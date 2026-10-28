import { describe, expect, it } from "vitest";
import {
  GoogleApiError,
  applyDailyRows,
  buildGooglePeriod,
  coversPeriod,
  dayRange,
  emptyGoogleDailyStore,
  googleQuotaBlockedMessage,
  isPermanentGoogleAccountError,
  markDaysSynced,
  parseGoogleRetryAfterSeconds,
  planSyncRanges,
  type GoogleDayRow,
} from "./googleDailyStore";

const row = (cost: number, impressions = 0, clicks = 0, conversions = 0, top: number | null = null, absolute: number | null = null): GoogleDayRow =>
  [cost * 1_000_000, impressions, clicks, conversions, top, absolute];

const storeWithCampaign = () => {
  const store = emptyGoogleDailyStore();
  store.accounts["111"] = { id: "111", name: "Conta A", currency: "BRL", loginCustomerId: "900", remainingBudget: 50 };
  store.campaigns["111:1"] = { id: "1", accountId: "111", client: "Conta A", currency: "BRL", name: "Camp 1", objective: "SEARCH", status: "ACTIVE", dailyBudget: 10, remainingBudget: null, optimizationStatus: "80% otimizada" };
  store.campaigns["111:2"] = { id: "2", accountId: "111", client: "Conta A", currency: "BRL", name: "Camp 2 pausada", objective: "SEARCH", status: "PAUSED", dailyBudget: 0, remainingBudget: null, optimizationStatus: null };
  return store;
};

