import { describe, expect, it } from "vitest";
import { brMoney } from "./brMoney";

describe("brMoney", () => {
  it("lê valores digitados no formato brasileiro", () => {
    expect(brMoney("3.500,00")).toBe(3500);
    expect(brMoney("R$ 1.234,56")).toBe(1234.56);
    expect(brMoney("2500,5")).toBe(2500.5);
    expect(brMoney("15.000")).toBe(15000);
  });

  it("mantém valores que já chegam como número", () => {
    expect(brMoney(2500.75)).toBe(2500.75);
    expect(brMoney("2500.75")).toBe(2500.75);
    expect(brMoney(0)).toBe(0);
  });

  it("devolve zero para vazio ou inválido", () => {
    expect(brMoney("")).toBe(0);
    expect(brMoney(undefined)).toBe(0);
    expect(brMoney("abc")).toBe(0);
  });
});
