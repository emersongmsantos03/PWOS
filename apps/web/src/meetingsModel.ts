import type { ClientBranch } from "./BranchSelect";
export type MeetingType = "FOLLOW_UP" | "PLANNING" | "RESULTS" | "ALIGNMENT" | "PRESENTATION" | "SUPPORT" | "OTHER";
export type MeetingFormat = "GOOGLE_MEET" | "PRESENTIAL" | "PHONE" | "WHATSAPP" | "OTHER";
export type MeetingStatus = "SCHEDULED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type ActionStatus = "PENDING" | "IN_PROGRESS" | "WAITING_CLIENT" | "SCHEDULED" | "DONE";
export type ActionOrigin = "CLIENT_REQUEST" | "DIAGNOSIS" | "OPPORTUNITY" | "MEETING_DECISION";
export type StatementKind = "" | "PRAISE" | "COMPLAINT" | "REQUEST" | "QUESTION" | "OPPORTUNITY";
export type PerceptionField = "satisfaction" | "contactQuality" | "contactVolume" | "commercialService" | "churnRisk" | "expansionPotential";
export type MeetingAction = { id: string; title: string; responsibleId: string; responsibleName: string; dueDate: string; origin: ActionOrigin; status: ActionStatus; notes: string };
export type Meeting = {
  id: string; clientId: string; clientName: string; unit: string; contactName: string; contactEmail: string; contactRole: string;
  startAt: string; durationMinutes: number; type: MeetingType; format: MeetingFormat; meetingUrl: string; subject: string; notes: string;
  responsibleId: string; responsibleName: string; participantIds: string[];
  notifications: { email: boolean; calendar: boolean; reminder: boolean; shareTeam: boolean };
  calendarEventId: string; status: MeetingStatus; startedAt: string; resumedAt: string; elapsedSeconds: number; completedAt: string;
  statements: { id: string; text: string; kind: StatementKind; createdAt: string }[];
  perception: Record<PerceptionField, string> & { notes: string };
  agenda: { id: string; label: string; done: boolean }[];
  actions: MeetingAction[]; summary: string; nextSteps: string;
  nextContact: { date: string; type: string; addToCalendar: boolean };
  nextMeeting: { enabled: boolean; date: string; time: string; invite: boolean };
  followUpMeetingId: string;
  attachments: { id: string; fileName: string; mimeType: string; size: number; createdAt: string; createdByName: string }[];
  rescheduleCount: number; createdById: string; createdByName: string; createdAt: string; updatedAt: string;
  google?: { synced: boolean; link: string; error: string } | null;
};
export type MeetingClient = { id: string; name: string; status: string; segment: string; website: string; createdAt: string; branches?: ClientBranch[] };
export type MeetingContact = { id: string; clientId: string; name: string; role: string; email: string };
export type MeetingUser = { id: string; name: string; role: string; departmentName: string };
export type MeetingsData = { meetings: Meeting[]; clients: MeetingClient[]; contacts: MeetingContact[]; users: MeetingUser[]; canViewTeam: boolean; googleConnected?: boolean };

