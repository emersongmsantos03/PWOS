// Histórico diário do Google Ads.
//
// Cada dia fica salvo separadamente (por conta e campanha). Qualquer período pedido
// pela tela é montado somando os dias já guardados, sem consultar o Google. A coleta
// das 04:00 só precisa buscar os dias recentes, que ainda podem mudar, e completar
// eventuais dias que faltem.
import { addDays } from "./mediaFreshness";

// [custo em micros, impressões, cliques, conversões,
//  parcela de impressões no topo (0-1) ou null, parcela no topo absoluto (0-1) ou null]
export type GoogleDayRow = [number, number, number, number, number | null, number | null];

export type GoogleAccountMeta = {
  id: string;
  name: string;
  currency: string;
  loginCustomerId: string;
  remainingBudget: number | null;
};

export type GoogleCampaignMeta = {
  id: string;
  accountId: string;
  client: string;
  currency: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: number;
  remainingBudget: number | null;
  optimizationStatus: string | null;
  optimizationHistory?: Array<{ value: string; capturedAt: string }>;
  landingPageUrl?: string | null;
  landingPageStatus?: string;
  geography?: Array<Record<string, unknown>>;
  searchTerms?: Array<Record<string, unknown>>;
  ads?: Array<Record<string, unknown>>;
};

export type GoogleDailyStore = {
  version: 1;
  // Primeiro dia que a coleta se comprometeu a cobrir.
  backfillFrom: string | null;
  // Dia -> instante da última coleta bem-sucedida de todas as contas naquele dia.
  syncedDays: Record<string, string>;
  // Dia -> "contaId:campanhaId" -> métricas. Dias sem veiculação não têm entrada.
  days: Record<string, Record<string, GoogleDayRow>>;
  accounts: Record<string, GoogleAccountMeta>;
  campaigns: Record<string, GoogleCampaignMeta>;
  lastSyncedAt: string | null;
  quotaBlockedUntil: string | null;
};

export const emptyGoogleDailyStore = (): GoogleDailyStore => ({
  version: 1,
  backfillFrom: null,
  syncedDays: {},
  days: {},
  accounts: {},
  campaigns: {},
  lastSyncedAt: null,
  quotaBlockedUntil: null,
});

export const googleCampaignKey = (accountId: string, campaignId: string) => `${accountId}:${campaignId}`;

// Lista os dias de `since` a `until`, inclusive. Datas AAAA-MM-DD.
export const dayRange = (since: string, until: string) => {
  const days: string[] = [];
  for (let day = since; day <= until && days.length < 4000; day = addDays(day, 1)) days.push(day);
  return days;
};

// Um período só é servido a partir do histórico se todos os dias já encerrados dele
// foram coletados. O dia de hoje pode ainda não ter sido coletado (antes das 04:00),
// e nesse caso simplesmente aparece sem números.
export const coversPeriod = (store: GoogleDailyStore, since: string, until: string, today: string) => {
  if (!store.backfillFrom || since < store.backfillFrom || since > until) return false;
  const lastClosedDay = until < today ? until : addDays(today, -1);
  return dayRange(since, lastClosedDay).every((day) => !!store.syncedDays[day]);
};

export type SyncRange = { since: string; until: string };

// Decide o que a próxima coleta precisa buscar: a janela recente (que ainda se
// ajusta), mais qualquer dia que falte desde o início do histórico. Dias contíguos
// viram um único intervalo, dividido em blocos para não sobrecarregar cada consulta.
export const planSyncRanges = (input: {
  store: GoogleDailyStore;
  today: string;
  backfillDays: number;
  reconcileDays: number;
  chunkDays: number;
}): SyncRange[] => {
  const { store, today, backfillDays, reconcileDays, chunkDays } = input;
  const desiredFrom = addDays(today, -(backfillDays - 1));
  const from = store.backfillFrom && store.backfillFrom < desiredFrom ? store.backfillFrom : desiredFrom;
  const needed = new Set<string>(dayRange(addDays(today, -(reconcileDays - 1)), today));
  dayRange(from, today).forEach((day) => { if (!store.syncedDays[day]) needed.add(day); });
  const sorted = [...needed].sort();
  const ranges: SyncRange[] = [];
  let start = "", previous = "", length = 0;
  const close = () => { if (start) ranges.push({ since: start, until: previous }); };
  for (const day of sorted) {
    if (start && addDays(previous, 1) === day && length < chunkDays) { previous = day; length += 1; continue; }
    close();
    start = day; previous = day; length = 1;
  }
  close();
  // Os dias mais recentes primeiro: se a coleta for interrompida, o que a tela mais usa já está salvo.
  return ranges.reverse();
};

// Substitui as métricas de uma conta no intervalo pelas recém-coletadas.
export const applyDailyRows = (
  store: GoogleDailyStore,
  accountId: string,
  since: string,
  until: string,
  rows: Array<{ day: string; campaignId: string; row: GoogleDayRow }>,
) => {
  const prefix = `${accountId}:`;
  for (const day of dayRange(since, until)) {
    const entries = store.days[day];
    if (!entries) continue;
    for (const key of Object.keys(entries)) if (key.startsWith(prefix)) delete entries[key];
    if (!Object.keys(entries).length) delete store.days[day];
  }
  for (const { day, campaignId, row } of rows) {
    (store.days[day] ||= {})[googleCampaignKey(accountId, campaignId)] = row;
  }
};

