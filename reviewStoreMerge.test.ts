import { describe, expect, it } from "vitest";
import { mergeById, mergeVerifications } from "./reviewStoreMerge";

describe("reviewStoreMerge", () => {
  it("mantém a análise feita na outra revisão do servidor", () => {
    const memory = { "META_ADS:a:1": { verified: false, verifiedAt: "", verifiedBy: "", history: [{ action: "ANALYSIS", createdAt: "2026-10-01T10:00:00Z", userId: "u1" }] } };
    const disk = {
      "META_ADS:a:1": { verified: true, verifiedAt: "2026-10-06T14:00:00Z", verifiedBy: "u2", history: [{ action: "REVIEW", createdAt: "2026-10-06T14:00:00Z", userId: "u2" }] },
      "META_ADS:a:2": { verified: true, verifiedAt: "2026-10-06T15:00:00Z", verifiedBy: "u2", history: [] },
    };
    const merged = mergeVerifications(memory, disk);
    expect(merged["META_ADS:a:1"]).toMatchObject({ verified: true, verifiedAt: "2026-10-06T14:00:00Z", verifiedBy: "u2" });
    expect(merged["META_ADS:a:1"].history?.map((entry) => entry.action)).toEqual(["ANALYSIS", "REVIEW"]);
    expect(merged["META_ADS:a:2"].verified).toBe(true);
  });

  it("não duplica a mesma entrada", () => {
    const entry = { action: "REVIEW", createdAt: "2026-10-06T14:00:00Z", userId: "u2" };
    const merged = mergeVerifications({ k: { verified: true, verifiedAt: entry.createdAt, verifiedBy: "u2", history: [entry] } }, { k: { verified: true, verifiedAt: entry.createdAt, verifiedBy: "u2", history: [{ ...entry }] } });
    expect(merged.k.history).toHaveLength(1);
  });

  it("junta revisões de portfólio pelo id", () => {
    const merged = mergeById({ p: [{ id: "1", createdAt: "2026-10-01" }] }, { p: [{ id: "2", createdAt: "2026-10-06" }, { id: "1", createdAt: "2026-10-01" }] });
    expect(merged.p.map((item) => item.id)).toEqual(["1", "2"]);
  });
});
