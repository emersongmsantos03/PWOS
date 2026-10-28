// Quebras da Análise da Campanha (PW Mídia): conversões por ação, dispositivo, dia da
// semana, horário, idade, faixa de renda e histórico de alterações. Tudo sai do próprio
// Google Ads, somado no período da coleta de detalhes e indexado pelo id da campanha.
//
// São de cinco a seis consultas por conta (dispositivo, dia e horário vêm juntos numa
// só), por isso a coleta diária as executa no máximo uma vez por dia em cada conta.
import { addDays } from "./mediaFreshness";

type Breakdown<K extends string, V> = Array<{ [key in K]: V } & { clicks: number; conversions: number }>;

export type CampaignAnalysis = {
  conversionActions: Array<{ name: string; conversions: number }>;
  byDevice: Breakdown<"device", string>;
  byDayOfWeek: Breakdown<"day", string>;
  byHour: Breakdown<"hour", number>;
  byAgeRange: Breakdown<"age", string>;
  byIncomeRange: Breakdown<"income", string>;
  changeHistory: Array<{ date: string; action: string; user: string | null }>;
};

export const campaignAnalysisFields = ["conversionActions", "byDevice", "byDayOfWeek", "byHour", "byAgeRange", "byIncomeRange", "changeHistory"] as const;

type SearchFn = (customerId: string, loginId: string, query: string) => Promise<Record<string, any>[]>;

const round = (value: number) => Math.round(value * 100) / 100;
const campaignIdOf = (row: Record<string, any>) => String(row.campaign?.id || "");

const weekDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

// Soma cliques e conversões por campanha e valor do segmento.
const sumBy = (rows: Record<string, any>[], segment: (row: Record<string, any>) => string | number | undefined) => {
  const result = new Map<string, Map<string | number, { clicks: number; conversions: number }>>();
  for (const row of rows) {
    const campaignId = campaignIdOf(row), key = segment(row);
    if (!campaignId || key == null || key === "") continue;
    const byKey = result.get(campaignId) || new Map(), current = byKey.get(key) || { clicks: 0, conversions: 0 };
    current.clicks += Number(row.metrics?.clicks || 0);
    current.conversions += Number(row.metrics?.conversions || 0);
    byKey.set(key, current);
    result.set(campaignId, byKey);
  }
  return result;
};

export const buildConversionActions = (rows: Record<string, any>[]) => {
  const result = new Map<string, CampaignAnalysis["conversionActions"]>();
  sumBy(rows, (row) => String(row.segments?.conversionActionName || "").trim()).forEach((byName, campaignId) => {
    const items = [...byName].filter(([, value]) => value.conversions > 0)
      .map(([name, value]) => ({ name: String(name), conversions: round(value.conversions) }))
      .sort((a, b) => b.conversions - a.conversions);
    if (items.length) result.set(campaignId, items);
  });
  return result;
};

// Dispositivo, dia da semana e horário vêm de uma única consulta; cada quebra soma as demais.
export const buildScheduleBreakdowns = (rows: Record<string, any>[]) => {
  const result = new Map<string, Pick<CampaignAnalysis, "byDevice" | "byDayOfWeek" | "byHour">>();
  const devices = sumBy(rows, (row) => row.segments?.device), days = sumBy(rows, (row) => row.segments?.dayOfWeek),
    hours = sumBy(rows, (row) => (row.segments?.hour == null ? undefined : Number(row.segments.hour)));
  const metric = (map: Map<string | number, { clicks: number; conversions: number }> | undefined, key: string | number) => {
    const value = map?.get(key);
    return { clicks: value?.clicks || 0, conversions: round(value?.conversions || 0) };
  };
  devices.forEach((byDevice, campaignId) => {
    result.set(campaignId, {
      byDevice: [...byDevice.keys()].map((device) => ({ device: String(device), ...metric(byDevice, device) }))
        .sort((a, b) => b.clicks - a.clicks || b.conversions - a.conversions),
      // Dias e horas sem cliques aparecem zerados, para o gráfico mostrar a semana e o dia inteiros.
      byDayOfWeek: weekDays.map((day) => ({ day, ...metric(days.get(campaignId), day) })),
      byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, ...metric(hours.get(campaignId), hour) })),
    });
  });
  return result;
};

