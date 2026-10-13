import { describe, expect, it } from "vitest";
import { applyWorkAction, closeWork, formatWorkTime, reopenWorkForAdjustment, workElapsed } from "./ticketWork";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 12, 12, minutes));

describe("cronômetro da etapa", () => {
  it("soma só o tempo em produção, sem contar as pausas", () => {
    let work = applyWorkAction(undefined, "START", at(0));
    work = applyWorkAction(work, "PAUSE", at(30));
    expect(workElapsed(work, at(50))).toBe(30 * 60000);
    work = applyWorkAction(work, "RESUME", at(50));
    expect(workElapsed(work, at(65))).toBe(45 * 60000);
    work = applyWorkAction(work, "FINISH", at(80));
    expect(work.state).toBe("FINISHED");
    expect(workElapsed(work, at(200))).toBe(60 * 60000);
    expect(work.firstStartedAt).toBe(at(0).toISOString());
  });

  it("não finaliza uma etapa que nem começou", () => {
    expect(() => applyWorkAction(undefined, "FINISH", at(0))).toThrow();
    expect(() => applyWorkAction(undefined, "PAUSE", at(0))).toThrow();
  });

  it("para o relógio quando a etapa sai de quem executa", () => {
    const running = applyWorkAction(undefined, "START", at(0));
    const closed = closeWork(running, at(10));
    expect(closed?.state).toBe("PAUSED");
    expect(workElapsed(closed, at(90))).toBe(10 * 60000);
  });

  it("devolução para ajustes recomeça a etapa e mantém o tempo trabalhado", () => {
    const finished = applyWorkAction(applyWorkAction(undefined, "START", at(0)), "FINISH", at(20));
    const reopened = reopenWorkForAdjustment(finished);
    expect(reopened.state).toBe("NOT_STARTED");
    expect(reopened.elapsedMs).toBe(20 * 60000);
  });

  it("guarda o rascunho sem mexer no relógio", () => {
    const work = applyWorkAction(undefined, "DRAFT", at(0), "  texto  ");
    expect(work).toMatchObject({ state: "NOT_STARTED", draft: "texto" });
  });

  it("formata horas e minutos", () => {
    expect(formatWorkTime(3 * 3600000 + 15 * 60000)).toBe("03h 15min");
  });
});
