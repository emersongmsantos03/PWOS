import { describe, expect, it } from "vitest";
import type { TicketStep } from "./ticketFlows";
import { averageDays, clientJustApproved, executedSteps, returnedToMe, sentForApproval, ticketSituation, toApprove, variation, type FlowTicket } from "./marketingTickets";

const step = (name: string, role: TicketStep["role"], assigneeId: string, status: TicketStep["status"], extra: Partial<TicketStep> = {}): TicketStep =>
  ({ id: name, name, role, days: 1, assigneeId, assigneeName: assigneeId, status, dueAt: "2026-10-20T12:00:00.000Z", ...extra });
const ticket = (steps: TicketStep[], extra: Partial<FlowTicket> = {}): FlowTicket => ({
  id: "t1", code: "CH-1", title: "LP", status: "IN_PROGRESS", priority: "HIGH", dueAt: "", createdAt: "", updatedAt: "",
  departmentId: "", requesterId: "pri", requesterName: "Priscila", assigneeId: "", assigneeName: "", steps, ...extra,
});

describe("chamados do ponto de vista de quem executa", () => {
  it("entregue por mim e aguardando a aprovação interna ou do cliente", () => {
    const internal = ticket([step("Layout", "EXECUTOR", "duda", "DONE"), step("Aprovação interna", "APPROVER", "pri", "ACTIVE")]);
    expect(sentForApproval(internal, "duda")).toBe(true);
    expect(sentForApproval(internal, "pri")).toBe(false);
    const client = ticket([step("Layout", "EXECUTOR", "duda", "DONE"), step("Aprovação interna", "APPROVER", "pri", "DONE"), step("Aprovação do cliente", "CLIENT", "pri", "ACTIVE")]);
    expect(sentForApproval(client, "duda")).toBe(true);
    expect(toApprove(client, "pri")).toBe(true);
    expect(ticketSituation(client, "duda").label).toBe("Aguardando cliente");
  });

  it("voltou para ajuste e cliente acabou de aprovar", () => {
    const returned = ticket([step("Layout", "EXECUTOR", "duda", "ACTIVE", { adjustment: { note: "Trocar fonte", byName: "Priscila", fromStepName: "Aprovação", at: "" } }), step("Aprovação", "APPROVER", "pri", "PENDING")]);
    expect(returnedToMe(returned, "duda")).toBe(true);
    expect(ticketSituation(returned, "duda")).toEqual({ label: "Ajuste solicitado", tone: "red" });
    const approved = ticket([step("Aprovação do cliente", "CLIENT", "pri", "DONE"), step("Desenvolvimento", "EXECUTOR", "duda", "ACTIVE")]);
    expect(clientJustApproved(approved)).toBe(true);
    approved.steps![1].work = { state: "RUNNING", elapsedMs: 0, runningSince: "2026-10-12T10:00:00.000Z" };
    expect(clientJustApproved(approved)).toBe(false);
    expect(ticketSituation(approved, "duda").label).toBe("Em andamento");
  });

  it("conta as etapas executadas no mês e o tempo médio", () => {
    const now = new Date("2026-10-15T12:00:00.000Z");
    const list = [ticket([
      step("A", "EXECUTOR", "duda", "DONE", { startedAt: "2026-10-01T12:00:00.000Z", completedAt: "2026-10-03T12:00:00.000Z" }),
      step("B", "EXECUTOR", "duda", "DONE", { startedAt: "2026-09-10T12:00:00.000Z", completedAt: "2026-09-11T12:00:00.000Z" }),
      step("C", "APPROVER", "duda", "DONE", { completedAt: "2026-10-05T12:00:00.000Z" }),
    ])];
    const current = executedSteps(list, "duda", 0, now), previous = executedSteps(list, "duda", 1, now);
    expect(current.map((item) => item.name)).toEqual(["A"]);
    expect(averageDays(current)).toBe(2);
    expect(variation(averageDays(current), averageDays(previous))).toBe(100);
    expect(variation(1, 0)).toBeNull();
  });
});
