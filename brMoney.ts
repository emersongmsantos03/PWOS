// Valor em reais vindo de formulário ("3.500,00", "3500,5") ou já numérico (3500.5).
// Número é usado como está: remover os pontos de 2500.75 o transformaria em 250075.
export function brMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim().replace(/[R$\s]/g, "");
  if (!text) return 0;
  const parsed = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text);
  return Number.isFinite(parsed) ? parsed : 0;
}
