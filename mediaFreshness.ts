// Regras de validade do cache compartilhado de mídia.
//
// A coleta acontece uma vez por dia, a partir das 04:00 em São Paulo. Ler a tela
// nunca aciona o Google/Meta: o snapshot salvo é sempre entregue e só esta regra
// diz se ele ainda é o "dado do dia" ou se aguarda a próxima coleta.
// O Brasil não adota horário de verão desde 2019, então o fuso é UTC-3 fixo.
export const DAILY_SYNC_HOUR = 4;
const SAO_PAULO_OFFSET = "-03:00";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const saoPauloDay = (date: Date) => dayFormatter.format(date);

export const addDays = (day: string, amount: number) => {
  const moment = new Date(`${day}T12:00:00${SAO_PAULO_OFFSET}`);
  moment.setUTCDate(moment.getUTCDate() + amount);
  return saoPauloDay(moment);
};

const dailySyncMoment = (day: string) =>
  new Date(`${day}T${String(DAILY_SYNC_HOUR).padStart(2, "0")}:00:00${SAO_PAULO_OFFSET}`);

// Momento da coleta diária mais recente que já deveria ter acontecido.
export const lastDailySyncBoundary = (now: Date) => {
  const today = saoPauloDay(now);
  const boundary = dailySyncMoment(today);
  return now.getTime() >= boundary.getTime() ? boundary : dailySyncMoment(addDays(today, -1));
};

export const isMediaSnapshotFresh = (
  snapshot: { syncedAt?: string; until: string },
  now: Date = new Date(),
) => {
  const syncedAt = new Date(snapshot.syncedAt || 0).getTime();
  if (!Number.isFinite(syncedAt) || syncedAt <= 0) return false;
  // Período encerrado: os números só ficam definitivos depois da primeira coleta
  // feita após o fechamento do último dia. Depois disso ele nunca mais expira.
  if (snapshot.until < saoPauloDay(now))
    return syncedAt >= dailySyncMoment(addDays(snapshot.until, 1)).getTime();
  // Período que inclui hoje: vale até a próxima coleta das 04:00.
  return syncedAt >= lastDailySyncBoundary(now).getTime();
};
