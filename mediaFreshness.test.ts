import { describe, expect, it } from "vitest";
import { addDays, currentSyncSlot, isMediaSnapshotFresh, lastSyncBoundary, saoPauloDay } from "./mediaFreshness";

// 2026-09-21 às 10:00 em São Paulo (UTC-3).
const morning = new Date("2026-09-21T13:00:00Z");

describe("mediaFreshness", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    expect(saoPauloDay(new Date("2026-09-22T01:30:00Z"))).toBe("2026-09-21");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("a coleta mais recente é a última entre 08:00, 13:00 e 16:00", () => {
    expect(lastSyncBoundary(morning).toISOString()).toBe("2026-09-21T11:00:00.000Z");
    expect(lastSyncBoundary(new Date("2026-09-21T17:30:00Z")).toISOString()).toBe("2026-09-21T16:00:00.000Z");
    expect(lastSyncBoundary(new Date("2026-09-21T22:00:00Z")).toISOString()).toBe("2026-09-21T19:00:00.000Z");
    // Antes das 08:00, vale a coleta das 16:00 de ontem.
    expect(lastSyncBoundary(new Date("2026-09-21T09:00:00Z")).toISOString()).toBe("2026-09-20T19:00:00.000Z");
  });

  it("identifica o horário de coleta em vigor", () => {
    expect(currentSyncSlot(morning)?.id).toBe("2026-09-21 08");
    expect(currentSyncSlot(new Date("2026-09-21T16:00:00Z"))?.id).toBe("2026-09-21 13");
    expect(currentSyncSlot(new Date("2026-09-22T01:00:00Z"))?.id).toBe("2026-09-21 16");
    expect(currentSyncSlot(new Date("2026-09-21T10:59:00Z"))).toBeNull();
  });

  it("período que inclui hoje vale até a próxima coleta agendada", () => {
    const period = { until: "2026-09-21" };
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-21T11:30:00Z" }, morning)).toBe(true);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-21T10:59:00Z" }, morning)).toBe(false);
    // Às 14:00, o dado das 08:00 já foi substituído pela coleta das 13:00.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-21T11:30:00Z" }, new Date("2026-09-21T17:00:00Z"))).toBe(false);
    // Às 05:00, o dado coletado ontem depois das 16:00 ainda é o atual.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-20T19:30:00Z" }, new Date("2026-09-21T08:00:00Z"))).toBe(true);
  });

  it("período encerrado só fica definitivo após uma coleta feita depois do fechamento", () => {
    const period = { until: "2026-09-10" };
    // Coletado durante o último dia do período: ainda incompleto.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-10T20:00:00Z" }, morning)).toBe(false);
    // Coletado depois das 08:00 do dia seguinte: definitivo, e não expira mais.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-11T08:00:00Z" }, morning)).toBe(false);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-11T11:00:00Z" }, morning)).toBe(true);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-11T11:00:00Z" }, new Date("2027-01-01T12:00:00Z"))).toBe(true);
  });

  it("data de sincronização ausente ou inválida nunca é considerada atual", () => {
    expect(isMediaSnapshotFresh({ until: "2026-09-21" }, morning)).toBe(false);
    expect(isMediaSnapshotFresh({ until: "2026-09-21", syncedAt: "não é data" }, morning)).toBe(false);
  });
});
