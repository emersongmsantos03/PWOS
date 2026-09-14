import { expect, it } from "vitest";
import { portfolioMetrics } from "./portfolioMetrics";
const campaign = { currency: "BRL", spend: 100, impressions: 1000, clicks: 100, leads: 10, conversations: 0, reach: 500, dailyBudget: 20, lifetimeBudget: 500, remainingBudget: 400 };
it("calculates accumulated rates from totals instead of averaging campaign rates", () => {
  const [total] = portfolioMetrics([campaign, { ...campaign, spend: 300, impressions: 9000, clicks: 100, leads: 30, remainingBudget: 200 }]);
  expect(total).toMatchObject({ spend: 400, clicks: 200, leads: 40, cpl: 10, ctr: 2, cpc: 2, cpm: 40, conversion: 20, dailyBudget: 40, remainingBudget: 600, balanceDays: 15 });
});
it("keeps currencies separate and unavailable balances unknown", () => {
  const totals = portfolioMetrics([campaign, { ...campaign, currency: "USD", remainingBudget: null }]);
  expect(totals).toHaveLength(2);
  expect(totals[1].remainingBudget).toBeNull();
  expect(totals[1].balanceDays).toBeNull();
});
it("handles zero delivery, mixed budget availability and conversation results", () => {
  const [total] = portfolioMetrics([{ ...campaign, spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, conversations: 5, lifetimeBudget: 0 }]);
  expect(total).toMatchObject({ results: 5, lifetimeBudget: null, ctr: null, cpc: null, cpm: null, conversion: null, frequency: null });
  expect(portfolioMetrics([])).toEqual([]);
});
