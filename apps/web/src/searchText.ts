// Busca de texto do sistema: ignora acentos, maiúsculas e espaços extras, e exige que todas
// as palavras digitadas apareçam ("colchoes rj" encontra "Dom Colchões - RJ").
export const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function matchesSearch(query: string, ...texts: (string | null | undefined)[]) {
  const words = normalizeSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeSearch(texts.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}
