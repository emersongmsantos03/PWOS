export type MetaAction = { action_type?: string; value?: string };

export type MetaLeadExtraction = {
  leads: number;
  actionType: string | null;
};

// Meta can report the same messaging result through several overlapping actions.
// Pick exactly one source, in priority order, instead of summing aliases.
const META_LEAD_ACTION_PRIORITY = [
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
] as const;

// O "Resultado" do Gerenciador de Anúncios segue a meta de otimização do conjunto. Sem ela,
// uma campanha de mensagens com alguns leads soltos mostraria os leads (2) no lugar das
// conversas iniciadas (18).
const META_RESULT_BY_GOAL: Record<string, readonly string[]> = {
  CONVERSATIONS: ["onsite_conversion.messaging_conversation_started_7d", "messaging_conversation_started_7d"],
  LEAD_GENERATION: ["lead", "onsite_conversion.lead_grouped"],
  QUALITY_LEAD: ["lead", "onsite_conversion.lead_grouped"],
};

// Meta de otimização que representa a campanha: a mais comum entre os conjuntos ativos
// (ou entre todos, quando nenhum está ativo).
export function metaCampaignGoal(adSets: { optimization_goal?: string; effective_status?: string; status?: string }[]): string | null {
  const live = adSets.filter((row) => !["DELETED", "ARCHIVED"].includes(row.effective_status || row.status || ""));
  const active = live.filter((row) => (row.effective_status || row.status) === "ACTIVE");
  const counts = new Map<string, number>();
  (active.length ? active : live).forEach((row) => {
    if (row.optimization_goal) counts.set(row.optimization_goal, (counts.get(row.optimization_goal) || 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export function extractMetaLeads(
  actions: MetaAction[] | undefined,
  optimizationGoal?: string | null,
): MetaLeadExtraction {
  const preferred = (optimizationGoal && META_RESULT_BY_GOAL[optimizationGoal]) || [];
  for (const actionType of [...preferred, ...META_LEAD_ACTION_PRIORITY]) {
    const action = actions?.find((item) => item.action_type === actionType);
    if (!action) continue;
    const value = Number(action.value || 0);
    return {
      leads: Number.isFinite(value) && value > 0 ? value : 0,
      actionType,
    };
  }
  return { leads: 0, actionType: null };
}
