import { describe, expect, it } from "vitest";
import { addBusinessDays, applyFlowAction, canReturnStep, pendingAdjustment, flowStatus, reopenFlow, scheduleSteps, ticketFlows, type TicketStep } from "./ticketFlows";

const steps = (...roles: TicketStep["role"][]): TicketStep[] =>
  roles.map((role, index) => ({ id: `s${index}`, name: `Etapa ${index + 1}`, role, days: 1, assigneeId: `u${index}`, assigneeName: `Pessoa ${index}`, status: index === 0 ? "ACTIVE" : "PENDING", dueAt: "", startedAt: index === 0 ? "2026-10-05T12:00:00.000Z" : undefined }));
const monday = new Date("2026-10-05T12:00:00.000Z");

describe("prazos em dias úteis", () => {
  it("pula o fim de semana", () => expect(addBusinessDays(new Date("2026-10-09T12:00:00.000Z"), 1).toISOString()).toBe("2026-10-12T12:00:00.000Z"));
  it("encadeia as etapas a partir do início da etapa ativa", () => {
    const scheduled = scheduleSteps(steps("EXECUTOR", "APPROVER", "EXECUTOR"), monday);
    expect(scheduled.map((item) => item.dueAt.slice(0, 10))).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
  });
});

describe("andamento do fluxo", () => {
  it("começa aberto e passa a em andamento depois da primeira entrega", () => {
    const flow = steps("EXECUTOR", "EXECUTOR");
    expect(flowStatus(flow)).toBe("OPEN");
    expect(flowStatus(applyFlowAction(flow, "COMPLETE", "Ana", monday).steps)).toBe("IN_PROGRESS");
  });
  it("aguarda quando a etapa ativa é aprovação do cliente", () => {
    const result = applyFlowAction(steps("EXECUTOR", "CLIENT"), "COMPLETE", "Ana", monday);
    expect(result.to?.name).toBe("Etapa 2");
    expect(flowStatus(result.steps)).toBe("WAITING");
  });
  it("resolve ao concluir a última etapa e reabre nela", () => {
    const done = applyFlowAction(steps("EXECUTOR"), "COMPLETE", "Ana", monday);
    expect(done.to).toBeUndefined();
    expect(flowStatus(done.steps)).toBe("RESOLVED");
    expect(done.steps[0].completedByName).toBe("Ana");
    expect(flowStatus(reopenFlow(done.steps, monday))).toBe("OPEN");
  });
  it("aprovação devolve para a etapa anterior; execução não pode devolver", () => {
    const atApproval = applyFlowAction(steps("EXECUTOR", "APPROVER"), "COMPLETE", "Ana", monday).steps;
    expect(canReturnStep(atApproval)).toBe(true);
    const back = applyFlowAction(atApproval, "RETURN", "Bia", monday);
    expect(back.steps.map((item) => item.status)).toEqual(["ACTIVE", "PENDING"]);
    expect(canReturnStep(back.steps)).toBe(false);
    expect(() => applyFlowAction(back.steps, "RETURN", "Bia", monday)).toThrow();
  });
});

it("todo modelo tem ao menos uma etapa e nome único", () => {
  expect(ticketFlows.every((flow) => flow.steps.length > 0)).toBe(true);
  expect(new Set(ticketFlows.map((flow) => flow.id)).size).toBe(ticketFlows.length);
});

describe("ajustes solicitados", () => {
  it("fica visível na etapa devolvida até ela ser entregue de novo", () => {
    const sent = applyFlowAction(steps("EXECUTOR", "APPROVER", "EXECUTOR"), "COMPLETE", "Ana", monday).steps;
    const returned = applyFlowAction(sent, "RETURN", "Bia", monday, " Trocar a foto ").steps;
    expect(pendingAdjustment(returned)).toMatchObject({ note: "Trocar a foto", byName: "Bia", fromStepName: "Etapa 2" });
    expect(pendingAdjustment(applyFlowAction(returned, "COMPLETE", "Ana", monday).steps)).toBeUndefined();
  });
});
