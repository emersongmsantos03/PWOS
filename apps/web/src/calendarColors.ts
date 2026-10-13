// Cores de evento do Google Agenda (o id é o `colorId` da API do Google). Usar a mesma
// paleta mantém a cor igual no PW OS e no Google Agenda de quem recebe o evento.
export const googleEventColors: { id: string; name: string; hex: string }[] = [
  { id: "1", name: "Lavanda", hex: "#7986cb" },
  { id: "2", name: "Sálvia", hex: "#33b679" },
  { id: "3", name: "Uva", hex: "#8e24aa" },
  { id: "4", name: "Flamingo", hex: "#e67c73" },
  { id: "5", name: "Banana", hex: "#f6bf26" },
  { id: "6", name: "Tangerina", hex: "#f4511e" },
  { id: "7", name: "Pavão", hex: "#039be5" },
  { id: "8", name: "Grafite", hex: "#616161" },
  { id: "9", name: "Mirtilo", hex: "#3f51b5" },
  { id: "10", name: "Manjericão", hex: "#0b8043" },
  { id: "11", name: "Tomate", hex: "#d50000" },
];
export const eventColorHex = (colorId?: string) => googleEventColors.find((color) => color.id === colorId)?.hex;
export const validEventColorId = (value: unknown) => googleEventColors.some((color) => color.id === String(value)) ? String(value) : "";
// Cor escolhida para a agenda de uma pessoa: hexadecimal de 6 dígitos.
export const validCalendarColor = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : "";
