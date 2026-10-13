// Chamados vistos por quem está no setor Marketing e Criação: o que está comigo, o que eu
// entreguei e espera aprovação, o que voltou para ajuste e os números do mês.
import type { TicketStep } from "./ticketFlows";

export const marketingDepartmentId = "department-marketing-creative";

type User = { id: string; departmentId?: string; departmentName?: string };
export type FlowTicket = {
  id: string; code: string; title: string; status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; dueAt: string; createdAt: string; updatedAt: string;
  departmentId: string; requesterId: string; requesterName: string; assigneeId: string; assigneeName: string;
  clientId?: string; clientName?: string; flowName?: string; steps?: TicketStep[];
};

export const isMarketingUser = (user: User) =>
  user.departmentId === marketingDepartmentId || /marketing/i.test(user.departmentName || "");

export const activeStep = (ticket: FlowTicket) => ticket.steps?.find((step) => step.status === "ACTIVE");
const activeIndex = (ticket: FlowTicket) => ticket.steps?.findIndex((step) => step.status === "ACTIVE") ?? -1;
export const isOpenTicket = (ticket: FlowTicket) => !["RESOLVED", "CLOSED"].includes(ticket.status);
const isApproval = (step?: TicketStep) => !!step && step.role !== "EXECUTOR";

// Prazo que importa agora: o da etapa ativa (ou o do chamado, sem fluxo).
export const dueOf = (ticket: FlowTicket) => activeStep(ticket)?.dueAt || ticket.dueAt;
export const isLate = (ticket: FlowTicket, now = new Date()) => isOpenTicket(ticket) && !!dueOf(ticket) && new Date(dueOf(ticket)) < now;
export const sameDay = (value: string | undefined, date = new Date()) => !!value && new Date(value).toDateString() === date.toDateString();

// Etapa ativa comigo (ou o chamado sem fluxo atribuído a mim).
export const withMe = (ticket: FlowTicket, userId: string) =>
  isOpenTicket(ticket) && (activeStep(ticket)?.assigneeId ?? ticket.assigneeId) === userId;
// Participo de alguma etapa (ou do chamado sem fluxo).
export const involves = (ticket: FlowTicket, userId: string) =>
  ticket.assigneeId === userId || !!ticket.steps?.some((step) => step.assigneeId === userId);

// Entreguei a etapa anterior e agora ela espera uma aprovação de outra pessoa (ou do cliente).
export const sentForApproval = (ticket: FlowTicket, userId: string) => {
  const index = activeIndex(ticket), step = ticket.steps?.[index];
  if (!isOpenTicket(ticket) || index < 1 || !isApproval(step) || step!.assigneeId === userId) return false;
  // Sobe pelas aprovações até achar quem executou: Layout → Aprovação interna → Aprovação do cliente.
  for (let position = index - 1; position >= 0; position -= 1) {
    const previous = ticket.steps![position];
    if (previous.role === "EXECUTOR") return previous.assigneeId === userId;
  }
  return false;
};
// Quando a etapa ativa foi enviada: conclusão da etapa anterior.
export const sentAt = (ticket: FlowTicket) => {
  const index = activeIndex(ticket);
  return index > 0 ? ticket.steps![index - 1].completedAt || activeStep(ticket)?.startedAt || "" : "";
};

// Aprovação (interna ou registro da aprovação do cliente) que está comigo.
export const toApprove = (ticket: FlowTicket, userId: string) => withMe(ticket, userId) && isApproval(activeStep(ticket));
export const returnedToMe = (ticket: FlowTicket, userId: string) => withMe(ticket, userId) && !!activeStep(ticket)?.adjustment;
// O cliente acabou de aprovar e a etapa seguinte (comigo) ainda não começou.
export const clientJustApproved = (ticket: FlowTicket) => {
  const index = activeIndex(ticket), step = ticket.steps?.[index];
  return index > 0 && ticket.steps![index - 1].role === "CLIENT" && step?.role === "EXECUTOR" && (!step.work || step.work.state === "NOT_STARTED") && !step.adjustment;
};

export type TicketTone = "blue" | "green" | "orange" | "red" | "purple" | "gray" | "yellow";
// Situação do chamado para quem está olhando.
export function ticketSituation(ticket: FlowTicket, userId: string): { label: string; tone: TicketTone } {
  if (ticket.status === "CLOSED") return { label: "Cancelado", tone: "gray" };
  if (ticket.status === "RESOLVED") return { label: "Concluído", tone: "green" };
  const step = activeStep(ticket);
  if (!step) return { label: "Em andamento", tone: "blue" };
  if (step.role === "CLIENT") return { label: "Aguardando cliente", tone: "purple" };
  if (step.role === "APPROVER") return { label: step.assigneeId === userId ? "Aprovar entrega" : "Aguardando aprovação", tone: "yellow" };
  if (step.adjustment && step.work?.state !== "RUNNING") return { label: "Ajuste solicitado", tone: "red" };
  switch (step.work?.state) {
    case "RUNNING": return { label: "Em andamento", tone: "blue" };
    case "PAUSED": return { label: "Pausado", tone: "orange" };
    case "FINISHED": return { label: "Pronto para enviar", tone: "green" };
    default: return { label: "Aguardando início", tone: "gray" };
  }
}

export const stepProgress = (ticket: FlowTicket) => {
  const steps = ticket.steps || [], done = steps.filter((step) => step.status === "DONE").length;
  const index = activeIndex(ticket);
  return { total: steps.length, done, position: index >= 0 ? index + 1 : done, percent: steps.length ? Math.round((done / steps.length) * 100) : ticket.status === "RESOLVED" ? 100 : 0 };
};

// Etapas de execução que a pessoa concluiu no mês (0 = mês atual, 1 = anterior).
export function executedSteps(tickets: FlowTicket[], userId: string, monthsAgo: number, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1), end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1);
  return tickets.flatMap((ticket) => (ticket.steps || []).filter((step) =>
    step.role === "EXECUTOR" && step.status === "DONE" && step.assigneeId === userId && !!step.completedAt &&
    new Date(step.completedAt) >= start && new Date(step.completedAt) < end));
}

// Tempo médio, em dias, entre o início e a entrega das etapas.
export const averageDays = (steps: TicketStep[]) => {
  const durations = steps.filter((step) => step.startedAt && step.completedAt)
    .map((step) => (new Date(step.completedAt!).getTime() - new Date(step.startedAt!).getTime()) / 86400000);
  return durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
};

// Variação percentual em relação ao mês anterior (null quando não há base de comparação).
export const variation = (current: number | null, previous: number | null) =>
  current == null || !previous ? null : Math.round(((current - previous) / previous) * 100);
