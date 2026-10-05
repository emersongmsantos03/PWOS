// Fluxos de chamados — compartilhado entre a API (vite.config.ts) e a interface.
// Um chamado nasce de um modelo: cada etapa tem papel, responsável e prazo em dias úteis.
// A etapa só é concluída quando o responsável a envia para a próxima; aprovações podem
// devolver o chamado para a etapa anterior.

export type TicketStepRole = "EXECUTOR" | "APPROVER" | "CLIENT";
// Quem assume a etapa por padrão: quem abriu o chamado ou o responsável do setor.
export type TicketStepOwner = "REQUESTER" | "DEPARTMENT";
export type TicketFlowStep = { name: string; role: TicketStepRole; owner: TicketStepOwner; days: number };
export type TicketFlow = { id: string; name: string; description: string; departmentId: string; steps: TicketFlowStep[] };
export type TicketStepStatus = "PENDING" | "ACTIVE" | "DONE";
export type TicketStep = {
  id: string;
  name: string;
  role: TicketStepRole;
  days: number;
  assigneeId: string;
  assigneeName: string;
  status: TicketStepStatus;
  dueAt: string;
  startedAt?: string;
  completedAt?: string;
  completedByName?: string;
  // Preenchido quando uma aprovação devolve a etapa; some quando a etapa é concluída de novo.
  adjustment?: { note: string; byName: string; fromStepName: string; at: string };
};
export type TicketFlowStatus = "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED";
export type TicketFlowAction = "COMPLETE" | "RETURN";

export const stepRoleLabels: Record<TicketStepRole, string> = { EXECUTOR: "Executor", APPROVER: "Aprovador", CLIENT: "Cliente" };

const step = (name: string, role: TicketStepRole, owner: TicketStepOwner, days: number): TicketFlowStep => ({ name, role, owner, days });

export const ticketFlows: TicketFlow[] = [
  {
    id: "simple", name: "Chamado simples", departmentId: "",
    description: "Uma etapa só: o responsável resolve e conclui.",
    steps: [step("Atendimento", "EXECUTOR", "DEPARTMENT", 2)],
  },
  {
    id: "landing-page", name: "Landing Page", departmentId: "department-marketing-creative",
    description: "Do conteúdo à publicação, com aprovação interna e do cliente.",
    steps: [
      step("Conteúdo recebido", "EXECUTOR", "REQUESTER", 1),
      step("Layout em produção", "EXECUTOR", "DEPARTMENT", 3),
      step("Aprovação interna", "APPROVER", "DEPARTMENT", 1),
      step("Aprovação do cliente", "CLIENT", "REQUESTER", 2),
      step("Desenvolvimento", "EXECUTOR", "DEPARTMENT", 4),
      step("Conferência", "APPROVER", "DEPARTMENT", 1),
      step("Instalação de tags", "EXECUTOR", "DEPARTMENT", 1),
      step("Testes e publicação", "APPROVER", "DEPARTMENT", 1),
    ],
  },
  {
    id: "website", name: "Site institucional", departmentId: "department-marketing-creative",
    description: "Site completo: layout, aprovações, desenvolvimento e publicação.",
    steps: [
      step("Briefing e conteúdo", "EXECUTOR", "REQUESTER", 2),
      step("Layout", "EXECUTOR", "DEPARTMENT", 5),
      step("Aprovação interna", "APPROVER", "DEPARTMENT", 1),
      step("Aprovação do cliente", "CLIENT", "REQUESTER", 3),
      step("Desenvolvimento", "EXECUTOR", "DEPARTMENT", 8),
      step("Conferência", "APPROVER", "DEPARTMENT", 2),
      step("Publicação", "EXECUTOR", "DEPARTMENT", 1),
    ],
  },
  {
    id: "creative", name: "Peça criativa", departmentId: "department-marketing-creative",
    description: "Arte para post, anúncio ou material impresso.",
    steps: [
      step("Briefing", "EXECUTOR", "REQUESTER", 1),
      step("Criação", "EXECUTOR", "DEPARTMENT", 2),
      step("Aprovação interna", "APPROVER", "DEPARTMENT", 1),
      step("Aprovação do cliente", "CLIENT", "REQUESTER", 2),
      step("Ajustes e entrega", "EXECUTOR", "DEPARTMENT", 1),
    ],
  },
  {
    id: "video", name: "Vídeo", departmentId: "department-marketing-creative",
    description: "Roteiro aprovado antes da produção, edição e entrega.",
    steps: [
      step("Roteiro", "EXECUTOR", "DEPARTMENT", 2),
      step("Aprovação do roteiro", "CLIENT", "REQUESTER", 2),
      step("Produção e edição", "EXECUTOR", "DEPARTMENT", 4),
      step("Aprovação interna", "APPROVER", "DEPARTMENT", 1),
      step("Aprovação do cliente", "CLIENT", "REQUESTER", 2),
      step("Entrega", "EXECUTOR", "DEPARTMENT", 1),
    ],
  },
  {
    id: "campaign", name: "Campanha de mídia", departmentId: "department-campaign-intelligence",
    description: "Estrutura, aprovação e publicação de campanha paga, com validação D+1.",
    steps: [
      step("Briefing e verba", "EXECUTOR", "REQUESTER", 1),
      step("Estrutura da campanha", "EXECUTOR", "DEPARTMENT", 2),
      step("Revisão interna", "APPROVER", "DEPARTMENT", 1),
      step("Aprovação do cliente", "CLIENT", "REQUESTER", 1),
      step("Publicação", "EXECUTOR", "DEPARTMENT", 1),
      step("Validação D+1", "APPROVER", "DEPARTMENT", 1),
    ],
  },
  {
    id: "internal-support", name: "Suporte interno", departmentId: "department-management",
    description: "Acessos, equipamentos e pedidos internos, validados por quem pediu.",
    steps: [
      step("Atendimento", "EXECUTOR", "DEPARTMENT", 1),
      step("Validação do solicitante", "APPROVER", "REQUESTER", 1),
    ],
  },
];