describe("googleDailyStore — períodos", () => {
  it("lista dias inclusive e atravessa virada de mês", () => {
    expect(dayRange("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(dayRange("2026-09-02", "2026-09-01")).toEqual([]);
  });

  it("soma os dias do período e ignora os de fora", () => {
    const store = storeWithCampaign();
    applyDailyRows(store, "111", "2026-09-01", "2026-09-05", [
      { day: "2026-09-01", campaignId: "1", row: row(10, 100, 5, 1) },
      { day: "2026-09-02", campaignId: "1", row: row(20, 200, 10, 2) },
      { day: "2026-09-05", campaignId: "1", row: row(99, 999, 99, 9) },
    ]);
    const period = buildGooglePeriod(store, "2026-09-01", "2026-09-04");
    const campaign = period.campaigns.find((item) => item.id === "1")!;
    expect(campaign.spend).toBe(30);
    expect(campaign.impressions).toBe(300);
    expect(campaign.clicks).toBe(15);
    expect(campaign.leads).toBe(3);
    expect(campaign.cpl).toBe(10);
    expect(period.accounts[0].amountSpent).toBe(30);
    // Todas as campanhas aparecem, inclusive as sem veiculação no período.
    expect(period.campaigns).toHaveLength(2);
    expect(period.campaigns.find((item) => item.id === "2")!.spend).toBe(0);
    expect(period.campaigns.find((item) => item.id === "2")!.cpl).toBeNull();
  });

  it("dois períodos diferentes saem do mesmo histórico, sem nova coleta", () => {
    const store = storeWithCampaign();
    applyDailyRows(store, "111", "2026-09-01", "2026-09-03", [
      { day: "2026-09-01", campaignId: "1", row: row(1) },
      { day: "2026-09-02", campaignId: "1", row: row(2) },
      { day: "2026-09-03", campaignId: "1", row: row(4) },
    ]);
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-01").campaigns[0].spend).toBe(1);
    expect(buildGooglePeriod(store, "2026-09-02", "2026-09-03").campaigns[0].spend).toBe(6);
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-03").campaigns[0].spend).toBe(7);
  });

  it("alcance e frequência ficam indisponíveis, pois não somam entre dias", () => {
    const store = storeWithCampaign();
    const campaign = buildGooglePeriod(store, "2026-09-01", "2026-09-02").campaigns[0];
    expect(campaign.reach).toBe(-1);
    expect(campaign.frequency).toBe(-1);
    expect(campaign.accountId).toBe("google_111");
  });

  it("parcela de topo do período é a média ponderada pelas impressões", () => {
    const store = storeWithCampaign();
    applyDailyRows(store, "111", "2026-09-01", "2026-09-02", [
      { day: "2026-09-01", campaignId: "1", row: row(1, 100, 0, 0, 0.5, null) },
      { day: "2026-09-02", campaignId: "1", row: row(1, 300, 0, 0, 0.1, null) },
    ]);
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-02").campaigns[0].auctionPosition).toBe("20.0% no topo");
    applyDailyRows(store, "111", "2026-09-01", "2026-09-02", [
      { day: "2026-09-01", campaignId: "1", row: row(1, 100, 0, 0, 0.5, 0.4) },
    ]);
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-02").campaigns[0].auctionPosition).toBe("40.0% no topo absoluto");
  });

  it("expõe as três parcelas de impressão como fração e não inventa a geral em dias antigos", () => {
    const store = storeWithCampaign();
    applyDailyRows(store, "111", "2026-09-01", "2026-09-02", [
      { day: "2026-09-01", campaignId: "1", row: [1_000_000, 100, 0, 0, 0.5, 0.4, 0.9] },
      { day: "2026-09-02", campaignId: "1", row: [1_000_000, 300, 0, 0, 0.1, null, 0.5] },
    ]);
    const campaign = buildGooglePeriod(store, "2026-09-01", "2026-09-02").campaigns[0];
    expect(campaign.searchImpressionShare).toBe(0.6);
    expect(campaign.searchTopImpressionShare).toBe(0.2);
    expect(campaign.searchAbsoluteTopImpressionShare).toBe(0.4);
    // Um dia salvo antes da parcela geral existir deixa o período sem ela.
    applyDailyRows(store, "111", "2026-09-03", "2026-09-03", [{ day: "2026-09-03", campaignId: "1", row: row(1, 100, 0, 0, 0.5, 0.4) }]);
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-03").campaigns[0].searchImpressionShare).toBeNull();
    expect(buildGooglePeriod(store, "2026-09-01", "2026-09-03").campaigns[1].searchImpressionShare).toBeNull();
  });

  it("devolve as quebras da análise salvas na campanha, ou listas vazias", () => {
    const store = storeWithCampaign();
    store.campaigns["111:1"].conversionActions = [{ name: "WhatsApp Topo", conversions: 18 }];
    store.campaigns["111:1"].analysisPeriod = { since: "2026-08-04", until: "2026-09-02" };
    const [first, second] = buildGooglePeriod(store, "2026-09-01", "2026-09-02").campaigns;
    expect(first.conversionActions).toEqual([{ name: "WhatsApp Topo", conversions: 18 }]);
    expect(first.analysisPeriod).toEqual({ since: "2026-08-04", until: "2026-09-02" });
    expect(second.byDevice).toEqual([]);
    expect(second.changeHistory).toEqual([]);
    expect(second.analysisPeriod).toBeNull();
  });

  it("recoletar um intervalo substitui os números da conta sem tocar em outras contas", () => {
    const store = storeWithCampaign();
    store.campaigns["222:9"] = { ...store.campaigns["111:1"], id: "9", accountId: "222" };
    applyDailyRows(store, "111", "2026-09-01", "2026-09-01", [{ day: "2026-09-01", campaignId: "1", row: row(10) }]);
    applyDailyRows(store, "222", "2026-09-01", "2026-09-01", [{ day: "2026-09-01", campaignId: "9", row: row(5) }]);
    applyDailyRows(store, "111", "2026-09-01", "2026-09-01", [{ day: "2026-09-01", campaignId: "1", row: row(12) }]);
    const period = buildGooglePeriod(store, "2026-09-01", "2026-09-01");
    expect(period.campaigns.find((item) => item.id === "1")!.spend).toBe(12);
    expect(period.campaigns.find((item) => item.id === "9")!.spend).toBe(5);
  });
});

describe("googleDailyStore — cobertura", () => {
  const today = "2026-09-21";

  it("sem histórico nada é coberto", () => {
    expect(coversPeriod(emptyGoogleDailyStore(), "2026-09-01", "2026-09-10", today)).toBe(false);
  });

  it("cobre o período quando todos os dias encerrados foram coletados", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-09-01", "2026-09-20", "2026-09-21T07:00:00Z");
    expect(coversPeriod(store, "2026-09-01", "2026-09-20", today)).toBe(true);
    // Inclui hoje, ainda não coletado (antes das 04:00): continua coberto.
    expect(coversPeriod(store, "2026-09-10", "2026-09-21", today)).toBe(true);
    // Só hoje.
    expect(coversPeriod(store, "2026-09-21", "2026-09-21", today)).toBe(true);
  });

  it("um dia faltando no meio ou antes do início do histórico impede a cobertura", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-09-01", "2026-09-10", "x");
    markDaysSynced(store, "2026-09-12", "2026-09-20", "x");
    expect(coversPeriod(store, "2026-09-01", "2026-09-20", today)).toBe(false);
    expect(coversPeriod(store, "2026-09-12", "2026-09-20", today)).toBe(true);
    expect(coversPeriod(store, "2026-08-31", "2026-09-05", today)).toBe(false);
  });

  it("período invertido não é coberto", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-09-01", "2026-09-20", "x");
    expect(coversPeriod(store, "2026-09-10", "2026-09-05", today)).toBe(false);
  });
});

