import { describe, expect, it } from "vitest";
import { metaPrepaidBalance } from "./metaPrepaidBalance";

describe("metaPrepaidBalance", () => {
  it("lê o saldo disponível em português e em inglês", () => {
    expect(metaPrepaidBalance("Saldo disponível (R$ 1.234,56 BRL)")).toBe(1234.56);
    expect(metaPrepaidBalance("Available balance (R$1,234.56 BRL)")).toBe(1234.56);
    expect(metaPrepaidBalance("Saldo disponível (R$ 0,00 BRL)")).toBe(0);
    expect(metaPrepaidBalance("Saldo disponível (R$ 15.000 BRL)")).toBe(15000);
  });

  it("ignora formas de pagamento que não são saldo", () => {
    expect(metaPrepaidBalance("Visa *1234")).toBeNull();
    expect(metaPrepaidBalance(undefined)).toBeNull();
  });
});
