// Junta o histórico de análises gravado no disco com o que está em memória. Durante uma
// troca de versão, as duas revisões do servidor rodam juntas por alguns instantes: sem
// juntar, a que grava por último apagaria as análises feitas na outra.
type Entry = { action: string; createdAt: string; userId?: string; portfolioReviewId?: string };
type Verification<E extends Entry> = { verified: boolean; verifiedAt: string; verifiedBy: string; history?: E[] };

const entryKey = (entry: Entry) => `${entry.action}|${entry.createdAt}|${entry.userId || ""}|${entry.portfolioReviewId || ""}`;

export function mergeVerifications<E extends Entry>(target: Record<string, Verification<E>>, incoming: Record<string, Verification<E>>) {
  for (const [key, other] of Object.entries(incoming || {})) {
    const current = target[key];
    if (!current) { target[key] = other; continue; }
    const history = new Map<string, E>();
    [...(current.history || []), ...(other.history || [])].forEach((entry) => history.set(entryKey(entry), entry));
    const newer = String(other.verifiedAt || "") > String(current.verifiedAt || "") ? other : current;
    target[key] = {
      ...current,
      verified: current.verified || other.verified,
      verifiedAt: newer.verifiedAt,
      verifiedBy: newer.verifiedBy,
      history: [...history.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  }
  return target;
}

export function mergeById<T extends { id: string; createdAt: string }>(target: Record<string, T[]>, incoming: Record<string, T[]>) {
  for (const [key, list] of Object.entries(incoming || {})) {
    const byId = new Map((target[key] || []).map((item) => [item.id, item]));
    (list || []).forEach((item) => { if (!byId.has(item.id)) byId.set(item.id, item); });
    target[key] = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return target;
}
