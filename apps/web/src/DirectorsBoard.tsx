import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleCheck, Clock3, ClipboardCheck, FileCheck2, Flag,
  FolderKanban, ListChecks, MessagesSquare, PlayCircle, Plus, UserRound, Users, Hourglass,
} from "lucide-react";
import type { Meeting } from "./meetingsModel";
import { userColor } from "./userColors";
import "./DirectorsBoard.css";

// Painel de quem está na Diretoria: agenda e aprovações do dia, chamados e tarefas de toda a
// equipe, reuniões com clientes (Customer Success) e projetos em implantação.
type SessionUser = { id: string; name: string };
export type Step = { name: string; role: "EXECUTOR" | "APPROVER" | "CLIENT"; status: string; assigneeId: string; assigneeName: string; startedAt?: string };
export type Ticket = { id: string; code: string; title: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED"; departmentId: string; assigneeId: string; assigneeName: string; dueAt: string; createdAt: string; clientName?: string; flowName?: string; steps?: Step[] };
export type Task = { id: string; title: string; clientId: string; responsibleId: string; responsibleName: string; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; status: string; dueAt: string; completedAt?: string; updatedAt?: string; approvalHistory?: { action: string; createdAt: string }[] };
export type Event = { id: string; title: string; ownerId: string; participantIds: string[]; startAt: string; endAt: string; location?: string; meetUrl?: string; category: string };
type Project = { id: string; name: string; clientName: string; responsibleId?: string; responsibleName: string; status: "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"; dueDate?: string; progress?: number; tasks?: { id: string; title: string; status: string }[]; clientId: string };
type Board = { tickets: Ticket[]; departments: { id: string; name: string }[]; tasks: Task[]; meetings: Meeting[]; events: Event[]; projects: Project[]; clients: { id: string; name: string }[]; users: { id: string; name: string; color?: string }[] };

const emptyBoard: Board = { tickets: [], departments: [], tasks: [], meetings: [], events: [], projects: [], clients: [], users: [] };
export const isToday = (value?: string) => !!value && new Date(value).toDateString() === new Date().toDateString();
export const time = (value: string) => new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const day = (value?: string) => value ? new Date(value.length === 10 ? `${value}T12:00` : value).toLocaleDateString("pt-BR") : "Sem prazo";
const initials = (name: string) => name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
export const first = (name: string) => name.split(" ")[0] || name;
export const since = (value?: string) => {
  if (!value) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
};
const priorityLabels = { URGENT: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" } as const;
export const openTicket = (ticket: Ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status);
export const lateTicket = (ticket: Ticket) => openTicket(ticket) && !!ticket.dueAt && new Date(ticket.dueAt) < new Date();
export const openTask = (task: Task) => !["DONE", "CANCELLED", "PUBLISHED"].includes(task.status);
export const lateTask = (task: Task) => openTask(task) && !!task.dueAt && new Date(task.dueAt) < new Date();
const taskStatusLabels: Record<string, string> = { TODO: "Planejada", IN_PROGRESS: "Em andamento", REVIEW: "Em revisão", WAITING_APPROVAL: "Aguardando aprovação", CHANGES_REQUESTED: "Ajustes pedidos", APPROVED: "Aprovada", SCHEDULED: "Agendada", PUBLISHED: "Publicada", DONE: "Concluída", CANCELLED: "Cancelada" };
const projectStatusLabels = { PLANNED: "Planejamento", ACTIVE: "Em andamento", PAUSED: "Pausado", COMPLETED: "Concluído", CANCELLED: "Cancelado" } as const;

async function get<T>(path: string): Promise<T | null> {
  const response = await fetch(`/api${path}`).catch(() => null);
  return response?.ok ? response.json().catch(() => null) : null;
}

export function DirectorsBoard({ user }: { user: SessionUser }) {
  const [board, setBoard] = useState<Board>(emptyBoard), [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [ticketsFilter, setTicketsFilter] = useState<"ATTENTION" | "ALL">("ATTENTION"), [person, setPerson] = useState("ALL");
  useEffect(() => {
    let disposed = false;
    Promise.all([
      get<{ tickets: Ticket[]; departments: Board["departments"] }>("/tickets"),
      get<{ tasks: Task[] }>("/tasks"),
      get<{ meetings: Meeting[] }>("/meetings"),
      get<{ events: Event[] }>("/calendar/events"),
      get<{ projects: Project[] }>("/projects"),
      get<{ clients: Board["clients"] }>("/clients"),
      get<{ users: Board["users"] }>("/users"),
    ]).then(([tickets, tasks, meetings, events, projects, clients, users]) => {
      if (disposed) return;
      setBoard({ tickets: tickets?.tickets || [], departments: tickets?.departments || [], tasks: tasks?.tasks || [], meetings: meetings?.meetings || [], events: events?.events || [], projects: projects?.projects || [], clients: clients?.clients || [], users: users?.users || [] });
      setLoadedAt(new Date());
    });
    return () => { disposed = true; };
  }, [user.id]);

  // Cor oficial de cada pessoa (escolhida pela Diretoria).
  const colorOf = (id?: string) => userColor(board.users.find((item) => item.id === id) || (id ? { id } : null));
  const meetingByEvent = useMemo(() => new Map(board.meetings.filter((item) => item.calendarEventId).map((item) => [item.calendarEventId, item])), [board.meetings]);
  const agenda = board.events.filter((event) => (event.ownerId === user.id || event.participantIds?.includes(user.id)) && isToday(event.startAt)).sort((a, b) => a.startAt.localeCompare(b.startAt));

  // Aprovações: etapas de chamado com Aprovador/Cliente em andamento e demandas do Creative Ops enviadas para aprovação.
  const approvals = [
    ...board.tickets.filter(openTicket).flatMap((ticket) => {
      const step = ticket.steps?.find((item) => item.status === "ACTIVE" && item.role !== "EXECUTOR");
      return step ? [{ id: `t:${ticket.id}`, title: ticket.title, client: ticket.clientName || "Interno", label: step.name, kind: step.role === "CLIENT" ? "client" : "internal", at: step.startedAt || ticket.createdAt, to: `/chamados?ticket=${encodeURIComponent(ticket.id)}` }] : [];
    }),
    ...board.tasks.filter((task) => task.status === "WAITING_APPROVAL" || task.status === "REVIEW").map((task) => ({
      id: `k:${task.id}`, title: task.title, client: board.clients.find((client) => client.id === task.clientId)?.name || "Interno",
      label: task.status === "REVIEW" ? "Revisão do Creative Ops" : "Aprovação do Creative Ops", kind: "creative",
      at: [...(task.approvalHistory || [])].reverse().find((item) => item.action === "SUBMITTED")?.createdAt || task.updatedAt, to: `/tarefas?task=${encodeURIComponent(task.id)}`,
    })),
  ].sort((a, b) => (a.at || "").localeCompare(b.at || ""));

  const openTickets = board.tickets.filter(openTicket);
  const ticketKpis = {
    late: openTickets.filter(lateTicket).length,
    today: openTickets.filter((ticket) => isToday(ticket.dueAt) && !lateTicket(ticket)).length,
    progress: openTickets.filter((ticket) => ticket.status === "IN_PROGRESS" || ticket.status === "OPEN").length,
    waiting: openTickets.filter((ticket) => ticket.status === "WAITING").length,
    critical: openTickets.filter((ticket) => ticket.priority === "URGENT").length,
  };
  const attention = (ticket: Ticket) => lateTicket(ticket) || isToday(ticket.dueAt) || ticket.priority === "URGENT" || ticket.priority === "HIGH";
  const ticketRows = openTickets.filter((ticket) => ticketsFilter === "ALL" || attention(ticket))
    .sort((a, b) => Number(lateTicket(b)) - Number(lateTicket(a)) || ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(b.priority) || (a.dueAt || "9").localeCompare(b.dueAt || "9"))
    .slice(0, 8);

  const people = [...new Map(board.tasks.filter(openTask).map((task) => [task.responsibleId, task.responsibleName])).entries()].filter(([id]) => id).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const teamTasks = board.tasks.filter((task) => person === "ALL" || task.responsibleId === person);
  const taskKpis = {
    late: teamTasks.filter(lateTask).length,
    today: teamTasks.filter((task) => openTask(task) && isToday(task.dueAt) && !lateTask(task)).length,
    progress: teamTasks.filter((task) => task.status === "IN_PROGRESS").length,
    doneToday: teamTasks.filter((task) => task.status === "DONE" && isToday(task.completedAt || task.updatedAt)).length,
  };
  const taskRows = teamTasks.filter(openTask)
    .sort((a, b) => Number(lateTask(b)) - Number(lateTask(a)) || ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(a.priority) - ["URGENT", "HIGH", "MEDIUM", "LOW"].indexOf(b.priority) || (a.dueAt || "9").localeCompare(b.dueAt || "9"))
    .slice(0, 8);

  const todayMeetings = board.meetings.filter((meeting) => isToday(meeting.startAt) && meeting.status !== "CANCELLED").sort((a, b) => a.startAt.localeCompare(b.startAt));
  const scheduled = todayMeetings.filter((meeting) => meeting.status === "SCHEDULED"), live = todayMeetings.filter((meeting) => ["IN_PROGRESS", "PAUSED"].includes(meeting.status)), done = todayMeetings.filter((meeting) => meeting.status === "COMPLETED");
  const projects = board.projects.filter((project) => ["PLANNED", "ACTIVE", "PAUSED"].includes(project.status)).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9")).slice(0, 6);

  const formatOf = (event: Event) => {
    const meeting = meetingByEvent.get(event.id);
    if (meeting) return meeting.format === "PRESENTIAL" ? "Presencial" : meeting.format === "PHONE" ? "Ligação" : meeting.format === "WHATSAPP" ? "WhatsApp" : "Online";
    if (event.meetUrl || /meet\.google|zoom|teams|https?:/i.test(event.location || "")) return "Online";
    return event.location ? "Presencial" : event.category === "MEETING" ? "Reunião" : "Compromisso";
  };
  const hour = new Date().getHours();
  return <div className="dir-board">
    <header className="dir-head">
      <div><h1>{hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"}, {first(user.name)}! <span aria-hidden="true">👋</span></h1><p>Aqui está o que precisa da sua atenção hoje.</p></div>
      <aside><CalendarDays /><div><b>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</b><small>{loadedAt ? `Dados atualizados agora às ${time(loadedAt.toISOString())}` : "Carregando dados…"}</small></div></aside>
    </header>

    <div className="dir-row two">
      <Card icon={CalendarDays} title="Agenda de hoje" link="Ver agenda completa" to="/agenda">
        {agenda.length ? <ul className="dir-agenda">{agenda.slice(0, 6).map((event) => {
          const meeting = meetingByEvent.get(event.id), format = formatOf(event);
          return <li key={event.id}><NavLink to={meeting ? `/reunioes/${meeting.id}` : `/agenda?date=${encodeURIComponent(event.startAt)}`}>
            <time>{time(event.startAt)} – {time(event.endAt)}</time><i className={format === "Presencial" ? "green" : format === "Online" ? "blue" : "purple"} />
            <span><b>{meeting?.clientName || event.title}</b><small>{meeting?.subject || (meeting ? "Reunião" : format === "Online" ? "Reunião online" : event.location || "Compromisso")}</small></span>
            <em className={format === "Presencial" ? "green" : "blue"}>{format}</em>
          </NavLink></li>;
        })}</ul> : <Empty text="Nenhum compromisso na sua agenda hoje." />}
      </Card>
      <Card icon={CircleCheck} title="Aprovações pendentes" link="Ver todas" to="/chamados">
        {approvals.length ? <ul className="dir-approvals">{approvals.slice(0, 5).map((item) => <li key={item.id}><NavLink to={item.to}>
          <span className={`dir-approval-icon ${item.kind}`}><FileCheck2 /></span>
          <span><b>{item.title}</b><small>{item.client}</small></span>
          <em className={`dir-chip ${item.kind}`}>{item.label}</em>
          <time className={(Date.now() - new Date(item.at || 0).getTime()) > 86400000 ? "" : "fresh"}>{since(item.at)}</time><ChevronRight />
        </NavLink></li>)}</ul> : <Empty text="Nenhuma aprovação esperando por alguém." />}
      </Card>
    </div>

    <section className="dir-card">
      <header className="dir-card-head">
        <span className="dir-card-icon"><MessagesSquare /></span><div><h2>Central de Chamados</h2><p>Todas as demandas da empresa em um só lugar.</p></div>
        <div className="dir-head-actions">
          <div className="dir-toggle" role="tablist"><button type="button" role="tab" aria-selected={ticketsFilter === "ATTENTION"} className={ticketsFilter === "ATTENTION" ? "active" : ""} onClick={() => setTicketsFilter("ATTENTION")}>Apenas os que exigem atenção</button><button type="button" role="tab" aria-selected={ticketsFilter === "ALL"} className={ticketsFilter === "ALL" ? "active" : ""} onClick={() => setTicketsFilter("ALL")}>Todos os chamados</button></div>
          <NavLink className="dir-primary" to="/chamados/novo"><Plus />Novo chamado</NavLink>
        </div>
      </header>
      <div className="dir-kpis five">
        <Kpi tone="red" icon={AlertCircle} value={ticketKpis.late} label="Atrasados" />
        <Kpi tone="orange" icon={CalendarDays} value={ticketKpis.today} label="Vencem hoje" />
        <Kpi tone="blue" icon={Clock3} value={ticketKpis.progress} label="Em andamento" />
        <Kpi tone="yellow" icon={Users} value={ticketKpis.waiting} label="Aguardando cliente" />
        <Kpi tone="rose" icon={Flag} value={ticketKpis.critical} label="Críticos" />
      </div>
      {ticketRows.length ? <div className="dir-table tickets" role="table" aria-label="Chamados">
        <div className="dir-tr head" role="row"><span>Prioridade</span><span>Cliente</span><span>Chamado</span><span>Área</span><span>Responsável</span><span>Prazo</span><span>Status</span><span>Tempo</span></div>
        {ticketRows.map((ticket) => {
          const status = lateTicket(ticket) ? ["red", "Atrasado"] : isToday(ticket.dueAt) ? ["orange", "Vence hoje"] : ticket.status === "WAITING" ? ["yellow", "Aguardando cliente"] : ticket.status === "OPEN" ? ["gray", "Aberto"] : ["blue", "Em andamento"];
          return <NavLink to={`/chamados?ticket=${encodeURIComponent(ticket.id)}`} className="dir-tr" role="row" key={ticket.id}>
            <span><Priority value={ticket.priority} /></span><span>{ticket.clientName || "Interno"}</span><span className="dir-strong" title={ticket.title}>{ticket.title}</span>
            <span>{board.departments.find((item) => item.id === ticket.departmentId)?.name || "—"}</span><span><Person name={ticket.assigneeName} color={colorOf(ticket.assigneeId)} /></span>
            <span className={lateTicket(ticket) ? "dir-late" : ""}>{day(ticket.dueAt)}</span><span><em className={`dir-status ${status[0]}`}>{status[1]}</em></span><span>{since(ticket.createdAt)}</span>
          </NavLink>;
        })}
      </div> : <Empty text={ticketsFilter === "ATTENTION" ? "Nenhum chamado exigindo atenção agora." : "Nenhum chamado em aberto."} />}
      <NavLink className="dir-more" to="/chamados">Abrir a central de chamados <ArrowRight /></NavLink>
    </section>

    <section className="dir-card">
      <header className="dir-card-head">
        <span className="dir-card-icon"><ListChecks /></span><div><h2>Tarefas da Equipe</h2><p>Acompanhamento das tarefas de toda a equipe.</p></div>
        <div className="dir-kpis inline">
          <Kpi tone="red" icon={AlertCircle} value={taskKpis.late} label="Atrasadas" />
          <Kpi tone="orange" icon={CalendarDays} value={taskKpis.today} label="Hoje" />
          <Kpi tone="blue" icon={Clock3} value={taskKpis.progress} label="Em andamento" />
          <Kpi tone="green" icon={CheckCircle2} value={taskKpis.doneToday} label="Concluídas hoje" />
        </div>
      </header>
      <div className="dir-people" role="tablist" aria-label="Filtrar por pessoa">
        <button type="button" className={person === "ALL" ? "active" : ""} onClick={() => setPerson("ALL")}>Todas</button>
        {people.map(([id, name]) => <button type="button" key={id} className={person === id ? "active" : ""} style={{ "--person-color": colorOf(id) } as React.CSSProperties} onClick={() => setPerson(id)}><i />{first(name)}</button>)}
      </div>
      {taskRows.length ? <div className="dir-table tasks" role="table" aria-label="Tarefas da equipe">
        <div className="dir-tr head" role="row"><span>Prioridade</span><span>Tarefa</span><span>Cliente / Projeto</span><span>Responsável</span><span>Prazo</span><span>Status</span></div>
        {taskRows.map((task) => {
          const status = lateTask(task) ? ["red", "Atrasada"] : isToday(task.dueAt) ? ["orange", "Vence hoje"] : task.status === "IN_PROGRESS" ? ["blue", "Em andamento"] : ["gray", taskStatusLabels[task.status] || task.status];
          return <NavLink to={`/tarefas?task=${encodeURIComponent(task.id)}`} className="dir-tr" role="row" key={task.id}>
            <span><Priority value={task.priority} /></span><span className="dir-strong" title={task.title}>{task.title}</span>
            <span>{board.clients.find((client) => client.id === task.clientId)?.name || "Interno"}</span><span><Person name={task.responsibleName} color={colorOf(task.responsibleId)} /></span>
            <span className={lateTask(task) ? "dir-late" : ""}>{day(task.dueAt)}</span><span><em className={`dir-status ${status[0]}`}>{status[1]}</em></span>
          </NavLink>;
        })}
      </div> : <Empty text="Nenhuma tarefa em aberto para este filtro." />}
      <NavLink className="dir-more" to="/tarefas">Ver todas as tarefas <ArrowRight /></NavLink>
    </section>

    <section className="dir-card">
      <header className="dir-card-head"><span className="dir-card-icon"><Users /></span><div><h2>Customer Success (Hoje)</h2><p>Reuniões com clientes e acompanhamento do dia.</p></div></header>
      <div className="dir-row three">
        <MeetingColumn icon={CalendarDays} tone="green" title="Reuniões agendadas" items={scheduled} to="/reunioes/agendadas" badge={(meeting) => meeting.format === "PRESENTIAL" ? ["orange", "Presencial"] : ["blue", "Online"]} />
        <MeetingColumn icon={PlayCircle} tone="blue" title="Em andamento" items={live} to="/reunioes/em-andamento" badge={(meeting) => meeting.status === "PAUSED" ? ["yellow", "Pausada"] : ["green", "Em andamento"]} />
        <MeetingColumn icon={CheckCircle2} tone="green" title="Reuniões finalizadas" items={done} to="/reunioes/concluidas" badge={() => ["green", "Concluída"]} />
      </div>
    </section>

    <section className="dir-card">
      <header className="dir-card-head"><span className="dir-card-icon"><FolderKanban /></span><div><h2>Projetos Novos</h2><p>Acompanhamento dos projetos em implantação.</p></div><div className="dir-head-actions"><NavLink className="dir-link" to="/clientes">Ver todos os projetos <ArrowRight /></NavLink></div></header>
      {projects.length ? <div className="dir-table projects" role="table" aria-label="Projetos em implantação">
        <div className="dir-tr head" role="row"><span>Cliente</span><span>Projeto</span><span>Etapas</span><span>Próxima etapa</span><span>Responsável</span><span>Prazo</span><span>Status</span><span>O que falta</span></div>
        {projects.map((project) => {
          const steps = project.tasks || [], next = steps.find((item) => item.status !== "DONE"), missing = steps.filter((item) => item.status !== "DONE");
          return <NavLink to={`/clientes?client=${encodeURIComponent(project.clientId)}`} className="dir-tr" role="row" key={project.id}>
            <span className="dir-strong">{project.clientName}</span><span>{project.name}</span>
            <span>{steps.length ? <ol className="dir-steps">{steps.slice(0, 6).map((item, index) => <li key={item.id} className={item.status === "DONE" ? "done" : item === next ? "current" : ""} title={item.title}><i /><small>{item.title}</small>{index < Math.min(steps.length, 6) - 1 && <b />}</li>)}</ol> : <div className="dir-progress"><i style={{ width: `${project.progress || 0}%` }} /><small>{project.progress || 0}%</small></div>}</span>
            <span>{next?.title || (steps.length ? "Todas concluídas" : "—")}</span><span>{project.responsibleName ? <Person name={project.responsibleName} color={colorOf(project.responsibleId)} /> : "—"}</span>
            <span className={project.dueDate && project.dueDate < new Date().toISOString().slice(0, 10) ? "dir-late" : ""}>{day(project.dueDate)}</span>
            <span><em className={`dir-status ${project.status === "ACTIVE" ? "blue" : project.status === "PAUSED" ? "yellow" : "orange"}`}>{projectStatusLabels[project.status]}</em></span>
            <span className="dir-muted" title={missing.map((item) => item.title).join(", ")}>{missing.length ? missing.slice(0, 2).map((item) => item.title).join(" e ") + (missing.length > 2 ? ` +${missing.length - 2}` : "") : steps.length ? "Nada pendente" : "Cadastre as entregas no projeto"}</span>
          </NavLink>;
        })}
      </div> : <Empty text="Nenhum projeto em implantação. Cadastre projetos na ficha do cliente." />}
    </section>
  </div>;
}

export function Card({ icon: Icon, title, link, to, children }: { icon: typeof CalendarDays; title: string; link: string; to: string; children: ReactNode }) {
  return <section className="dir-card"><header className="dir-card-head compact"><span className="dir-card-icon"><Icon /></span><div><h2>{title}</h2></div><div className="dir-head-actions"><NavLink className="dir-link" to={to}>{link} <ArrowRight /></NavLink></div></header>{children}</section>;
}
export function Kpi({ tone, icon: Icon, value, label }: { tone: string; icon: typeof CalendarDays; value: number; label: string }) {
  return <article className={`dir-kpi ${tone}`}><Icon /><div><b>{value}</b><small>{label}</small></div></article>;
}
export function Priority({ value }: { value: keyof typeof priorityLabels }) {
  return <em className={`dir-priority ${value.toLowerCase()}`}>{value === "URGENT" ? <Flag /> : <Hourglass />}{priorityLabels[value] || value}</em>;
}
export function Person({ name, color }: { name: string; color?: string }) {
  return <span className="dir-person"><i style={color ? { background: color } : undefined}>{initials(name)}</i>{first(name) || "—"}</span>;
}
export function Empty({ text }: { text: string }) {
  return <p className="dir-empty"><ClipboardCheck />{text}</p>;
}
function MeetingColumn({ icon: Icon, tone, title, items, to, badge }: { icon: typeof CalendarDays; tone: string; title: string; items: Meeting[]; to: string; badge: (meeting: Meeting) => string[] }) {
  return <article className="dir-meetings">
    <header><Icon className={tone} /><b>{title}</b><span className="dir-count">{items.length}</span><NavLink className="dir-link" to={to}>Ver todas <ArrowRight /></NavLink></header>
    {items.length ? <ul>{items.slice(0, 4).map((meeting) => {
      const [badgeTone, label] = badge(meeting), end = new Date(new Date(meeting.startAt).getTime() + meeting.durationMinutes * 60000).toISOString();
      return <li key={meeting.id}><NavLink to={`/reunioes/${meeting.id}`}><time>{time(meeting.startAt)} – {time(end)}</time><span><b>{meeting.clientName}</b><small>{meeting.subject || "Reunião"} · {first(meeting.responsibleName)}</small></span><em className={`dir-status ${badgeTone}`}>{label}</em></NavLink></li>;
    })}</ul> : <p className="dir-empty small"><UserRound />Nenhuma reunião.</p>}
  </article>;
}
