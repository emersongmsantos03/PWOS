import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, BarChart3, Bell, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, Check,
  CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Clock, Download, FileArchive, FileImage, FileText, FilterX, Frown, Headphones, Heart,
  HelpCircle, History, Home, Lightbulb, List, ListChecks, Megaphone, Meh, MessageCircle, MoreVertical, Paperclip, Pause, Pencil, Play, Plus, Presentation, Quote,
  Search, Smile, Sparkles, Square, Target, ThumbsUp, Timer, Trash2, TrendingUp, UserRound, Users, Video, X, XCircle,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SearchableSelect } from "./SearchableSelect";
import { systemConfirm } from "./SystemDialog";
import {
  actionOverdue, actionStatusLabels, addDays, avatarTone, contactRoles, csvDownload, dayGroupLabel, dayOf, displayStatus, durationMinutes, endTime, formatLabels,
  fullDate, groupByDay, initials, isOpenAction, localDay, meetingThemes, nextContactTypes, originLabels, overallPerception, pad, perceptionLabels, perceptionRows,
  shortDate, startOfWeek, statementLabels, subjectThemes, timeOf, typeDescriptions, typeLabels,
  type ActionOrigin, type ActionStatus, type Meeting, type MeetingAction, type MeetingFormat, type MeetingsData, type MeetingType, type OverallPerception, type StatementKind,
} from "./meetingsModel";
import "./Meetings.css";

type SessionUser = { id: string; name: string; profile: string; permissions?: string[] };
export type MeetingsView = "schedule" | "scheduled" | "live" | "completed" | "detail" | "reports";
type CalendarEvent = { id: string; title: string; ownerId: string; participantIds: string[]; startAt: string; endAt: string; location: string; category: string };

