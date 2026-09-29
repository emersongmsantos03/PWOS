// Converte uma data gravada (com fuso, ex.: "2026-09-28T20:00:00.000Z", ou sem fuso) para o
// formato do campo <input type="datetime-local"> no horário do navegador. Cortar o texto com
// slice(0, 16) mostraria o horário em UTC, três horas adiantado.
export const toDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
