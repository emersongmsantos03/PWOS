// Cor de cada pessoa da equipe em todo o sistema (agenda, painéis, listas). A Diretoria
// escolhe a cor oficial; sem escolha, cada pessoa recebe uma cor fixa a partir do id.
const defaultPalette = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0891b2",
  "#16a34a", "#ca8a04", "#dc2626", "#4f46e5", "#0d9488",
];
// Cores que podem ser escolhidas: as padrão mais o cinza (fora do sorteio, para não mudar
// a cor de quem ainda não escolheu).
export const teamPalette = [...defaultPalette, "#64748b"];
export const defaultUserColor = (id: string) =>
  defaultPalette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % defaultPalette.length];
export const userColor = (user?: { id: string; color?: string } | null) =>
  user ? user.color || defaultUserColor(user.id) : "#8fa0b2";
