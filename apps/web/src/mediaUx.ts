export type MediaMetricFocus = "ALL" | "SPEND" | "LEADS" | "CPL";

export const matchesMediaMetric = (focus: MediaMetricFocus, campaign: { spend: number; leads: number; cpl: number | null }) =>
  focus === "ALL" || focus === "SPEND" && campaign.spend > 0 || focus === "LEADS" && campaign.leads > 0 || focus === "CPL" && campaign.cpl !== null;

export const mediaPercentChange = (current: number, previous: number, inverse = false) =>
  previous ? ((current - previous) / previous * 100) * (inverse ? -1 : 1) : null;

export const mediaTrendCacheKey = (granularity: string, since: string, until: string, signature: string) =>
  `pw-os-media-trend:${granularity}:${since}:${until}:${signature}`;

const mediaObjectiveLabels: Record<string, string> = {
  UNKNOWN: "Não informado",
  UNSPECIFIED: "Não informado",
  SEARCH: "Pesquisa",
  SMART: "Pesquisa",
  SMART_CAMPAIGN: "Pesquisa",
  PERFORMANCE_MAX: "Performance Máxima",
  DISPLAY: "Rede de Display",
  VIDEO: "Vídeo",
  SHOPPING: "Shopping",
  DEMAND_GEN: "Geração de demanda",
  DISCOVERY: "Descoberta",
  LOCAL: "Campanha local",
  LOCAL_SERVICES: "Serviços locais",
  AWARENESS: "Reconhecimento",
  BRAND_AWARENESS: "Reconhecimento da marca",
  REACH: "Alcance",
  TRAFFIC: "Tráfego",
  LINK_CLICKS: "Cliques no link",
  ENGAGEMENT: "Engajamento",
  POST_ENGAGEMENT: "Engajamento com a publicação",
  PAGE_LIKES: "Curtidas na página",
  EVENT_RESPONSES: "Respostas ao evento",
  MESSAGES: "Mensagens",
  LEADS: "Leads",
  LEAD_GENERATION: "Geração de leads",
  SALES: "Vendas",
  CONVERSIONS: "Conversões",
  PRODUCT_CATALOG_SALES: "Vendas do catálogo",
  CATALOG_SALES: "Vendas do catálogo",
  STORE_VISITS: "Visitas à loja",
  APP_PROMOTION: "Promoção do aplicativo",
  APP_INSTALLS: "Instalações do aplicativo",
  CALLS: "Ligações",
};

const objectiveWordLabels: Record<string, string> = {
  APP: "Aplicativo",
  AWARENESS: "Reconhecimento",
  CALLS: "Ligações",
  CATALOG: "Catálogo",
  CONVERSIONS: "Conversões",
  DEMAND: "Demanda",
  DISPLAY: "Display",
  ENGAGEMENT: "Engajamento",
  GENERATION: "Geração",
  INSTALLS: "Instalações",
  LEADS: "Leads",
  LOCAL: "Local",
  MAX: "Máxima",
  MESSAGES: "Mensagens",
  PERFORMANCE: "Performance",
  PROMOTION: "Promoção",
  REACH: "Alcance",
  SALES: "Vendas",
  SEARCH: "Pesquisa",
  SHOPPING: "Shopping",
  TRAFFIC: "Tráfego",
  VIDEO: "Vídeo",
  WEBSITE: "Site",
};

export const mediaObjectiveLabel = (value: string | null | undefined) => {
  const normalized = String(value || "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/^OUTCOME_/, "")
    .replace(/[\s-]+/g, "_");
  if (mediaObjectiveLabels[normalized]) return mediaObjectiveLabels[normalized];
  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => objectiveWordLabels[word] || `${word[0]}${word.slice(1).toLowerCase()}`)
    .join(" ");
};
