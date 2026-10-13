// Saldo das contas e detecção automática do crédito recebido — compartilhado entre a API
// (vite.config.ts) e o painel. Quando alguém marca "Solicitado", o sistema passa a acompanhar o
// menor saldo da conta; se o saldo sobe de novo (o cliente pagou e o crédito caiu), o pedido é
// marcado como "Recebido" sozinho, sem depender de alguém marcar.

export type BalanceAccount = {
  platform?: "META_ADS" | "GOOGLE_ADS";
  spendCap?: number;
  amountSpent?: number;
  prepaidBalance?: number | null;
  remainingBudget?: number | null;
};

// Meta: crédito pré-pago (Pix/boleto) e o que falta até o limite de gastos — vale o menor dos
// dois, pois qualquer um para a veiculação. Google: orçamento da conta ainda não veiculado.
export function accountBalance(account: BalanceAccount): number | null {
  if (account.platform === "GOOGLE_ADS")
    return account.remainingBudget == null ? null : Math.max(0, Number(account.remainingBudget));
  const cap = account.spendCap && account.spendCap > 0 ? Math.max(0, account.spendCap - Number(account.amountSpent || 0)) : null;
  const prepaid = account.prepaidBalance == null ? null : Math.max(0, account.prepaidBalance);
  return cap == null ? prepaid : prepaid == null ? cap : Math.min(cap, prepaid);
}

export type CreditMark = {
  requestedAt?: string; requestedBy?: string; receivedAt?: string; receivedBy?: string;
  // "AUTO": recebido detectado pelo aumento do saldo.
  receivedSource?: "AUTO";
  // Menor saldo visto desde o pedido; a subida a partir dele indica que o crédito caiu.
  lowestBalance?: number;
  previous?: { requestedAt: string; receivedAt?: string };
};

// Aumento mínimo do saldo (na moeda da conta) para considerar que o crédito caiu. Evita marcar
// recebido por pequenos ajustes do Google/Meta (créditos por cliques inválidos, arredondamentos).
export const creditPaymentThreshold = 20;
export const autoReceivedBy = "Automático (saldo subiu)";

// Atualiza um pedido em aberto com o saldo atual. Devolve null quando nada muda.
export function detectCreditPayment(mark: CreditMark, balance: number | null, now: Date): CreditMark | null {
  if (!mark.requestedAt || mark.receivedAt || balance == null || !Number.isFinite(balance)) return null;
  if (mark.lowestBalance == null) return { ...mark, lowestBalance: round(balance) };
  if (balance >= mark.lowestBalance + creditPaymentThreshold)
    return { ...mark, receivedAt: now.toISOString(), receivedBy: autoReceivedBy, receivedSource: "AUTO" };
  if (balance < mark.lowestBalance) return { ...mark, lowestBalance: round(balance) };
  return null;
}

const round = (value: number) => Math.round(value * 100) / 100;