export const findFlow = (id: string) => ticketFlows.find((flow) => flow.id === id);

// Prazos em dias úteis: sábado e domingo não contam.
export function addBusinessDays(from: Date, days: number) {
  const date = new Date(from);
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1;
  }
  return date;
}

// Recalcula os prazos da etapa ativa e das pendentes em sequência, a partir do início da etapa ativa.
export function scheduleSteps(steps: TicketStep[], now: Date) {
  let cursor = now;
  return steps.map((item) => {
    if (item.status === "DONE") return item;
    const start = item.status === "ACTIVE" && item.startedAt ? new Date(item.startedAt) : cursor;
    const due = addBusinessDays(start, item.days);
    cursor = due;
    return { ...item, dueAt: due.toISOString() };
  });
}

export const activeStepIndex = (steps: TicketStep[]) => steps.findIndex((item) => item.status === "ACTIVE");

export function flowStatus(steps: TicketStep[]): TicketFlowStatus {
  const index = activeStepIndex(steps);
  if (index < 0) return steps.length && steps.every((item) => item.status === "DONE") ? "RESOLVED" : "OPEN";
  if (steps[index].role === "CLIENT") return "WAITING";
  return steps.some((item) => item.status === "DONE") ? "IN_PROGRESS" : "OPEN";
}

export const canReturnStep = (steps: TicketStep[]) => {
  const index = activeStepIndex(steps);
  return index > 0 && steps[index].role !== "EXECUTOR";
};

// Concluir envia para a próxima etapa (ou encerra o fluxo); devolver reabre a etapa anterior.
export function applyFlowAction(steps: TicketStep[], action: TicketFlowAction, actorName: string, now: Date, note = "") {
  const index = activeStepIndex(steps);
  if (index < 0) throw new Error("Este chamado não tem etapa em andamento.");
  if (action === "RETURN" && !canReturnStep(steps)) throw new Error("Esta etapa não pode ser devolvida.");
  const at = now.toISOString();
  const target = action === "COMPLETE" ? index + 1 : index - 1;
  const next = steps.map((item, position): TicketStep => {
    if (position === index)
      return action === "COMPLETE"
        ? { ...item, status: "DONE", completedAt: at, completedByName: actorName, adjustment: undefined }
        : { ...item, status: "PENDING", startedAt: undefined };
    if (position === target) return {
      ...item, status: "ACTIVE", startedAt: at, completedAt: undefined, completedByName: undefined,
      adjustment: action === "RETURN" ? { note: note.trim(), byName: actorName, fromStepName: steps[index].name, at } : undefined,
    };
    return item;
  });
  return { steps: scheduleSteps(next, now), from: steps[index], to: next[target] as TicketStep | undefined };
}

// Reabre um chamado encerrado na última etapa.
export function reopenFlow(steps: TicketStep[], now: Date) {
  if (!steps.length || activeStepIndex(steps) >= 0) return steps;
  const last = steps.length - 1, at = now.toISOString();
  return scheduleSteps(steps.map((item, position) => position === last ? { ...item, status: "ACTIVE" as const, startedAt: at, completedAt: undefined, completedByName: undefined } : item), now);
}

// Ajuste pedido e ainda não entregue: a etapa ativa foi devolvida por uma aprovação.
export const pendingAdjustment = (steps: TicketStep[] | undefined) => steps?.find((item) => item.status === "ACTIVE")?.adjustment;
