import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowDown, ArrowRight, ArrowUp, BarChart3, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3,
  ExternalLink, Hourglass, KanbanSquare, List, ListTodo, MoreVertical, Play, Plus, Quote, Search, ShieldCheck, Undo2, Users,
} from "lucide-react";
import { eventColorHex } from "./calendarColors";
import { avatarTone, initials } from "./meetingsModel";
import { userColor } from "./userColors";
import { PersonAvatar, ticketApi, type Ticket, type TicketsData } from "./TicketsManagement";
import {
  activeStep, averageDays, clientJustApproved, dueOf, executedSteps, involves, isLate, isOpenTicket, marketingDepartmentId,
  returnedToMe, sameDay, sentAt, sentForApproval, stepProgress, ticketSituation, toApprove, variation, withMe,
} from "./marketingTickets";
import "./MarketingBoard.css";

export { marketingDepartmentId };

// Painel do setor Marketing e Criação. Quem executa vê o próprio dia: chamados com prazo hoje,
// o que voltou para ajuste, agenda, tarefas e o que entregou e espera aprovação. O líder do
// setor vê o mesmo e, além disso, as aprovações que estão com ele e a carga de cada pessoa.
type SessionUser = { id: string; name: string; avatarDataUrl?: string; departmentId?: string; departmentName?: string; role?: string };
type Task = { id: string; title: string; responsibleId: string; priority: Ticket["priority"]; status: string; dueAt: string; ticketId?: string; ticketCode?: string };
type Event = { id: string; title: string; ownerId: string; participantIds?: string[]; startAt: string; endAt: string; location?: string; category?: string; colorId?: string };
type Board = { tickets: TicketsData | null; tasks: Task[]; events: Event[] };

