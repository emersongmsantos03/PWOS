export type Platform = "Google Ads" | "Meta Ads";
export type Health = "Saudável" | "Atenção" | "Em risco";

export const campaigns = [
  { id: "solar", client: "Solar Prime", campaign: "Captação Solar | Sul", platform: "Google Ads" as Platform, status: "Saudável" as Health, owner: "Lucas Andrade", budget: 24000, spend: 16420, impressions: 284300, clicks: 8450, ctr: 2.97, cpc: 1.94, conversions: 328, cpa: 50.06, change: 12.4 },
  { id: "vivaz", client: "Vivaz Urbanismo", campaign: "Lançamento Aurora", platform: "Meta Ads" as Platform, status: "Atenção" as Health, owner: "Marina Costa", budget: 18000, spend: 13980, impressions: 742100, clicks: 9760, ctr: 1.32, cpc: 1.43, conversions: 181, cpa: 77.24, change: -6.8 },
  { id: "norte", client: "Norte Clinic", campaign: "Consultas Curitiba", platform: "Google Ads" as Platform, status: "Em risco" as Health, owner: "Lucas Andrade", budget: 12000, spend: 10890, impressions: 119800, clicks: 3210, ctr: 2.68, cpc: 3.39, conversions: 82, cpa: 132.80, change: -18.2 },
  { id: "linx", client: "Linx Academy", campaign: "Matrículas 2026", platform: "Meta Ads" as Platform, status: "Saudável" as Health, owner: "Rafael Lima", budget: 15500, spend: 9210, impressions: 531200, clicks: 11040, ctr: 2.08, cpc: .83, conversions: 267, cpa: 34.49, change: 21.1 },
];

export const clients = [
  { name: "Solar Prime", status: "Saudável", channels: "Google • Meta", owner: "Lucas", next: "Reunião hoje, 15h", note: "Novo criativo aprovado" },
  { name: "Vivaz Urbanismo", status: "Atenção", channels: "Meta • LP", owner: "Marina", next: "Revisar segmentação", note: "CPA subiu 9%" },
  { name: "Norte Clinic", status: "Em risco", channels: "Google • LP", owner: "Lucas", next: "Otimizar agora", note: "Saldo para 3 dias" },
  { name: "Linx Academy", status: "Saudável", channels: "Google • Meta", owner: "Rafael", next: "Relatório sexta", note: "Meta superada" },
];

export const trend = [
  { day: "01 jul", atual: 42, anterior: 36 }, { day: "05 jul", atual: 58, anterior: 44 },
  { day: "09 jul", atual: 54, anterior: 49 }, { day: "13 jul", atual: 71, anterior: 53 },
  { day: "17 jul", atual: 67, anterior: 59 }, { day: "21 jul", atual: 86, anterior: 62 },
  { day: "25 jul", atual: 92, anterior: 70 }, { day: "28 jul", atual: 108, anterior: 74 },
];
