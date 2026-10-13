import { describe, expect, it } from "vitest";
import { accountBalance, autoReceivedBy, detectCreditPayment } from "./creditBalance";

const now = new Date("2026-10-13T16:00:00.000Z");

describe("saldo da conta", () => {
  it("Google usa o orçamento restante; Meta usa o menor entre pré-pago e limite", () => {
    expect(accountBalance({ platform: "GOOGLE_ADS", remainingBudget: 158.24 })).toBe(158.24);
    expect(accountBalance({ platform: "GOOGLE_ADS", remainingBudget: null })).toBeNull();
    expect(accountBalance({ platform: "META_ADS", spendCap: 1000, amountSpent: 900, prepaidBalance: 300 })).toBe(100);
    expect(accountBalance({ platform: "META_ADS", prepaidBalance: 42 })).toBe(42);
    expect(accountBalance({ platform: "META_ADS", spendCap: 0, prepaidBalance: null })).toBeNull();
  });
});

describe("crédito recebido detectado pelo saldo", () => {
  it("guarda o saldo do pedido como ponto de partida (inclusive em pedidos antigos)", () => {
    expect(detectCreditPayment({ requestedAt: "2026-10-06T16:00:00.000Z" }, 158.24, now)).toMatchObject({ lowestBalance: 158.24 });
  });

  it("acompanha o menor saldo enquanto a conta gasta", () => {
    expect(detectCreditPayment({ requestedAt: "x", lowestBalance: 158 }, 90, now)).toMatchObject({ lowestBalance: 90 });
    expect(detectCreditPayment({ requestedAt: "x", lowestBalance: 90 }, 95, now)).toBeNull();
  });

  it("marca recebido quando o saldo sobe a partir do menor valor", () => {
    const result = detectCreditPayment({ requestedAt: "x", requestedBy: "Priscila", lowestBalance: 12 }, 372, now);
    expect(result).toMatchObject({ receivedAt: now.toISOString(), receivedBy: autoReceivedBy, receivedSource: "AUTO", requestedBy: "Priscila" });
  });

  it("não mexe em pedidos já recebidos, sem pedido ou sem saldo conhecido", () => {
    expect(detectCreditPayment({ requestedAt: "x", receivedAt: "y", lowestBalance: 0 }, 500, now)).toBeNull();
    expect(detectCreditPayment({ previous: { requestedAt: "x" } }, 500, now)).toBeNull();
    expect(detectCreditPayment({ requestedAt: "x", lowestBalance: 10 }, null, now)).toBeNull();
  });
});