async function api<T>(path: string, init?: RequestInit & { json?: unknown }) {
  const response = await fetch(`/api${path}`, { ...init, headers: { "Content-Type": "application/json" }, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload as T;
}

function useMeetings() {
  const [data, setData] = useState<MeetingsData | null>(null), [error, setError] = useState("");
  const load = useCallback(() => api<MeetingsData>("/meetings").then((value) => { setData(value); setError(""); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  const upsert = useCallback((meeting: Meeting) => setData((current) => current && ({ ...current, meetings: current.meetings.some((item) => item.id === meeting.id) ? current.meetings.map((item) => item.id === meeting.id ? meeting : item) : [...current.meetings, meeting] })), []);
  const remove = useCallback((id: string) => setData((current) => current && ({ ...current, meetings: current.meetings.filter((item) => item.id !== id) })), []);
  return { data, error, load, upsert, remove };
}
type Store = ReturnType<typeof useMeetings> & { data: MeetingsData };

const quotes = [
  ["Disciplina hoje,", "grandes resultados amanhã."],
  ["Relacionamento bem cuidado", "vira resultado no longo prazo."],
  ["Boa comunicação hoje,", "clientes mais próximos amanhã."],
  ["Relacionamento bem cuidado,", "clientes que crescem com a gente."],
];

export function MeetingsManagement({ view, user }: { view: MeetingsView; user: SessionUser }) {
  const store = useMeetings();
  const can = (permission: string) => user.profile === "MASTER" || !!user.permissions?.includes(permission);
  if (store.error && !store.data) return <div className="mt-page"><p className="mt-alert" role="alert">{store.error}</p></div>;
  if (!store.data) return <div className="mt-page"><div className="mt-loading" role="status"><CalendarDays /> Carregando reuniões…</div></div>;
  const props = { store: store as Store, user, can };
  return <div className="mt-page">
    {view === "schedule" && <ScheduleView {...props} />}
    {view === "scheduled" && <ScheduledView {...props} />}
    {view === "live" && <LiveView {...props} />}
    {view === "completed" && <CompletedView {...props} />}
    {view === "detail" && <DetailView {...props} />}
    {view === "reports" && <ReportsView {...props} />}
  </div>;
}
type ViewProps = { store: Store; user: SessionUser; can: (permission: string) => boolean };

/* ---------- Peças compartilhadas ---------- */

function PageHeader({ icon: Icon, crumb, title, subtitle, quote, actions }: { icon: typeof CalendarDays; crumb: string; title: string; subtitle: string; quote?: number; actions?: ReactNode }) {
  return <header className="mt-header">
    <nav className="mt-crumbs" aria-label="Você está em"><NavLink to="/" aria-label="Início"><Home /></NavLink><ChevronRight /><NavLink to="/reunioes/agendadas">Customer Success</NavLink><ChevronRight /><b>{crumb}</b></nav>
    <div className="mt-header-row">
      <span className="mt-header-icon"><Icon /></span>
      <div className="mt-header-copy"><h1>{title}</h1><p>{subtitle}</p></div>
      {quote !== undefined && <blockquote className="mt-quote"><Quote /><span>"{quotes[quote][0]}<br />{quotes[quote][1]}"</span><cite>Dyego Pessoa</cite></blockquote>}
      {actions && <div className="mt-header-actions">{actions}</div>}
    </div>
  </header>;
}

function Card({ icon: Icon, title, action, children, className = "" }: { icon: typeof CalendarDays; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`mt-card ${className}`}><header className="mt-card-head"><Icon /><h2>{title}</h2>{action}</header>{children}</section>;
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return <span className={`mt-avatar ${size}`} style={{ background: avatarTone(name || "?") }} aria-hidden="true">{initials(name || "?")}</span>;
}

function Badge({ tone, children }: { tone: string; children: ReactNode }) { return <span className={`mt-badge ${tone}`}>{children}</span>; }

function PerceptionBadge({ value }: { value: OverallPerception }) {
  if (!value) return <Badge tone="muted">Sem registro</Badge>;
  const Icon = value === "POSITIVE" ? Smile : value === "ATTENTION" ? Meh : Frown;
  return <Badge tone={value === "POSITIVE" ? "green" : value === "ATTENTION" ? "yellow" : "red"}><Icon />{perceptionLabels[value]}</Badge>;
}

const actionTone: Record<ActionStatus, string> = { PENDING: "orange", IN_PROGRESS: "blue", WAITING_CLIENT: "yellow", SCHEDULED: "muted", DONE: "green" };

function RowMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const visible = items.filter((item) => !item.hidden);
  if (!visible.length) return <span className="mt-menu-placeholder" />;
  return <div className="mt-menu" ref={ref}>
    <button type="button" className="mt-icon-button" aria-label="Mais ações" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreVertical /></button>
    {open && <div className="mt-menu-list" role="menu">{visible.map((item) => <button type="button" role="menuitem" key={item.label} className={item.danger ? "danger" : ""} onClick={() => { setOpen(false); item.onClick(); }}>{item.label}</button>)}</div>}
  </div>;
}

function Notice({ notice, onClose }: { notice: { tone: "ok" | "error" | "warn"; text: string; link?: { to: string; label: string } } | null; onClose: () => void }) {
  if (!notice) return null;
  return <div className={`mt-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
    {notice.tone === "ok" ? <CheckCircle2 /> : <AlertCircle />}<span>{notice.text}</span>{notice.link && <NavLink to={notice.link.to}>{notice.link.label}</NavLink>}
    <button type="button" aria-label="Fechar aviso" onClick={onClose}><X /></button>
  </div>;
}
type NoticeState = Parameters<typeof Notice>[0]["notice"];

function Pagination({ total, page, perPage, onPage, onPerPage, noun }: { total: number; page: number; perPage: number; onPage: (page: number) => void; onPerPage: (value: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / perPage)), shown = Math.min(perPage, Math.max(0, total - (page - 1) * perPage));
  return <footer className="mt-pagination">
    <span>Mostrando {shown} de {total} {noun}</span>
    <label>Itens por página<select value={perPage} onChange={(event) => onPerPage(Number(event.target.value))}>{[10, 20, 50].map((value) => <option key={value}>{value}</option>)}</select></label>
    <nav aria-label="Paginação"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft /></button>
      {Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.max(0, page - 3) + 5).map((value) => <button type="button" key={value} className={value === page ? "active" : ""} onClick={() => onPage(value)}>{value}</button>)}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Próxima página"><ChevronRight /></button></nav>
  </footer>;
}

function FormatBadge({ format }: { format: MeetingFormat }) {
  const Icon = format === "GOOGLE_MEET" ? Video : format === "PRESENTIAL" ? Users : format === "PHONE" ? Headphones : MessageCircle;
  return <span className={`mt-format ${format.toLowerCase()}`}><Icon />{formatLabels[format]}</span>;
}

const selectAll = (checked: boolean, ids: string[], set: (value: Set<string>) => void) => set(new Set(checked ? ids : []));

/* ---------- Agendar ---------- */

type ScheduleForm = { clientId: string; unit: string; contactName: string; contactEmail: string; contactRole: string; date: string; time: string; durationMinutes: number; type: MeetingType; format: MeetingFormat; meetingUrl: string; subject: string; notes: string; responsibleId: string; participantIds: string[]; notifications: Meeting["notifications"] };
const emptyForm = (userId: string, date = localDay()): ScheduleForm => ({ clientId: "", unit: "", contactName: "", contactEmail: "", contactRole: "", date, time: "", durationMinutes: 30, type: "FOLLOW_UP", format: "GOOGLE_MEET", meetingUrl: "", subject: "", notes: "", responsibleId: userId, participantIds: [], notifications: { email: true, calendar: true, reminder: true, shareTeam: false } });
const typeIcons: Record<MeetingType, typeof Users> = { FOLLOW_UP: UserRound, PLANNING: CalendarDays, RESULTS: BarChart3, ALIGNMENT: Users, PRESENTATION: Presentation, SUPPORT: HelpCircle, OTHER: FileText };

function ScheduleView({ store, user, can }: ViewProps) {
  const { data } = store, navigate = useNavigate(), [params, setParams] = useSearchParams(), editingId = params.get("editar") || "";
  const editing = data.meetings.find((item) => item.id === editingId);
  const [form, setForm] = useState<ScheduleForm>(() => ({ ...emptyForm(user.id, params.get("data") || localDay()), clientId: params.get("cliente") || "" }));
  const [events, setEvents] = useState<CalendarEvent[]>([]), [saving, setSaving] = useState(false), [notice, setNotice] = useState<NoticeState>(null), [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!editing) return;
    const start = new Date(editing.startAt);
    setForm({ clientId: editing.clientId, unit: editing.unit, contactName: editing.contactName, contactEmail: editing.contactEmail, contactRole: editing.contactRole, date: localDay(start), time: `${pad(start.getHours())}:${pad(start.getMinutes())}`, durationMinutes: editing.durationMinutes, type: editing.type, format: editing.format, meetingUrl: editing.meetingUrl, subject: editing.subject, notes: editing.notes, responsibleId: editing.responsibleId, participantIds: editing.participantIds, notifications: editing.notifications });
  }, [editing?.id]);
  useEffect(() => { if (can("calendar.view")) api<{ events: CalendarEvent[] }>("/calendar/events").then((value) => setEvents(value.events)).catch(() => setEvents([])); }, []);
  const set = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const clientContacts = data.contacts.filter((contact) => contact.clientId === form.clientId);
  const units = [...new Set(data.meetings.filter((item) => item.clientId === form.clientId && item.unit).map((item) => item.unit))];
  const linkedEventIds = new Set(data.meetings.map((item) => item.calendarEventId).filter(Boolean));
  const dayItems = [
    ...data.meetings.filter((item) => item.id !== editingId && item.status !== "CANCELLED" && item.responsibleId === form.responsibleId && dayOf(item.startAt) === form.date).map((item) => ({ id: item.id, start: new Date(item.startAt).getTime(), end: new Date(item.startAt).getTime() + item.durationMinutes * 60000, title: item.clientName, detail: item.subject || typeLabels[item.type], tone: item.type === "ALIGNMENT" ? "purple" : item.type === "PLANNING" ? "orange" : "blue" })),
    ...events.filter((event) => !linkedEventIds.has(event.id) && (event.ownerId === form.responsibleId || event.participantIds.includes(form.responsibleId)) && dayOf(event.startAt) === form.date).map((event) => ({ id: event.id, start: new Date(event.startAt).getTime(), end: new Date(event.endAt).getTime(), title: event.title, detail: event.location || "Compromisso", tone: "purple" })),
  ].sort((a, b) => a.start - b.start);
  const busy = (time: string) => {
    const start = new Date(`${form.date}T${time}:00`).getTime(), end = start + form.durationMinutes * 60000;
    return dayItems.some((item) => start < item.end && end > item.start);
  };
  const slots = Array.from({ length: 20 }, (_, index) => `${pad(8 + Math.floor(index / 2))}:${index % 2 ? "30" : "00"}`);
  const slotDisabled = (time: string) => busy(time) || new Date(`${form.date}T${time}:00`).getTime() < Date.now();
  const selectedFree = form.time && !busy(form.time);
  const missing = { clientId: !form.clientId, contactName: !form.contactName.trim(), date: !form.date, time: !form.time, subject: !form.subject.trim() };
  const recent = data.meetings.filter((item) => item.status === "SCHEDULED" && new Date(item.startAt).getTime() >= Date.now() - 3600000).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const teammates = data.users.filter((member) => member.id !== form.responsibleId);
  const shareNames = teammates.filter((member) => form.participantIds.includes(member.id)).map((member) => member.name.split(" ")[0]);
  const reset = () => { setForm(emptyForm(user.id)); setTouched(false); if (editingId) setParams({}); };
  const submit = async () => {
    setTouched(true);
    if (Object.values(missing).some(Boolean)) { setNotice({ tone: "error", text: "Preencha os campos obrigatórios marcados com *." }); return; }
    if (busy(form.time) && !(await systemConfirm({ title: "Horário ocupado", message: "O responsável já tem um compromisso nesse horário. Deseja agendar mesmo assim?", confirmLabel: "Agendar mesmo assim", tone: "warning" }))) return;
    setSaving(true);
    try {
      const { date, time, ...rest } = form, payload = { ...rest, startAt: new Date(`${date}T${time}:00`).toISOString() };
      const result = editing ? await api<{ meeting: Meeting; warning?: string }>(`/meetings/${editing.id}`, { method: "PATCH", json: payload }) : await api<{ meeting: Meeting; warning?: string }>("/meetings", { method: "POST", json: payload });
      store.upsert(result.meeting);
      setNotice(result.warning ? { tone: "warn", text: result.warning } : { tone: "ok", text: `${editing ? "Reunião atualizada." : `Reunião com ${result.meeting.clientName} agendada para ${fullDate(result.meeting.startAt)} às ${timeOf(result.meeting.startAt)}.`}${result.meeting.google?.synced ? " Evento criado no Google Agenda" + (result.meeting.meetingUrl.includes("meet.google.com") ? " com link do Meet." : ".") : ""}`, link: { to: `/reunioes/${result.meeting.id}`, label: "Ver reunião" } });
      reset();
    } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); } finally { setSaving(false); }
  };
  const cancelMeeting = async (meeting: Meeting) => {
    if (!(await systemConfirm({ title: "Cancelar reunião", message: `Cancelar a reunião com ${meeting.clientName} em ${fullDate(meeting.startAt)} às ${timeOf(meeting.startAt)}? O evento também sai da agenda.`, confirmLabel: "Cancelar reunião", cancelLabel: "Voltar", tone: "danger" }))) return;
    try { store.upsert((await api<{ meeting: Meeting }>(`/meetings/${meeting.id}`, { method: "PATCH", json: { transition: "cancel" } })).meeting); } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
  };
  const invalid = (key: keyof typeof missing) => touched && missing[key] ? "invalid" : "";
  const canCreate = can(editing ? "meetings.edit" : "meetings.create");
  const formatDay = new Date(`${form.date || localDay()}T12:00:00`);

  return <>
    <PageHeader icon={CalendarPlus} crumb={editing ? "Editar" : "Agendar"} title={editing ? "Editar Reunião" : "Agendar Reunião"} subtitle="Programe uma nova reunião com o cliente e mantenha o relacionamento sempre em dia." quote={1} />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    {editingId && !editing && <p className="mt-alert">A reunião que você tentou editar não foi encontrada.</p>}
    <div className="mt-schedule-grid">
      <Card icon={CalendarPlus} title="Dados da reunião" className="mt-form-card">
        <div className="mt-form">
          <label className={`span-6 ${invalid("clientId")}`}>Cliente / Grupo <em>*</em>
            <SearchableSelect value={form.clientId} onChange={(clientId) => setForm((current) => ({ ...current, clientId, unit: "", contactName: "", contactEmail: "", contactRole: "" }))} placeholder="Selecione o cliente ou grupo" searchPlaceholder="Buscar cliente ou grupo..." options={data.clients.map((client) => ({ value: client.id, label: client.name }))} /></label>
          <label className="span-6">Loja / Unidade<input list="mt-units" value={form.unit} maxLength={80} placeholder="Ex.: Matriz, Cambé - PR (opcional)" onChange={(event) => set("unit", event.target.value)} /><datalist id="mt-units">{["Matriz", ...units].map((unit) => <option key={unit} value={unit} />)}</datalist></label>
          <label className={`span-6 ${invalid("contactName")}`}>Contato / Participante <em>*</em>
            <input list="mt-contacts" value={form.contactName} maxLength={120} placeholder="Nome do participante" onChange={(event) => { const contact = clientContacts.find((item) => item.name === event.target.value); setForm((current) => ({ ...current, contactName: event.target.value, ...(contact ? { contactEmail: contact.email, contactRole: contact.role || current.contactRole } : {}) })); }} />
            <datalist id="mt-contacts">{clientContacts.map((contact) => <option key={contact.id} value={contact.name}>{contact.role}</option>)}</datalist></label>
          <label className="span-6">Cargo (opcional)<SearchableSelect value={form.contactRole} onChange={(value) => set("contactRole", value)} searchable={false} options={[{ value: "", label: "Selecione" }, ...[...new Set([...contactRoles, form.contactRole].filter(Boolean))].map((role) => ({ value: role, label: role }))]} /></label>
          <label className="span-12">E-mail do participante<input type="email" value={form.contactEmail} maxLength={160} placeholder="Usado para enviar o convite (opcional)" onChange={(event) => set("contactEmail", event.target.value)} /></label>
          <label className={`span-4 ${invalid("date")}`}>Data <em>*</em><input type="date" value={form.date} onChange={(event) => set("date", event.target.value)} /></label>
          <label className={`span-4 ${invalid("time")}`}>Horário <em>*</em><input type="time" value={form.time} step={900} onChange={(event) => set("time", event.target.value)} /></label>
          <label className="span-4">Duração<SearchableSelect value={String(form.durationMinutes)} onChange={(value) => set("durationMinutes", Number(value))} searchable={false} options={([[15, "15 minutos"], [30, "30 minutos"], [45, "45 minutos"], [60, "1 hora"], [90, "1h30"], [120, "2 horas"]] as const).map(([value, label]) => ({ value: String(value), label }))} /></label>
          <label className="span-6">Tipo da reunião <em>*</em><SearchableSelect value={form.type} onChange={(value) => set("type", value as MeetingType)} searchable={false} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label: value === "FOLLOW_UP" ? "Reunião de acompanhamento" : label }))} /></label>
          <label className="span-6">Formato <em>*</em><SearchableSelect value={form.format} onChange={(value) => set("format", value as MeetingFormat)} searchable={false} options={Object.entries(formatLabels).map(([value, label]) => ({ value, label }))} /></label>
          {["GOOGLE_MEET", "OTHER"].includes(form.format) && <label className="span-12">Link da reunião<input type="url" value={form.meetingUrl} maxLength={300} placeholder={data.googleConnected && form.format === "GOOGLE_MEET" ? "Deixe em branco para gerar automaticamente" : "https://meet.google.com/…"} onChange={(event) => set("meetingUrl", event.target.value)} /></label>}
          {data.canViewTeam && <label className="span-12">Responsável<SearchableSelect value={form.responsibleId} onChange={(value) => set("responsibleId", value)} searchPlaceholder="Buscar responsável..." options={data.users.map((member) => ({ value: member.id, label: member.name }))} /></label>}
          <label className={`span-12 ${invalid("subject")}`}>Assunto / Pauta <em>*</em><textarea rows={3} maxLength={150} value={form.subject} placeholder="Ex.: Resultados do mês, próximos passos, planejamento…" onChange={(event) => set("subject", event.target.value)} /><small>{form.subject.length}/150</small></label>
          <label className="span-12">Observações (opcional)<textarea rows={3} maxLength={500} value={form.notes} placeholder="Informações adicionais, materiais necessários, links, etc…" onChange={(event) => set("notes", event.target.value)} /><small>{form.notes.length}/500</small></label>
          <p className={`span-12 mt-google-hint ${data.googleConnected ? "on" : ""}`}><Video />{data.googleConnected ? (form.format === "GOOGLE_MEET" && !form.meetingUrl ? "Google Workspace conectado: o link do Meet será criado automaticamente e o convite sai pelo seu Google Agenda." : "Google Workspace conectado: a reunião vai para o seu Google Agenda.") : <>Conecte sua conta Google em <NavLink to="/configuracoes">Configurações → Conta Google e e-mail</NavLink> para criar o link do Meet e o evento no Google Agenda automaticamente.</>}</p>
          <fieldset className="span-12 mt-notifications"><legend><Bell /> Notificações</legend>
            <label><input type="checkbox" checked={form.notifications.email} onChange={(event) => set("notifications", { ...form.notifications, email: event.target.checked })} />Enviar convite por e-mail para o participante</label>
            <label><input type="checkbox" checked={form.notifications.calendar} onChange={(event) => set("notifications", { ...form.notifications, calendar: event.target.checked })} />{data.googleConnected ? "Adicionar na agenda do PW OS e no Google Agenda" : "Adicionar na agenda do PW OS"}</label>
            <label><input type="checkbox" checked={form.notifications.reminder} onChange={(event) => set("notifications", { ...form.notifications, reminder: event.target.checked })} />Enviar lembrete 1 hora antes</label>
            <label><input type="checkbox" checked={form.notifications.shareTeam} onChange={(event) => set("notifications", { ...form.notifications, shareTeam: event.target.checked })} />Compartilhar com a equipe{shareNames.length ? ` (${shareNames.join(", ")})` : " (selecione em Participantes sugeridos)"}</label>
          </fieldset>
          <div className="span-12 mt-form-actions"><button type="button" className="mt-button ghost" onClick={reset}>{editing ? "Cancelar edição" : "Limpar"}</button><button type="button" className="mt-button primary" disabled={saving || !canCreate} onClick={submit}><CalendarPlus />{saving ? "Salvando…" : editing ? "Salvar alterações" : "Agendar Reunião"}</button></div>
        </div>
      </Card>
      <div className="mt-column">
        <Card icon={CalendarDays} title="Agenda do dia" action={<NavLink className="mt-link" to="/agenda">Ver agenda completa <ArrowRight /></NavLink>}>
          <p className="mt-card-sub">{dayGroupLabel(form.date || localDay()).replace(/^(Hoje|Amanhã|Ontem) — /, "")}</p>
          <div className="mt-timeline">
            {dayItems.length || form.time ? [...dayItems.map((item) => ({ ...item, free: false })), ...(selectedFree ? [{ id: "free", start: new Date(`${form.date}T${form.time}:00`).getTime(), end: 0, title: "Disponível", detail: "Horário selecionado", tone: "green", free: true }] : [])].sort((a, b) => a.start - b.start).map((item) =>
              <article key={item.id} className={`mt-timeline-item ${item.tone}`}><time>{new Date(item.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><i /><div><b>{item.title}</b>{!item.free && <small>{item.detail}</small>}</div></article>)
              : <p className="mt-empty">Nenhum compromisso para {formatDay.toLocaleDateString("pt-BR")}. Dia livre.</p>}
          </div>
        </Card>
        <Card icon={Clock} title="Próximos horários disponíveis">
          <p className="mt-card-sub">{fullDate(form.date || localDay())} · {form.durationMinutes} min</p>
          <div className="mt-slots">{slots.map((slot) => <button type="button" key={slot} disabled={slotDisabled(slot)} className={form.time === slot ? "active" : ""} onClick={() => set("time", slot)} aria-pressed={form.time === slot}>{slot}</button>)}</div>
        </Card>
        <Card icon={Users} title="Participantes sugeridos">
          <div className="mt-people">{teammates.slice(0, 8).map((member) => <label key={member.id}><Avatar name={member.name} /><b>{member.name}</b><small>{member.departmentName || member.role}</small><input type="checkbox" checked={form.participantIds.includes(member.id)} onChange={(event) => set("participantIds", event.target.checked ? [...form.participantIds, member.id] : form.participantIds.filter((id) => id !== member.id))} /></label>)}{!teammates.length && <p className="mt-empty">Nenhum colaborador cadastrado.</p>}</div>
        </Card>
      </div>
      <div className="mt-column">
        <Card icon={ClipboardList} title="Tipos de reunião">
          <div className="mt-types">{(Object.keys(typeLabels) as MeetingType[]).map((type) => { const Icon = typeIcons[type]; return <button type="button" key={type} className={`mt-type ${type.toLowerCase()} ${form.type === type ? "active" : ""}`} aria-pressed={form.type === type} onClick={() => set("type", type)}><span><Icon /></span><b>{typeLabels[type]}</b><small>{typeDescriptions[type]}</small></button>; })}</div>
        </Card>
        <Card icon={CalendarCheck} title="Últimas reuniões agendadas" action={<NavLink className="mt-link" to="/reunioes/agendadas">Ver todas <ArrowRight /></NavLink>}>
          <div className="mt-recent">{recent.map((item) => <div key={item.id}><NavLink to={`/reunioes/${item.id}`}><b>{item.clientName}</b></NavLink><span>{shortDate(item.startAt)} - {timeOf(item.startAt)}</span><FormatBadge format={item.format} /><RowMenu items={[{ label: "Editar", onClick: () => setParams({ editar: item.id }), hidden: !can("meetings.edit") }, { label: "Cancelar reunião", danger: true, onClick: () => void cancelMeeting(item), hidden: !can("meetings.edit") }, { label: "Ver detalhes", onClick: () => navigate(`/reunioes/${item.id}`) }]} /></div>)}{!recent.length && <p className="mt-empty">Nenhuma reunião agendada ainda.</p>}</div>
        </Card>
        <aside className="mt-banner"><BarChart3 /><p>Clientes bem atendidos,<br />crescem com a gente.</p></aside>
      </div>
    </div>
  </>;
}

/* ---------- Agendadas ---------- */

function ScheduledView({ store, can }: ViewProps) {
  const { data } = store, navigate = useNavigate(), [params] = useSearchParams();
  const [search, setSearch] = useState(""), [period, setPeriod] = useState("ALL"), [client, setClient] = useState(params.get("cliente") || ""), [status, setStatus] = useState(""), [type, setType] = useState(""), [responsible, setResponsible] = useState("");
  const [tab, setTab] = useState("ALL"), [mode, setMode] = useState<"list" | "calendar">("list"), [selected, setSelected] = useState(new Set<string>()), [page, setPage] = useState(1), [perPage, setPerPage] = useState(20), [notice, setNotice] = useState<NoticeState>(null), [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const now = new Date(), today = localDay(now), tomorrow = localDay(addDays(now, 1)), weekStart = startOfWeek(now), weekEnd = localDay(addDays(weekStart, 6));
  const inPeriod = (meeting: Meeting) => { const day = dayOf(meeting.startAt); return period === "ALL" || (period === "TODAY" && day === today) || (period === "WEEK" && day >= localDay(weekStart) && day <= weekEnd) || (period === "MONTH" && day.slice(0, 7) === today.slice(0, 7)) || (period === "NEXT30" && day >= today && day <= localDay(addDays(now, 30))); };
  const base = data.meetings.filter((meeting) => (status === "CANCELLED" ? meeting.status === "CANCELLED" : ["SCHEDULED", "IN_PROGRESS", "PAUSED"].includes(meeting.status)) && inPeriod(meeting) && (!client || meeting.clientId === client) && (!type || meeting.type === type) && (!responsible || meeting.responsibleId === responsible) && (!status || status === "CANCELLED" || displayStatus(meeting).label === status) && (!search || `${meeting.clientName} ${meeting.contactName} ${meeting.subject} ${meeting.unit}`.toLowerCase().includes(search.toLowerCase())));
  const tabs: [string, string, (meeting: Meeting) => boolean][] = [["ALL", "Todas", () => true], ["TODAY", "Hoje", (m) => dayOf(m.startAt) === today], ["TOMORROW", "Amanhã", (m) => dayOf(m.startAt) === tomorrow], ["WEEK", "Esta semana", (m) => dayOf(m.startAt) >= localDay(weekStart) && dayOf(m.startAt) <= weekEnd], ["NEXT", "Próximas", (m) => dayOf(m.startAt) > weekEnd]];
  const filtered = base.filter(tabs.find(([key]) => key === tab)![2]).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [search, period, client, status, type, responsible, tab, perPage]);
  const clear = () => { setSearch(""); setPeriod("ALL"); setClient(""); setStatus(""); setType(""); setResponsible(""); };
  const transition = async (meeting: Meeting, value: string) => {
    try { const result = await api<{ meeting: Meeting }>(`/meetings/${meeting.id}`, { method: "PATCH", json: { transition: value } }); store.upsert(result.meeting); return result.meeting; } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); return null; }
  };
  const start = async (meeting: Meeting) => { if (await transition(meeting, "start")) navigate(`/reunioes/em-andamento?id=${meeting.id}`); };
  const cancel = async (items: Meeting[]) => {
    if (!items.length || !(await systemConfirm({ title: items.length > 1 ? `Cancelar ${items.length} reuniões` : "Cancelar reunião", message: items.length > 1 ? "As reuniões selecionadas serão canceladas e sairão da agenda." : `Cancelar a reunião com ${items[0].clientName} em ${fullDate(items[0].startAt)} às ${timeOf(items[0].startAt)}?`, confirmLabel: "Cancelar", cancelLabel: "Voltar", tone: "danger" }))) return;
    for (const item of items.filter((meeting) => meeting.status !== "IN_PROGRESS")) await transition(item, "cancel");
    setSelected(new Set());
  };
  const remove = async (meeting: Meeting) => {
    if (!(await systemConfirm({ title: "Excluir reunião", message: `Excluir definitivamente a reunião com ${meeting.clientName}? Essa ação não pode ser desfeita.`, confirmLabel: "Excluir", tone: "danger" }))) return;
    try { await api(`/meetings/${meeting.id}`, { method: "DELETE" }); store.remove(meeting.id); } catch (error) { setNotice({ tone: "error", text: (error as Error).message }); }
  };
  const exportRows = (items: Meeting[]) => csvDownload(`reunioes-agendadas-${today}.csv`, [["Data", "Horário", "Cliente", "Loja/Unidade", "Participante", "Tipo", "Assunto", "Responsável", "Status", "Formato"], ...items.map((m) => [fullDate(m.startAt), timeOf(m.startAt), m.clientName, m.unit, m.contactName, typeLabels[m.type], m.subject, m.responsibleName, displayStatus(m).label, formatLabels[m.format]])]);
  const selectedItems = filtered.filter((meeting) => selected.has(meeting.id));

  return <>
    <PageHeader icon={CalendarClock} crumb="Agendadas" title="Reuniões Agendadas" subtitle="Acompanhe e gerencie todas as reuniões com seus clientes." quote={0} actions={can("meetings.create") && <NavLink className="mt-button dark" to="/reunioes/agendar"><Plus />Nova Reunião</NavLink>} />
    <Notice notice={notice} onClose={() => setNotice(null)} />
    <section className="mt-filters">
      <label className="mt-search"><Search /><input value={search} placeholder="Buscar reunião…" onChange={(event) => setSearch(event.target.value)} aria-label="Buscar reunião" /></label>
      <label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="ALL">Todos</option><option value="TODAY">Hoje</option><option value="WEEK">Esta semana</option><option value="MONTH">Este mês</option><option value="NEXT30">Próximos 30 dias</option></select></label>
      <label>Cliente<select value={client} onChange={(event) => setClient(event.target.value)}><option value="">Todos</option>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option>{["Agendada", "Em andamento", "Pausada", "Não iniciada"].map((value) => <option key={value}>{value}</option>)}<option value="CANCELLED">Cancelada</option></select></label>
      <label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {data.canViewTeam && <label>Responsável<select value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Todos</option>{data.users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
      <button type="button" className="mt-button outline" onClick={clear}><FilterX />Limpar filtros</button>
    </section>
    <div className="mt-toolbar">
      <div className="mt-tabs" role="tablist">{tabs.map(([key, label, test]) => <button type="button" role="tab" aria-selected={tab === key} key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label} ({base.filter(test).length})</button>)}</div>
      <div className="mt-toolbar-actions">
        {selectedItems.length > 0 && <>{can("meetings.edit") && <button type="button" className="mt-button outline danger" onClick={() => void cancel(selectedItems)}><XCircle />Cancelar ({selectedItems.length})</button>}</>}
        <button type="button" className="mt-button outline" onClick={() => exportRows(selectedItems.length ? selectedItems : filtered)}><Download />Exportar{selectedItems.length ? ` (${selectedItems.length})` : ""}</button>
        <div className="mt-switch"><button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}><List />Lista</button><button type="button" className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}><CalendarDays />Calendário</button></div>
      </div>
    </div>
    {mode === "calendar" ? <MonthCalendar meetings={filtered} month={month} onMonth={setMonth} /> : <section className="mt-table-card">
      <div className="mt-table scheduled" role="table" aria-label="Reuniões agendadas">
        <div className="mt-row head" role="row"><span><input type="checkbox" aria-label="Selecionar todas" checked={!!pageItems.length && pageItems.every((m) => selected.has(m.id))} onChange={(event) => selectAll(event.target.checked, pageItems.map((m) => m.id), setSelected)} /></span><span>Data</span><span>Horário</span><span>Cliente</span><span>Loja / Unidade</span><span>Participante</span><span>Tipo</span><span>Assunto / Pauta</span><span>Responsável</span><span>Status</span><span>Ações</span><span /></div>
        {groupByDay(pageItems).map(([day, items]) => <div key={day} role="rowgroup">
          <div className="mt-group" role="row"><CalendarDays /><b>{dayGroupLabel(day)}</b><em>{filtered.filter((m) => dayOf(m.startAt) === day).length}</em></div>
          {items.map((meeting) => { const state = displayStatus(meeting), live = ["IN_PROGRESS", "PAUSED"].includes(meeting.status); return <div className="mt-row" role="row" key={meeting.id}>
            <span><input type="checkbox" aria-label={`Selecionar ${meeting.clientName}`} checked={selected.has(meeting.id)} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(meeting.id); else next.delete(meeting.id); setSelected(next); }} /></span>
            <span>{shortDate(meeting.startAt)}</span><span>{timeOf(meeting.startAt)}</span>
            <NavLink to={`/reunioes/${meeting.id}`} className="mt-strong">{meeting.clientName}</NavLink><span>{meeting.unit || "—"}</span>
            <span className="mt-person"><Avatar name={meeting.contactName} size="sm" />{meeting.contactName}</span>
            <span>{typeLabels[meeting.type]}</span><span className="mt-clip" title={meeting.subject}>{meeting.subject}</span>
            <span className="mt-person"><Avatar name={meeting.responsibleName} size="sm" />{meeting.responsibleName.split(" ")[0]}</span>
            <span><Badge tone={state.tone}>{state.label}</Badge></span>
            <span>{meeting.status === "CANCELLED" ? (can("meetings.edit") && <button type="button" className="mt-action" onClick={() => void transition(meeting, "reopen")}>Reativar</button>) : live ? <NavLink className="mt-action" to={`/reunioes/em-andamento?id=${meeting.id}`}><Pencil />Abrir</NavLink> : can("meetings.edit") && <button type="button" className="mt-action" onClick={() => void start(meeting)}><Play />Iniciar</button>}</span>
            <RowMenu items={[{ label: "Ver detalhes", onClick: () => navigate(`/reunioes/${meeting.id}`) }, { label: "Editar / Reagendar", onClick: () => navigate(`/reunioes/agendar?editar=${meeting.id}`), hidden: !can("meetings.edit") || meeting.status !== "SCHEDULED" }, { label: "Cancelar reunião", danger: true, onClick: () => void cancel([meeting]), hidden: !can("meetings.edit") || !["SCHEDULED", "PAUSED"].includes(meeting.status) }, { label: "Excluir", danger: true, onClick: () => void remove(meeting), hidden: !can("meetings.delete") }]} />
          </div>; })}
        </div>)}
        {!filtered.length && <p className="mt-empty big">Nenhuma reunião encontrada com os filtros atuais.{can("meetings.create") && <NavLink to="/reunioes/agendar"> Agendar uma reunião</NavLink>}</p>}
      </div>
      <Pagination total={filtered.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} noun="reuniões" />
    </section>}
  </>;
}

function MonthCalendar({ meetings, month, onMonth }: { meetings: Meeting[]; month: Date; onMonth: (value: Date) => void }) {
  const first = startOfWeek(month), days = Array.from({ length: 42 }, (_, index) => addDays(first, index)), today = localDay();
  return <section className="mt-table-card mt-calendar">
    <header><button type="button" className="mt-icon-button" aria-label="Mês anterior" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button><b>{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</b><button type="button" className="mt-icon-button" aria-label="Próximo mês" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button></header>
    <div className="mt-calendar-grid">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <span className="mt-calendar-weekday" key={day}>{day}</span>)}
      {days.map((day) => { const key = localDay(day), items = meetings.filter((m) => dayOf(m.startAt) === key); return <div key={key} className={`mt-calendar-day${day.getMonth() !== month.getMonth() ? " out" : ""}${key === today ? " today" : ""}`}><small>{day.getDate()}</small>{items.slice(0, 3).map((m) => <NavLink key={m.id} to={`/reunioes/${m.id}`} className={`tone-${displayStatus(m).tone}`}>{timeOf(m.startAt)} {m.clientName}</NavLink>)}{items.length > 3 && <em>+{items.length - 3} reuniões</em>}</div>; })}
    </div>
  </section>;
}

/* ---------- Em andamento ---------- */

type Draft = Pick<Meeting, "statements" | "perception" | "agenda" | "actions" | "summary" | "nextSteps" | "nextContact" | "nextMeeting">;
const draftOf = (meeting: Meeting): Draft => ({ statements: meeting.statements, perception: meeting.perception, agenda: meeting.agenda, actions: meeting.actions, summary: meeting.summary, nextSteps: meeting.nextSteps, nextContact: meeting.nextContact, nextMeeting: meeting.nextMeeting });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clock = (seconds: number) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
const statementIcons: Record<Exclude<StatementKind, "">, typeof ThumbsUp> = { PRAISE: ThumbsUp, COMPLAINT: AlertCircle, REQUEST: Megaphone, QUESTION: HelpCircle, OPPORTUNITY: Lightbulb };

function LiveView({ store, user, can }: ViewProps) {
  const { data } = store, navigate = useNavigate(), [params, setParams] = useSearchParams();
  const requested = params.get("id");
  const meeting = requested ? data.meetings.find((item) => item.id === requested) : data.meetings.filter((item) => ["IN_PROGRESS", "PAUSED"].includes(item.status)).sort((a, b) => Number(b.responsibleId === user.id) - Number(a.responsibleId === user.id) || b.startAt.localeCompare(a.startAt))[0];
  if (!meeting) return <LivePicker store={store} user={user} can={can} missing={!!requested} onPick={(id) => setParams({ id })} />;
  return <LiveMeeting key={meeting.id} meeting={meeting} store={store} user={user} can={can} onDone={() => navigate(`/reunioes/${meeting.id}`)} />;
}

function LivePicker({ store, can, missing, onPick }: ViewProps & { missing: boolean; onPick: (id: string) => void }) {
  const today = localDay(), [error, setError] = useState("");
  const todays = store.data.meetings.filter((item) => item.status === "SCHEDULED" && dayOf(item.startAt) <= today && dayOf(item.startAt) >= localDay(addDays(new Date(), -1))).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const start = async (meeting: Meeting) => { try { store.upsert((await api<{ meeting: Meeting }>(`/meetings/${meeting.id}`, { method: "PATCH", json: { transition: "start" } })).meeting); onPick(meeting.id); } catch (reason) { setError((reason as Error).message); } };
  return <>
    <PageHeader icon={Timer} crumb="Em andamento" title="Reunião em andamento" subtitle="Registre em tempo real o que o cliente disse, sua percepção e as ações combinadas." quote={2} />
    {missing && <p className="mt-alert">A reunião solicitada não foi encontrada ou você não tem acesso a ela.</p>}
    {error && <p className="mt-alert" role="alert">{error}</p>}
    <Card icon={Play} title="Nenhuma reunião em andamento agora">
      <p className="mt-card-sub">Inicie uma das reuniões previstas para hoje para abrir o registro ao vivo.</p>
      <div className="mt-start-list">{todays.map((item) => <article key={item.id}><time>{timeOf(item.startAt)}</time><div><b>{item.clientName}</b><small>{typeLabels[item.type]} · {item.subject}</small></div><Badge tone={displayStatus(item).tone}>{displayStatus(item).label}</Badge>{can("meetings.edit") && <button type="button" className="mt-button primary small" onClick={() => void start(item)}><Play />Iniciar</button>}</article>)}
        {!todays.length && <p className="mt-empty">Nenhuma reunião agendada para hoje. <NavLink to="/reunioes/agendadas">Ver todas as agendadas</NavLink></p>}</div>
    </Card>
  </>;
}

function LiveMeeting({ meeting, store, can, onDone }: ViewProps & { meeting: Meeting; onDone: () => void }) {
  const { data } = store, editable = can("meetings.edit");
  const [draft, setDraft] = useState<Draft>(() => draftOf(meeting)), [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle"), [error, setError] = useState("");
  const [input, setInput] = useState(""), [kind, setKind] = useState<StatementKind>(""), [editAgenda, setEditAgenda] = useState(false), [newAgenda, setNewAgenda] = useState(""), [finishing, setFinishing] = useState(false), [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState(() => Date.now()), [tick, setTick] = useState(Date.now());
  const firstRender = useRef(true), latest = useRef(draft);
  latest.current = draft;
  useEffect(() => { setSyncedAt(Date.now()); }, [meeting.elapsedSeconds, meeting.status]);
  useEffect(() => { if (meeting.status !== "IN_PROGRESS") return; const timer = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(timer); }, [meeting.status]);
  const save = useCallback(async (extra: Record<string, unknown> = {}) => {
    setSaveState("saving");
    try { const result = await api<{ meeting: Meeting; warning?: string }>(`/meetings/${meeting.id}`, { method: "PATCH", json: { ...latest.current, ...extra } }); store.upsert(result.meeting); setSaveState("saved"); setError(result.warning || ""); return result.meeting; } catch (reason) { setSaveState("error"); setError((reason as Error).message); return null; }
  }, [meeting.id, store]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!editable) return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [draft]);
  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }));
  const elapsed = meeting.elapsedSeconds + (meeting.status === "IN_PROGRESS" ? Math.max(0, Math.floor((tick - syncedAt) / 1000)) : 0);
  const transition = async (value: "start" | "pause" | "finish", extra: Record<string, unknown> = {}) => { setBusy(true); const result = await save({ transition: value, ...extra }); setBusy(false); return result; };
  const addStatement = () => { const text = input.trim(); if (!text) return; patch({ statements: [...draft.statements, { id: uid(), text, kind, createdAt: new Date().toISOString() }] }); setInput(""); setKind(""); };
  const updateAction = (id: string, value: Partial<MeetingAction>) => patch({ actions: draft.actions.map((action) => action.id === id ? { ...action, ...value } : action) });
  const addAction = () => patch({ actions: [...draft.actions, { id: uid(), title: "", responsibleId: meeting.responsibleId, responsibleName: meeting.responsibleName, dueDate: localDay(addDays(new Date(), 2)), origin: "CLIENT_REQUEST", status: "PENDING", notes: "" }] });
  const quickFill = () => patch({ perception: { ...draft.perception, satisfaction: "POSITIVE", contactQuality: "GOOD", contactVolume: "GOOD", commercialService: "GOOD", churnRisk: "LOW", expansionPotential: "MEDIUM" } });
  const client = data.clients.find((item) => item.id === meeting.clientId);
  const months = client ? Math.max(0, Math.round((Date.now() - new Date(client.createdAt).getTime()) / (30.44 * 86400000))) : 0;
  const completed = meeting.status === "COMPLETED", live = meeting.status === "IN_PROGRESS";
  const badge = completed ? ["green", "Reunião concluída"] : live ? ["blue", "Reunião em andamento"] : meeting.status === "PAUSED" ? ["yellow", "Reunião pausada"] : ["muted", "Reunião agendada"];
  const finish = async (summary: string, extra: { nextSteps?: string; actions?: MeetingAction[] } = {}) => { const result = await transition("finish", { summary, ...(extra.nextSteps !== undefined ? { nextSteps: extra.nextSteps } : {}), ...(extra.actions?.length ? { actions: [...latest.current.actions, ...extra.actions] } : {}) }); if (result) onDone(); };
  const generateSummary = async () => { if (!(await save())) return null; return api<AiSummary>(`/meetings/${meeting.id}/ai-summary`, { method: "POST", json: {} }); };
  const statementLength = draft.statements.reduce((sum, item) => sum + item.text.length, 0) + input.length;

  return <>
    <nav className="mt-crumbs" aria-label="Você está em"><NavLink to="/" aria-label="Início"><Home /></NavLink><ChevronRight /><NavLink to="/reunioes/agendadas">Customer Success</NavLink><ChevronRight /><b>{completed ? "Editar registro" : "Em andamento"}</b></nav>
    <header className="mt-live-header">
      <span className="mt-client-logo" style={{ color: avatarTone(meeting.clientName) }}>{initials(meeting.clientName)}</span>
      <div className="mt-live-title"><Badge tone={badge[0]}>{live && <i className="mt-pulse" />}{badge[1].toUpperCase()}</Badge><h1>{meeting.clientName}</h1><p>{meeting.type === "FOLLOW_UP" ? "Reunião de acompanhamento" : typeLabels[meeting.type]}</p></div>
      <dl className="mt-live-meta">
        <div><CalendarDays /><dd>{fullDate(meeting.startAt)}</dd></div><div><Clock /><dd>{timeOf(meeting.startAt)} - {endTime(meeting)}</dd></div>
        <div className="mt-timer"><Timer /><dd aria-live="off">{clock(elapsed)}</dd></div><div><i className={`mt-dot ${live ? "green" : "gray"}`} /><dd>{displayStatus(meeting).label}</dd></div>
        <div><UserRound /><dd>{meeting.responsibleName} (Responsável)</dd></div><div><UserRound /><dd>{meeting.contactName}{meeting.contactRole && <small>{meeting.contactRole}</small>}</dd></div>
        <div><Video /><dd>{meeting.meetingUrl ? <a href={meeting.meetingUrl} target="_blank" rel="noreferrer">{formatLabels[meeting.format]}</a> : formatLabels[meeting.format]}</dd></div>
      </dl>
      <div className="mt-live-actions">
        {editable && !completed && (live ? <button type="button" className="mt-button outline" disabled={busy} onClick={() => void transition("pause")}><Pause />Pausar reunião</button> : <button type="button" className="mt-button outline" disabled={busy} onClick={() => void transition("start")}><Play />{meeting.status === "PAUSED" ? "Retomar reunião" : "Iniciar reunião"}</button>)}
        {editable && !completed && <button type="button" className="mt-button danger-solid" disabled={busy} onClick={() => setFinishing(true)}><Square />Finalizar reunião</button>}
        {completed && <NavLink className="mt-button dark" to={`/reunioes/${meeting.id}`}><ArrowLeft />Voltar aos detalhes</NavLink>}
      </div>
      <p className="mt-live-hint"><Pencil /><span>Registre os principais pontos da conversa.<br />{editable ? saveState === "saving" ? "Salvando…" : saveState === "error" ? "Não foi possível salvar. Tente novamente." : "As informações são salvas automaticamente." : "Você possui acesso somente para leitura."}</span></p>
    </header>
    {error && <p className="mt-alert" role="alert">{error}</p>}
    <fieldset className="mt-live-grid" disabled={!editable}>
      <Card icon={MessageCircle} title="O que o cliente está dizendo" className="mt-said" action={<span className={`mt-save ${saveState}`}><i />{saveState === "saving" ? "Salvando…" : "Salvar automaticamente"}</span>}>
        <ul className="mt-statements">{draft.statements.map((item) => { const Icon = item.kind ? statementIcons[item.kind] : null; return <li key={item.id} className={item.kind.toLowerCase()}>{Icon && <span className="mt-kind"><Icon />{statementLabels[item.kind as Exclude<StatementKind, "">]}</span>}<span>{item.text}</span><button type="button" aria-label="Remover anotação" onClick={() => patch({ statements: draft.statements.filter((value) => value.id !== item.id) })}><X /></button></li>; })}
          {!draft.statements.length && <li className="mt-empty">Nenhum ponto registrado ainda.</li>}</ul>
        <textarea className="mt-said-input" rows={2} maxLength={400} value={input} placeholder="Digite aqui os pontos principais da conversa e pressione Enter…" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addStatement(); } }} />
        <small className="mt-counter">{Math.min(statementLength, 2000)}/2000</small>
        <div className="mt-quick"><span>Adicionar anotação rápida:</span>{(Object.keys(statementLabels) as Exclude<StatementKind, "">[]).map((value) => { const Icon = statementIcons[value]; return <button type="button" key={value} className={`${value.toLowerCase()} ${kind === value ? "active" : ""}`} aria-pressed={kind === value} onClick={() => setKind(kind === value ? "" : value)}><Icon />{statementLabels[value]}</button>; })}{input.trim() && <button type="button" className="mt-button primary small" onClick={addStatement}><Plus />Adicionar</button>}</div>
      </Card>
      <Card icon={BarChart3} title="Percepção" className="mt-perception" action={<button type="button" className="mt-link" onClick={quickFill}>Preenchimento rápido</button>}>
        <div className="mt-perception-grid">{perceptionRows.map((row) => <div key={row.field} role="radiogroup" aria-label={row.label}><b>{row.label}</b>{row.options.map((option) => { const active = draft.perception[row.field] === option.value; return <button type="button" role="radio" aria-checked={active} key={option.value} className={active ? `active ${option.tone}` : ""} onClick={() => patch({ perception: { ...draft.perception, [row.field]: active ? "" : option.value } })}>{active && <CheckCircle2 />}{option.label}</button>; })}</div>)}</div>
        <label className="mt-field">Observações da percepção (opcional)<textarea rows={3} maxLength={500} value={draft.perception.notes} placeholder="Ex.: Cliente demonstrou interesse em nova linha de produtos…" onChange={(event) => patch({ perception: { ...draft.perception, notes: event.target.value } })} /><small>{draft.perception.notes.length}/500</small></label>
      </Card>
      <div className="mt-column">
        <Card icon={ListChecks} title="Pauta da reunião" action={<button type="button" className="mt-link" onClick={() => setEditAgenda((value) => !value)}><Pencil />{editAgenda ? "Concluir edição" : "Editar pauta"}</button>}>
          <ul className="mt-agenda">{draft.agenda.map((item) => <li key={item.id}><label><input type="checkbox" checked={item.done} onChange={(event) => patch({ agenda: draft.agenda.map((value) => value.id === item.id ? { ...value, done: event.target.checked } : value) })} />{item.label}</label>{editAgenda && <button type="button" aria-label={`Remover ${item.label}`} onClick={() => patch({ agenda: draft.agenda.filter((value) => value.id !== item.id) })}><Trash2 /></button>}</li>)}</ul>
          {editAgenda && <form className="mt-inline-add" onSubmit={(event) => { event.preventDefault(); if (!newAgenda.trim()) return; patch({ agenda: [...draft.agenda, { id: uid(), label: newAgenda.trim().slice(0, 120), done: false }] }); setNewAgenda(""); }}><input value={newAgenda} maxLength={120} placeholder="Novo item da pauta" onChange={(event) => setNewAgenda(event.target.value)} /><button type="submit" className="mt-button primary small"><Plus />Adicionar</button></form>}
        </Card>
        <Card icon={ClipboardCheck} title="Dados do cliente" action={<NavLink className="mt-link" to="/clientes">Ver cliente <ArrowRight /></NavLink>}>
          <dl className="mt-client-data"><div><dt>Grupo</dt><dd>{meeting.clientName}</dd></div><div><dt>Unidade</dt><dd>{meeting.unit || "—"}</dd></div><div><dt>Segmento</dt><dd>{client?.segment || "—"}</dd></div><div><dt>Tempo de cliente</dt><dd>{client ? (months < 1 ? "Menos de 1 mês" : `${months} ${months === 1 ? "mês" : "meses"}`) : "—"}</dd></div></dl>
        </Card>
      </div>
      <Card icon={ClipboardList} title="Ações / pendências geradas na reunião" className="mt-actions-card" action={<><em className="mt-count">{draft.actions.length}</em><button type="button" className="mt-button primary small" onClick={addAction}><Plus />Adicionar ação</button></>}>
        <ActionsEditor actions={draft.actions} users={data.users} onChange={updateAction} onRemove={(id) => patch({ actions: draft.actions.filter((action) => action.id !== id) })} />
      </Card>
      {completed && <Card icon={FileText} title="Resumo da reunião" className="mt-wide"><textarea className="mt-summary-input" rows={4} maxLength={3000} value={draft.summary} onChange={(event) => patch({ summary: event.target.value })} /></Card>}
      <Card icon={TrendingUp} title="Próximos passos"><textarea className="mt-summary-input" rows={3} maxLength={500} value={draft.nextSteps} placeholder="O que acontece depois desta reunião?" onChange={(event) => patch({ nextSteps: event.target.value })} /><small className="mt-counter">{draft.nextSteps.length}/500</small></Card>
      <Card icon={CalendarClock} title="Próximo contato">
        <div className="mt-form compact"><label className="span-6">Data de retorno<input type="date" value={draft.nextContact.date} onChange={(event) => patch({ nextContact: { ...draft.nextContact, date: event.target.value } })} /></label><label className="span-6">Tipo<select value={draft.nextContact.type} onChange={(event) => patch({ nextContact: { ...draft.nextContact, type: event.target.value } })}><option value="">Selecione</option>{nextContactTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="span-12 mt-check"><input type="checkbox" checked={draft.nextContact.addToCalendar} onChange={(event) => patch({ nextContact: { ...draft.nextContact, addToCalendar: event.target.checked } })} />Adicionar na minha agenda ao finalizar</label></div>
      </Card>
      <Card icon={CalendarPlus} title="Nova reunião" action={<label className="mt-toggle"><input type="checkbox" checked={draft.nextMeeting.enabled} disabled={!!meeting.followUpMeetingId} onChange={(event) => patch({ nextMeeting: { ...draft.nextMeeting, enabled: event.target.checked, date: draft.nextMeeting.date || localDay(addDays(new Date(meeting.startAt), 30)) } })} /><span aria-hidden="true" /><b className="sr-only">Agendar nova reunião ao finalizar</b></label>}>
        {meeting.followUpMeetingId ? <p className="mt-card-sub">Próxima reunião já agendada. <NavLink to={`/reunioes/${meeting.followUpMeetingId}`}>Ver reunião</NavLink></p> : <div className={`mt-form compact ${draft.nextMeeting.enabled ? "" : "is-off"}`}>
          <label className="span-7">Data sugerida<input type="date" value={draft.nextMeeting.date} disabled={!draft.nextMeeting.enabled} onChange={(event) => patch({ nextMeeting: { ...draft.nextMeeting, date: event.target.value } })} /></label><label className="span-5">Horário<input type="time" value={draft.nextMeeting.time} disabled={!draft.nextMeeting.enabled} onChange={(event) => patch({ nextMeeting: { ...draft.nextMeeting, time: event.target.value } })} /></label>
          <p className="span-12 mt-card-sub">Reunião mensal de acompanhamento · criada ao finalizar</p>
          <label className="span-12 mt-check"><input type="checkbox" checked={draft.nextMeeting.invite} disabled={!draft.nextMeeting.enabled} onChange={(event) => patch({ nextMeeting: { ...draft.nextMeeting, invite: event.target.checked } })} />Enviar convite automaticamente</label></div>}
      </Card>
    </fieldset>
    {finishing && <FinishDialog meeting={meeting} draft={draft} busy={busy} onCancel={() => setFinishing(false)} onGenerate={generateSummary} onConfirm={(summary, extra) => void finish(summary, extra)} />}
  </>;
}

function ActionsEditor({ actions, users, onChange, onRemove, readOnly = false }: { actions: MeetingAction[]; users: MeetingsData["users"]; onChange: (id: string, value: Partial<MeetingAction>) => void; onRemove?: (id: string) => void; readOnly?: boolean }) {
  const today = localDay();
  return <div className="mt-table actions" role="table" aria-label="Ações geradas">
    <div className="mt-row head" role="row"><span>#</span><span>Ação</span><span>Responsável</span><span>Prazo</span><span>Origem</span><span>Status</span><span>Observações</span><span /></div>
    {actions.map((action, index) => <div className="mt-row" role="row" key={action.id}>
      <span>{pad(index + 1)}</span>
      {readOnly ? <b>{action.title}</b> : <input aria-label="Ação" value={action.title} maxLength={160} placeholder="Descreva a ação" onChange={(event) => onChange(action.id, { title: event.target.value })} />}
      {readOnly ? <span className="mt-person"><Avatar name={action.responsibleName || "?"} size="sm" />{action.responsibleName || "—"}</span> : <select aria-label="Responsável" value={action.responsibleId} onChange={(event) => onChange(action.id, { responsibleId: event.target.value, responsibleName: event.target.value === "CLIENT" ? "Cliente" : users.find((member) => member.id === event.target.value)?.name || "" })}><option value="">Sem responsável</option><option value="CLIENT">Cliente</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>}
      {readOnly ? <span className={actionOverdue(action, today) ? "mt-late" : ""}>{fullDate(action.dueDate)}</span> : <input aria-label="Prazo" type="date" value={action.dueDate} className={actionOverdue(action, today) ? "mt-late" : ""} onChange={(event) => onChange(action.id, { dueDate: event.target.value })} />}
      {readOnly ? <span>{originLabels[action.origin]}</span> : <select aria-label="Origem" value={action.origin} onChange={(event) => onChange(action.id, { origin: event.target.value as ActionOrigin })}>{Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
      <select aria-label="Status" className={`mt-status-select ${actionTone[action.status]}`} value={action.status} onChange={(event) => onChange(action.id, { status: event.target.value as ActionStatus })}>{Object.entries(actionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {readOnly ? <span className="mt-clip" title={action.notes}>{action.notes || "—"}</span> : <input aria-label="Observações" value={action.notes} maxLength={200} placeholder="—" onChange={(event) => onChange(action.id, { notes: event.target.value })} />}
      {onRemove ? <button type="button" className="mt-icon-button" aria-label="Remover ação" onClick={() => onRemove(action.id)}><Trash2 /></button> : <span />}
    </div>)}
    {!actions.length && <p className="mt-empty">Nenhuma ação registrada. Use “Adicionar ação” para registrar o que foi combinado.</p>}
  </div>;
}

type AiSummary = { summary: string; nextSteps: string; suggestedActions: { title: string; origin: ActionOrigin }[]; model: string };

function FinishDialog({ meeting, draft, busy, onCancel, onGenerate, onConfirm }: { meeting: Meeting; draft: Draft; busy: boolean; onCancel: () => void; onGenerate: () => Promise<AiSummary | null>; onConfirm: (summary: string, extra: { nextSteps?: string; actions?: MeetingAction[] }) => void }) {
  const [summary, setSummary] = useState(draft.summary || draft.statements.map((item) => item.text.replace(/\.?$/, ".")).join(" "));
  const [ai, setAi] = useState<AiSummary | null>(null), [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle"), [aiError, setAiError] = useState("");
  const [nextSteps, setNextSteps] = useState(draft.nextSteps), [picked, setPicked] = useState(new Set<number>());
  const openActions = draft.actions.filter((action) => action.title.trim()).length, missingPerception = !overallPerception({ perception: draft.perception });
  const generate = async () => {
    if (summary.trim() && ai && !(await systemConfirm({ title: "Gerar novamente", message: "O resumo atual será substituído por uma nova versão gerada pela IA.", confirmLabel: "Gerar novamente", tone: "warning" }))) return;
    setAiState("loading"); setAiError("");
    try {
      const result = await onGenerate();
      if (!result) { setAiState("error"); setAiError("Não foi possível salvar as anotações antes de gerar o resumo."); return; }
      setAi(result); setSummary(result.summary); if (!draft.nextSteps.trim() && result.nextSteps) setNextSteps(result.nextSteps);
      setPicked(new Set(result.suggestedActions.map((_, index) => index))); setAiState("idle");
    } catch (reason) { setAiState("error"); setAiError((reason as Error).message); }
  };
  const confirm = () => {
    const actions = ai ? ai.suggestedActions.filter((_, index) => picked.has(index)).map((item): MeetingAction => ({ id: uid(), title: item.title, responsibleId: meeting.responsibleId, responsibleName: meeting.responsibleName, dueDate: localDay(addDays(new Date(), 7)), origin: item.origin, status: "PENDING", notes: "" })) : [];
    onConfirm(summary.trim(), { ...(nextSteps !== draft.nextSteps ? { nextSteps: nextSteps.trim() } : {}), actions });
  };
  return <div className="mt-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <div className="mt-dialog" role="dialog" aria-modal="true" aria-labelledby="mt-finish-title">
      <header><h2 id="mt-finish-title">Finalizar reunião com {meeting.clientName}</h2><button type="button" className="mt-icon-button" aria-label="Fechar" onClick={onCancel}><X /></button></header>
      <div className="mt-ai-bar"><span><Sparkles />{ai ? `Resumo gerado por IA a partir das suas anotações. Revise antes de finalizar.` : "Gere o resumo, os próximos passos e sugestões de ações a partir das anotações."}</span><button type="button" className="mt-button outline" disabled={aiState === "loading" || busy} onClick={() => void generate()}><Sparkles />{aiState === "loading" ? "Gerando…" : ai ? "Gerar novamente" : "Gerar com IA"}</button></div>
      {aiError && <p className="mt-alert" role="alert">{aiError}</p>}
      <label className="mt-field">Resumo da reunião<textarea rows={6} maxLength={3000} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Resumo do que foi conversado e decidido." /></label>
      {ai && <label className="mt-field">Próximos passos<textarea rows={3} maxLength={500} value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} placeholder="O que acontece depois desta reunião?" /></label>}
      {ai && ai.suggestedActions.length > 0 && <fieldset className="mt-ai-actions"><legend>Ações sugeridas pela IA</legend>{ai.suggestedActions.map((item, index) => <label key={index}><input type="checkbox" checked={picked.has(index)} onChange={(event) => { const next = new Set(picked); if (event.target.checked) next.add(index); else next.delete(index); setPicked(next); }} /><span>{item.title}<small>{originLabels[item.origin]} · prazo em 7 dias · {meeting.responsibleName}</small></span></label>)}</fieldset>}
      <ul className="mt-finish-checks">
        <li className={missingPerception ? "warn" : "ok"}>{missingPerception ? <AlertTriangle /> : <CheckCircle2 />}{missingPerception ? "Percepção do cliente não preenchida" : `Percepção: ${perceptionLabels[overallPerception({ perception: draft.perception }) as Exclude<OverallPerception, "">]}`}</li>
        <li className="ok"><CheckCircle2 />{openActions + (ai ? picked.size : 0)} ação(ões) registrada(s)</li>
        <li className={draft.nextMeeting.enabled ? "ok" : "muted"}><CalendarPlus />{draft.nextMeeting.enabled && draft.nextMeeting.date ? `Nova reunião será agendada para ${fullDate(draft.nextMeeting.date)} às ${draft.nextMeeting.time}` : "Nenhuma nova reunião será agendada"}</li>
        {draft.nextContact.date && <li className="ok"><CalendarClock />Retorno em {fullDate(draft.nextContact.date)}{draft.nextContact.addToCalendar ? " (adicionado à agenda)" : ""}</li>}
      </ul>
      <footer><button type="button" className="mt-button ghost" onClick={onCancel}>Voltar</button><button type="button" className="mt-button danger-solid" disabled={busy || aiState === "loading"} onClick={confirm}><Square />{busy ? "Finalizando…" : "Finalizar reunião"}</button></footer>
    </div>
  </div>;
}

/* ---------- Concluídas ---------- */

function CompletedView({ store, can }: ViewProps) {
  const { data } = store, navigate = useNavigate(), [params] = useSearchParams();
  const [search, setSearch] = useState(""), [period, setPeriod] = useState("ALL"), [client, setClient] = useState(params.get("cliente") || ""), [type, setType] = useState(""), [responsible, setResponsible] = useState("");
  const [tab, setTab] = useState("ALL"), [selected, setSelected] = useState(new Set<string>()), [page, setPage] = useState(1), [perPage, setPerPage] = useState(20);
  const now = new Date(), month = localDay(now).slice(0, 7), lastMonth = localDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const completed = data.meetings.filter((meeting) => meeting.status === "COMPLETED");
  const inPeriod = (meeting: Meeting) => { const day = dayOf(meeting.startAt); return period === "ALL" || (period === "MONTH" && day.slice(0, 7) === month) || (period === "LAST_MONTH" && day.slice(0, 7) === lastMonth) || (period === "30" && day >= localDay(addDays(now, -30))) || (period === "90" && day >= localDay(addDays(now, -90))); };
  const base = completed.filter((meeting) => inPeriod(meeting) && (!client || meeting.clientId === client) && (!type || meeting.type === type) && (!responsible || meeting.responsibleId === responsible) && (!search || `${meeting.clientName} ${meeting.contactName} ${meeting.subject} ${meeting.summary}`.toLowerCase().includes(search.toLowerCase())));
  const tabs: [string, string, (meeting: Meeting) => boolean][] = [["ALL", "Todas", () => true], ["MONTH", "Este mês", (m) => dayOf(m.startAt).slice(0, 7) === month], ["LAST_MONTH", "Mês anterior", (m) => dayOf(m.startAt).slice(0, 7) === lastMonth], ["PENDING", "Com pendências", (m) => m.actions.some(isOpenAction)]];
  const filtered = base.filter(tabs.find(([key]) => key === tab)![2]).sort((a, b) => b.startAt.localeCompare(a.startAt));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [search, period, client, type, responsible, tab, perPage]);
  const thisMonth = completed.filter((m) => dayOf(m.startAt).slice(0, 7) === month), previous = completed.filter((m) => dayOf(m.startAt).slice(0, 7) === lastMonth).length;
  const count = (value: OverallPerception) => thisMonth.filter((m) => overallPerception(m) === value).length, share = (value: number) => thisMonth.length ? Math.round(value / thisMonth.length * 100) : 0;
  const delta = previous ? Math.round((thisMonth.length - previous) / previous * 100) : null;
  const nextStep = (meeting: Meeting) => meeting.nextMeeting.enabled && meeting.nextMeeting.date ? `Nova reunião em ${shortDate(meeting.nextMeeting.date)}` : meeting.nextContact.date ? `Retorno em ${shortDate(meeting.nextContact.date)}` : meeting.nextSteps || "—";
  const exportRows = (items: Meeting[]) => csvDownload(`reunioes-concluidas-${localDay()}.csv`, [["Data", "Horário", "Cliente", "Loja/Unidade", "Tipo", "Participante", "Duração (min)", "Percepção", "Próximo passo", "Responsável", "Resumo", "Ações abertas"], ...items.map((m) => [fullDate(m.startAt), timeOf(m.startAt), m.clientName, m.unit, typeLabels[m.type], m.contactName, String(durationMinutes(m)), perceptionLabels[overallPerception(m) as Exclude<OverallPerception, "">] || "", nextStep(m), m.responsibleName, m.summary, String(m.actions.filter(isOpenAction).length)])]);
  const selectedItems = filtered.filter((m) => selected.has(m.id));

  return <>
    <PageHeader icon={CalendarCheck} crumb="Concluídas" title="Reuniões Concluídas" subtitle="Acompanhe o histórico das reuniões realizadas e os principais resultados." quote={2} actions={can("meetings.create") && <NavLink className="mt-button dark" to="/reunioes/agendar"><Plus />Nova Reunião</NavLink>} />
    <section className="mt-filters">
      <label className="mt-search"><Search /><input value={search} placeholder="Buscar reunião…" aria-label="Buscar reunião" onChange={(event) => setSearch(event.target.value)} /></label>
      <label>Período<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="ALL">Todos</option><option value="MONTH">Este mês</option><option value="LAST_MONTH">Mês anterior</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
      <label>Cliente<select value={client} onChange={(event) => setClient(event.target.value)}><option value="">Todos</option>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Tipo<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {data.canViewTeam && <label>Responsável<select value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Todos</option>{data.users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
      <button type="button" className="mt-button outline" onClick={() => { setSearch(""); setPeriod("ALL"); setClient(""); setType(""); setResponsible(""); }}><FilterX />Limpar filtros</button>
    </section>
    <section className="mt-kpis four">
      <Kpi icon={CalendarCheck} tone="blue" value={thisMonth.length} label="Reuniões realizadas no mês" trend={delta} trendLabel="vs. mês anterior" />
      <Kpi icon={Smile} tone="green" value={count("POSITIVE")} label="Clientes satisfeitos" detail={`${share(count("POSITIVE"))}% do total`} />
      <Kpi icon={Meh} tone="yellow" value={count("ATTENTION")} label="Atenção / Acompanhar" detail={`${share(count("ATTENTION"))}% do total`} />
      <Kpi icon={Frown} tone="red" value={count("NEGATIVE")} label={count("NEGATIVE") === 1 ? "Cliente insatisfeito" : "Clientes insatisfeitos"} detail={`${share(count("NEGATIVE"))}% do total`} />
      <button type="button" className="mt-button outline" onClick={() => exportRows(selectedItems.length ? selectedItems : filtered)}><Download />Exportar{selectedItems.length ? ` (${selectedItems.length})` : ""}</button>
    </section>
    <div className="mt-toolbar"><div className="mt-tabs" role="tablist">{tabs.map(([key, label, test]) => <button type="button" role="tab" aria-selected={tab === key} key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label} ({base.filter(test).length})</button>)}</div></div>
    <section className="mt-table-card">
      <div className="mt-table completed" role="table" aria-label="Reuniões concluídas">
        <div className="mt-row head" role="row"><span><input type="checkbox" aria-label="Selecionar todas" checked={!!pageItems.length && pageItems.every((m) => selected.has(m.id))} onChange={(event) => selectAll(event.target.checked, pageItems.map((m) => m.id), setSelected)} /></span><span>Data</span><span>Horário</span><span>Cliente</span><span>Loja / Unidade</span><span>Tipo</span><span>Participantes</span><span>Duração</span><span>Percepção</span><span>Próximo passo</span><span>Responsável</span><span>Ações</span><span /></div>
        {groupByDay(pageItems, "desc").map(([day, items]) => <div key={day} role="rowgroup">
          <div className="mt-group" role="row"><CalendarDays /><b>{dayGroupLabel(day)}</b><em>{filtered.filter((m) => dayOf(m.startAt) === day).length}</em></div>
          {items.map((meeting) => <div className="mt-row" role="row" key={meeting.id}>
            <span><input type="checkbox" aria-label={`Selecionar ${meeting.clientName}`} checked={selected.has(meeting.id)} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(meeting.id); else next.delete(meeting.id); setSelected(next); }} /></span>
            <span>{shortDate(meeting.startAt)}</span><span>{timeOf(meeting.startAt)}</span><NavLink className="mt-strong" to={`/reunioes/${meeting.id}`}>{meeting.clientName}</NavLink><span>{meeting.unit || "—"}</span><span>{typeLabels[meeting.type]}</span>
            <span className="mt-person"><Avatar name={meeting.contactName} size="sm" />{meeting.contactName}</span><span>{durationMinutes(meeting)} min</span><span><PerceptionBadge value={overallPerception(meeting)} /></span>
            <span className="mt-clip" title={nextStep(meeting)}>{nextStep(meeting)}</span><span className="mt-person"><Avatar name={meeting.responsibleName} size="sm" />{meeting.responsibleName.split(" ")[0]}</span>
            <NavLink className="mt-action" to={`/reunioes/${meeting.id}`}>Ver detalhes</NavLink>
            <RowMenu items={[{ label: "Editar registro", onClick: () => navigate(`/reunioes/em-andamento?id=${meeting.id}`), hidden: !can("meetings.edit") }, { label: "Agendar próxima reunião", onClick: () => navigate(`/reunioes/agendar?cliente=${meeting.clientId}`), hidden: !can("meetings.create") }, { label: "Histórico do cliente", onClick: () => { setClient(meeting.clientId); setTab("ALL"); } }]} />
          </div>)}
        </div>)}
        {!filtered.length && <p className="mt-empty big">Nenhuma reunião concluída encontrada com os filtros atuais.</p>}
      </div>
      <Pagination total={filtered.length} page={page} perPage={perPage} onPage={setPage} onPerPage={setPerPage} noun="reuniões" />
    </section>
  </>;
}

function Kpi({ icon: Icon, tone, value, label, detail, trend, trendLabel, invertTrend = false }: { icon: typeof Smile; tone: string; value: ReactNode; label: string; detail?: string; trend?: number | null; trendLabel?: string; invertTrend?: boolean }) {
  const good = trend == null ? true : invertTrend ? trend <= 0 : trend >= 0;
  return <article className={`mt-kpi ${tone}`}><span className="mt-kpi-icon"><Icon /></span><div><strong>{value}</strong><b>{label}</b>{detail && <small>{detail}</small>}</div>{trend != null && <em className={good ? "up" : "down"} title={trendLabel}>{trend >= 0 ? <ArrowUp /> : <ArrowDown />}{trend >= 0 ? "+" : ""}{trend}%<small>{trendLabel}</small></em>}</article>;
}

/* ---------- Detalhes ---------- */

function DetailView({ store, can }: ViewProps) {
  const { id = "" } = useParams(), navigate = useNavigate(), { data } = store;
  const meeting = data.meetings.find((item) => item.id === id);
  const [error, setError] = useState(""), [uploading, setUploading] = useState(false), fileRef = useRef<HTMLInputElement>(null);
  if (!meeting) return <><PageHeader icon={CalendarDays} crumb="Detalhes" title="Reunião não encontrada" subtitle="Ela pode ter sido excluída ou você não tem acesso a ela." /><NavLink className="mt-button outline" to="/reunioes/agendadas"><ArrowLeft />Voltar para as reuniões</NavLink></>;
  const perception = overallPerception(meeting), p = meeting.perception, openActions = meeting.actions.filter(isOpenAction);
  const campaignNeedsWork = ["IMPROVE", "BAD"].includes(p.contactVolume) || ["REGULAR", "BAD"].includes(p.contactQuality);
  const attention = perception === "NEGATIVE" || p.churnRisk === "HIGH" ? "CRITICAL" : perception === "ATTENTION" || p.churnRisk === "MEDIUM" || openActions.some((action) => actionOverdue(action)) || (perception === "POSITIVE" && openActions.length > 0) ? "WATCH" : perception ? "OK" : "";
  const followUp = meeting.followUpMeetingId ? data.meetings.find((item) => item.id === meeting.followUpMeetingId) : undefined;
  const nextScheduled = followUp || data.meetings.filter((item) => item.clientId === meeting.clientId && item.status === "SCHEDULED" && item.startAt > meeting.startAt).sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  const history = data.meetings.filter((item) => item.clientId === meeting.clientId && item.status === "COMPLETED").sort((a, b) => b.startAt.localeCompare(a.startAt));
  const completed = meeting.status === "COMPLETED", state = displayStatus(meeting);
  const updateAction = async (actionId: string, value: Partial<MeetingAction>) => {
    try { store.upsert((await api<{ meeting: Meeting }>(`/meetings/${meeting.id}`, { method: "PATCH", json: { actions: meeting.actions.map((action) => action.id === actionId ? { ...action, ...value } : action) } })).meeting); } catch (reason) { setError((reason as Error).message); }
  };
  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setError("O anexo pode ter no máximo 8 MB."); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.readAsDataURL(file); });
      store.upsert((await api<{ meeting: Meeting }>(`/meetings/${meeting.id}/attachments`, { method: "POST", json: { fileName: file.name, dataUrl } })).meeting);
      setError("");
    } catch (reason) { setError((reason as Error).message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const download = async (attachmentId: string) => {
    try { const { attachment } = await api<{ attachment: { fileName: string; dataUrl: string } }>(`/meetings/${meeting.id}/attachments/${attachmentId}`); const link = document.createElement("a"); link.href = attachment.dataUrl; link.download = attachment.fileName; link.click(); } catch (reason) { setError((reason as Error).message); }
  };
  const removeAttachment = async (attachmentId: string, fileName: string) => {
    if (!(await systemConfirm({ title: "Remover anexo", message: `Remover ${fileName} desta reunião?`, confirmLabel: "Remover", tone: "danger" }))) return;
    try { store.upsert((await api<{ meeting: Meeting }>(`/meetings/${meeting.id}/attachments/${attachmentId}`, { method: "DELETE" })).meeting); } catch (reason) { setError((reason as Error).message); }
  };
  const summaryCards = [
    { icon: Smile, title: "Percepção do cliente", value: perception ? perceptionLabels[perception] : "Sem registro", detail: perception === "POSITIVE" ? "Cliente satisfeito com o trabalho." : perception === "NEGATIVE" ? "Cliente demonstrou insatisfação." : perception ? "Pontos de atenção identificados." : "Percepção não preenchida.", tone: perception === "POSITIVE" ? "green" : perception === "NEGATIVE" ? "red" : perception ? "yellow" : "muted" },
    { icon: BarChart3, title: "Campanhas", value: !p.contactVolume && !p.contactQuality ? "Sem registro" : campaignNeedsWork ? "Necessita ajuste" : "Em bom ritmo", detail: campaignNeedsWork ? "Pontos de otimização identificados." : "Volume e qualidade dentro do esperado.", tone: !p.contactVolume && !p.contactQuality ? "muted" : campaignNeedsWork ? "orange" : "green" },
    { icon: Users, title: "Comercial / Leads", value: p.contactQuality === "GOOD" ? "Boa qualidade" : p.contactQuality === "REGULAR" ? "Qualidade regular" : p.contactQuality === "BAD" ? "Baixa qualidade" : "Sem registro", detail: p.commercialService === "GOOD" ? "Atendimento comercial bem avaliado." : p.commercialService ? "Atendimento comercial pode melhorar." : "Leads qualificados pela conversa.", tone: p.contactQuality === "GOOD" ? "green" : p.contactQuality === "BAD" ? "red" : p.contactQuality ? "yellow" : "muted" },
    { icon: AlertTriangle, title: "Nível de atenção", value: attention === "CRITICAL" ? "Crítico" : attention === "WATCH" ? "Acompanhar" : attention === "OK" ? "Tranquilo" : "Sem registro", detail: attention === "CRITICAL" ? "Agir antes do próximo contato." : attention === "WATCH" ? "Manter acompanhamento próximo." : "Relacionamento estável.", tone: attention === "CRITICAL" ? "red" : attention === "WATCH" ? "orange" : attention === "OK" ? "green" : "muted" },
  ];
  const fileIcon = (mime: string) => mime.startsWith("image/") ? FileImage : /zip|rar|7z/.test(mime) ? FileArchive : FileText;

  return <>
    <nav className="mt-crumbs" aria-label="Você está em"><NavLink to="/" aria-label="Início"><Home /></NavLink><ChevronRight /><NavLink to="/reunioes/agendadas">Customer Success</NavLink><ChevronRight /><NavLink to={completed ? "/reunioes/concluidas" : "/reunioes/agendadas"}>{completed ? "Concluídas" : "Agendadas"}</NavLink><ChevronRight /><b>Detalhes da Reunião</b></nav>
    <header className="mt-detail-header">
      <span className="mt-header-icon"><CalendarCheck /></span>
      <div><Badge tone={state.tone}>{completed && <CheckCircle2 />}{completed ? "REUNIÃO CONCLUÍDA" : state.label.toUpperCase()}</Badge><h1>{meeting.clientName}</h1><p>{meeting.type === "FOLLOW_UP" ? "Reunião de acompanhamento" : typeLabels[meeting.type]}{meeting.unit ? ` · ${meeting.unit}` : ""}</p></div>
      <dl className="mt-live-meta inline"><div><CalendarDays /><dd>{fullDate(meeting.startAt)}</dd></div><div><Clock /><dd>{timeOf(meeting.startAt)} - {endTime(meeting)} ({durationMinutes(meeting)} min)</dd></div><div><UserRound /><dd>{meeting.responsibleName}</dd></div><div><Video /><dd>{meeting.meetingUrl ? <a href={meeting.meetingUrl} target="_blank" rel="noreferrer">{formatLabels[meeting.format]}</a> : formatLabels[meeting.format]}</dd></div>{meeting.google?.synced && meeting.google.link && <div><CalendarCheck /><dd><a href={meeting.google.link} target="_blank" rel="noreferrer">Ver no Google Agenda</a></dd></div>}</dl>
      <div className="mt-live-actions"><button type="button" className="mt-button outline" onClick={() => navigate(-1)}><ArrowLeft />Voltar</button>
        {can("meetings.edit") && (completed || ["IN_PROGRESS", "PAUSED"].includes(meeting.status) ? <NavLink className="mt-button outline" to={`/reunioes/em-andamento?id=${meeting.id}`}><Pencil />{completed ? "Editar Reunião" : "Abrir reunião"}</NavLink> : meeting.status === "SCHEDULED" && <NavLink className="mt-button outline" to={`/reunioes/agendar?editar=${meeting.id}`}><Pencil />Editar Reunião</NavLink>)}
        {can("tickets.create") && <NavLink className="mt-button outline" to={`/chamados/novo?reuniao=${meeting.id}`}><Plus />Abrir chamado</NavLink>}
        <NavLink className="mt-button dark" to="/clientes"><UserRound />Ver Cliente Completo</NavLink></div>
    </header>
    {error && <p className="mt-alert" role="alert">{error}</p>}
    {meeting.google?.error && meeting.status === "SCHEDULED" && <p className="mt-alert">Esta reunião não foi sincronizada com o Google Agenda: {meeting.google.error}</p>}
    <section className="mt-summary-cards">{summaryCards.map((card) => <article key={card.title} className={card.tone}><span><card.icon /></span><div><small>{card.title}</small><b>{card.value}</b><p>{card.detail}</p></div></article>)}</section>
    <div className="mt-detail-grid">
      <Card icon={FileText} title="Resumo da reunião">{meeting.summary ? <p className="mt-prose">{meeting.summary}</p> : <p className="mt-empty">{completed ? "Nenhum resumo registrado." : `Reunião ${state.label.toLowerCase()} para ${fullDate(meeting.startAt)} às ${timeOf(meeting.startAt)}. Pauta: ${meeting.subject}`}</p>}{meeting.notes && <p className="mt-card-sub">Observações do agendamento: {meeting.notes}</p>}</Card>
      <Card icon={MessageCircle} title="O cliente disse"><ul className="mt-quotes">{meeting.statements.map((item) => <li key={item.id}><Quote /><span>“{item.text}”{item.kind && <em className={item.kind.toLowerCase()}>{statementLabels[item.kind as Exclude<StatementKind, "">]}</em>}</span></li>)}{!meeting.statements.length && <li className="mt-empty">Nenhuma fala registrada.</li>}</ul></Card>
      <Card icon={BarChart3} title="Percepção do cliente (detalhes)"><dl className="mt-perception-list">{perceptionRows.map((row) => { const option = row.options.find((item) => item.value === p[row.field]); return <div key={row.field}><dt>{row.label}</dt><dd className={option?.tone || "muted"}>{option ? <>{option.tone === "good" ? <Smile /> : option.tone === "bad" ? <Frown /> : option.tone === "info" ? <TrendingUp /> : <Meh />}{option.label}</> : "—"}</dd></div>; })}</dl>{p.notes && <p className="mt-card-sub">{p.notes}</p>}</Card>
    </div>
    <div className="mt-detail-grid two">
      <Card icon={ClipboardCheck} title="Ações geradas pela reunião"><ActionsEditor readOnly actions={meeting.actions} users={data.users} onChange={(actionId, value) => { if (can("meetings.edit")) void updateAction(actionId, value); }} /></Card>
      <div className="mt-column">
        <Card icon={Target} title="Próximo passo"><div className="mt-next"><CalendarClock /><p>{meeting.nextContact.date ? <>{meeting.responsibleName.split(" ")[0]} retorna ao cliente em<b>{fullDate(meeting.nextContact.date)}</b>{meeting.nextContact.type && <span>{meeting.nextContact.type}</span>}</> : <span>Nenhum retorno definido.</span>}{meeting.nextSteps && <span>{meeting.nextSteps}</span>}</p></div></Card>
        <Card icon={CalendarPlus} title="Próxima reunião">{nextScheduled ? <NavLink className="mt-next-meeting" to={`/reunioes/${nextScheduled.id}`}><b>{fullDate(nextScheduled.startAt)} às {timeOf(nextScheduled.startAt)} ({nextScheduled.durationMinutes} min)</b><span>{nextScheduled.subject || typeLabels[nextScheduled.type]}</span></NavLink> : <p className="mt-empty">Nenhuma reunião futura com este cliente.</p>}{can("meetings.create") && <NavLink className="mt-button outline wide" to={`/reunioes/agendar?cliente=${meeting.clientId}`}><Plus />Agendar próxima reunião</NavLink>}</Card>
      </div>
    </div>
    <div className="mt-detail-grid two">
      <Card icon={Paperclip} title="Anexos da reunião"><div className="mt-attachments">{meeting.attachments.map((file) => { const Icon = fileIcon(file.mimeType); return <article key={file.id}><Icon /><button type="button" className="mt-attachment-name" onClick={() => void download(file.id)}>{file.fileName}</button><small>{file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</small>{can("meetings.edit") && <button type="button" className="mt-icon-button" aria-label={`Remover ${file.fileName}`} onClick={() => void removeAttachment(file.id, file.fileName)}><Trash2 /></button>}</article>; })}
        {can("meetings.edit") && <label className="mt-attachment-add"><Plus />{uploading ? "Enviando…" : "Adicionar anexo"}<input ref={fileRef} type="file" hidden disabled={uploading} onChange={(event) => void upload(event.target.files)} /></label>}</div></Card>
      <Card icon={History} title="Histórico do cliente" action={<NavLink className="mt-link" to={`/reunioes/concluidas?cliente=${meeting.clientId}`}>Ver histórico completo <ArrowRight /></NavLink>}>
        <div className="mt-history">{history.slice(0, 5).map((item) => <NavLink key={item.id} to={`/reunioes/${item.id}`} className={item.id === meeting.id ? "current" : ""}><time>{fullDate(item.startAt)}</time><span>{item.type === "FOLLOW_UP" ? "Reunião de acompanhamento" : `Reunião de ${typeLabels[item.type].toLowerCase()}`}</span><span>{item.responsibleName.split(" ")[0]}</span><Badge tone="green"><CheckCircle2 />Concluída</Badge></NavLink>)}{!history.length && <p className="mt-empty">Nenhuma reunião concluída com este cliente ainda.</p>}</div>
      </Card>
    </div>
  </>;
}

/* ---------- Relatórios ---------- */

function ReportsView({ store }: ViewProps) {
  const { data } = store, now = new Date();
  const [preset, setPreset] = useState("MONTH"), [from, setFrom] = useState(localDay(new Date(now.getFullYear(), now.getMonth(), 1))), [to, setTo] = useState(localDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [client, setClient] = useState(""), [unit, setUnit] = useState(""), [responsible, setResponsible] = useState(""), [type, setType] = useState(""), [perceptionFilter, setPerceptionFilter] = useState(""), [actionFilter, setActionFilter] = useState("");
  const applyPreset = (value: string) => {
    setPreset(value);
    const ranges: Record<string, [Date, Date]> = { MONTH: [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0)], LAST_MONTH: [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)], "30": [addDays(now, -29), now], "90": [addDays(now, -89), now], YEAR: [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)] };
    if (ranges[value]) { setFrom(localDay(ranges[value][0])); setTo(localDay(ranges[value][1])); }
  };
  const today = localDay(), units = [...new Set(data.meetings.map((m) => m.unit).filter(Boolean))].sort();
  const matches = (m: Meeting) => (!client || m.clientId === client) && (!unit || m.unit === unit) && (!responsible || m.responsibleId === responsible) && (!type || m.type === type) && (!perceptionFilter || overallPerception(m) === perceptionFilter) && (!actionFilter || m.actions.some((action) => actionFilter === "OVERDUE" ? actionOverdue(action, today) : action.status === actionFilter));
  const span = Math.max(1, Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1);
  const prevFrom = localDay(addDays(new Date(`${from}T12:00:00`), -span)), prevTo = localDay(addDays(new Date(`${from}T12:00:00`), -1));
  const scope = (start: string, end: string) => data.meetings.filter((m) => matches(m) && dayOf(m.startAt) >= start && dayOf(m.startAt) <= end);
  const stats = (items: Meeting[]) => {
    const done = items.filter((m) => m.status === "COMPLETED"), cancelled = items.filter((m) => m.status === "CANCELLED"), due = items.filter((m) => m.status === "COMPLETED" || m.status === "CANCELLED" || (m.status === "SCHEDULED" && displayStatus(m).label === "Não iniciada"));
    const actions = done.flatMap((m) => m.actions.map((action) => ({ action, meeting: m })));
    return { all: items.filter((m) => m.status !== "CANCELLED"), done, cancelled, rescheduled: items.filter((m) => m.rescheduleCount > 0), clients: new Set(done.map((m) => m.clientId)).size, avg: done.length ? Math.round(done.reduce((sum, m) => sum + durationMinutes(m), 0) / done.length) : 0, rate: due.length ? Math.round(done.length / due.length * 100) : 0, actions, perception: (value: OverallPerception) => done.filter((m) => overallPerception(m) === value).length };
  };
  const current = stats(scope(from, to)), previous = stats(scope(prevFrom, prevTo));
  const trend = (a: number, b: number) => b ? Math.round((a - b) / b * 100) : null;
  const pct = (value: number, total: number) => total ? `${Math.round(value / total * 100)}% do total` : "—";
  const withPerception = current.perception("POSITIVE") + current.perception("ATTENTION") + current.perception("NEGATIVE");
  const openActionsAll = data.meetings.filter(matches).flatMap((m) => m.actions.filter(isOpenAction).map((action) => ({ action, meeting: m })));
  const pendingClients = new Set(openActionsAll.map((item) => item.meeting.clientId)).size;
  const doneActions = current.actions.filter(({ action }) => action.status === "DONE").length, lateActions = current.actions.filter(({ action }) => actionOverdue(action, today)).length;
  // Reuniões realizadas por semana (início na segunda-feira) dentro do período.
  const weeks: { label: string; value: number }[] = [];
  for (let week = startOfWeek(new Date(`${from}T12:00:00`)); localDay(week) <= to; week = addDays(week, 7)) weeks.push({ label: shortDate(localDay(week)), value: current.done.filter((m) => { const day = dayOf(m.startAt); return day >= localDay(week) && day <= localDay(addDays(week, 6)); }).length });
  const donut = [{ key: "POSITIVE", label: "Positiva", value: current.perception("POSITIVE"), color: "var(--mt-good)" }, { key: "ATTENTION", label: "Acompanhar", value: current.perception("ATTENTION"), color: "var(--mt-warn)" }, { key: "NEGATIVE", label: "Insatisfeita", value: current.perception("NEGATIVE"), color: "var(--mt-bad)" }];
  const themes = subjectThemes.map((theme) => ({ label: theme.label, value: current.done.filter((m) => meetingThemes(m).includes(theme.label)).length })).filter((item) => item.value).sort((a, b) => b.value - a.value);
  const themeTotal = themes.reduce((sum, item) => sum + item.value, 0);
  const latestByClient = new Map<string, Meeting>();
  data.meetings.filter((m) => m.status === "COMPLETED" && matches(m)).sort((a, b) => a.startAt.localeCompare(b.startAt)).forEach((m) => latestByClient.set(m.clientId, m));
  const attentionClients = [...latestByClient.values()].map((m) => {
    const perception = overallPerception(m), rescheduled = data.meetings.filter((item) => item.clientId === m.clientId && item.rescheduleCount > 0).reduce((sum, item) => sum + item.rescheduleCount, 0);
    const complaint = m.statements.find((item) => item.kind === "COMPLAINT")?.text;
    const reason = perception === "NEGATIVE" || perception === "ATTENTION" ? m.perception.notes || complaint || (m.perception.contactVolume === "BAD" || m.perception.contactVolume === "IMPROVE" ? "Volume de contatos abaixo do esperado" : m.perception.churnRisk === "HIGH" ? "Alto risco de cancelamento" : "Pontos de atenção na última reunião") : rescheduled >= 2 ? `Reunião reagendada ${rescheduled}x` : "";
    return { meeting: m, perception: perception || "ATTENTION", reason };
  }).filter((item) => item.reason).sort((a, b) => Number(b.perception === "NEGATIVE") - Number(a.perception === "NEGATIVE") || b.meeting.startAt.localeCompare(a.meeting.startAt));
  const returns = data.meetings.filter((m) => m.status === "COMPLETED" && matches(m) && m.nextContact.date >= today).sort((a, b) => a.nextContact.date.localeCompare(b.nextContact.date));
  const upcoming = data.meetings.filter((m) => m.status === "SCHEDULED" && matches(m) && m.startAt >= new Date().toISOString()).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const generated = current.actions.sort((a, b) => Number(isOpenAction(b.action)) - Number(isOpenAction(a.action)) || (a.action.dueDate || "9").localeCompare(b.action.dueDate || "9"));
  const clear = () => { setClient(""); setUnit(""); setResponsible(""); setType(""); setPerceptionFilter(""); setActionFilter(""); };

  return <>
    <PageHeader icon={BarChart3} crumb="Relatórios" title="Relatórios de Reuniões" subtitle="Visão completa das reuniões, resultados e ações geradas." quote={3}
      actions={<div className="mt-range"><CalendarDays /><input type="date" aria-label="Início do período" value={from} onChange={(event) => { setFrom(event.target.value); setPreset(""); }} /><ArrowRight /><input type="date" aria-label="Fim do período" value={to} onChange={(event) => { setTo(event.target.value); setPreset(""); }} /><select aria-label="Período rápido" value={preset} onChange={(event) => applyPreset(event.target.value)}><option value="">Personalizado</option><option value="MONTH">Este mês</option><option value="LAST_MONTH">Mês anterior</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="YEAR">Este ano</option></select></div>} />
    <section className="mt-filters six">
      <label>Cliente / Grupo<select value={client} onChange={(event) => setClient(event.target.value)}><option value="">Todos</option>{data.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Loja / Unidade<select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="">Todas</option>{units.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Responsável<select value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Todos</option>{data.users.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label>Tipo de reunião<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Percepção do cliente<select value={perceptionFilter} onChange={(event) => setPerceptionFilter(event.target.value)}><option value="">Todas</option>{Object.entries(perceptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Status das ações<select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}><option value="">Todos</option>{Object.entries(actionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}<option value="OVERDUE">Em atraso</option></select></label>
      <button type="button" className="mt-button outline" onClick={clear}><FilterX />Limpar filtros</button>
    </section>
    <section className="mt-kpis seven">
      <Kpi icon={CalendarDays} tone="blue" value={current.all.length} label="Reuniões agendadas" trend={trend(current.all.length, previous.all.length)} trendLabel="vs. período anterior" />
      <Kpi icon={Check} tone="green" value={current.done.length} label="Reuniões realizadas" trend={trend(current.done.length, previous.done.length)} trendLabel="vs. período anterior" />
      <Kpi icon={CalendarClock} tone="blue" value={current.rescheduled.length} label="Reuniões reagendadas" trend={trend(current.rescheduled.length, previous.rescheduled.length)} trendLabel="vs. período anterior" invertTrend />
      <Kpi icon={XCircle} tone="red" value={current.cancelled.length} label="Reuniões canceladas" trend={trend(current.cancelled.length, previous.cancelled.length)} trendLabel="vs. período anterior" invertTrend />
      <Kpi icon={Users} tone="blue" value={current.clients} label="Clientes atendidos" trend={trend(current.clients, previous.clients)} trendLabel="vs. período anterior" />
      <Kpi icon={Clock} tone="blue" value={`${current.avg} min`} label="Tempo médio" />
      <Kpi icon={BarChart3} tone="green" value={`${current.rate}%`} label="Taxa de realização" detail="realizadas ÷ previstas até hoje" />
      <Kpi icon={Smile} tone="green" value={current.perception("POSITIVE")} label="Percepção positiva" detail={pct(current.perception("POSITIVE"), withPerception)} />
      <Kpi icon={Meh} tone="yellow" value={current.perception("ATTENTION")} label="Acompanhar" detail={pct(current.perception("ATTENTION"), withPerception)} />
      <Kpi icon={Frown} tone="red" value={current.perception("NEGATIVE")} label="Insatisfeitos" detail={pct(current.perception("NEGATIVE"), withPerception)} />
      <Kpi icon={ClipboardList} tone="orange" value={pendingClients} label="Clientes com pendências" detail={data.clients.length ? `${Math.round(pendingClients / data.clients.length * 100)}% da carteira` : undefined} />
      <Kpi icon={ListChecks} tone="blue" value={current.actions.length} label="Ações geradas" trend={trend(current.actions.length, previous.actions.length)} trendLabel="vs. período anterior" />
      <Kpi icon={CheckCircle2} tone="green" value={doneActions} label="Ações concluídas" detail={pct(doneActions, current.actions.length)} />
      <Kpi icon={Clock} tone="red" value={lateActions} label="Ações em atraso" detail={pct(lateActions, current.actions.length)} />
    </section>
    <div className="mt-report-grid">
      <Card icon={Target} title="Reuniões realizadas no período" action={<span className="mt-card-meta">Total: {current.done.length} reuniões</span>}>
        {weeks.some((week) => week.value) ? <div className="mt-chart" role="img" aria-label={`Reuniões realizadas por semana: ${weeks.map((week) => `semana de ${week.label}: ${week.value}`).join(", ")}`}><ResponsiveContainer width="100%" height={210}><BarChart data={weeks} margin={{ top: 20, right: 8, left: -24, bottom: 0 }} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="var(--mt-grid)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--mt-muted)" }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--mt-muted)" }} /><Tooltip cursor={{ fill: "var(--mt-hover)" }} formatter={(value) => [`${value} reuniões`, "Realizadas"]} labelFormatter={(label) => `Semana de ${label}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--mt-border)", background: "var(--mt-surface)", fontSize: 11 }} /><Bar dataKey="value" fill="var(--mt-series)" radius={[4, 4, 0, 0]} maxBarSize={44}><LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "var(--mt-ink)" }} formatter={(value: unknown) => Number(value) || ""} /></Bar></BarChart></ResponsiveContainer></div> : <p className="mt-empty big">Nenhuma reunião realizada no período.</p>}
      </Card>
      <Card icon={Heart} title="Percepção dos clientes">
        {withPerception ? <div className="mt-donut"><div className="mt-donut-chart"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={donut.filter((item) => item.value)} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="var(--mt-surface)" strokeWidth={2}>{donut.filter((item) => item.value).map((item) => <Cell key={item.key} fill={item.color} />)}</Pie><Tooltip formatter={(value, name) => [`${value} reuniões`, name]} contentStyle={{ borderRadius: 8, border: "1px solid var(--mt-border)", background: "var(--mt-surface)", fontSize: 11 }} /></PieChart></ResponsiveContainer><div><b>{withPerception}</b><small>reuniões</small></div></div>
          <ul className="mt-legend">{donut.map((item) => <li key={item.key}><i style={{ background: item.color }} />{item.label}<b>{item.value} ({Math.round(item.value / withPerception * 100)}%)</b></li>)}</ul></div> : <p className="mt-empty big">Nenhuma percepção registrada no período.</p>}
      </Card>
      <Card icon={BarChart3} title="Principais assuntos das reuniões">
        {themes.length ? <ul className="mt-hbars">{themes.map((item) => <li key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.value / themes[0].value * 100}%` }} /></i><em>{item.value} ({Math.round(item.value / themeTotal * 100)}%)</em></li>)}</ul> : <p className="mt-empty big">Sem assuntos registrados no período.</p>}
      </Card>
    </div>
    <div className="mt-report-grid two">
      <Card icon={Target} title="O que as reuniões geraram" action={<NavLink className="mt-link" to="/reunioes/concluidas">Ver todas <ArrowRight /></NavLink>}>
        <div className="mt-table generated" role="table"><div className="mt-row head" role="row"><span>Cliente</span><span>Tipo</span><span>Solicitação / Ação</span><span>Responsável</span><span>Prazo</span><span>Status</span><span>Retorno ao cliente</span></div>
          {generated.slice(0, 6).map(({ action, meeting }) => <NavLink className="mt-row" role="row" key={action.id} to={`/reunioes/${meeting.id}`}><span className="mt-person"><span className="mt-client-mini" style={{ color: avatarTone(meeting.clientName) }}>{initials(meeting.clientName)}</span><b>{meeting.clientName}</b></span><span>{typeLabels[meeting.type]}</span><span className="mt-clip" title={action.title}>{action.title}</span><span className="mt-person"><Avatar name={action.responsibleName || "?"} size="sm" />{action.responsibleName.split(" ")[0] || "—"}</span><span className={actionOverdue(action, today) ? "mt-late" : ""}>{shortDate(action.dueDate)}</span><span><Badge tone={actionTone[action.status]}>{actionStatusLabels[action.status]}</Badge></span><span>{shortDate(meeting.nextContact.date)}</span></NavLink>)}
          {!generated.length && <p className="mt-empty">Nenhuma ação gerada no período.</p>}</div>
      </Card>
      <Card icon={AlertTriangle} title="Clientes que exigem atenção" className="mt-attention" action={<NavLink className="mt-link" to="/reunioes/concluidas">Ver todas <ArrowRight /></NavLink>}>
        <div className="mt-table attention" role="table"><div className="mt-row head" role="row"><span>Cliente</span><span>Motivo</span><span>Última reunião</span><span>Percepção</span></div>
          {attentionClients.slice(0, 6).map((item) => <NavLink className="mt-row" role="row" key={item.meeting.clientId} to={`/reunioes/${item.meeting.id}`}><b>{item.meeting.clientName}</b><span className="mt-clip" title={item.reason}>{item.reason}</span><span>{shortDate(item.meeting.startAt)}</span><span><PerceptionBadge value={item.perception} /></span></NavLink>)}
          {!attentionClients.length && <p className="mt-empty">Nenhum cliente exige atenção agora.</p>}</div>
      </Card>
    </div>
    <div className="mt-report-grid two">
      <Card icon={CalendarClock} title="Próximos retornos" action={<NavLink className="mt-link" to="/reunioes/concluidas">Ver todas <ArrowRight /></NavLink>}>
        <div className="mt-table returns" role="table"><div className="mt-row head" role="row"><span>Data</span><span>Cliente</span><span>Assunto</span><span>Responsável</span></div>{returns.slice(0, 5).map((m) => <NavLink className="mt-row" role="row" key={m.id} to={`/reunioes/${m.id}`}><span>{shortDate(m.nextContact.date)}</span><b>{m.clientName}</b><span className="mt-clip">{m.nextContact.type || m.nextSteps || "Retorno ao cliente"}</span><span>{m.responsibleName.split(" ")[0]}</span></NavLink>)}{!returns.length && <p className="mt-empty">Nenhum retorno programado.</p>}</div>
      </Card>
      <Card icon={CalendarDays} title="Próximas reuniões agendadas" action={<NavLink className="mt-link" to="/reunioes/agendadas">Ver todas <ArrowRight /></NavLink>}>
        <div className="mt-table upcoming" role="table"><div className="mt-row head" role="row"><span>Data</span><span>Horário</span><span>Cliente</span><span>Tipo</span><span>Responsável</span></div>{upcoming.slice(0, 5).map((m) => <NavLink className="mt-row" role="row" key={m.id} to={`/reunioes/${m.id}`}><span>{shortDate(m.startAt)}</span><span>{timeOf(m.startAt)}</span><b>{m.clientName}</b><span>{typeLabels[m.type]}</span><span>{m.responsibleName.split(" ")[0]}</span></NavLink>)}{!upcoming.length && <p className="mt-empty">Nenhuma reunião futura agendada.</p>}</div>
      </Card>
    </div>
  </>;
}