export const markDaysSynced = (store: GoogleDailyStore, since: string, until: string, syncedAt: string) => {
  for (const day of dayRange(since, until)) store.syncedDays[day] = syncedAt;
  if (!store.backfillFrom || since < store.backfillFrom) store.backfillFrom = since;
};

// Monta a resposta de um período no mesmo formato que a tela já consome.
export const buildGooglePeriod = (store: GoogleDailyStore, since: string, until: string) => {
  type Total = { cost: number; impressions: number; clicks: number; conversions: number; topSum: number; topWeight: number; absSum: number; absWeight: number };
  const totals = new Map<string, Total>();
  for (const day of dayRange(since, until)) {
    const entries = store.days[day];
    if (!entries) continue;
    for (const [key, [cost, impressions, clicks, conversions, top, absoluteTop]] of Object.entries(entries)) {
      const total = totals.get(key) || { cost: 0, impressions: 0, clicks: 0, conversions: 0, topSum: 0, topWeight: 0, absSum: 0, absWeight: 0 };
      total.cost += cost; total.impressions += impressions; total.clicks += clicks; total.conversions += conversions;
      // Parcelas de impressão são razões: o período usa a média ponderada pelas impressões de cada dia.
      if (top != null) { total.topSum += top * impressions; total.topWeight += impressions; }
      if (absoluteTop != null) { total.absSum += absoluteTop * impressions; total.absWeight += impressions; }
      totals.set(key, total);
    }
  }
  const percent = (value: number) => (value * 100).toFixed(1);
  const spendByAccount = new Map<string, number>();
  const campaigns = Object.entries(store.campaigns).map(([key, meta]) => {
    const total = totals.get(key);
    const spend = (total?.cost || 0) / 1_000_000, conversions = total?.conversions || 0;
    spendByAccount.set(meta.accountId, (spendByAccount.get(meta.accountId) || 0) + spend);
    return {
      id: meta.id,
      accountId: `google_${meta.accountId}`,
      client: meta.client,
      currency: meta.currency,
      name: meta.name,
      objective: meta.objective,
      status: meta.status,
      dailyBudget: meta.dailyBudget,
      lifetimeBudget: 0,
      remainingBudget: meta.remainingBudget,
      spend,
      // Alcance e frequência não somam entre dias; ficam indisponíveis, como já ocorre
      // nos tipos de campanha em que o Google não os fornece.
      reach: -1,
      impressions: total?.impressions || 0,
      clicks: total?.clicks || 0,
      leads: conversions,
      conversations: 0,
      cpl: conversions ? spend / conversions : null,
      frequency: -1,
      auctionPosition: total && total.absWeight > 0
        ? `${percent(total.absSum / total.absWeight)}% no topo absoluto`
        : total && total.topWeight > 0
          ? `${percent(total.topSum / total.topWeight)}% no topo`
          : null,
      optimizationStatus: meta.optimizationStatus,
      optimizationHistory: meta.optimizationHistory || [],
      landingPageStatus: meta.landingPageStatus || "UNKNOWN",
      landingPageUrl: meta.landingPageUrl ?? null,
      geography: meta.geography || [],
      searchTerms: meta.searchTerms || [],
      ads: meta.ads || [],
    };
  });
  const accounts = Object.values(store.accounts).map((account) => ({
    id: `google_${account.id}`,
    name: account.name,
    businessPortfolioId: null,
    pageName: account.name,
    profilePictureUrl: null,
    currency: account.currency,
    amountSpent: spendByAccount.get(account.id) || 0,
    spendCap: 0,
    remainingBudget: account.remainingBudget,
  }));
  return { schemaVersion: 11, since, until, syncedAt: store.lastSyncedAt || new Date(0).toISOString(), accounts, campaigns };
};

// Erros da API do Google separados por como a coleta deve reagir.
export class GoogleApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "GoogleApiError"; }
}
export class GoogleQuotaError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) { super(message); this.name = "GoogleQuotaError"; }
}

// "Too many requests. Retry in 55973 seconds." -> 55973
export const parseGoogleRetryAfterSeconds = (message: string) => {
  const seconds = Number(/retry in (\d+)\s*seconds?/i.exec(message)?.[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

// Erros 4xx (exceto limite de taxa e timeout) são permanentes para aquela conta, como
// permissão negada ou conta desativada; não devem impedir o resto da coleta.
export const isPermanentGoogleAccountError = (error: unknown) =>
  error instanceof GoogleApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;

export const googleQuotaBlockedMessage = (blockedUntilIso: string) => {
  const until = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(blockedUntilIso));
  return `O Google Ads bloqueou novas consultas até ${until.replace(",", " às")} (cota diária da API esgotada). Os dados já salvos continuam disponíveis.`;
};
