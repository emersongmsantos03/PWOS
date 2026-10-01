// Regras de validade do cache compartilhado de mídia.
//
// A coleta acontece três vezes por dia (08:00, 13:00 e 16:00 em São Paulo). Ler a
// tela nunca aciona o Google/Meta: o snapshot salvo é sempre entregue e só esta
// regra diz se ele ainda é o dado atual ou se aguarda a próxima coleta.
// O Brasil não adota horário de verão desde 2019, então o fuso é UTC-3 fixo.
export const SYNC_HOURS = [8, 13, 16] as const;
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

const syncMoment = (day: string, hour: number) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:00:00${SAO_PAULO_OFFSET}`);

// Momento da coleta agendada mais recente que já deveria ter acontecido.
export const lastSyncBoundary = (now: Date) => {
  const today = saoPauloDay(now);
  for (const hour of [...SYNC_HOURS].reverse()) {
    const boundary = syncMoment(today, hour);
    if (now.getTime() >= boundary.getTime()) return boundary;
  }
  return syncMoment(addDays(today, -1), SYNC_HOURS[SYNC_HOURS.length - 1]);
};

// Identificador do horário de coleta em vigor ("AAAA-MM-DD 08"), ou null antes da
// primeira coleta do dia.
export const currentSyncSlot = (now: Date) => {
  const today = saoPauloDay(now), boundary = lastSyncBoundary(now);
  if (saoPauloDay(boundary) !== today) return null;
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(boundary));
  return { day: today, hour, id: `${today} ${String(hour).padStart(2, "0")}` };
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
    return syncedAt >= syncMoment(addDays(snapshot.until, 1), SYNC_HOURS[0]).getTime();
  // Período que inclui hoje: vale até a próxima coleta agendada.
  return syncedAt >= lastSyncBoundary(now).getTime();
};
