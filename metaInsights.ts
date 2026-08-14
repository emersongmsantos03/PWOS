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

export function extractMetaLeads(
  actions: MetaAction[] | undefined,
): MetaLeadExtraction {
  for (const actionType of META_LEAD_ACTION_PRIORITY) {
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