describe("googleDailyStore — plano de coleta", () => {
  const today = "2026-09-21";
  const plan = (store = emptyGoogleDailyStore(), overrides = {}) =>
    planSyncRanges({ store, today, backfillDays: 90, reconcileDays: 7, chunkDays: 31, ...overrides });

  it("primeira execução busca todo o histórico em blocos de até 31 dias, do mais recente ao mais antigo", () => {
    const ranges = plan();
    expect(ranges[0].until).toBe(today);
    expect(ranges.at(-1)!.since).toBe("2026-06-24");
    expect(ranges.every((range) => dayRange(range.since, range.until).length <= 31)).toBe(true);
    // Sem buracos nem sobreposição.
    const covered = ranges.flatMap((range) => dayRange(range.since, range.until));
    expect(new Set(covered).size).toBe(covered.length);
    expect(covered).toHaveLength(90);
  });

  it("com o histórico completo, busca apenas a janela recente", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-06-24", "2026-09-21", "x");
    expect(plan(store)).toEqual([{ since: "2026-09-15", until: "2026-09-21" }]);
    expect(plan(store, { reconcileDays: 3 })).toEqual([{ since: "2026-09-19", until: "2026-09-21" }]);
  });

  it("completa dias que faltam no meio junto com a janela recente", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-06-24", "2026-09-21", "x");
    delete store.syncedDays["2026-08-10"];
    delete store.syncedDays["2026-08-11"];
    const ranges = plan(store);
    expect(ranges).toContainEqual({ since: "2026-08-10", until: "2026-08-11" });
    expect(ranges).toContainEqual({ since: "2026-09-15", until: "2026-09-21" });
  });

  it("aumentar o histórico desejado busca apenas os dias mais antigos que faltam", () => {
    const store = emptyGoogleDailyStore();
    markDaysSynced(store, "2026-06-24", "2026-09-21", "x");
    const ranges = plan(store, { backfillDays: 120 });
    const covered = ranges.flatMap((range) => dayRange(range.since, range.until));
    expect(covered).toContain("2026-05-25");
    expect(covered).not.toContain("2026-05-24");
    expect(covered).not.toContain("2026-07-01");
  });
});

describe("googleDailyStore — erros e cota", () => {
  it("lê o tempo de espera informado pelo Google", () => {
    expect(parseGoogleRetryAfterSeconds("Too many requests. Retry in 55973 seconds.")).toBe(55973);
    expect(parseGoogleRetryAfterSeconds("retry in 1 second")).toBe(1);
    expect(parseGoogleRetryAfterSeconds("Erro qualquer")).toBeNull();
  });

  it("erros 4xx permanentes não travam a coleta; limite de taxa e falhas de rede sim", () => {
    expect(isPermanentGoogleAccountError(new GoogleApiError("negado", 403))).toBe(true);
    expect(isPermanentGoogleAccountError(new GoogleApiError("conta desativada", 400))).toBe(true);
    expect(isPermanentGoogleAccountError(new GoogleApiError("limite", 429))).toBe(false);
    expect(isPermanentGoogleAccountError(new GoogleApiError("timeout", 408))).toBe(false);
    expect(isPermanentGoogleAccountError(new GoogleApiError("indisponível", 503))).toBe(false);
    expect(isPermanentGoogleAccountError(new Error("rede"))).toBe(false);
  });

  it("mensagem de bloqueio mostra o horário de São Paulo", () => {
    expect(googleQuotaBlockedMessage("2026-09-22T07:01:00Z")).toContain("22/09 às 04:01");
  });
});