const buildCriterionBreakdown = <K extends "age" | "income">(rows: Record<string, any>[], key: K, type: (row: Record<string, any>) => string | undefined) => {
  const result = new Map<string, Breakdown<K, string>>();
  sumBy(rows, type).forEach((byType, campaignId) => {
    const items = [...byType].filter(([, value]) => value.clicks > 0 || value.conversions > 0).sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([value, metrics]) => ({ [key]: String(value), clicks: metrics.clicks, conversions: round(metrics.conversions) }) as Breakdown<K, string>[number]);
    if (items.length) result.set(campaignId, items);
  });
  return result;
};
export const buildAgeRanges = (rows: Record<string, any>[]) => buildCriterionBreakdown(rows, "age", (row) => row.adGroupCriterion?.ageRange?.type);
export const buildIncomeRanges = (rows: Record<string, any>[]) => buildCriterionBreakdown(rows, "income", (row) => row.adGroupCriterion?.incomeRange?.type);

// ---------- Histórico de alterações (change_event) ----------
const resourceLabels: Record<string, [label: string, feminine: boolean]> = {
  CAMPAIGN: ["Campanha", true],
  CAMPAIGN_BUDGET: ["Orçamento", false],
  AD_GROUP: ["Grupo de anúncios", false],
  AD_GROUP_AD: ["Anúncio", false],
  AD: ["Anúncio", false],
  AD_GROUP_CRITERION: ["Segmentação do grupo", true],
  CAMPAIGN_CRITERION: ["Segmentação da campanha", true],
  AD_GROUP_BID_MODIFIER: ["Ajuste de lance", false],
  ASSET: ["Recurso", false],
  CAMPAIGN_ASSET: ["Recurso da campanha", false],
  AD_GROUP_ASSET: ["Recurso do grupo", false],
  ASSET_GROUP: ["Grupo de recursos", false],
  ASSET_GROUP_ASSET: ["Recurso do grupo de recursos", false],
};
const operationLabels: Record<string, [masculine: string, feminine: string]> = {
  CREATE: ["criado", "criada"], UPDATE: ["alterado", "alterada"], REMOVE: ["removido", "removida"],
};
const fieldLabels: Record<string, string> = {
  status: "situação", name: "nome", amount_micros: "valor", cpc_bid_micros: "lance de CPC", cpm_bid_micros: "lance de CPM",
  target_cpa_micros: "CPA desejado", target_roas: "ROAS desejado", bidding_strategy_type: "estratégia de lances",
  final_urls: "URL final", start_date: "data de início", end_date: "data de término", bid_modifier: "ajuste de lance",
  headlines: "títulos", descriptions: "descrições", keyword: "palavra-chave", location: "local", ad_schedule: "programação",
};
const clientTypeLabels: Record<string, string> = {
  GOOGLE_ADS_AUTOMATED_RULE: "Regra automática",
  GOOGLE_ADS_RECOMMENDATIONS: "Recomendação do Google",
  GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION: "Recomendações automáticas",
  GOOGLE_ADS_SCRIPTS: "Script",
  INTERNAL_TOOL: "Google",
};
const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
// A máscara de campos chega como texto separado por vírgulas ("amountMicros,name") ou como { paths }.
const changedFields = (mask: unknown) => {
  const paths = typeof mask === "string" ? mask.split(",") : Array.isArray((mask as any)?.paths) ? (mask as any).paths : [];
  return (paths as string[]).map((path) => snake(String(path).trim()).split(".")).filter((parts) => !!parts[0]);
};

