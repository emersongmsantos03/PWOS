// Saldo pré-pago da Meta (Pix/boleto). A Graph API não tem um campo numérico para ele:
// o valor só aparece no texto de `funding_source_details.display_string`, por exemplo
// "Saldo disponível (R$ 1.234,56 BRL)" ou "Available balance (R$1,234.56 BRL)".
export function metaPrepaidBalance(displayString: string | undefined | null): number | null {
  if (!displayString || !/saldo|balance/i.test(displayString)) return null;
  const match = displayString.match(/(-?\d[\d.,\s]*)/);
  if (!match) return null;
  const raw = match[1].replace(/\s/g, "").replace(/[.,]$/, "");
  // O último separador seguido de 1 ou 2 dígitos é o decimal; os demais agrupam milhares.
  const decimal = raw.match(/[.,](\d{1,2})$/);
  const integer = (decimal ? raw.slice(0, -decimal[0].length) : raw).replace(/[.,]/g, "");
  const value = Number(`${integer}${decimal ? `.${decimal[1]}` : ""}`);
  return Number.isFinite(value) ? value : null;
}
