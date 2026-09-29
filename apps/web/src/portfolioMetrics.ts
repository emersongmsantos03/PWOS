type PortfolioCampaign = {
  accountId?: string; status?: string; currency: string; spend: number; impressions: number; clicks: number;
  leads: number; conversations: number; reach: number; dailyBudget: number;
  lifetimeBudget: number; remainingBudget?: number | null; accountRemainingBudget?: number | null;
};

export function portfolioMetrics(campaigns: PortfolioCampaign[]) {
  const currencies = [...new Set(campaigns.map(item => item.currency))];
  return currencies.map(currency => {
    const rows = campaigns.filter(item => item.currency === currency);
    const sum = (field: keyof PortfolioCampaign) => rows.reduce((total, item) => total + (typeof item[field] === "number" && Number.isFinite(item[field]) ? Math.max(0, item[field] as number) : 0), 0);
    const spend = sum("spend"), impressions = sum("impressions"), clicks = sum("clicks"), leads = sum("leads"), reach = sum("reach"), conversations = sum("conversations");
    const results = rows.reduce((total, item) => total + (item.leads || item.conversations || 0), 0);
    // Saldo de conta não pode ser somado uma vez por campanha: uma mesma conta
    // pode ter várias campanhas. Quando a plataforma informa o crédito da
    // conta, ele é a fonte exibida.
    const balancesByAccount = new Map<string, number | null>();
    rows.forEach(item => {
      if (item.accountId && !balancesByAccount.has(item.accountId)) balancesByAccount.set(item.accountId, item.accountRemainingBudget ?? null);
    });
    const hasAccountBalances = balancesByAccount.size > 0 && [...balancesByAccount.values()].every(value => value != null && Number.isFinite(value));
    const remainingBudget = hasAccountBalances
      ? [...balancesByAccount.values()].reduce<number>((total, value) => total + Math.max(0, Number(value)), 0)
      : rows.every(item => item.remainingBudget != null && Number.isFinite(item.remainingBudget)) ? sum("remainingBudget") : null;
    // Orçamento diário só existe para o que está rodando: campanhas pausadas
    // mantêm o valor configurado, mas não gastam. Mesmo quando o filtro inclui
    // inativas, somam-se apenas os orçamentos das campanhas ativas.
    const budgetRows = rows.filter(item => item.status == null || item.status === "ACTIVE");
    const dailyBudget = budgetRows.reduce((total, item) => total + (Number.isFinite(item.dailyBudget) ? Math.max(0, item.dailyBudget) : 0), 0);
    return {
      currency, spend, impressions, clicks, leads, reach, conversations, results,
      dailyBudget: dailyBudget || null,
      lifetimeBudget: rows.every(item => item.lifetimeBudget > 0) ? sum("lifetimeBudget") : null,
      remainingBudget,
      balanceSource: hasAccountBalances ? "ACCOUNT" : remainingBudget != null ? "CAMPAIGN" : "NONE",
      balanceDays: remainingBudget != null && budgetRows.length > 0 && budgetRows.every(item => item.dailyBudget > 0) ? remainingBudget / dailyBudget : null,
      cpl: leads > 0 ? spend / leads : null,
      costPerResult: results > 0 ? spend / results : null,
      ctr: impressions > 0 ? clicks / impressions * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cpm: impressions > 0 ? spend / impressions * 1000 : null,
      conversion: clicks > 0 ? leads / clicks * 100 : null,
      frequency: reach > 0 && rows.every(item => item.reach > 0 || item.impressions === 0) ? impressions / reach : null,
    };
  });
}