export const ticketPageUrl = (ticket: { id: string }) => `/chamados/ver/${encodeURIComponent(ticket.id)}`;
const openTask = (task: Task) => !["DONE", "CANCELLED", "PUBLISHED"].includes(task.status);
const time = (value: string) => new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const shortDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const longDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(date).replace(/^./, (char) => char.toUpperCase());
const first = (name: string) => name.split(" ")[0] || name;
const isoWeek = (date: Date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
  return Math.ceil(((target.getTime() - Date.UTC(target.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
const dayOfYear = (date: Date) => Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
const phrases = ["Disciplina hoje, grandes resultados amanhã.", "Feito é melhor que perfeito — e entregue no prazo é melhor ainda.", "Uma etapa por vez, com capricho.", "Clareza no briefing, velocidade na entrega.", "Cada detalhe conta na experiência do cliente."];
const quotes = [
  { text: "Qualidade é a soma de pequenos detalhes bem feitos.", author: "Steve Jobs" },
  { text: "Design não é só como parece, é como funciona.", author: "Steve Jobs" },
  { text: "Simplicidade é o último grau de sofisticação.", author: "Leonardo da Vinci" },
  { text: "A criatividade é a inteligência se divertindo.", author: "Albert Einstein" },
];

async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(`/api${path}`).catch(() => null);
  return response?.ok ? response.json().catch(() => null) : null;
}

export function useMarketingBoard(userId: string) {
  const [board, setBoard] = useState<Board>({ tickets: null, tasks: [], events: [] }), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [tickets, tasks, events] = await Promise.all([get<TicketsData>("/tickets"), get<{ tasks: Task[] }>("/tasks"), get<{ events: Event[] }>("/calendar/events")]);
    setBoard({ tickets, tasks: tasks?.tasks || [], events: events?.events || [] });
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load, userId]);
  return { ...board, loading, load };
}

// Líder do setor: responsável cadastrado no setor Marketing e Criação (ou no setor da pessoa).
export const isSectorLeader = (user: SessionUser, data: TicketsData | null) =>
  !!data?.departments.some((item) => item.managerUserId === user.id && (item.id === marketingDepartmentId || item.id === user.departmentId));

/* ---------- Peças ---------- */

export function ClientMark({ name }: { name?: string }) {
  const label = name || "Interno";
  return <span className="mc-client-mark" style={{ background: avatarTone(label) }} aria-hidden="true">{initials(label)}</span>;
}
export function PriorityTag({ value }: { value: Ticket["priority"] }) {
  const meta = { URGENT: ["Urgente", "red", ArrowUp], HIGH: ["Alta", "red", ArrowUp], MEDIUM: ["Média", "orange", ArrowDown], LOW: ["Baixa", "green", ArrowDown] } as const;
  const [label, tone, Icon] = meta[value];
  return <span className={`mc-priority ${tone}`}><Icon />{label}</span>;
}
export function SituationPill({ ticket, userId }: { ticket: Ticket; userId: string }) {
  const { label, tone } = ticketSituation(ticket, userId);
  return <span className={`mc-pill ${tone}`}>{tone === "blue" && <i className="mc-live" />}{label}</span>;
}
export function StepCell({ ticket }: { ticket: Ticket }) {
  const step = activeStep(ticket), progress = stepProgress(ticket);
  const name = ticket.status === "RESOLVED" ? "Concluído" : ticket.status === "CLOSED" ? "Cancelado" : step?.name || "Atendimento";
  return <span className="mc-step-cell"><b title={name}>{name}{progress.total ? ` (${progress.position}/${progress.total})` : ""}</b><i style={{ "--done": `${progress.percent}%` } as CSSProperties}><em /></i></span>;
}
export function DueCell({ ticket }: { ticket: Ticket }) {
  const due = dueOf(ticket);
  if (!due) return <span className="mc-due">Sem prazo</span>;
  const late = isLate(ticket);
  return <span className={`mc-due ${late ? "late" : sameDay(due) ? "today" : ""}`}><b>{late ? "Atrasado" : sameDay(due) ? "Hoje" : shortDate(due)}</b><small>{late ? `${shortDate(due)} ${time(due)}` : sameDay(due) ? time(due) : new Date(due).getFullYear()}</small></span>;
}
function RowMenu({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const url = `${window.location.origin}${ticketPageUrl(ticket)}`;
  return <div className="mc-row-menu" ref={ref}>
    <button type="button" className="mc-icon-button" aria-label={`Mais opções de ${ticket.code}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreVertical /></button>
    {open && <div className="mc-menu" role="menu">
      <a role="menuitem" href={ticketPageUrl(ticket)} target="_blank" rel="noreferrer"><ExternalLink />Abrir em nova aba</a>
      <button type="button" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(url); setOpen(false); }}><ClipboardCheck />Copiar link</button>
      <NavLink role="menuitem" to={`/chamados/editar/${ticket.id}`}><ListTodo />Editar chamado</NavLink>
    </div>}
  </div>;
}
export function OpenButton({ ticket }: { ticket: Ticket }) {
  return <NavLink className="mc-open" to={ticketPageUrl(ticket)}>Abrir<ArrowRight /></NavLink>;
}
function Card({ icon: Icon, title, subtitle, tone = "dark", action, children, className = "" }: { icon: typeof Users; title: ReactNode; subtitle?: string; tone?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`mc-card ${className}`}>
    <header className="mc-card-head"><span className={`mc-card-icon ${tone}`}><Icon /></span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="mc-card-actions">{action}</div>}</header>
    {children}
  </section>;
}
const Empty = ({ text }: { text: string }) => <p className="mc-empty">{text}</p>;
function Kpi({ icon: Icon, tone, value, label, detail, trend, inverse = false }: { icon: typeof Users; tone: string; value: string | number; label: string; detail: string; trend?: number | null; inverse?: boolean }) {
  const good = trend != null && (inverse ? trend < 0 : trend > 0);
  return <article className="mc-kpi"><span className={`mc-kpi-icon ${tone}`}><Icon /></span><div><b>{value}</b><strong>{label}</strong>
    {trend != null ? <small className={good ? "up" : trend === 0 ? "" : "down"}>{trend > 0 ? <ArrowUp /> : trend < 0 ? <ArrowDown /> : null}{trend > 0 ? "+" : ""}{trend}% vs. mês anterior</small> : <small>{detail}</small>}</div></article>;
}

/* ---------- Painel ---------- */

export function MarketingBoard({ user }: { user: SessionUser }) {
  const { tickets: data, tasks, events, loading, load } = useMarketingBoard(user.id);
  const [now] = useState(() => new Date());
  if (loading && !data) return <div className="mc-board"><p className="mc-loading" role="status"><Clock3 />Carregando seu painel…</p></div>;
  if (!data) return <div className="mc-board"><p className="mc-alert" role="alert">Não foi possível carregar os chamados. Atualize a página para tentar novamente.</p></div>;
  const all = data.tickets.filter((ticket) => ticket.status !== "CLOSED"), leader = isSectorLeader(user, data);
  const mine = all.filter((ticket) => involves(ticket, user.id));
  const withMeNow = mine.filter((ticket) => withMe(ticket, user.id) && activeStep(ticket)?.role !== "CLIENT");
  const today = withMeNow.filter((ticket) => activeStep(ticket)?.role === "EXECUTOR" || !activeStep(ticket)).filter((ticket) => isLate(ticket) || sameDay(dueOf(ticket)))
    .sort((a, b) => dueOf(a).localeCompare(dueOf(b)));
  const returned = withMeNow.filter((ticket) => returnedToMe(ticket, user.id)).sort((a, b) => (activeStep(b)?.adjustment?.at || "").localeCompare(activeStep(a)?.adjustment?.at || ""));
  const sent = all.filter((ticket) => sentForApproval(ticket, user.id)).sort((a, b) => sentAt(b).localeCompare(sentAt(a)));
  const approvals = all.filter((ticket) => toApprove(ticket, user.id) && activeStep(ticket)?.role === "APPROVER");
  const doneNow = executedSteps(data.tickets, user.id, 0, now), donePrevious = executedSteps(data.tickets, user.id, 1, now);
  const average = averageDays(doneNow), previousAverage = averageDays(donePrevious);
  const hour = now.getHours(), quote = quotes[dayOfYear(now) % quotes.length];
  const sectorId = data.departments.find((item) => item.managerUserId === user.id && (item.id === marketingDepartmentId || item.id === user.departmentId))?.id || marketingDepartmentId;
  const sector = all.filter((ticket) => ticket.departmentId === sectorId);

  return <div className="mc-board">
    <header className="mc-hero">
      <div className="mc-hero-main">
        {user.avatarDataUrl ? <img className="mc-hero-photo" src={user.avatarDataUrl} alt="" /> : <span className="mc-hero-photo initials" style={{ background: userColor({ id: user.id }) }}>{initials(user.name)}</span>}
        <div><h1>{hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}, {first(user.name)}!</h1><p>“{phrases[dayOfYear(now) % phrases.length]}”</p></div>
        <aside><b>{longDate(now)}</b><span>Semana {isoWeek(now)} • {leader ? "Liderança do setor" : "Foco na entrega"}</span></aside>
      </div>
      <blockquote className="mc-hero-quote"><Quote /><div><p>“{quote.text}”</p><cite>{quote.author}</cite></div></blockquote>
    </header>

    <section className="mc-kpis" aria-label="Indicadores">
      <Kpi icon={CalendarDays} tone="dark" value={today.length} label="Chamados do dia" detail={today.some((ticket) => isLate(ticket)) ? `${today.filter((ticket) => isLate(ticket)).length} atrasado(s)` : "Para executar hoje"} />
      <Kpi icon={Play} tone="blue" value={withMeNow.length} label="Em andamento" detail="Total na sua carteira" />
      <Kpi icon={Clock3} tone="orange" value={sent.length} label="Aguardando aprovação" detail="Entregues (cliente ou aprovação interna)" />
      <Kpi icon={Check} tone="green" value={doneNow.length} label="Concluídos este mês" detail="Etapas entregues por você" trend={variation(doneNow.length, donePrevious.length)} />
      <Kpi icon={BarChart3} tone="purple" value={average == null ? "—" : `${average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`} label="Tempo médio de execução" detail="Do início à entrega da etapa" trend={variation(average, previousAverage)} inverse />
    </section>

    <div className="mc-columns">
      <div className="mc-column main">
        <Card icon={CalendarDays} title="Chamados do dia" subtitle="Seus chamados com prazo para hoje. Foque no que precisa ser entregue." action={<NavLink className="mc-link-button" to="/agenda">Ver calendário do dia<ArrowRight /></NavLink>}>
          {today.length ? <div className="mc-table" role="table" aria-label="Chamados do dia">
            <div className="mc-tr head day" role="row"><span>#</span><span>Cliente / Projeto</span><span>Tipo</span><span>Etapa atual</span><span>Prazo</span><span>Prioridade</span><span>Status</span><span>Ação</span></div>
            {today.map((ticket) => <div className={`mc-tr day ${clientJustApproved(ticket) ? "approved" : ""}`} role="row" key={ticket.id}>
              <span className="mc-code">{ticket.code}</span>
              <ClientCell ticket={ticket} />
              <span className="mc-muted">{ticket.flowName || "Chamado"}</span>
              <span className="mc-step-with-flag"><StepCell ticket={ticket} />{clientJustApproved(ticket) && <em className="mc-flag green"><CheckCircle2 />Cliente aprovou</em>}</span>
              <DueCell ticket={ticket} />
              <span><PriorityTag value={ticket.priority} /></span>
              <span><SituationPill ticket={ticket} userId={user.id} /></span>
              <span className="mc-actions"><OpenButton ticket={ticket} /><RowMenu ticket={ticket} /></span>
            </div>)}
          </div> : <Empty text="Nenhum chamado com prazo para hoje. Aproveite para adiantar os próximos." />}
        </Card>

        {returned.length > 0 && <Card className="mc-returned" icon={Undo2} tone="red" title={<>Retornaram para mim <em className="mc-count">{returned.length}</em></>} subtitle="Chamados que voltaram para ajustes ou correções." action={<NavLink className="mc-link-button" to="/chamados/meus/andamento">Ver todos<ArrowRight /></NavLink>}>
          <div className="mc-table" role="table" aria-label="Chamados que retornaram">
            <div className="mc-tr head returned" role="row"><span>#</span><span>Cliente / Projeto</span><span>Motivo do retorno</span><span>Retornou em</span><span>Prioridade</span><span>Ação</span></div>
            {returned.map((ticket) => { const adjustment = activeStep(ticket)!.adjustment!; return <div className="mc-tr returned" role="row" key={ticket.id}>
              <span className="mc-code">{ticket.code}</span><ClientCell ticket={ticket} />
              <span className="mc-reason" title={adjustment.note}><b>{first(adjustment.byName)}</b> solicitou: {adjustment.note}</span>
              <span className="mc-muted">{adjustment.at ? `${sameDay(adjustment.at) ? "Hoje" : shortDate(adjustment.at)} às ${time(adjustment.at)}` : "—"}</span>
              <span><PriorityTag value={ticket.priority} /></span>
              <span className="mc-actions"><OpenButton ticket={ticket} /><RowMenu ticket={ticket} /></span>
            </div>; })}
          </div>
        </Card>}

        <MyTickets title="Meus Chamados" subtitle="Acompanhe todos os seus chamados, independentemente do prazo." tickets={mine.filter(isOpenTicket)} userId={user.id} data={data} compact action={<NavLink className="mc-link-button" to="/chamados/meus">Ver todos ({mine.filter(isOpenTicket).length})<ArrowRight /></NavLink>} />
        {leader && <MyTickets title="Chamados do setor" subtitle="Todos os chamados do Marketing e Criação, com quem está cada etapa." icon={Users} tickets={sector.filter(isOpenTicket)} userId={user.id} data={data} people action={<NavLink className="mc-link-button" to="/chamados">Abrir lista completa<ArrowRight /></NavLink>} />}
      </div>

      <div className="mc-column side">
        <Agenda user={user} events={events} />
        <TodayTasks tasks={tasks.filter((task) => task.responsibleId === user.id && openTask(task))} onChange={load} />
        {approvals.length > 0 && <Card icon={ShieldCheck} tone="blue" title={<>Para você aprovar <em className="mc-count blue">{approvals.length}</em></>} subtitle="Entregas da equipe esperando o seu retorno.">
          <ul className="mc-mini-list">{approvals.map((ticket) => <li key={ticket.id}><NavLink to={ticketPageUrl(ticket)}>
            <ClientMark name={ticket.clientName} /><span><b>{ticket.clientName || "Interno"} · {ticket.code}</b><small>{activeStep(ticket)?.name} · enviado {sentAt(ticket) ? `${shortDate(sentAt(ticket))} ${time(sentAt(ticket))}` : "—"}</small></span>
            <em className={isLate(ticket) ? "late" : ""}>{isLate(ticket) ? "Atrasada" : "Revisar"}</em>
          </NavLink></li>)}</ul>
        </Card>}
        <Card className="mc-waiting" icon={Hourglass} tone="red" title="Aguardando aprovações" action={<NavLink className="mc-link-button" to="/chamados/meus/aprovacao">Ver todos ({sent.length})<ArrowRight /></NavLink>}>
          {sent.length ? <div className="mc-table" role="table" aria-label="Aguardando aprovações">
            <div className="mc-tr head waiting" role="row"><span>#</span><span>Cliente / Projeto</span><span>Enviado em</span><span>Aguardando</span></div>
            {sent.slice(0, 6).map((ticket) => { const step = activeStep(ticket)!; return <NavLink className="mc-tr waiting link" role="row" key={ticket.id} to={ticketPageUrl(ticket)}>
              <span className="mc-code">{ticket.code}</span><span className="mc-strong" title={ticket.title}>{ticket.clientName || ticket.title}</span>
              <span className="mc-muted">{sentAt(ticket) ? `${shortDate(sentAt(ticket))} ${time(sentAt(ticket))}` : "—"}</span>
              <span className="mc-person"><PersonAvatar size="sm" name={step.role === "CLIENT" ? ticket.clientName || "Cliente" : step.assigneeName} src={step.role === "CLIENT" ? undefined : data.availableUsers.find((item) => item.id === step.assigneeId)?.avatarDataUrl} />{step.role === "CLIENT" ? "Cliente" : first(step.assigneeName)}</span>
            </NavLink>; })}
          </div> : <Empty text="Nada aguardando aprovação." />}
          {sent.length > 0 && <NavLink className="mc-waiting-foot" to="/chamados/meus/aprovacao"><Hourglass /><span>{sent.length} {sent.length === 1 ? "material aguardando" : "materiais aguardando"} aprovação.<br />Mantenha o fluxo em movimento.</span><ArrowRight /></NavLink>}
        </Card>
        {leader && <TeamLoad tickets={sector.filter(isOpenTicket)} data={data} />}
      </div>
    </div>
  </div>;
}

function ClientCell({ ticket }: { ticket: Ticket }) {
  return <span className="mc-client"><ClientMark name={ticket.clientName} /><span><b title={ticket.clientName || "Interno"}>{ticket.clientName || "Interno"}</b><small title={ticket.title}>{ticket.title}</small></span></span>;
}

/* ---------- Agenda do dia ---------- */

const agendaPalette = ["#2563eb", "#16a34a", "#dc2626", "#7c3aed", "#ca8a04", "#0891b2"];
function Agenda({ user, events }: { user: SessionUser; events: Event[] }) {
  const [day, setDay] = useState(() => new Date());
  const shift = (days: number) => setDay((current) => { const next = new Date(current); next.setDate(next.getDate() + days); return next; });
  const items = events.filter((event) => (event.ownerId === user.id || event.participantIds?.includes(user.id)) && sameDay(event.startAt, day)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const googleUrl = `https://calendar.google.com/calendar/r/day/${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`;
  return <Card icon={CalendarDays} title="Minha Agenda" action={<a className="mc-link-button" href={googleUrl} target="_blank" rel="noreferrer">Abrir no Google Agenda<ExternalLink /></a>}>
    <div className="mc-agenda-nav"><b>{longDate(day)}</b><div>
      <button type="button" className="mc-icon-button bordered" onClick={() => shift(-1)} aria-label="Dia anterior"><ChevronLeft /></button>
      <button type="button" className="mc-icon-button bordered" onClick={() => shift(1)} aria-label="Próximo dia"><ChevronRight /></button>
      <button type="button" className="mc-link-button" disabled={sameDay(day.toISOString())} onClick={() => setDay(new Date())}>Hoje<ArrowRight /></button>
    </div></div>
    {items.length ? <ol className="mc-agenda">{items.map((event, index) => {
      const color = eventColorHex(event.colorId) || agendaPalette[index % agendaPalette.length];
      return <li key={event.id}><time>{time(event.startAt)}</time>
        <NavLink to={`/agenda?date=${encodeURIComponent(event.startAt)}`} style={{ "--event": color } as CSSProperties}><b>{event.title}</b><small>{time(event.startAt)} – {time(event.endAt)}{event.location ? ` · ${event.location}` : ""}</small></NavLink>
      </li>;
    })}</ol> : <Empty text={sameDay(day.toISOString()) ? "Nenhum compromisso na sua agenda hoje." : "Nenhum compromisso neste dia."} />}
  </Card>;
}

/* ---------- Tarefas do dia ---------- */

function TodayTasks({ tasks, onChange }: { tasks: Task[]; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const today = tasks.filter((task) => !task.dueAt || sameDay(task.dueAt) || new Date(task.dueAt) < new Date())
    .sort((a, b) => (a.dueAt || "9").localeCompare(b.dueAt || "9"));
  const complete = async (task: Task) => {
    setBusy(task.id); setError("");
    try { await ticketApi(`/tasks/${task.id}`, { method: "PATCH", json: { status: "DONE" } }); await onChange(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(""); }
  };
  return <Card icon={CheckCircle2} title="Minhas Tarefas do Dia" subtitle="Demandas do Creative Ops, incluindo as que vêm dos seus chamados." action={<NavLink className="mc-link-button" to="/tarefas">Ver no Creative Ops ({tasks.length})<ArrowRight /></NavLink>}>
    {error && <p className="mc-alert" role="alert">{error}</p>}
    {today.length ? <ul className="mc-tasks">{today.slice(0, 7).map((task) => {
      const late = !!task.dueAt && new Date(task.dueAt) < new Date() && !sameDay(task.dueAt);
      return <li key={task.id}>
        {task.ticketId
          // Demanda de chamado (Creative Ops): a entrega é feita no chamado.
          ? <NavLink className="mc-task-ticket" to={ticketPageUrl({ id: task.ticketId })} title={`Entregar pelo chamado ${task.ticketCode || ""}`} aria-label={`Abrir o chamado ${task.ticketCode || ""}`}><ClipboardCheck /></NavLink>
          : <input type="checkbox" checked={busy === task.id} disabled={!!busy} onChange={() => void complete(task)} aria-label={`Concluir ${task.title}`} />}
        <time className={late ? "late" : ""}>{!task.dueAt ? "—" : late ? shortDate(task.dueAt) : time(task.dueAt)}</time>
        <NavLink to={`/tarefas?task=${encodeURIComponent(task.id)}`} title={task.title}>{task.title}</NavLink>
        <PriorityTag value={task.priority} />
      </li>;
    })}</ul> : <Empty text="Nenhuma tarefa para hoje." />}
  </Card>;
}

/* ---------- Carga da equipe (líder) ---------- */

function TeamLoad({ tickets, data }: { tickets: Ticket[]; data: TicketsData }) {
  const people = [...new Map(tickets.map((ticket) => { const step = activeStep(ticket); return [step?.assigneeId || ticket.assigneeId, step?.assigneeName || ticket.assigneeName] as const; })).entries()]
    .filter(([id]) => id)
    .map(([id, name]) => { const list = tickets.filter((ticket) => (activeStep(ticket)?.assigneeId || ticket.assigneeId) === id); return { id, name, total: list.length, late: list.filter((ticket) => isLate(ticket)).length, adjust: list.filter((ticket) => activeStep(ticket)?.adjustment).length }; })
    .sort((a, b) => b.late - a.late || b.total - a.total);
  const max = Math.max(1, ...people.map((person) => person.total));
  return <Card icon={Users} tone="purple" title="Carga da equipe" subtitle="Chamados em andamento com cada pessoa agora.">
    {people.length ? <ul className="mc-team">{people.map((person) => <li key={person.id}>
      <PersonAvatar size="sm" name={person.name} src={data.availableUsers.find((user) => user.id === person.id)?.avatarDataUrl} />
      <span><b>{person.name}</b><i style={{ "--load": `${(person.total / max) * 100}%`, "--person": userColor({ id: person.id }) } as CSSProperties}><em /></i></span>
      <small>{person.total}{person.late ? <em className="late"> · {person.late} atrasado{person.late > 1 ? "s" : ""}</em> : null}{person.adjust ? <em> · {person.adjust} em ajuste</em> : null}</small>
    </li>)}</ul> : <Empty text="Nenhum chamado em andamento no setor." />}
  </Card>;
}

/* ---------- Lista de chamados (painel e páginas "Meus chamados") ---------- */

export function MyTickets({ title, subtitle, tickets, userId, data, action, compact = false, people = false, icon = ClipboardCheck }: { title: string; subtitle: string; tickets: Ticket[]; userId: string; data: TicketsData; action?: ReactNode; compact?: boolean; people?: boolean; icon?: typeof Users }) {
  const [layout, setLayout] = useState<"LIST" | "KANBAN">("LIST"), [client, setClient] = useState(""), [type, setType] = useState(""), [priority, setPriority] = useState(""), [person, setPerson] = useState(""), [query, setQuery] = useState(""), [page, setPage] = useState(1);
  const navigate = useNavigate();
  const ownerOf = (ticket: Ticket) => activeStep(ticket)?.assigneeId || ticket.assigneeId;
  const clients = useMemo(() => [...new Map(tickets.filter((ticket) => ticket.clientId).map((ticket) => [ticket.clientId!, ticket.clientName || ""])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [tickets]);
  const types = useMemo(() => [...new Set(tickets.map((ticket) => ticket.flowName || "Chamado"))].sort(), [tickets]);
  const team = useMemo(() => [...new Map(tickets.map((ticket) => [ownerOf(ticket), activeStep(ticket)?.assigneeName || ticket.assigneeName])).entries()].filter(([id]) => id).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [tickets]);
  const rows = tickets.filter((ticket) => (!client || ticket.clientId === client) && (!type || (ticket.flowName || "Chamado") === type) && (!priority || ticket.priority === priority) && (!person || ownerOf(ticket) === person)
    && (!query || `${ticket.code} ${ticket.title} ${ticket.clientName || ""} ${ticket.requesterName} ${activeStep(ticket)?.name || ""}`.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => Number(isLate(b)) - Number(isLate(a)) || (dueOf(a) || "9").localeCompare(dueOf(b) || "9"));
  const size = compact ? 6 : 15, pages = Math.max(1, Math.ceil(rows.length / size)), current = Math.min(page, pages);
  const reset = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };
  const columns: { key: string; label: string; match: (ticket: Ticket) => boolean }[] = [
    { key: "todo", label: "Aguardando início", match: (ticket) => ["Aguardando início", "Ajuste solicitado"].includes(ticketSituation(ticket, userId).label) },
    { key: "doing", label: "Em andamento", match: (ticket) => ["Em andamento", "Pausado", "Pronto para enviar"].includes(ticketSituation(ticket, userId).label) },
    { key: "approval", label: "Em aprovação", match: (ticket) => ["Aguardando aprovação", "Aprovar entrega", "Aguardando cliente"].includes(ticketSituation(ticket, userId).label) },
    { key: "done", label: "Concluídos", match: (ticket) => !isOpenTicket(ticket) },
  ];
  return <Card icon={icon} title={title} subtitle={subtitle} action={<>
    <div className="mc-toggle" role="group" aria-label="Visualização">
      <button type="button" className={layout === "LIST" ? "active" : ""} aria-pressed={layout === "LIST"} onClick={() => setLayout("LIST")}><List />Lista</button>
      <button type="button" className={layout === "KANBAN" ? "active" : ""} aria-pressed={layout === "KANBAN"} onClick={() => setLayout("KANBAN")}><KanbanSquare />Kanban</button>
    </div>{action}
  </>}>
    <div className="mc-filters">
      <select value={client} onChange={(event) => reset(setClient)(event.target.value)} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select value={type} onChange={(event) => reset(setType)(event.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{types.map((value) => <option key={value}>{value}</option>)}</select>
      <select value={priority} onChange={(event) => reset(setPriority)(event.target.value)} aria-label="Prioridade"><option value="">Todas as prioridades</option><option value="URGENT">Urgente</option><option value="HIGH">Alta</option><option value="MEDIUM">Média</option><option value="LOW">Baixa</option></select>
      {people && <select value={person} onChange={(event) => reset(setPerson)(event.target.value)} aria-label="Responsável"><option value="">Toda a equipe</option>{team.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}
      <label className="mc-search"><Search /><input value={query} onChange={(event) => reset(setQuery)(event.target.value)} placeholder="Buscar chamado…" aria-label={`Buscar em ${title}`} /></label>
    </div>
    {!rows.length ? <Empty text={tickets.length ? "Nenhum chamado com esses filtros." : "Nenhum chamado por aqui."} />
      : layout === "LIST" ? <div className="mc-table" role="table" aria-label={title}>
        <div className={`mc-tr head list ${people ? "people" : ""}`} role="row"><span>#</span><span>Cliente / Projeto</span><span>Tipo</span><span>Etapa atual</span><span>{people ? "Com quem" : "Solicitante"}</span><span>Prazo</span><span>Prioridade</span><span>Status</span><span>Ação</span></div>
        {rows.slice((current - 1) * size, current * size).map((ticket) => {
          const owner = people ? { id: ownerOf(ticket), name: activeStep(ticket)?.assigneeName || ticket.assigneeName } : { id: ticket.requesterId, name: ticket.requesterName };
          return <div className={`mc-tr list ${people ? "people" : ""}`} role="row" key={ticket.id} onDoubleClick={() => navigate(ticketPageUrl(ticket))}>
            <span className="mc-code">{ticket.code}</span><ClientCell ticket={ticket} /><span className="mc-muted">{ticket.flowName || "Chamado"}</span>
            <StepCell ticket={ticket} />
            <span className="mc-person"><PersonAvatar size="sm" name={owner.name} src={data.availableUsers.find((item) => item.id === owner.id)?.avatarDataUrl} />{first(owner.name)}</span>
            <DueCell ticket={ticket} /><span><PriorityTag value={ticket.priority} /></span><span><SituationPill ticket={ticket} userId={userId} /></span>
            <span className="mc-actions"><OpenButton ticket={ticket} /><RowMenu ticket={ticket} /></span>
          </div>;
        })}
      </div>
      : <div className="mc-kanban">{columns.map((column) => { const list = rows.filter(column.match); return <section key={column.key}>
        <header><b>{column.label}</b><span>{list.length}</span></header>
        {list.map((ticket) => <NavLink key={ticket.id} to={ticketPageUrl(ticket)} className="mc-kanban-card">
          <small>{ticket.code} · {ticket.flowName || "Chamado"}</small><b>{ticket.clientName || "Interno"}</b><span>{ticket.title}</span>
          <StepCell ticket={ticket} />
          <footer><PriorityTag value={ticket.priority} /><DueCell ticket={ticket} /></footer>
        </NavLink>)}
        {!list.length && <p className="mc-kanban-empty">Nada aqui.</p>}
      </section>; })}</div>}
    {layout === "LIST" && pages > 1 && <footer className="mc-pages"><span>{rows.length} chamados</span><button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft />Anterior</button><b>{current} de {pages}</b><button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Próxima<ChevronRight /></button></footer>}
  </Card>;
}

/* ---------- Páginas do menu "Meus chamados" ---------- */

export type MyTicketsView = "all" | "progress" | "approval" | "done";
const viewMeta: Record<MyTicketsView, { title: string; subtitle: string }> = {
  all: { title: "Meus Chamados", subtitle: "Todos os chamados em que você tem uma etapa, do briefing à publicação." },
  progress: { title: "Em andamento", subtitle: "Chamados com você agora: comece, pause, finalize e envie cada etapa." },
  approval: { title: "Aguardando aprovação", subtitle: "O que você entregou e espera retorno — e o que espera a sua aprovação." },
  done: { title: "Concluídos", subtitle: "Chamados finalizados em que você participou." },
};

// Contagem do menu lateral: entregas esperando aprovação e aprovações comigo.
export const approvalBadge = (tickets: Ticket[], userId: string) =>
  tickets.filter((ticket) => sentForApproval(ticket, userId) || (toApprove(ticket, userId) && activeStep(ticket)?.role === "APPROVER")).length;

export function MyTicketsPage({ user, view }: { user: SessionUser; view: MyTicketsView }) {
  const { tickets: data, loading } = useMarketingBoard(user.id);
  if (loading && !data) return <div className="mc-board"><p className="mc-loading" role="status"><Clock3 />Carregando chamados…</p></div>;
  if (!data) return <div className="mc-board"><p className="mc-alert" role="alert">Não foi possível carregar os chamados.</p></div>;
  const mine = data.tickets.filter((ticket) => ticket.status !== "CLOSED" && involves(ticket, user.id)), meta = viewMeta[view];
  const lists: { title: string; subtitle: string; tickets: Ticket[] }[] =
    view === "all" ? [{ title: "Abertos", subtitle: "Chamados em andamento em que você participa.", tickets: mine.filter(isOpenTicket) }]
    : view === "progress" ? [{ title: "Com você agora", subtitle: "Etapas que dependem de você para seguir.", tickets: mine.filter((ticket) => withMe(ticket, user.id) && activeStep(ticket)?.role !== "APPROVER") }]
    : view === "approval" ? [
      { title: "Para você aprovar", subtitle: "Entregas da equipe esperando o seu retorno.", tickets: mine.filter((ticket) => toApprove(ticket, user.id) && activeStep(ticket)?.role === "APPROVER") },
      { title: "Enviados para aprovação", subtitle: "Você entregou; agora está com a aprovação interna ou com o cliente.", tickets: data.tickets.filter((ticket) => sentForApproval(ticket, user.id)) },
    ]
    : [{ title: "Concluídos", subtitle: "Chamados finalizados.", tickets: data.tickets.filter((ticket) => ticket.status === "RESOLVED" && involves(ticket, user.id)) }];
  return <div className="mc-board">
    <header className="mc-page-head"><div><h1>{meta.title}</h1><p>{meta.subtitle}</p></div>{data.canCreate && <NavLink className="mc-primary" to="/chamados/novo"><Plus />Abrir chamado</NavLink>}</header>
    {lists.map((list) => (view === "approval" && !list.tickets.length && list.title === "Para você aprovar") ? null
      : <MyTickets key={list.title} title={list.title} subtitle={list.subtitle} tickets={list.tickets} userId={user.id} data={data} />)}
  </div>;
}
