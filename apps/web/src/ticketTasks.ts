// Ligação entre chamados e o Creative Ops — compartilhada entre a API (vite.config.ts) e a interface.
// Cada etapa de execução de um chamado do setor Marketing e Criação vira uma demanda no Creative Ops
// para quem está com a etapa. O chamado manda no andamento: a demanda acompanha a etapa e, quando
// alguém move a demanda no Creative Ops (iniciar, finalizar), isso vira a ação no cronômetro da etapa.
import type { TicketStep } from "./ticketFlows";
import type { TicketWorkAction, TicketWorkState } from "./ticketWork";

export const ticketTaskDepartments = ["department-marketing-creative"];
export type LinkedTaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "CHANGES_REQUESTED" | "DONE" | "CANCELLED";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";

// Tipo da demanda no Creative Ops conforme o tipo de chamado.
export const ticketTaskType = (flowId?: string): { type: "WEB" | "DESIGN" | "VIDEO" | "OTHER"; subtype: string } => {
  switch (flowId) {
    case "landing-page": return { type: "WEB", subtype: "landing_page" };
    case "website": return { type: "WEB", subtype: "website" };
    case "creative": return { type: "DESIGN", subtype: "ad_creative" };
    case "video": return { type: "VIDEO", subtype: "editing" };
    default: return { type: "OTHER", subtype: "custom" };
  }
};

// Status da demanda a partir da etapa do chamado.
export function linkedTaskStatus(step: Pick<TicketStep, "status" | "adjustment" | "work">, ticketStatus: TicketStatus): LinkedTaskStatus {
  if (ticketStatus === "CLOSED") return "CANCELLED";
  if (step.status === "DONE") return "DONE";
  if (step.status !== "ACTIVE") return "TODO";
  const state = step.work?.state || "NOT_STARTED";
  if (state === "FINISHED") return "REVIEW";
  if (state === "RUNNING" || state === "PAUSED") return "IN_PROGRESS";
  return step.adjustment ? "CHANGES_REQUESTED" : "TODO";
}

// Mover a demanda no Creative Ops → ações no cronômetro da etapa. A entrega (concluir) é
// feita pelo chamado, que sabe para quem a etapa segue.
export function workActionsForTaskStatus(status: string, state: TicketWorkState, ticketCode: string): { actions: TicketWorkAction[] } | { error: string } {
  if (status === "IN_PROGRESS")
    return { actions: state === "NOT_STARTED" ? ["START"] : state === "PAUSED" ? ["RESUME"] : state === "FINISHED" ? ["REOPEN", "RESUME"] : [] };
  if (status === "REVIEW")
    return { actions: state === "NOT_STARTED" ? ["START", "FINISH"] : state === "FINISHED" ? [] : ["FINISH"] };
  if (status === "TODO") {
    if (state === "RUNNING") return { actions: ["PAUSE"] };
    if (state === "NOT_STARTED") return { actions: [] };
    return { error: `Esta etapa do chamado ${ticketCode} já foi iniciada. Use “Pausar” para parar o cronômetro.` };
  }
  return { error: `Esta demanda vem do chamado ${ticketCode}: a entrega é enviada pela página do chamado, que segue para a próxima etapa.` };
}
