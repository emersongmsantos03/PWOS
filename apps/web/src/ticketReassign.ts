// Reatribuir chamado — compartilhado entre a API (vite.config.ts) e a interface.
// O líder de um setor repassa as etapas que estão com ele (ou com alguém do setor dele) para
// outra pessoa do mesmo setor. Quem pode atribuir chamados (Diretoria, gestão) repassa qualquer
// etapa em aberto para qualquer pessoa da equipe. Etapas concluídas não mudam.
import type { TicketStep } from "./ticketFlows";
import { closeWork } from "./ticketWork";

export type TicketHandoff = NonNullable<TicketStep["handoff"]>;
export type ReassignPerson = { id: string; name: string; departmentId?: string };
export type ReassignDepartment = { id: string; managerUserId?: string };
export type ReassignRights = { any: boolean; teamIds: Set<string> };

export function reassignRights(userId: string, canAssignAll: boolean, departments: ReassignDepartment[], people: ReassignPerson[]): ReassignRights {
  if (canAssignAll) return { any: true, teamIds: new Set(people.map((person) => person.id)) };
  const led = new Set(departments.filter((item) => item.managerUserId === userId).map((item) => item.id));
  if (!led.size) return { any: false, teamIds: new Set() };
  return { any: false, teamIds: new Set([userId, ...people.filter((person) => led.has(person.departmentId || "")).map((person) => person.id)]) };
}

// Quem está com a parte precisa ser o líder ou alguém do time dele.
const holds = (assigneeId: string, userId: string, rights: ReassignRights) =>
  rights.any || (rights.teamIds.size > 0 && (assigneeId === userId || rights.teamIds.has(assigneeId)));

export const canReassignStep = (step: TicketStep, userId: string, rights: ReassignRights) =>
  step.status !== "DONE" && holds(step.assigneeId, userId, rights);

export const canReassignTicket = (ticket: { status: string; assigneeId: string; steps?: TicketStep[] }, userId: string, rights: ReassignRights) =>
  !["RESOLVED", "CLOSED"].includes(ticket.status) &&
  (ticket.steps?.length ? ticket.steps.some((step) => canReassignStep(step, userId, rights)) : holds(ticket.assigneeId, userId, rights));

export function reassignSteps(steps: TicketStep[], stepIds: string[], to: { id: string; name: string }, by: { id: string; name: string }, now: Date, note = "") {
  const moved: TicketStep[] = [];
  const next = steps.map((step) => {
    if (!stepIds.includes(step.id) || step.status === "DONE" || step.assigneeId === to.id) return step;
    moved.push(step);
    const handoff: TicketHandoff = { fromName: step.assigneeName, byId: by.id, byName: by.name, at: now.toISOString(), ...(note ? { note } : {}) };
    // O cronômetro de quem estava produzindo para; a nova pessoa retoma quando começar.
    return { ...step, assigneeId: to.id, assigneeName: to.name, work: closeWork(step.work, now), handoff };
  });
  return { steps: next, moved };
}

// "“A”", "“A” e “B”", "“A”, “B” e “C”"
export const quotedList = (names: string[]) => {
  const quoted = names.map((name) => `“${name}”`);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} e ${quoted[quoted.length - 1]}` : quoted[0] || "";
};
