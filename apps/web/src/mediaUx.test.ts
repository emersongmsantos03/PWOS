import { describe, expect, it } from "vitest";
import { matchesMediaMetric, mediaPercentChange, mediaTrendCacheKey } from "./mediaUx";

describe("media UX helpers", () => {
  it("filtra campanhas pela métrica selecionada", () => {
    const campaign = { spend: 100, leads: 0, cpl: null };
    expect(matchesMediaMetric("SPEND", campaign)).toBe(true);
    expect(matchesMediaMetric("LEADS", campaign)).toBe(false);
    expect(matchesMediaMetric("CPL", campaign)).toBe(false);
  });

  it("calcula comparação normal e inversa", () => {
    expect(mediaPercentChange(120, 100)).toBe(20);
    expect(mediaPercentChange(120, 100, true)).toBe(-20);
    expect(mediaPercentChange(10, 0)).toBeNull();
  });

  it("isola o cache por período, granularidade e campanhas", () => {
    expect(mediaTrendCacheKey("WEEKLY", "2026-08-01", "2026-08-25", "meta:1"))
      .toBe("pw-os-media-trend:WEEKLY:2026-08-01:2026-08-25:meta:1");
  });
});
