import { describe, expect, it } from "vitest";
import { linkedTaskStatus, ticketTaskType, workActionsForTaskStatus } from "./ticketTasks";

describe("demanda do Creative Ops ligada à etapa do chamado", () => {
  it("acompanha o andamento da etapa", () => {
    expect(linkedTaskStatus({ status: "ACTIVE" }, "OPEN")).toBe("TODO");
    expect(linkedTaskStatus({ status: "ACTIVE", work: { state: "RUNNING", elapsedMs: 0 } }, "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(linkedTaskStatus({ status: "ACTIVE", work: { state: "PAUSED", elapsedMs: 5 } }, "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(linkedTaskStatus({ status: "ACTIVE", work: { state: "FINISHED", elapsedMs: 5 } }, "IN_PROGRESS")).toBe("REVIEW");
    expect(linkedTaskStatus({ status: "DONE" }, "WAITING")).toBe("DONE");
    expect(linkedTaskStatus({ status: "ACTIVE", adjustment: { note: "x", byName: "Duda", fromStepName: "Aprovação", at: "" } }, "IN_PROGRESS")).toBe("CHANGES_REQUESTED");
    expect(linkedTaskStatus({ status: "ACTIVE", work: { state: "RUNNING", elapsedMs: 0 } }, "CLOSED")).toBe("CANCELLED");
  });

  it("mover a demanda vira ação no cronômetro; concluir só pelo chamado", () => {
    expect(workActionsForTaskStatus("IN_PROGRESS", "NOT_STARTED", "CH-1")).toEqual({ actions: ["START"] });
    expect(workActionsForTaskStatus("IN_PROGRESS", "FINISHED", "CH-1")).toEqual({ actions: ["REOPEN", "RESUME"] });
    expect(workActionsForTaskStatus("REVIEW", "NOT_STARTED", "CH-1")).toEqual({ actions: ["START", "FINISH"] });
    expect(workActionsForTaskStatus("REVIEW", "RUNNING", "CH-1")).toEqual({ actions: ["FINISH"] });
    expect(workActionsForTaskStatus("TODO", "RUNNING", "CH-1")).toEqual({ actions: ["PAUSE"] });
    expect(workActionsForTaskStatus("TODO", "PAUSED", "CH-1")).toHaveProperty("error");
    expect(workActionsForTaskStatus("DONE", "FINISHED", "CH-1")).toHaveProperty("error");
  });

  it("usa o tipo certo no Creative Ops", () => {
    expect(ticketTaskType("landing-page")).toEqual({ type: "WEB", subtype: "landing_page" });
    expect(ticketTaskType("creative").type).toBe("DESIGN");
    expect(ticketTaskType(undefined).type).toBe("OTHER");
  });
});
