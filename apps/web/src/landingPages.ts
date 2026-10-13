// Landing pages da linha do cliente na Gestão de Mídia. A mesma página costuma chegar escrita de
// jeitos diferentes (com ou sem "www.", barra no fim, parâmetros de rastreamento como utm_*),
// e cada variação virava um ícone. Aqui elas são agrupadas pelo endereço real. Campanhas pausadas
// só contam quando o cliente não tem nenhuma ativa, para não exibir páginas antigas.

type LandingCampaign = { status: string; landingPageUrl?: string | null; landingPageStatus?: string | null };
export type LandingPageGroup = { url: string; status: "ACTIVE" | "INACTIVE" | "UNKNOWN" };

export function landingPageKey(url: string) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path.toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function landingPageGroups(campaigns: LandingCampaign[]): LandingPageGroup[] {
  const withUrl = campaigns.filter((item) => !!item.landingPageUrl);
  const active = withUrl.filter((item) => item.status === "ACTIVE");
  const source = active.length ? active : withUrl;
  const groups = new Map<string, { url: string; statuses: (string | null | undefined)[] }>();
  for (const item of source) {
    const key = landingPageKey(item.landingPageUrl!);
    const group = groups.get(key) || { url: item.landingPageUrl!.trim(), statuses: [] };
    group.statuses.push(item.landingPageStatus);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ url, statuses }) => ({
    url,
    status: statuses.includes("INACTIVE") ? "INACTIVE" : statuses.every((value) => value === "ACTIVE") ? "ACTIVE" : "UNKNOWN",
  }));
}
