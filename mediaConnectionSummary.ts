export function mediaConnectionSummary(cache: unknown, connected: boolean) {
  if (!connected) return { accountCount: 0, campaignCount: 0, lastSyncAt: null };
  const empty = { accountCount: null, campaignCount: null, lastSyncAt: null };
  if (!cache || typeof cache !== "object") return empty;
  const outer = cache as Record<string, unknown>;
  const data = (outer.payload && typeof outer.payload === "object" ? outer.payload : outer) as Record<string, unknown>;
  if (!Array.isArray(data.accounts) || !Array.isArray(data.campaigns)) return empty;
  return {
    accountCount: data.accounts.length,
    campaignCount: data.campaigns.length,
    lastSyncAt: typeof data.syncedAt === "string" ? data.syncedAt : typeof outer.cachedAt === "string" ? outer.cachedAt : null,
  };
}