const describeChange = (event: Record<string, any>, currency: string) => {
  const type = String(event.changeResourceType || ""), operation = String(event.resourceChangeOperation || ""),
    [label, feminine] = resourceLabels[type] || [type ? `Recurso ${type.toLowerCase().replaceAll("_", " ")}` : "Recurso", false],
    verb = operationLabels[operation]?.[feminine ? 1 : 0] || "alterado",
    generic = `${label} ${verb}`,
    fields = changedFields(event.changedFields), has = (name: string) => fields.some((parts) => parts.includes(name)),
    previous = event.oldResource || {}, next = event.newResource || {};
  if (type === "CAMPAIGN_BUDGET" && operation === "UPDATE" && has("amount_micros")) {
    const before = Number(previous.campaignBudget?.amountMicros || 0) / 1_000_000, after = Number(next.campaignBudget?.amountMicros || 0) / 1_000_000;
    const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(value);
    const change = before > 0 ? ` (${after >= before ? "+" : ""}${Math.round(((after - before) / before) * 100)}%)` : "";
    return { generic, text: `${after >= before ? "Aumento" : "Redução"} de orçamento: ${money(before)} → ${money(after)}${change}` };
  }
  if (type === "CAMPAIGN" && operation === "UPDATE" && has("status")) {
    const status = String(next.campaign?.status || "");
    if (status === "ENABLED") return { generic, text: "Campanha ativada" };
    if (status === "PAUSED") return { generic, text: "Campanha pausada" };
  }
  const keyword = next.adGroupCriterion?.keyword?.text || next.campaignCriterion?.keyword?.text;
  if (operation === "CREATE" && keyword) {
    const negative = !!(next.adGroupCriterion?.negative || next.campaignCriterion?.negative);
    return { generic: negative ? "Palavras-chave negativas adicionadas" : "Palavras-chave adicionadas", text: `Palavra-chave${negative ? " negativa" : ""} adicionada: "${keyword}"` };
  }
  const names = [...new Set(fields.map((parts) => fieldLabels[parts.at(-1)!] || fieldLabels[parts[0]] || parts.at(-1)!.replaceAll("_", " ")))];
  return { generic, text: operation === "UPDATE" && names.length ? `${generic}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}` : generic };
};

