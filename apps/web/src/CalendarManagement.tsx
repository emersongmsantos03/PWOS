import { systemConfirm } from "./SystemDialog";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  Handshake,
  MapPin,
  MessagesSquare,
  Plus,
  Users,
  X,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SearchableSelect } from "./SearchableSelect";
import { DateTimePicker } from "./DateTimePicker";
import { eventColorHex, googleEventColors } from "./calendarColors";
import { defaultUserColor, teamPalette } from "./userColors";

type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  participantIds: string[];
  participantResponses?: Record<string, "PENDING" | "ACCEPTED" | "DECLINED">;
  startAt: string;
  endAt: string;
  location: string;
  category: string;
  clientId?: string;
  opportunityId?: string;
  recurrence?: string;
  reminderMinutes?: number;
  source?: "GOOGLE";
  googleHtmlLink?: string;
  googleSyncError?: string;
  colorId?: string;
  meetUrl?: string;
};
type Task = {
  id: string;
  title: string;
  responsibleId: string;
  responsibleName: string;
  dueAt: string;
  priority: string;
  status: string;
  description?: string;
  estimateMinutes?: number;
  clientId?: string;
  opportunityId?: string;
};
type User = { id: string; name: string; profile?: string; color?: string };
type Client = { id: string; name: string };
type Opportunity = {
  id: string;
  name: string;
  company: string;
  status: string;
  serviceInterest: string;
  responsibleId?: string;
  responsibleName?: string;
  nextAction?: string;
  nextActionAt?: string;
};
type View = "DAY" | "WEEK" | "MONTH";
type CreateType = "EVENT" | "TASK";
type AgendaTicket = { id: string; code: string; title: string; assigneeId: string; assigneeName: string; priority: string; status: string; dueAt: string };
type CalendarItem = {
  kind: "event" | "task" | "ticket" | "crm";
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  start: Date;
  end: Date;
  location?: string;
  category: string;
  editable: boolean;
  color: string;
  // Evento com mais de uma pessoa das agendas abertas: uma cor para cada uma.
  colors?: string[];
};

// Dono e convidados que não recusaram: o evento aparece na agenda de cada um.
const eventPeople = (event: CalendarEvent) => [...new Set([event.ownerId, ...(event.participantIds || []).filter((id) => event.participantResponses?.[id] !== "DECLINED")])];
const pad = (value: number) => String(value).padStart(2, "0");
const localInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
  );
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const weekStart = (date: Date) =>
  addDays(startOfDay(date), -((date.getDay() + 6) % 7));
