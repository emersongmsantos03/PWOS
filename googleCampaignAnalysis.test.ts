import { describe, expect, it } from "vitest";
import {
  buildAgeRanges,
  buildChangeHistory,
  buildConversionActions,
  buildScheduleBreakdowns,
  collectGoogleCampaignAnalysis,
  mergeCampaignAnalysis,
} from "./googleCampaignAnalysis";

const change = (event: Record<string, unknown>) => ({ changeEvent: { clientType: "GOOGLE_ADS_WEB_CLIENT", ...event } });

describe("googleCampaignAnalysis — quebras", () => {
  it("soma conversões por ação, ignora ações sem conversão e ordena da maior para a menor", () => {
    const result = buildConversionActions([
      { campaign: { id: "1" }, segments: { conversionActionName: "WhatsApp Rodapé" }, metrics: { conversions: 6 } },
      { campaign: { id: "1" }, segments: { conversionActionName: "WhatsApp Topo" }, metrics: { conversions: 10 } },
      { campaign: { id: "1" }, segments: { conversionActionName: "WhatsApp Topo" }, metrics: { conversions: 8 } },
      { campaign: { id: "1" }, segments: { conversionActionName: "Ligação" }, metrics: { conversions: 0 } },
      { campaign: { id: "2" }, segments: { conversionActionName: "Formulário" }, metrics: { conversions: 0 } },
    ]);
    expect(result.get("1")).toEqual([{ name: "WhatsApp Topo", conversions: 18 }, { name: "WhatsApp Rodapé", conversions: 6 }]);
    expect(result.has("2")).toBe(false);
  });

  it("separa dispositivo, dia da semana e horário a partir da mesma consulta", () => {
    const result = buildScheduleBreakdowns([
      { campaign: { id: "1" }, segments: { device: "MOBILE", dayOfWeek: "MONDAY", hour: 9 }, metrics: { clicks: "10", conversions: 1 } },
      { campaign: { id: "1" }, segments: { device: "MOBILE", dayOfWeek: "SATURDAY", hour: 16 }, metrics: { clicks: "5", conversions: 2.5 } },
      { campaign: { id: "1" }, segments: { device: "DESKTOP", dayOfWeek: "MONDAY", hour: 9 }, metrics: { clicks: "3", conversions: 0 } },
    ]).get("1")!;
    expect(result.byDevice).toEqual([{ device: "MOBILE", clicks: 15, conversions: 3.5 }, { device: "DESKTOP", clicks: 3, conversions: 0 }]);
    expect(result.byDayOfWeek).toHaveLength(7);
    expect(result.byDayOfWeek[0]).toEqual({ day: "MONDAY", clicks: 13, conversions: 1 });
    expect(result.byDayOfWeek[5]).toEqual({ day: "SATURDAY", clicks: 5, conversions: 2.5 });
    expect(result.byDayOfWeek[6]).toEqual({ day: "SUNDAY", clicks: 0, conversions: 0 });
    expect(result.byHour).toHaveLength(24);
    expect(result.byHour[9]).toEqual({ hour: 9, clicks: 13, conversions: 1 });
    expect(result.byHour[16]).toEqual({ hour: 16, clicks: 5, conversions: 2.5 });
  });

  it("monta faixas de idade em ordem e descarta faixas sem cliques nem conversões", () => {
    const result = buildAgeRanges([
      { campaign: { id: "1" }, adGroupCriterion: { ageRange: { type: "AGE_RANGE_35_44" } }, metrics: { clicks: "4", conversions: 1 } },
      { campaign: { id: "1" }, adGroupCriterion: { ageRange: { type: "AGE_RANGE_25_34" } }, metrics: { clicks: "9", conversions: 17 } },
      { campaign: { id: "1" }, adGroupCriterion: { ageRange: { type: "AGE_RANGE_65_UP" } }, metrics: { clicks: "0", conversions: 0 } },
    ]);
    expect(result.get("1")).toEqual([
      { age: "AGE_RANGE_25_34", clicks: 9, conversions: 17 },
      { age: "AGE_RANGE_35_44", clicks: 4, conversions: 1 },
    ]);
  });
});