// Agrupa as alterações por campanha, das mais recentes para as mais antigas. Várias
// alterações do mesmo tipo no mesmo dia, pela mesma pessoa, viram uma linha só.
export const buildChangeHistory = (rows: Record<string, any>[], campaignsByBudget: Map<string, string[]>, currency = "BRL", limit = 30) => {
  type Entry = { date: string; user: string | null; generic: string; texts: string[] };
  const grouped = new Map<string, Map<string, Entry>>();
  const sorted = [...rows].sort((a, b) => String(b.changeEvent?.changeDateTime || "").localeCompare(String(a.changeEvent?.changeDateTime || "")));
  for (const row of sorted) {
    const event = row.changeEvent || {}, date = String(event.changeDateTime || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const resourceName = String(event.changeResourceName || ""),
      campaignIds = event.campaign
        ? [String(event.campaign).split("/").at(-1)!]
        : event.changeResourceType === "CAMPAIGN_BUDGET"
          ? campaignsByBudget.get(resourceName) || []
          : event.changeResourceType === "CAMPAIGN" ? [resourceName.split("/").at(-1)!] : [];
    // Do e-mail fica só a parte antes do @; alterações automáticas recebem o nome da origem.
    const user = String(event.userEmail || "").split("@")[0] || clientTypeLabels[String(event.clientType || "")] || null;
    const { generic, text } = describeChange(event, currency);
    for (const campaignId of campaignIds.filter(Boolean)) {
      const entries = grouped.get(campaignId) || new Map<string, Entry>(), key = `${date}|${user}|${generic}`;
      const entry = entries.get(key) || { date, user, generic, texts: [] };
      entry.texts.push(text);
      entries.set(key, entry);
      grouped.set(campaignId, entries);
    }
  }
  const result = new Map<string, CampaignAnalysis["changeHistory"]>();
  grouped.forEach((entries, campaignId) => {
    result.set(campaignId, [...entries.values()].slice(0, limit).map((entry) => ({
      date: entry.date,
      action: entry.texts.length === 1 ? entry.texts[0] : `${entry.generic} (${entry.texts.length}x)`,
      user: entry.user,
    })));
  });
  return result;
};

// Erros 4xx (exceto limite de taxa e timeout) são da própria conta ou do tipo de campanha e
// se repetiriam; tempo esgotado, cota e instabilidade do Google merecem nova tentativa.
const isPermanentError = (cause: unknown) => {
  const status = Number((cause as { status?: unknown } | null)?.status);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

// Consulta o Google Ads e monta as quebras de cada campanha da conta. As consultas rodam em
// paralelo e são independentes: se uma falhar, as demais seguem e a campanha mantém o que já
// tinha salvo naquele campo. `complete` diz se vale tentar de novo na próxima coleta.
export const collectGoogleCampaignAnalysis = async (
  search: SearchFn,
  account: { id: string; loginCustomerId: string; currency?: string },
  since: string,
  until: string,
  today: string,
) => {
  const campaigns = new Map<string, Partial<CampaignAnalysis>>();
  let complete = true;
  const attach = (values: Map<string, Partial<CampaignAnalysis>>) =>
    values.forEach((value, campaignId) => campaigns.set(campaignId, { ...campaigns.get(campaignId), ...value }));
  const field = <F extends keyof CampaignAnalysis>(name: F, values: Map<string, CampaignAnalysis[F]>) =>
    new Map([...values].map(([campaignId, value]) => [campaignId, { [name]: value } as Partial<CampaignAnalysis>]));
  const run = async (label: string, query: string) => {
    try {
      return await search(account.id, account.loginCustomerId, query);
    } catch (cause) {
      if (!isPermanentError(cause)) complete = false;
      console.warn(`[Google Ads] ${label} indisponível para ${account.id}:`, cause instanceof Error ? cause.message : cause);
      return null;
    }
  };
  const period = `segments.date BETWEEN '${since}' AND '${until}'`;
  // O Google só guarda o histórico de alterações dos últimos 30 dias.
  const changeSince = since > addDays(today, -29) ? since : addDays(today, -29);
  const [actionRows, scheduleRows, ageRows, incomeRows, changeRows] = await Promise.all([
    run("Conversões por ação", `SELECT campaign.id, segments.conversion_action_name, metrics.conversions FROM campaign WHERE ${period}`),
    run("Dispositivo/dia/horário", `SELECT campaign.id, segments.device, segments.day_of_week, segments.hour, metrics.clicks, metrics.conversions FROM campaign WHERE ${period}`),
    run("Idade", `SELECT campaign.id, ad_group_criterion.age_range.type, metrics.clicks, metrics.conversions FROM age_range_view WHERE ${period}`),
    run("Faixa de renda", `SELECT campaign.id, ad_group_criterion.income_range.type, metrics.clicks, metrics.conversions FROM income_range_view WHERE ${period}`),
    changeSince <= until
      ? run("Histórico de alterações",
        `SELECT change_event.change_date_time, change_event.change_resource_type, change_event.change_resource_name, change_event.resource_change_operation, change_event.changed_fields, change_event.user_email, change_event.client_type, change_event.campaign, change_event.old_resource, change_event.new_resource FROM change_event WHERE change_event.change_date_time >= '${changeSince}' AND change_event.change_date_time <= '${until} 23:59:59' ORDER BY change_event.change_date_time DESC LIMIT 2000`)
      : Promise.resolve(null),
  ]);
  if (actionRows) attach(field("conversionActions", buildConversionActions(actionRows)));
  if (scheduleRows) attach(buildScheduleBreakdowns(scheduleRows));
  if (ageRows) attach(field("byAgeRange", buildAgeRanges(ageRows)));
  if (incomeRows) attach(field("byIncomeRange", buildIncomeRanges(incomeRows)));
  if (changeRows) {
    // Alterações de orçamento não trazem a campanha: o vínculo vem do cadastro, e só é consultado se precisar.
    const campaignsByBudget = new Map<string, string[]>();
    if (changeRows.some((row) => row.changeEvent?.changeResourceType === "CAMPAIGN_BUDGET" && !row.changeEvent?.campaign)) {
      const budgetRows = await run("Vínculo de orçamentos", "SELECT campaign.id, campaign.campaign_budget FROM campaign WHERE campaign.status != 'REMOVED'");
      budgetRows?.forEach((row) => {
        const budget = String(row.campaign?.campaignBudget || ""), campaignId = campaignIdOf(row);
        if (budget && campaignId) campaignsByBudget.set(budget, [...(campaignsByBudget.get(budget) || []), campaignId]);
      });
    }
    attach(field("changeHistory", buildChangeHistory(changeRows, campaignsByBudget, account.currency)));
  }
  return { campaigns, complete };
};

// Campos da análise para a resposta: o que acabou de ser coletado, senão o que já estava salvo.
export const mergeCampaignAnalysis = (fresh: Partial<CampaignAnalysis> | undefined, previous: Partial<CampaignAnalysis> | undefined): CampaignAnalysis =>
  Object.fromEntries(campaignAnalysisFields.map((field) => [field, fresh?.[field] || previous?.[field] || []])) as CampaignAnalysis;