export const typeLabels: Record<MeetingType, string> = { FOLLOW_UP: "Acompanhamento", PLANNING: "Planejamento", RESULTS: "Resultados", ALIGNMENT: "Alinhamento", PRESENTATION: "Apresentação", SUPPORT: "Suporte / Dúvidas", OTHER: "Outros" };
export const typeDescriptions: Record<MeetingType, string> = { FOLLOW_UP: "Resultados e ações em andamento", PLANNING: "Estratégia e próximos passos", RESULTS: "Análise de números e metas", ALIGNMENT: "Reunião interna ou entre equipes", PRESENTATION: "Nova proposta ou serviço", SUPPORT: "Atendimento ao cliente", OTHER: "Outro tipo de reunião" };
export const formatLabels: Record<MeetingFormat, string> = { GOOGLE_MEET: "Google Meet", PRESENTIAL: "Presencial", PHONE: "Ligação", WHATSAPP: "WhatsApp", OTHER: "Outro" };
export const actionStatusLabels: Record<ActionStatus, string> = { PENDING: "Pendente", IN_PROGRESS: "Em andamento", WAITING_CLIENT: "Aguardando cliente", SCHEDULED: "Programado", DONE: "Concluída" };
export const originLabels: Record<ActionOrigin, string> = { CLIENT_REQUEST: "Solicitação do cliente", DIAGNOSIS: "Diagnóstico PW", OPPORTUNITY: "Oportunidade", MEETING_DECISION: "Definição em reunião" };
export const statementLabels: Record<Exclude<StatementKind, "">, string> = { PRAISE: "Elogio", COMPLAINT: "Reclamação", REQUEST: "Solicitação", QUESTION: "Dúvida", OPPORTUNITY: "Oportunidade" };
export const perceptionRows: { field: PerceptionField; label: string; options: { value: string; label: string; tone: "good" | "mid" | "bad" | "info" }[] }[] = [
  { field: "satisfaction", label: "Satisfação geral", options: [{ value: "POSITIVE", label: "Positiva", tone: "good" }, { value: "NEUTRAL", label: "Neutra", tone: "mid" }, { value: "NEGATIVE", label: "Negativa", tone: "bad" }] },
  { field: "contactQuality", label: "Qualidade dos contatos", options: [{ value: "GOOD", label: "Boa", tone: "good" }, { value: "REGULAR", label: "Regular", tone: "mid" }, { value: "BAD", label: "Ruim", tone: "bad" }] },
  { field: "contactVolume", label: "Volume de contatos", options: [{ value: "GOOD", label: "Bom", tone: "good" }, { value: "IMPROVE", label: "Pode melhorar", tone: "mid" }, { value: "BAD", label: "Ruim", tone: "bad" }] },
  { field: "commercialService", label: "Atendimento comercial", options: [{ value: "GOOD", label: "Bom", tone: "good" }, { value: "REGULAR", label: "Regular", tone: "mid" }, { value: "BAD", label: "Ruim", tone: "bad" }] },
  { field: "churnRisk", label: "Risco de cancelamento", options: [{ value: "LOW", label: "Baixo", tone: "good" }, { value: "MEDIUM", label: "Médio", tone: "mid" }, { value: "HIGH", label: "Alto", tone: "bad" }] },
  { field: "expansionPotential", label: "Potencial de expansão", options: [{ value: "LOW", label: "Baixo", tone: "mid" }, { value: "MEDIUM", label: "Médio", tone: "good" }, { value: "HIGH", label: "Alto", tone: "info" }] },
];
export const contactRoles = ["Proprietário(a)", "Sócio(a)", "Diretor(a)", "Gerente", "Gerente de Marketing", "Coordenador(a)", "Vendedor(a)", "Outro"];
export const nextContactTypes = ["Retorno com ajustes", "Envio de relatório", "Ligação de acompanhamento", "Apresentação de proposta", "Envio de materiais"];

export type OverallPerception = "POSITIVE" | "ATTENTION" | "NEGATIVE" | "";
export const perceptionLabels: Record<Exclude<OverallPerception, "">, string> = { POSITIVE: "Positiva", ATTENTION: "Acompanhar", NEGATIVE: "Insatisfeita" };

/** Consolida a percepção detalhada em um único sinal para listas e relatórios. */
export function overallPerception(meeting: Pick<Meeting, "perception">): OverallPerception {
  const p = meeting.perception;
  if (![p.satisfaction, p.contactQuality, p.contactVolume, p.commercialService, p.churnRisk].some(Boolean)) return "";
  if (p.satisfaction === "NEGATIVE" || p.churnRisk === "HIGH") return "NEGATIVE";
  const anyBad = [p.contactQuality, p.contactVolume, p.commercialService].includes("BAD");
  if (p.satisfaction === "POSITIVE" && p.churnRisk !== "MEDIUM" && !anyBad) return "POSITIVE";
  return "ATTENTION";
}

export const isOpenAction = (action: MeetingAction) => action.status !== "DONE";
export const actionOverdue = (action: MeetingAction, today = localDay()) => isOpenAction(action) && !!action.dueDate && action.dueDate < today;