const calendarColors = teamPalette;
const ownerColor = defaultUserColor;
const initialCalendarDate = () => {
  const value = new URLSearchParams(window.location.search).get("date"),
    date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export function CalendarManagement() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<AgendaTicket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [canViewTeam, setCanViewTeam] = useState(false);
  const [canEditAllEvents, setCanEditAllEvents] = useState(false);
  // Cor escolhida por quem está vendo para cada agenda; sem escolha, vale a cor padrão.
  const [agendaColors, setAgendaColors] = useState<Record<string, string>>({});
  const [colorPicker, setColorPicker] = useState<{ ownerId: string; top: number; left: number } | null>(null);
  // Ordem: cor que esta pessoa escolheu só para si → cor oficial da equipe (Diretoria) → padrão.
  const [canManageColors, setCanManageColors] = useState(false);
  const colorFor = (ownerId: string) => agendaColors[ownerId] || users.find((user) => user.id === ownerId)?.color || ownerColor(ownerId);
  const chooseTeamColor = async (ownerId: string, color: string) => {
    setColorPicker(null);
    const response = await fetch(`/api/users/${ownerId}/color`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) }).catch(() => null);
    if (!response?.ok) return setError("Não foi possível salvar a cor da equipe.");
    setUsers((current) => current.map((user) => user.id === ownerId ? { ...user, color: color || undefined } : user));
    // A cor da equipe passa a valer também na visão de quem escolheu.
    if (agendaColors[ownerId]) void chooseAgendaColor(ownerId, "");
  };
  const chooseAgendaColor = async (ownerId: string, color: string) => {
    setColorPicker(null);
    setAgendaColors((current) => { const next = { ...current }; if (color) next[ownerId] = color; else delete next[ownerId]; return next; });
    const response = await fetch("/api/calendar/colors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId, color }) }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (payload?.calendarColors) setAgendaColors(payload.calendarColors);
    else setError("Não foi possível salvar a cor da agenda.");
  };
  const [google, setGoogle] = useState<{ connected: boolean; error: string }>({ connected: false, error: "" });
  const [canEditAllTasks, setCanEditAllTasks] = useState(false);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [anchor, setAnchor] = useState(initialCalendarDate);
  const [view, setView] = useState<View>("WEEK");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | Task | null>(null);
  const [createType, setCreateType] = useState<CreateType>("EVENT");
  const [draftStart, setDraftStart] = useState(() => new Date());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [
      eventResponse,
      taskResponse,
      userResponse,
      sessionResponse,
      clientResponse,
      opportunityResponse,
    ] = await Promise.all([
      fetch("/api/calendar/events"),
      fetch("/api/tasks"),
      fetch("/api/users"),
      fetch("/api/auth/session"),
      fetch("/api/clients"),
      fetch("/api/crm/opportunities"),
    ]);
    // Prazos de chamados entram na agenda do responsável (somente leitura).
    void fetch("/api/tickets").then(async (response) => response.ok && setTickets((await response.json()).tickets || [])).catch(() => undefined);
    const [
      eventData,
      taskData,
      userData,
      sessionData,
      clientData,
      opportunityData,
    ] = await Promise.all([
      eventResponse.json(),
      taskResponse.json(),
      userResponse.json(),
      sessionResponse.json(),
      clientResponse.json(),
      opportunityResponse.json(),
    ]);
    if (eventResponse.ok) {
      setEvents(eventData.events || []);
      setCanViewTeam(!!eventData.canViewTeam);
      setCanEditAllEvents(!!eventData.canEditAll);
      setGoogle(eventData.google || { connected: false, error: "" });
      setAgendaColors(eventData.calendarColors || {});
    }
    if (taskResponse.ok) {
      setTasks(taskData.tasks || []);
      setCanEditAllTasks(!!taskData.canEditAll);
    }
    // Clientes externos não têm agenda na equipe.
    const teamUsers: User[] = userResponse.ok ? (userData.users || []).filter((user: User) => user.profile !== "CLIENT") : [];
    if (userResponse.ok) setUsers(teamUsers);
    if (clientResponse.ok) setClients(clientData.clients || []);
    if (opportunityResponse.ok)
      setOpportunities(opportunityData.opportunities || []);
    if (sessionResponse.ok) {
      setCurrentUserId(sessionData.user.id);
      setCanManageColors(sessionData.user.profile === "MASTER" || !!sessionData.user.permissions?.includes("users.manage_colors"));
      // Quem vê a agenda da equipe (Diretoria, gestão) abre com todas as agendas sobrepostas.
      const allOwners = eventResponse.ok && eventData.canViewTeam && teamUsers.length ? teamUsers.map((user) => user.id) : [sessionData.user.id];
      setOwnerIds((value) => (value.length ? value : allOwners));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const items = useMemo<CalendarItem[]>(() => {
    const eventItems = events
      .map((event) => ({ event, people: eventPeople(event).filter((id) => ownerIds.includes(id)) }))
      .filter(({ people }) => people.length)
      .map(({ event, people }) => ({
        kind: "event" as const,
        id: event.id,
        title: event.title,
        ownerId: event.ownerId,
        ownerName: event.ownerName,
        start: new Date(event.startAt),
        end: new Date(event.endAt),
        location: event.location,
        category: event.category,
        // Cor própria do evento (como no Google Agenda) ou a cor da agenda de quem está nele.
        color: eventColorHex(event.colorId) || colorFor(people[0]),
        colors: people.length > 1 ? people.map(colorFor) : undefined,
        // Eventos do Google Agenda são editados pelo próprio dono; a alteração volta para o Google.
        editable: event.source === "GOOGLE" ? event.ownerId === currentUserId && google.connected : event.ownerId === currentUserId || canEditAllEvents,
      }));
    const taskItems = tasks
      .filter(
        (task) =>
          ownerIds.includes(task.responsibleId) &&
          task.dueAt &&
          !["DONE", "CANCELLED"].includes(task.status),
      )
      .map((task) => {
        const start = new Date(task.dueAt);
        return {
          kind: "task" as const,
          id: task.id,
          title: task.title,
          ownerId: task.responsibleId,
          ownerName: task.responsibleName,
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          category: `TASK_${task.priority}`,
          color: colorFor(task.responsibleId),
          editable: task.responsibleId === currentUserId || canEditAllTasks,
        };
      });
    const ticketItems = tickets
      .filter((ticket) => ownerIds.includes(ticket.assigneeId) && ticket.dueAt && !["RESOLVED", "CLOSED"].includes(ticket.status))
      .map((ticket) => {
        const start = new Date(ticket.dueAt);
        return {
          kind: "ticket" as const,
          id: ticket.id,
          title: `${ticket.code} · ${ticket.title}`,
          ownerId: ticket.assigneeId,
          ownerName: ticket.assigneeName,
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          category: `TICKET_${ticket.priority}`,
          color: colorFor(ticket.assigneeId),
          editable: false,
        };
      });
    // Próxima ação de leads do CRM na agenda do responsável (somente leitura).
    const crmItems = opportunities
      .filter((item) => item.status === "OPEN" && item.nextActionAt && item.responsibleId && ownerIds.includes(item.responsibleId))
      .map((item) => {
        const start = new Date(item.nextActionAt!);
        return {
          kind: "crm" as const,
          id: item.id,
          title: `${item.nextAction || "Próxima ação"} · ${item.company || item.name}`,
          ownerId: item.responsibleId!,
          ownerName: item.responsibleName || "",
          start,
          end: new Date(start.getTime() + 30 * 60_000),
          category: "CRM",
          color: colorFor(item.responsibleId!),
          editable: false,
        };
      });
    return [...eventItems, ...taskItems, ...ticketItems, ...crmItems].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
  }, [
    events,
    tasks,
    tickets,
    opportunities,
    ownerIds,
    currentUserId,
    canEditAllEvents,
    canEditAllTasks,
    google.connected,
    agendaColors,
    users,
  ]);

  const days = useMemo(() => {
    if (view === "DAY") return [startOfDay(anchor)];
    if (view === "WEEK") {
      const start = weekStart(anchor);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1),
      start = weekStart(first);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [anchor, view]);
  const movePeriod = (direction: number) =>
    setAnchor((date) =>
      view === "DAY"
        ? addDays(date, direction)
        : view === "WEEK"
          ? addDays(date, direction * 7)
          : new Date(date.getFullYear(), date.getMonth() + direction, 1),
    );
  const openCreate = (date = new Date()) => {
    setEditing(null);
    setDraftStart(date);
    setError("");
    setCreating(true);
  };
  const openEdit = (item: CalendarItem) => {
    if (item.kind === "ticket") {
      navigate(`/chamados?ticket=${encodeURIComponent(item.id)}`);
      return;
    }
    if (item.kind === "crm") {
      navigate(`/crm?opportunity=${encodeURIComponent(item.id)}`);
      return;
    }
    if (!item.editable) {
      // Eventos criados direto no Google Agenda são abertos lá.
      const googleEvent = item.kind === "event" ? events.find((event) => event.id === item.id && event.source === "GOOGLE") : undefined;
      // Evento do Google de um colega: o link do Google só abre para quem foi convidado,
      // então os dados são mostrados aqui mesmo.
      if (googleEvent && googleEvent.ownerId !== currentUserId) {
        const when = `${new Date(googleEvent.startAt).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} às ${new Date(googleEvent.endAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        void systemConfirm({
          title: googleEvent.title,
          message: [`Google Agenda de ${googleEvent.ownerName}`, when, googleEvent.location, googleEvent.description].filter(Boolean).join("\n"),
          confirmLabel: "Abrir no Google",
          cancelLabel: "Fechar",
        }).then((open) => { if (open && googleEvent.googleHtmlLink) window.open(googleEvent.googleHtmlLink, "_blank", "noopener"); });
        return;
      }
      if (googleEvent?.googleHtmlLink) {
        window.open(googleEvent.googleHtmlLink, "_blank", "noopener");
        return;
      }
      setError("Este item é somente para visualização.");
      return;
    }
    const record =
      item.kind === "event"
        ? events.find((event) => event.id === item.id)
        : tasks.find((task) => task.id === item.id);
    if (!record) return;
    setCreateType(item.kind === "event" ? "EVENT" : "TASK");
    setDraftStart(item.start);
    setEditing(record);
    setError("");
    setCreating(true);
  };

  const drop = async (event: DragEvent, day: Date, hour?: number) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/pw-calendar");
    if (!payload) return;
    const dragged = JSON.parse(payload) as {
      kind: "event" | "task";
      id: string;
    };
    const source = items.find(
      (item) => item.kind === dragged.kind && item.id === dragged.id,
    );
    if (!source) return;
    if (!source.editable) {
      setError(
        "Esta agenda é somente para visualização. Você só pode mover seus próprios itens.",
      );
      return;
    }
    const nextStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour ?? source.start.getHours(),
      source.start.getMinutes(),
    );
    setSaving(true);
    if (dragged.kind === "event") {
      const duration = source.end.getTime() - source.start.getTime();
      await fetch(`/api/calendar/events/${dragged.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: nextStart.toISOString(),
          endAt: new Date(nextStart.getTime() + duration).toISOString(),
        }),
      });
    } else {
      await fetch(`/api/tasks/${dragged.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueAt: nextStart.toISOString() }),
      });
    }
    await load();
    setSaving(false);
  };
  const drag = (event: DragEvent, item: CalendarItem) =>
    event.dataTransfer.setData(
      "application/pw-calendar",
      JSON.stringify({ kind: item.kind, id: item.id }),
    );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const raw=Object.fromEntries(form),roomId=String(raw.roomId||""),rooms:{id:string;name:string;location:string}[]=JSON.parse(localStorage.getItem("pw-os-meeting-rooms")||"[]"),room=rooms.find(item=>item.id===roomId);
    const input = {
      ...raw,
      location:room?[room.name,room.location].filter(Boolean).join(" · "):raw.location,
      participantIds: form.getAll("participantIds").map(String),
    };
    const basePath = createType === "EVENT" ? "/api/calendar/events" : "/api/tasks";
    const response = await fetch(
      editing ? `${basePath}/${editing.id}` : basePath,
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      setError(data.message || "Não foi possível salvar.");
      setSaving(false);
      return;
    }
    setCreating(false);
    setEditing(null);
    await load();
    setSaving(false);
  };
  const remove = async () => {
    if (!editing) return;
    const isEvent = createType === "EVENT", label = isEvent ? "evento" : "tarefa";
    if (!await systemConfirm({
      title: `Excluir ${isEvent ? "este evento" : "esta tarefa"}?`,
      message: isEvent
        ? `“${editing.title}” sai da agenda${(editing as CalendarEvent).googleHtmlLink ? " e do Google Agenda (os convidados são avisados)" : ""}. Se for o compromisso de uma reunião agendada, a reunião é cancelada.`
        : `“${editing.title}” será arquivada e sai da agenda.`,
      confirmLabel: `Excluir ${label}`,
      tone: "danger",
    })) return;
    setSaving(true);
    setError("");
    const response = await fetch(`${isEvent ? "/api/calendar/events" : "/api/tasks"}/${editing.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setError(data.message || `Não foi possível excluir ${isEvent ? "o evento" : "a tarefa"}.`);
    setCreating(false);
    setEditing(null);
    await load();
  };

  const title =
    view === "DAY"
      ? anchor.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : view === "WEEK"
        ? `${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          });
  const visibleOwners = users.filter((user) => ownerIds.includes(user.id));
  const pendingInvites=events.filter(event=>event.participantIds?.includes(currentUserId)&&(event.participantResponses?.[currentUserId]||"PENDING")==="PENDING");
  const respond=async(id:string,status:"ACCEPTED"|"DECLINED")=>{await fetch(`/api/calendar/events/${id}/response`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});await load()};
  const toggleOwner = (id: string) =>
    setOwnerIds((current) =>
      current.includes(id)
        ? current.length === 1
          ? current
          : current.filter((value) => value !== id)
        : [...current, id],
    );

  return (
    <div className="page operations-page calendar-workspace">
      <div className="page-head">
        <div>
          <span className="eyebrow">PLANEJAMENTO</span>
          <h1>Agenda</h1>
          <p>Eventos e tarefas de cada colaborador em uma única visão.</p>
        </div>
        <button className="primary" onClick={() => openCreate(new Date())}>
          <Plus /> Criar
        </button>
      </div>
      <section className="panel google-calendar">
        <header className="calendar-toolbar">
          <div className="calendar-navigation">
            <button
              className="secondary today"
              onClick={() => setAnchor(new Date())}
            >
              Hoje
            </button>
            <button
              onClick={() => movePeriod(-1)}
              aria-label="Período anterior"
            >
              <ChevronLeft />
            </button>
            <button onClick={() => movePeriod(1)} aria-label="Próximo período">
              <ChevronRight />
            </button>
            <h2>{title}</h2>
          </div>
          <div className="calendar-controls">
            {canViewTeam && (
              <span className="calendar-merged-badge">
                <Users />
                {ownerIds.length} agenda{ownerIds.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="calendar-view-switch">
              {(["DAY", "WEEK", "MONTH"] as View[]).map((value) => (
                <button
                  className={view === value ? "active" : ""}
                  onClick={() => setView(value)}
                  key={value}
                >
                  {value === "DAY"
                    ? "Dia"
                    : value === "WEEK"
                      ? "Semana"
                      : "Mês"}
                </button>
              ))}
            </div>
          </div>
        </header>
        {pendingInvites.map(event=><div className="calendar-invitation" key={event.id}><CalendarDays/><span><b>Convite: {event.title}</b><small>{new Date(event.startAt).toLocaleString("pt-BR")} · {event.ownerName}</small></span><button onClick={()=>void respond(event.id,"DECLINED")}>Recusar</button><button className="accept" onClick={()=>void respond(event.id,"ACCEPTED")}>Aceitar</button></div>)}
        {google.error && <div className="calendar-permission-notice calendar-google-error"><Eye />Não foi possível ler seu Google Agenda: {google.error}</div>}
        {!google.connected && <div className="calendar-permission-notice calendar-google-hint"><CalendarDays />Conecte sua conta Google em Configurações → Conta Google e e-mail para ver e enviar seus compromissos ao Google Agenda.</div>}
        {error && !creating && (
          <div className="calendar-permission-notice">
            <Eye />
            {error}
            <button onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        <div className="calendar-merge-layout">
          {canViewTeam && (
            <aside className="calendar-agenda-selector">
              <header>
                <div>
                  <Users />
                  <span>
                    <b>Agendas</b>
                    <small>Sobreponha calendários</small>
                  </span>
                </div>
                <button
                  onClick={() => setOwnerIds(users.map((user) => user.id))}
                >
                  Todas
                </button>
              </header>
              <div>
                {users.map((user) => {
                  const selected = ownerIds.includes(user.id),
                    color = colorFor(user.id);
                  return (
                    <button
                      className={selected ? "selected" : ""}
                      onClick={() => toggleOwner(user.id)}
                      key={user.id}
                    >
                      <i
                        style={{ background: color, "--owner-color": color } as React.CSSProperties}
                        role="button"
                        tabIndex={0}
                        className="calendar-color-swatch"
                        title="Mudar a cor desta agenda"
                        aria-label={`Mudar a cor da agenda de ${user.name}`}
                        onClick={(event) => { event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); setColorPicker((current) => current?.ownerId === user.id ? null : { ownerId: user.id, top: box.bottom + 6, left: box.left }); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).click(); } }}
                      >
                        {selected ? <Check /> : null}
                      </i>
                      <span>
                        <b>
                          {user.id === currentUserId
                            ? "Minha agenda"
                            : user.name}
                        </b>
                        <small>
                          {
                            events.filter((event) => eventPeople(event).includes(user.id))
                              .length
                          }{" "}
                          eventos
                        </small>
                      </span>
                      {selected ? <Eye /> : <EyeOff />}
                    </button>
                  );
                })}
              </div>
              <footer>
                <span>
                  <i className="event-dot" />
                  Evento
                </span>
                <span>
                  <i className="task-dot" />
                  Tarefa
                </span>
                <span>
                  <i className="ticket-dot" />
                  Chamado
                </span>
                <span>
                  <i className="crm-dot" />
                  CRM
                </span>
              </footer>
            </aside>
          )}
          <div className="calendar-merge-main">
            <div className="calendar-owner-strip">
              <div className="calendar-owner-stack">
                {visibleOwners.slice(0, 4).map((user) => (
                  <span
                    className="calendar-owner-avatar"
                    style={{ background: colorFor(user.id) }}
                    key={user.id}
                  >
                    {user.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                ))}
                {visibleOwners.length > 4 && (
                  <span className="calendar-owner-more">
                    +{visibleOwners.length - 4}
                  </span>
                )}
              </div>
              <div>
                <b>
                  {visibleOwners.length === 1
                    ? visibleOwners[0]?.id === currentUserId
                      ? "Minha agenda"
                      : visibleOwners[0]?.name
                    : `${visibleOwners.length} agendas combinadas`}
                </b>
                <small>
                  {items.length} itens visíveis · cada pessoa tem uma cor ·
                  arraste para alterar
                </small>
              </div>
              {saving && <em>Salvando…</em>}
            </div>
            {view === "MONTH" ? (
              <MonthGrid
                days={days}
                anchor={anchor}
                items={items}
                onDrop={drop}
                onDrag={drag}
                onCreate={openCreate}
                onOpen={openEdit}
              />
            ) : (
              <TimeGrid
                days={days}
                items={items}
                onDrop={drop}
                onDrag={drag}
                onCreate={openCreate}
                onOpen={openEdit}
              />
            )}
          </div>
        </div>
      </section>
      {creating && (
        <CreateModal
          type={createType}
          setType={setCreateType}
          start={draftStart}
          users={users}
          clients={clients}
          opportunities={opportunities}
          currentUserId={currentUserId}
          googleConnected={google.connected}
          saving={saving}
          error={error}
          item={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={save}
          onDelete={editing ? () => void remove() : undefined}
          agendaColor={colorFor(editing && "ownerId" in editing ? editing.ownerId : currentUserId)}
        />
      )}
      {colorPicker && (
        <div className="calendar-color-backdrop" onMouseDown={() => setColorPicker(null)}>
          <div className="calendar-color-popover" role="dialog" aria-label="Cor da agenda" style={{ top: Math.min(colorPicker.top, window.innerHeight - 190), left: Math.min(colorPicker.left, window.innerWidth - 236) }} onMouseDown={(event) => event.stopPropagation()}>
            <b>Cor da agenda</b>
            <div>{[...new Set([...calendarColors, ...googleEventColors.map((color) => color.hex)])].map((hex) => (
              <button type="button" key={hex} style={{ background: hex }} className={colorFor(colorPicker.ownerId) === hex ? "active" : ""} aria-label={`Usar a cor ${hex}`} onClick={() => void (canManageColors ? chooseTeamColor : chooseAgendaColor)(colorPicker.ownerId, hex)}>{colorFor(colorPicker.ownerId) === hex && <Check />}</button>
            ))}</div>
            {canManageColors
              ? users.find((user) => user.id === colorPicker.ownerId)?.color && <button type="button" className="calendar-color-reset" onClick={() => void chooseTeamColor(colorPicker.ownerId, "")}>Voltar à cor padrão</button>
              : agendaColors[colorPicker.ownerId] && <button type="button" className="calendar-color-reset" onClick={() => void chooseAgendaColor(colorPicker.ownerId, "")}>Voltar à cor da equipe</button>}
            <small>{canManageColors ? "Cor da pessoa para toda a equipe: agenda, painéis e listas." : "Só muda na sua visão, como no Google Agenda."}</small>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  onDrag,
  onOpen,
  durationHours,
}: {
  item: CalendarItem;
  onDrag: (event: DragEvent, item: CalendarItem) => void;
  onOpen: (item: CalendarItem) => void;
  durationHours?: number;
}) {
  const color = item.color;
  const shared: Record<string, string> = item.colors && item.colors.length > 1 ? {
    "--shared-bar": `linear-gradient(180deg, ${item.colors.map((value, index, all) => `${value} ${(index / all.length) * 100}% ${((index + 1) / all.length) * 100}%`).join(", ")})`,
    "--shared-fill": `linear-gradient(90deg, ${item.colors.map((value) => `color-mix(in srgb, ${value} 16%, var(--surface))`).join(", ")})`,
  } : {};
  return (
    <article
      draggable={item.editable}
      onDragStart={(event) => item.editable && onDrag(event, item)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      className={`calendar-item ${item.kind} ${item.category.toLowerCase()} ${item.editable ? "editable" : "read-only"}${durationHours ? " calendar-duration" : ""}${item.colors ? " shared" : ""}`}
      style={{ "--owner-color": color, ...shared, ...(durationHours ? { "--calendar-duration-height": `${Math.max(30, durationHours * 58 - 6)}px` } : {}) } as React.CSSProperties}
      title={
        item.kind === "ticket"
          ? `${item.ownerName} · prazo do chamado — clique para abrir`
          : item.kind === "crm"
          ? `${item.ownerName} · próxima ação do CRM — clique para abrir o lead`
          : item.kind === "task"
          ? `${item.ownerName} · ${item.editable ? "clique para editar" : "somente visualização"}`
          : `${item.ownerName} · ${item.editable ? "clique para editar ou arraste para alterar o horário" : "somente visualização"}`
      }
    >
      <span>{item.kind === "task" ? <CheckSquare2 /> : item.kind === "ticket" ? <MessagesSquare /> : item.kind === "crm" ? <Handshake /> : <Clock3 />}</span>
      <div>
        <b>{item.title}</b>
        <small>
          {item.start.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {item.kind === "event" &&
            ` – ${item.end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}{" "}
          · {item.ownerName}
          {item.kind === "task" && " · Creative Ops"}
          {item.kind === "ticket" && " · Chamado"}
          {item.kind === "crm" && " · CRM"}
        </small>
      </div>
      {!item.editable && <Eye />}
    </article>
  );
}

function TimeGrid({
  days,
  items,
  onDrop,
  onDrag,
  onCreate,
  onOpen,
}: {
  days: Date[];
  items: CalendarItem[];
  onDrop: (event: DragEvent, day: Date, hour?: number) => void;
  onDrag: (event: DragEvent, item: CalendarItem) => void;
  onCreate: (date: Date) => void;
  onOpen: (item: CalendarItem) => void;
}) {
  const startHour = 6;
  const endHour = 23;
  return (
    <div className="calendar-time-scroll">
      <div
        className="calendar-time-grid"
        style={{ "--calendar-days": days.length } as React.CSSProperties}
      >
        <div className="calendar-corner" />
        {days.map((day) => (
          <header
            className={sameDay(day, new Date()) ? "today" : ""}
            key={day.toISOString()}
          >
            <small>
              {day.toLocaleDateString("pt-BR", { weekday: "short" })}
            </small>
            <b>{day.getDate()}</b>
          </header>
        ))}
        {Array.from({ length: endHour - startHour }, (_, index) => index + startHour).flatMap((hour) => [
          <time key={`time-${hour}`}>{pad(hour)}:00</time>,
          ...days.map((day) => (
            <section
              key={`${day.toISOString()}-${hour}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.currentTarget.dataset.justDropped = "true";
                void onDrop(event, day, hour);
                setTimeout(
                  () => delete event.currentTarget.dataset.justDropped,
                  0,
                );
              }}
              onClick={(event) => {
                if (event.currentTarget.dataset.justDropped) return;
                if ((event.target as HTMLElement).closest(".calendar-item"))
                  return;
                onCreate(
                  new Date(
                    day.getFullYear(),
                    day.getMonth(),
                    day.getDate(),
                    hour,
                  ),
                );
              }}
            >
              {items
                .filter(
                  (item) =>
                    sameDay(item.start, day) && item.start.getHours() === hour,
                )
                .map((item) => (
                  <ItemCard
                    item={item}
                    onDrag={onDrag}
                    onOpen={onOpen}
                    durationHours={Math.min(
                      Math.max(0.5, (item.end.getTime() - item.start.getTime()) / 3_600_000),
                      endHour - hour,
                    )}
                    key={`${item.kind}-${item.id}`}
                  />
                ))}
            </section>
          )),
        ])}
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  items,
  onDrop,
  onDrag,
  onCreate,
  onOpen,
}: {
  days: Date[];
  anchor: Date;
  items: CalendarItem[];
  onDrop: (event: DragEvent, day: Date) => void;
  onDrag: (event: DragEvent, item: CalendarItem) => void;
  onCreate: (date: Date) => void;
  onOpen: (item: CalendarItem) => void;
}) {
  return (
    <div className="calendar-month">
      <div className="month-weekdays">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => (
          <section
            className={`${day.getMonth() !== anchor.getMonth() ? "outside" : ""} ${sameDay(day, new Date()) ? "today" : ""}`}
            key={day.toISOString()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.currentTarget.dataset.justDropped = "true";
              void onDrop(event, day);
              setTimeout(
                () => delete event.currentTarget.dataset.justDropped,
                0,
              );
            }}
            onClick={(event) => {
              if (event.currentTarget.dataset.justDropped) return;
              if ((event.target as HTMLElement).closest(".calendar-item"))
                return;
              onCreate(
                new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9),
              );
            }}
          >
            <b>{day.getDate()}</b>
            {items
              .filter((item) => sameDay(item.start, day))
              .slice(0, 4)
              .map((item) => (
                <ItemCard
                  item={item}
                  onDrag={onDrag}
                  onOpen={onOpen}
                  key={`${item.kind}-${item.id}`}
                />
              ))}
            {items.filter((item) => sameDay(item.start, day)).length > 4 && (
              <small>
                +{items.filter((item) => sameDay(item.start, day)).length - 4}{" "}
                itens
              </small>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function CreateModal({
  type,
  setType,
  start,
  users,
  clients,
  opportunities,
  currentUserId,
  googleConnected,
  saving,
  error,
  item,
  onClose,
  onSubmit,
  onDelete,
  agendaColor,
}: {
  type: CreateType;
  setType: (type: CreateType) => void;
  start: Date;
  users: User[];
  clients: Client[];
  opportunities: Opportunity[];
  currentUserId: string;
  googleConnected: boolean;
  saving: boolean;
  error: string;
  item: CalendarEvent | Task | null;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
  agendaColor: string;
}) {
  const eventItem = type === "EVENT" ? (item as CalendarEvent | null) : null;
  const taskItem = type === "TASK" ? (item as Task | null) : null;
  const eventStart = eventItem ? new Date(eventItem.startAt) : start;
  const end = eventItem
    ? new Date(eventItem.endAt)
    : new Date(start.getTime() + 60 * 60_000);
  const [participantSearch, setParticipantSearch] = useState("");
  const [colorId, setColorId] = useState(eventItem?.colorId || "");
  const [participantIds, setParticipantIds] = useState<string[]>(eventItem?.participantIds || []);
  const [clientId, setClientId] = useState(eventItem?.clientId || taskItem?.clientId || "");
  const [category,setCategory]=useState(eventItem?.category || "WORK");
  const rooms:{id:string;name:string;location:string;capacity:number}[]=useMemo(()=>{try{return JSON.parse(localStorage.getItem("pw-os-meeting-rooms")||"[]")}catch{return[]}},[]);
  const visibleParticipants = users.filter(
    (user) =>
      user.id !== currentUserId &&
      user.name.toLowerCase().includes(participantSearch.toLowerCase()),
  );
  const relatedOpportunities = opportunities.filter(
    (item) =>
      item.status !== "CONVERTED" &&
      (!clientId ||
        clients.find((client) => client.id === clientId)?.name.toLowerCase() ===
          item.company.toLowerCase()),
  );
  return (
    <div className="modal-backdrop">
      <section className="operations-modal calendar-create-modal">
        <header>
          <div>
            <h2>{item ? `Editar ${type === "EVENT" ? "evento" : "tarefa"}` : "Novo item na agenda"}</h2>
            <p>{item ? "Atualize as informações deste item da agenda." : "Crie um compromisso ou planeje uma tarefa."}</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {!item && <div className="calendar-create-tabs">
          <button
            className={type === "EVENT" ? "active" : ""}
            onClick={() => setType("EVENT")}
          >
            <CalendarDays /> Evento
          </button>
          <button
            className={type === "TASK" ? "active" : ""}
            onClick={() => setType("TASK")}
          >
            <CheckSquare2 /> Tarefa
          </button>
        </div>}
        <form onSubmit={onSubmit}>
          <label className="full">
            Título *<input name="title" required autoFocus defaultValue={item?.title || ""} />
          </label>
          {type === "EVENT" ? (
            <>
              <label>
                Início
                <DateTimePicker
                  name="startAt"
                  defaultValue={localInput(eventStart)}
                  required
                />
              </label>
              <label>
                Fim
                <DateTimePicker
                  name="endAt"
                  defaultValue={localInput(end)}
                  required
                />
              </label>
              <label>
                Categoria
                <select name="category" value={category} onChange={(event)=>setCategory(event.target.value)}>
                  <option value="WORK">Bloco de trabalho</option>
                  <option value="MEETING">Reunião</option>
                  <option value="UNAVAILABLE">Indisponível</option>
                  <option value="PERSONAL">Pessoal</option>
                </select>
              </label>
              <div className="full calendar-event-colors">
                <span>Cor do evento</span>
                <input type="hidden" name="colorId" value={colorId} />
                <div role="radiogroup" aria-label="Cor do evento">
                  <button type="button" role="radio" aria-checked={!colorId} className={`agenda-default ${!colorId ? "active" : ""}`} style={{ background: agendaColor }} title="Cor da agenda" onClick={() => setColorId("")}>{!colorId && <Check />}</button>
                  {googleEventColors.map((color) => <button type="button" role="radio" aria-checked={colorId === color.id} key={color.id} className={colorId === color.id ? "active" : ""} style={{ background: color.hex }} title={color.name} aria-label={color.name} onClick={() => setColorId(color.id)}>{colorId === color.id && <Check />}</button>)}
                </div>
                <small>{colorId ? `${googleEventColors.find((color) => color.id === colorId)?.name} · também no Google Agenda` : "Cor da agenda"}</small>
              </div>
              <label>
                Local ou link
                <div className="input-with-icon">
                  <MapPin />
                  <input name="location" defaultValue={eventItem?.location || ""} />
                </div>
              </label>
              {googleConnected && (eventItem?.meetUrl ? <p className="full calendar-google-meet">Google Meet: <a href={eventItem.meetUrl} target="_blank" rel="noreferrer">{eventItem.meetUrl}</a></p> : <label className="full calendar-google-meet"><input type="checkbox" name="googleMeet" defaultChecked={category === "MEETING"} /> Criar link do Google Meet e enviar convite pelo Google Agenda</label>)}
              {eventItem?.source === "GOOGLE" && <p className="full calendar-google-meet">Evento do seu Google Agenda: título, horário, local e descrição são salvos direto no Google. Participantes e vínculos com cliente não se aplicam.</p>}
              {eventItem?.googleSyncError && <p className="full calendar-google-error">Não sincronizado com o Google Agenda: {eventItem.googleSyncError}</p>}
              {category === "MEETING" && rooms.length > 0 && <label className="full">Sala de reunião<select name="roomId"><option value="">Sem sala reservada</option>{rooms.map(room=><option value={room.id} key={room.id}>{room.name}{room.location?` · ${room.location}`:""}{room.capacity?` · ${room.capacity} pessoas`:""}</option>)}</select></label>}
            </>
          ) : (
            <>
              <input type="hidden" name="status" value="TODO" />
              <label>
                Prazo e horário
                <DateTimePicker
                  name="dueAt"
                  defaultValue={localInput(taskItem ? new Date(taskItem.dueAt) : start)}
                  required
                />
              </label>
              <label>
                Responsável
                <SearchableSelect
                  name="responsibleId"
                  defaultValue={taskItem?.responsibleId || currentUserId}
                  options={users.map((user) => ({
                    value: user.id,
                    label: user.name,
                  }))}
                  searchPlaceholder="Buscar responsável..."
                  required
                />
              </label>
              <label>
                Prioridade
                <select name="priority" defaultValue={taskItem?.priority || "LOW"}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
              <label>
                Estimativa (minutos)
                <input
                  name="estimateMinutes"
                  type="number"
                  min="0"
                  defaultValue={taskItem?.estimateMinutes || 60}
                />
              </label>
            </>
          )}
          <fieldset className="calendar-related full">
            <legend>Referente a</legend>
            <label>
              Cliente
              <SearchableSelect
                name="clientId"
                value={clientId}
                onChange={setClientId}
                placeholder="Nenhum cliente"
                searchPlaceholder="Buscar cliente..."
                options={[
                  { value: "", label: "Nenhum cliente" },
                  ...clients.map((client) => ({
                    value: client.id,
                    label: client.name,
                  })),
                ]}
              />
            </label>
            <label>
              Lead ou oportunidade do CRM
              <SearchableSelect
                name="opportunityId"
                defaultValue={eventItem?.opportunityId || taskItem?.opportunityId || ""}
                placeholder="Nenhum lead"
                searchPlaceholder="Buscar lead, empresa ou serviço..."
                options={[
                  { value: "", label: "Nenhum lead" },
                  ...relatedOpportunities.map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: [item.company, item.serviceInterest]
                      .filter(Boolean)
                      .join(" · "),
                  })),
                ]}
              />
            </label>
          </fieldset>
          {type === "EVENT" && (
            <div className="participant-picker full">
              <div className="participant-picker-head">
                <div>
                  <b>Convidar colaboradores</b>
                  <small>
                    Eles receberão o convite e poderão aceitar ou recusar.
                  </small>
                </div>
                <div className="participant-search">
                  <Users />
                  <input
                    value={participantSearch}
                    onChange={(event) =>
                      setParticipantSearch(event.target.value)
                    }
                    placeholder="Buscar colaborador..."
                  />
                </div>
              </div>
              <div className="participant-options">
                {visibleParticipants.length ? (
                  visibleParticipants.map((user) => {
                    const selected = participantIds.includes(user.id);
                    return (
                      <label
                        className={selected ? "selected" : ""}
                        key={user.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setParticipantIds((value) =>
                              selected
                                ? value.filter((id) => id !== user.id)
                                : [...value, user.id],
                            )
                          }
                        />
                        <span>
                          {user.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <div>
                          <b>{user.name}</b>
                          <small>
                            {selected
                              ? "Participará do evento"
                              : "Clique para convidar"}
                          </small>
                        </div>
                        <i>{selected ? "✓" : "+"}</i>
                      </label>
                    );
                  })
                ) : (
                  <p>Nenhum colaborador encontrado.</p>
                )}
              </div>
              {participantIds.map((id) => (
                <input
                  type="hidden"
                  name="participantIds"
                  value={id}
                  key={id}
                />
              ))}
            </div>
          )}
          {type === "EVENT" && (
            <>
              <label>
                Lembrete
                <select name="reminderMinutes" defaultValue={eventItem?.reminderMinutes || 0}>
                  <option value="0">Sem lembrete</option>
                  <option value="5">5 minutos antes</option>
                  <option value="15">15 minutos antes</option>
                  <option value="60">1 hora antes</option>
                </select>
              </label>
              <label>
                Recorrência
                <select name="recurrence" defaultValue={eventItem?.recurrence || "NONE"}>
                  <option value="NONE">Não repetir</option>
                  <option value="DAILY">Diariamente</option>
                  <option value="WEEKLY">Semanalmente</option>
                  <option value="MONTHLY">Mensalmente</option>
                </select>
              </label>
            </>
          )}
          <label className="full">
            Descrição
            <textarea name="description" defaultValue={eventItem?.description || taskItem?.description || ""} />
          </label>
          {error && <div className="form-error full">{error}</div>}
          <footer>
            {onDelete && <button type="button" className="secondary danger calendar-delete" disabled={saving} onClick={onDelete}><Trash2 />Excluir</button>}
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={saving}>
              {saving
                ? "Salvando…"
                : type === "EVENT"
                  ? item ? "Salvar evento" : "Criar evento"
                  : item ? "Salvar tarefa" : "Criar tarefa"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
