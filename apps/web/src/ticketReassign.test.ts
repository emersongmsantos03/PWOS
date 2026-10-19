import { describe, expect, it } from "vitest";
import type { TicketStep } from "./ticketFlows";
import { canReassignStep, canReassignTicket, quotedList, reassignRights, reassignSteps } from "./ticketReassign";

const departments = [{ id: "mkt", managerUserId: "duda" }, { id: "cs", managerUserId: "carla" }];
const people = [
  { id: "duda", name: "Duda", departmentId: "mkt" }, { id: "ana", name: "Ana", departmentId: "mkt" },
  { id: "bia", name: "Bia", departmentId: "mkt" }, { id: "carla", name: "Carla", departmentId: "cs" },
];
const step = (id: string, assigneeId: string, status: TicketStep["status"] = "PENDING"): TicketStep =>
  ({ id, name: `Etapa ${id}`, role: "EXECUTOR", days: 1, assigneeId, assigneeName: people.find((p) => p.id === assigneeId)?.name || assigneeId, status, dueAt: "" });
const now = new Date("2026-10-19T12:00:00.000Z");

describe("quem pode reatribuir", () => {
  it("o líder repassa só para o próprio setor", () => {
    const rights = reassignRights("duda", false, departments, people);
    expect([...rights.teamIds].sort()).toEqual(["ana", "bia", "duda"]);
    expect(rights.any).toBe(false);
  });
  it("quem não lidera setor não repassa", () => {
    const rights = reassignRights("ana", false, departments, people);
    expect(canReassignStep(step("1", "ana", "ACTIVE"), "ana", rights)).toBe(false);
  });
  it("o líder repassa as partes dele e do time, nunca as concluídas nem as de outro setor", () => {
    const rights = reassignRights("duda", false, departments, people);
    expect(canReassignStep(step("1", "duda", "ACTIVE"), "duda", rights)).toBe(true);
    expect(canReassignStep(step("2", "ana"), "duda", rights)).toBe(true);
    expect(canReassignStep(step("3", "duda", "DONE"), "duda", rights)).toBe(false);
    expect(canReassignStep(step("4", "carla"), "duda", rights)).toBe(false);
  });
  it("quem atribui chamados repassa qualquer parte em aberto", () => {
    const rights = reassignRights("chefe", true, departments, people);
    expect(canReassignStep(step("1", "carla"), "chefe", rights)).toBe(true);
    expect(rights.teamIds.has("carla")).toBe(true);
  });
  it("chamado encerrado não é repassado; sem etapas, vale o responsável", () => {
    const rights = reassignRights("duda", false, departments, people);
    expect(canReassignTicket({ status: "RESOLVED", assigneeId: "duda" }, "duda", rights)).toBe(false);
    expect(canReassignTicket({ status: "OPEN", assigneeId: "duda" }, "duda", rights)).toBe(true);
    expect(canReassignTicket({ status: "OPEN", assigneeId: "carla" }, "duda", rights)).toBe(false);
  });
});

describe("repassar etapas", () => {
  it("troca o responsável, registra o repasse e para o cronômetro", () => {
    const running = { ...step("1", "duda", "ACTIVE"), work: { state: "RUNNING" as const, elapsedMs: 0, runningSince: "2026-10-19T11:00:00.000Z" } };
    const { steps, moved } = reassignSteps([running, step("2", "duda"), step("3", "duda", "DONE")], ["1", "2", "3"], { id: "ana", name: "Ana" }, { id: "duda", name: "Duda" }, now, "Agenda cheia");
    expect(moved.map((item) => item.id)).toEqual(["1", "2"]);
    expect(steps[0]).toMatchObject({ assigneeId: "ana", assigneeName: "Ana", handoff: { fromName: "Duda", byName: "Duda", note: "Agenda cheia" } });
    expect(steps[0].work).toMatchObject({ state: "PAUSED", elapsedMs: 3600000 });
    expect(steps[2].assigneeId).toBe("duda");
  });
  it("ignora o que já está com a pessoa", () => {
    expect(reassignSteps([step("1", "ana")], ["1"], { id: "ana", name: "Ana" }, { id: "duda", name: "Duda" }, now).moved).toEqual([]);
  });
  it("lista os nomes entre aspas", () => {
    expect(quotedList(["A"])).toBe("“A”");
    expect(quotedList(["A", "B", "C"])).toBe("“A”, “B” e “C”");
  });
});
