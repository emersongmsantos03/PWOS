import { describe, expect, it } from "vitest";
import { addDays, isMediaSnapshotFresh, lastDailySyncBoundary, saoPauloDay } from "./mediaFreshness";

// 2026-09-21 às 10:00 em São Paulo (UTC-3).
const morning = new Date("2026-09-21T13:00:00Z");

describe("mediaFreshness", () => {
  it("usa o dia de São Paulo, não o de UTC", () => {
    expect(saoPauloDay(new Date("2026-09-22T01:30:00Z"))).toBe("2026-09-21");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("a coleta diária mais recente é 04:00 de hoje, ou de ontem antes disso", () => {
    expect(lastDailySyncBoundary(morning).toISOString()).toBe("2026-09-21T07:00:00.000Z");
    expect(lastDailySyncBoundary(new Date("2026-09-21T05:00:00Z")).toISOString()).toBe("2026-09-20T07:00:00.000Z");
  });

  it("período que inclui hoje vale até a próxima coleta das 04:00", () => {
    const period = { until: "2026-09-21" };
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-21T07:30:00Z" }, morning)).toBe(true);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-21T06:59:00Z" }, morning)).toBe(false);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-20T22:00:00Z" }, morning)).toBe(false);
    // Às 02:00, o dado coletado ontem depois das 04:00 ainda é o dado do dia.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-20T15:00:00Z" }, new Date("2026-09-21T05:00:00Z"))).toBe(true);
  });

  it("período encerrado só fica definitivo após uma coleta feita depois do fechamento", () => {
    const period = { until: "2026-09-10" };
    // Coletado durante o último dia do período: ainda incompleto.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-10T20:00:00Z" }, morning)).toBe(false);
    // Coletado depois das 04:00 do dia seguinte: definitivo, e não expira mais.
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-11T07:00:00Z" }, morning)).toBe(true);
    expect(isMediaSnapshotFresh({ ...period, syncedAt: "2026-09-11T07:00:00Z" }, new Date("2027-01-01T12:00:00Z"))).toBe(true);
  });

  it("data de sincronização ausente ou inválida nunca é considerada atual", () => {
    expect(isMediaSnapshotFresh({ until: "2026-09-21" }, morning)).toBe(false);
    expect(isMediaSnapshotFresh({ until: "2026-09-21", syncedAt: "não é data" }, morning)).toBe(false);
  });
});