/** Status mostrado em listas: reuniões agendadas cujo horário passou sem início aparecem como "Não iniciada". */
export function displayStatus(meeting: Meeting, now = Date.now()) {
  if (meeting.status === "SCHEDULED" && new Date(meeting.startAt).getTime() + meeting.durationMinutes * 60000 < now) return { label: "Não iniciada", tone: "muted" };
  return ({ SCHEDULED: { label: "Agendada", tone: "blue" }, IN_PROGRESS: { label: "Em andamento", tone: "green" }, PAUSED: { label: "Pausada", tone: "yellow" }, COMPLETED: { label: "Concluída", tone: "green" }, CANCELLED: { label: "Cancelada", tone: "red" } } as const)[meeting.status];
}

export const pad = (value: number) => String(value).padStart(2, "0");
export const localDay = (date: Date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const dayOf = (iso: string) => localDay(new Date(iso));
export const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
export const startOfWeek = (date: Date) => { const next = new Date(date.getFullYear(), date.getMonth(), date.getDate()); next.setDate(next.getDate() - ((next.getDay() + 6) % 7)); return next; };
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const shortDate = (value: string) => { if (!value) return "—"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };
export const fullDate = (value: string) => { if (!value) return "—"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); return date.toLocaleDateString("pt-BR"); };
export const endTime = (meeting: Meeting) => timeOf(new Date(new Date(meeting.startAt).getTime() + meeting.durationMinutes * 60000).toISOString());
export const durationMinutes = (meeting: Meeting) => meeting.elapsedSeconds ? Math.max(1, Math.round(meeting.elapsedSeconds / 60)) : meeting.durationMinutes;
const capitalize = (value: string) => value.replace(/(^|\s)(\p{L})/gu, (match) => match.toUpperCase()).replace(/ De /g, " de ");

/** Rótulo do agrupamento por dia: "Hoje — 23 de Agosto de 2026 (Segunda-feira)". */
export function dayGroupLabel(day: string, today = new Date()) {
  const date = new Date(`${day}T12:00:00`);
  const long = capitalize(date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }));
  const weekday = capitalize(date.toLocaleDateString("pt-BR", { weekday: "long" }));
  const relative = day === localDay(today) ? "Hoje" : day === localDay(addDays(today, 1)) ? "Amanhã" : day === localDay(addDays(today, -1)) ? "Ontem" : "";
  return relative ? `${relative} — ${long} (${weekday})` : `${weekday} — ${long}`;
}

export function groupByDay(meetings: Meeting[], direction: "asc" | "desc" = "asc") {
  const groups = new Map<string, Meeting[]>();
  [...meetings].sort((a, b) => direction === "asc" ? a.startAt.localeCompare(b.startAt) : b.startAt.localeCompare(a.startAt)).forEach((meeting) => {
    const day = dayOf(meeting.startAt);
    groups.set(day, [...(groups.get(day) || []), meeting]);
  });
  return [...groups.entries()];
}

/** Classifica os assuntos das reuniões concluídas pelos itens de pauta tratados e pela pauta escrita. */
export const subjectThemes: { label: string; pattern: RegExp }[] = [
  { label: "Campanhas", pattern: /campanha|meta|google|an[úu]ncio/i },
  { label: "Leads / Resultados", pattern: /lead|resultado|contato|m[ée]trica|meta(s)? do m[êe]s/i },
  { label: "Criativos", pattern: /criativ|v[íi]deo|material|arte/i },
  { label: "Planejamento", pattern: /planej|pr[óo]ximo m[êe]s|estrat[ée]gia/i },
  { label: "Atendimento", pattern: /atendimento|suporte|d[úu]vida/i },
  { label: "Expansão", pattern: /expans|unidade|nova loja|oportunidade/i },
  { label: "Comercial", pattern: /comercial|venda|proposta|or[çc]amento/i },
];
export function meetingThemes(meeting: Meeting) {
  const text = [meeting.subject, ...meeting.agenda.filter((item) => item.done).map((item) => item.label)].join(" · ");
  return subjectThemes.filter((theme) => theme.pattern.test(text)).map((theme) => theme.label);
}

export const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const avatarTones = ["#c98a3c", "#6558d3", "#d6456b", "#8a55d6", "#e9853a", "#2b9d8f", "#3b6fd8", "#4c5bd4"];
export const avatarTone = (name: string) => avatarTones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarTones.length];

export function csvDownload(fileName: string, rows: string[][]) {
  const escape = (value: string) => /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const blob = new Blob(["﻿" + rows.map((row) => row.map(escape).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