describe("googleCampaignAnalysis — histórico de alterações", () => {
  it("descreve aumento de orçamento e liga o orçamento às campanhas que o usam", () => {
    const result = buildChangeHistory([
      change({
        changeDateTime: "2026-10-07 10:00:00.000", changeResourceType: "CAMPAIGN_BUDGET", resourceChangeOperation: "UPDATE",
        changeResourceName: "customers/1/campaignBudgets/50", changedFields: "amountMicros", userEmail: "priscila@agencia.com",
        oldResource: { campaignBudget: { amountMicros: "100000000" } }, newResource: { campaignBudget: { amountMicros: "120000000" } },
      }),
    ], new Map([["customers/1/campaignBudgets/50", ["7", "8"]]]));
    const expected = [{ date: "2026-10-07", action: "Aumento de orçamento: R$ 100,00 → R$ 120,00 (+20%)", user: "priscila" }];
    expect(result.get("7")).toEqual(expected);
    expect(result.get("8")).toEqual(expected);
  });

  it("mostra pausa da campanha, agrupa palavras-chave do mesmo dia e usa a origem quando não há e-mail", () => {
    const keyword = (text: string) => change({
      changeDateTime: "2026-10-05 09:00:00", changeResourceType: "AD_GROUP_CRITERION", resourceChangeOperation: "CREATE",
      campaign: "customers/1/campaigns/7", userEmail: "ana@pw.com", newResource: { adGroupCriterion: { keyword: { text } } },
    });
    const result = buildChangeHistory([
      keyword("colchão casal"), keyword("colchão queen"),
      change({ changeDateTime: "2026-10-06 18:00:00", changeResourceType: "CAMPAIGN", resourceChangeOperation: "UPDATE", changeResourceName: "customers/1/campaigns/7", changedFields: "status", newResource: { campaign: { status: "PAUSED" } }, clientType: "GOOGLE_ADS_AUTOMATED_RULE" }),
      change({ changeDateTime: "2026-10-04 08:00:00", changeResourceType: "AD_GROUP_CRITERION", resourceChangeOperation: "CREATE", campaign: "customers/1/campaigns/7", userEmail: "ana@pw.com", newResource: { adGroupCriterion: { keyword: { text: "colchão solteiro" }, negative: true } } }),
    ], new Map());
    expect(result.get("7")).toEqual([
      { date: "2026-10-06", action: "Campanha pausada", user: "Regra automática" },
      { date: "2026-10-05", action: "Palavras-chave adicionadas (2x)", user: "ana" },
      { date: "2026-10-04", action: 'Palavra-chave negativa adicionada: "colchão solteiro"', user: "ana" },
    ]);
  });

  it("lista os campos alterados quando não há descrição específica", () => {
    const result = buildChangeHistory([
      change({ changeDateTime: "2026-10-05 09:00:00", changeResourceType: "CAMPAIGN", resourceChangeOperation: "UPDATE", campaign: "customers/1/campaigns/7", changedFields: "targetCpa.targetCpaMicros,name", userEmail: "ana@pw.com" }),
    ], new Map());
    expect(result.get("7")![0].action).toBe("Campanha alterada: CPA desejado, nome");
  });
});

describe("googleCampaignAnalysis — coleta", () => {
  it("segue com as demais consultas quando uma falha e só busca o vínculo de orçamento se precisar", async () => {
    const queries: string[] = [];
    const search = async (_customer: string, _login: string, query: string) => {
      queries.push(query);
      if (query.includes("conversion_action_name")) return [{ campaign: { id: "1" }, segments: { conversionActionName: "WhatsApp Topo" }, metrics: { conversions: 3 } }];
      if (query.includes("income_range_view")) throw new Error("not supported");
      return [];
    };
    const result = await collectGoogleCampaignAnalysis(search, { id: "111", loginCustomerId: "900" }, "2026-09-29", "2026-10-28", "2026-10-28");
    expect(result.get("1")).toEqual({ conversionActions: [{ name: "WhatsApp Topo", conversions: 3 }] });
    expect(queries).toHaveLength(5);
    expect(queries.some((query) => query.includes("campaign.campaign_budget"))).toBe(false);
    expect(queries.at(-1)).toContain("change_event.change_date_time >= '2026-09-29'");
  });

  it("limita o histórico de alterações aos últimos 30 dias", async () => {
    const queries: string[] = [];
    await collectGoogleCampaignAnalysis(async (_c, _l, query) => { queries.push(query); return []; }, { id: "111", loginCustomerId: "900" }, "2026-01-01", "2026-10-28", "2026-10-28");
    expect(queries.at(-1)).toContain("change_event.change_date_time >= '2026-09-29'");
    queries.length = 0;
    await collectGoogleCampaignAnalysis(async (_c, _l, query) => { queries.push(query); return []; }, { id: "111", loginCustomerId: "900" }, "2026-01-01", "2026-01-31", "2026-10-28");
    expect(queries.some((query) => query.includes("change_event"))).toBe(false);
  });

  it("mantém o que já estava salvo nos campos que não vieram na coleta", () => {
    const merged = mergeCampaignAnalysis({ byDevice: [{ device: "MOBILE", clicks: 1, conversions: 0 }] }, { conversionActions: [{ name: "Ligação", conversions: 2 }] });
    expect(merged.byDevice).toHaveLength(1);
    expect(merged.conversionActions).toEqual([{ name: "Ligação", conversions: 2 }]);
    expect(merged.changeHistory).toEqual([]);
  });
});
