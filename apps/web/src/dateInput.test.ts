import { describe, expect, it } from "vitest";
import { toDateTimeInput } from "./dateInput";

describe("toDateTimeInput", () => {
  it("mostra no fuso do navegador uma data gravada em UTC", () => {
    const stored = "2026-09-28T20:00:00.000Z", local = toDateTimeInput(stored);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(local).getTime()).toBe(new Date(stored).getTime());
  });
  it("mantém datas já sem fuso e ignora vazias ou inválidas", () => {
    expect(toDateTimeInput("2026-09-28T17:00")).toBe("2026-09-28T17:00");
    expect(toDateTimeInput("")).toBe("");
    expect(toDateTimeInput("abc")).toBe("");
  });
});
