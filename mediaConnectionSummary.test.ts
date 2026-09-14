import { expect, it } from "vitest";
import { mediaConnectionSummary } from "./mediaConnectionSummary";

it("uses the Google synchronized data even without a legacy integration record", () => {
  expect(mediaConnectionSummary({ accounts: [{ id: "1" }, { id: "2" }], campaigns: [{ id: "3" }], syncedAt: "2026-09-04T11:48:49Z" }, true)).toEqual({ accountCount: 2, campaignCount: 1, lastSyncAt: "2026-09-04T11:48:49Z" });
});
it("reads Meta's nested cache and timestamp", () => {
  expect(mediaConnectionSummary({ payload: { accounts: [{}], campaigns: [] }, cachedAt: "2026-09-04" }, true)).toEqual({ accountCount: 1, campaignCount: 0, lastSyncAt: "2026-09-04" });
});
it("distinguishes missing synchronization from a successful empty result", () => {
  for (const cache of [null, {}, { accounts: [] }, { payload: {} }]) expect(mediaConnectionSummary(cache, true).accountCount).toBeNull();
  expect(mediaConnectionSummary({ accounts: [], campaigns: [] }, true).accountCount).toBe(0);
});

it("hides historical counts and dates when a platform is disconnected", () => {
  for (const cache of [
    { accounts: [{}], campaigns: [{}], syncedAt: "2026-09-04" },
    { payload: { accounts: [{}], campaigns: [{}] }, cachedAt: "2026-09-04" },
    null,
  ]) expect(mediaConnectionSummary(cache, false)).toEqual({ accountCount: 0, campaignCount: 0, lastSyncAt: null });
});
it("does not delete the historical cache on disconnect", () => {
  const cache = { accounts: [{}], campaigns: [{}], syncedAt: "2026-09-04" };
  mediaConnectionSummary(cache, false);
  expect(mediaConnectionSummary(cache, true)).toEqual({ accountCount: 1, campaignCount: 1, lastSyncAt: "2026-09-04" });
});
