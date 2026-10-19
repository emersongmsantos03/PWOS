import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { ClientBranch } from "./BranchSelect";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, Building2, Check, CheckCircle2, ChevronRight, Clock3, Download, Edit3, FileText,
  Hourglass, Home, KanbanSquare, List, MessageSquare, MessagesSquare, Paperclip, Pencil, Plus, Quote, RotateCcw, Search, Send, Settings2, Trash2, Undo2, UserRound, Workflow, X, XCircle,
} from "lucide-react";
import { systemConfirm } from "./SystemDialog";
import { SearchableSelect } from "./SearchableSelect";
import { avatarTone, initials } from "./meetingsModel";
import { canReturnStep, pendingAdjustment, stepRoleLabels, type TicketFlow, type TicketStep } from "./ticketFlows";
import type { TicketChecklistItem } from "./ticketWork";
import { isMarketingUser } from "./marketingTickets";
import "./Meetings.css";
import "./Tickets.css";

export type TicketUser = { id: string; name: string; email: string; avatarDataUrl?: string; departmentId?: string; departmentName?: string };
export type Department = { id: string; name: string; description: string; active: boolean; managerUserId?: string; managerName?: string };
export type TicketComment = { id: string; authorId: string; authorName: string; message: string; mentions: string[]; createdAt: string; kind?: "SYSTEM"; action?: "RETURN"; note?: string; stepId?: string; delivery?: boolean; editedAt?: string };
type Comment = TicketComment;
export type TicketAttachment = { id: string; name: string; contentType: string; sizeBytes: number; uploadedById: string; uploadedByName: string; createdAt: string; stepId?: string };
export type TicketOriginType = "INTERNAL" | "MEETING" | "WHATSAPP" | "EMAIL" | "PHONE";
export type Ticket = {
  id: string; code: string; title: string; description: string; departmentId: string;
  requesterId: string; requesterName: string; assigneeId: string; assigneeName: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
  dueAt: string; participantIds: string[]; comments: Comment[]; createdAt: string; updatedAt: string;
  clientId?: string; clientName?: string; unit?: string;
  origin?: { type: TicketOriginType; meetingId?: string; label: string };
  flowId?: string; flowName?: string; steps?: TicketStep[]; notes?: string; attachments?: TicketAttachment[];
  checklist?: TicketChecklistItem[]; projectValue?: number;
  // Chamado sem etapas repassado para outra pessoa (com etapas, fica em cada etapa).
  handoff?: TicketStep["handoff"];
};
export type TicketsData = {
  tickets: Ticket[]; departments: Department[]; availableUsers: TicketUser[]; flows: TicketFlow[];
  clients: { id: string; name: string; contactName?: string; contactEmail?: string; contactPhone?: string; branches?: ClientBranch[] }[];
  meetings: { id: string; clientId: string; subject: string; startAt: string; unit: string }[];
  canViewAll: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canComment: boolean; canAssign: boolean; canManageDepartments: boolean; canManageFlows?: boolean;
};
export type SessionUser = { id: string; name: string; avatarDataUrl?: string; departmentId?: string; departmentName?: string };
export type TicketsView = "open" | "done";

export const statusMeta = {
  OPEN: { label: "Aberto", tone: "blue" },
  IN_PROGRESS: { label: "Em andamento", tone: "orange" },
  WAITING: { label: "Aguardando cliente", tone: "purple" },
  RESOLVED: { label: "Concluído", tone: "green" },
  CLOSED: { label: "Cancelado", tone: "gray" },
} as const;
export const priorityMeta = {
  LOW: { label: "Baixa", tone: "green" },
  MEDIUM: { label: "Média", tone: "yellow" },
  HIGH: { label: "Alta", tone: "red" },
  URGENT: { label: "Urgente", tone: "red" },
} as const;
export const originLabels: Record<TicketOriginType, string> = { INTERNAL: "Solicitação interna", MEETING: "Reunião", WHATSAPP: "WhatsApp", EMAIL: "E-mail", PHONE: "Telefone" };

export const dateTime = (value: string) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Sem prazo";
export const shortDay = (value: string) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value)) : "—";
export const fileSize = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
const isOpen = (ticket: Ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status);
const isLate = (ticket: Ticket) => isOpen(ticket) && !!ticket.dueAt && new Date(ticket.dueAt).getTime() < Date.now();
const activeStep = (ticket: Ticket) => ticket.steps?.find((item) => item.status === "ACTIVE");
const doneSteps = (ticket: Ticket) => ticket.steps?.filter((item) => item.status === "DONE").length || 0;

export async function ticketApi<T>(path: string, init?: { method?: string; json?: unknown }) {
  const response = await fetch(`/api${path}`, { method: init?.method || "GET", headers: { "Content-Type": "application/json" }, body: init?.json !== undefined ? JSON.stringify(init.json) : undefined });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload as T;
}

export async function uploadTicketFile(ticketId: string, file: File, stepId?: string) {
  const response = await fetch(`/api/tickets/${ticketId}/attachments`, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), ...(stepId ? { "X-Ticket-Step": stepId } : {}) }, body: file });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${file.name}: ${payload.message || "falha no envio"}`);
  return payload.ticket as Ticket;
}

export function useTicketsData() {
  const [data, setData] = useState<TicketsData | null>(null), [error, setError] = useState("");
  const load = useCallback(() => ticketApi<TicketsData>("/tickets").then((value) => { setData(value); setError(""); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  return { data, error, load };
}

/* ---------- Peças compartilhadas ---------- */

export function TicketHeader({ icon: Icon, crumb, title, subtitle, actions, quote }: { icon: typeof MessagesSquare; crumb: string; title: string; subtitle: string; actions?: ReactNode; quote?: boolean }) {
  return <header className="mt-header">
    <nav className="mt-crumbs" aria-label="Você está em"><NavLink to="/" aria-label="Início"><Home /></NavLink><ChevronRight /><NavLink to="/chamados">Chamados</NavLink><ChevronRight /><b>{crumb}</b></nav>
    <div className="mt-header-row">
      <span className="mt-header-icon"><Icon /></span>
      <div className="mt-header-copy"><h1>{title}</h1><p>{subtitle}</p></div>
      {quote && <blockquote className="mt-quote"><Quote /><span>"Processos bem definidos<br />entregam resultados extraordinários."</span><cite>Dyego Pessoa</cite></blockquote>}
      {actions && <div className="mt-header-actions">{actions}</div>}
    </div>
  </header>;
}

export function PersonAvatar({ name, src, size = "md" }: { name: string; src?: string; size?: "sm" | "md" }) {
  if (src) return <img className={`mt-avatar tk-avatar-img ${size}`} src={src} alt="" />;
  return <span className={`mt-avatar ${size}`} style={{ background: avatarTone(name || "?") }} aria-hidden="true">{initials(name || "?")}</span>;
}

export function TicketPill({ kind, value }: { kind: "status" | "priority"; value: Ticket["status"] | Ticket["priority"] }) {
  const meta = kind === "status" ? statusMeta[value as Ticket["status"]] : priorityMeta[value as Ticket["priority"]];
  return <span className={`tk-pill ${meta.tone}`}>{meta.label}</span>;
}

// Linha do fluxo: concluída, em andamento ou pendente, com responsável e prazo de cada etapa.
export function StepRail({ steps, users, renderAssignee, vertical = false }: { steps: Pick<TicketStep, "name" | "role" | "status" | "assigneeName" | "dueAt">[]; users: TicketUser[]; renderAssignee?: (index: number) => ReactNode; vertical?: boolean }) {
  return <ol className={`tk-rail ${vertical ? "vertical" : ""}`} style={{ "--steps": steps.length } as CSSProperties}>
    {steps.map((item, index) => {
      const late = item.status === "ACTIVE" && item.dueAt && new Date(item.dueAt).getTime() < Date.now();
      return <li key={index} className={`${item.status.toLowerCase()} ${late ? "late" : ""}`}>
        <span className="tk-rail-dot">{item.status === "DONE" ? <Check /> : index + 1}</span>
        <b>{item.name}</b>
        {renderAssignee ? renderAssignee(index) : <span className="tk-rail-person"><PersonAvatar size="sm" name={item.assigneeName} src={users.find((user) => user.name === item.assigneeName)?.avatarDataUrl} /><span>{item.assigneeName}</span></span>}
        <small>{stepRoleLabels[item.role]}{item.dueAt ? ` · ${shortDay(item.dueAt)}` : ""}</small>
      </li>;
    })}
  </ol>;
}

/* ---------- Listas ---------- */

const viewMeta: Record<TicketsView, { crumb: string; title: string; subtitle: string; empty: string }> = {
  open: { crumb: "Em andamento", title: "Chamados em Andamento", subtitle: "Os chamados com você, os que você abriu e os que estão com outras pessoas da equipe.", empty: "Nenhum chamado em andamento." },
  done: { crumb: "Concluídos", title: "Chamados Concluídos", subtitle: "Histórico de chamados finalizados e cancelados.", empty: "Nenhum chamado concluído ainda." },
};

export function TicketsManagement({ user, view }: { user: SessionUser; view: TicketsView }) {
  const { data, error, load } = useTicketsData();
  const navigate = useNavigate(), location = useLocation(), [params, setParams] = useSearchParams();
  const [uploadErrors, setUploadErrors] = useState<string[]>(() => (location.state as { uploadErrors?: string[] } | null)?.uploadErrors || []);
  const [search, setSearch] = useState(""), [clientFilter, setClientFilter] = useState(""), [priorityFilter, setPriorityFilter] = useState(""),
    [scope, setScope] = useState<"ALL" | "WITH_ME" | "REQUESTED" | "OTHERS" | "LATE">(() => params.get("filtro") === "terceiros" ? "OTHERS" : "ALL"), [layout, setLayout] = useState<"LIST" | "KANBAN">("LIST"),
    [manageDepartments, setManageDepartments] = useState(false);
  // Marketing e Criação trabalha na página completa do chamado (cronômetro, entregas, checklist).
  const fullPage = isMarketingUser(user);
  useEffect(() => { const id = params.get("ticket"); if (fullPage && id) navigate(`/chamados/ver/${encodeURIComponent(id)}`, { replace: true }); }, [fullPage, params, navigate]);
  const selected = fullPage ? null : data?.tickets.find((ticket) => ticket.id === params.get("ticket")) || null;
  const select = (ticket: Ticket | null) => fullPage && ticket ? navigate(`/chamados/ver/${encodeURIComponent(ticket.id)}`) : setParams(ticket ? { ticket: ticket.id } : {}, { replace: !ticket });
  const inView = useCallback((ticket: Ticket) => view === "done" ? !isOpen(ticket) : isOpen(ticket), [view]);
  const visible = useMemo(() => (data?.tickets || []).filter((ticket) => inView(ticket)
    && (!clientFilter || ticket.clientId === clientFilter)
    && (!priorityFilter || ticket.priority === priorityFilter)
    && (scope === "ALL" || (scope === "WITH_ME" && ticket.assigneeId === user.id) || (scope === "REQUESTED" && ticket.requesterId === user.id) || (scope === "OTHERS" && ticket.assigneeId !== user.id) || (scope === "LATE" && isLate(ticket)))
    && (!search || [ticket.code, ticket.title, ticket.clientName, ticket.requesterName, ticket.assigneeName, activeStep(ticket)?.name].some((value) => value?.toLowerCase().includes(search.toLowerCase())))), [data, inView, clientFilter, priorityFilter, scope, search, user.id]);

  if (error && !data) return <div className="mt-page"><p className="mt-alert" role="alert">{error}</p></div>;
  if (!data) return <div className="mt-page"><div className="mt-loading" role="status"><MessagesSquare /> Carregando chamados…</div></div>;
  const all = data.tickets, meta = viewMeta[view];
  const kpis = [
    { icon: UserRound, label: "Comigo agora", value: all.filter((t) => isOpen(t) && t.assigneeId === user.id).length, tone: "blue" },
    { icon: Hourglass, label: "Aguardando cliente", value: all.filter((t) => t.status === "WAITING").length, tone: "purple" },
    { icon: AlertTriangle, label: "Atrasados", value: all.filter(isLate).length, tone: "red" },
    { icon: CheckCircle2, label: "Concluídos no mês", value: all.filter((t) => t.status === "RESOLVED" && t.updatedAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length, tone: "green" },
  ];
  const clientsInUse = data.clients.filter((client) => all.some((ticket) => ticket.clientId === client.id));

  return <div className="mt-page tk-page">
    <TicketHeader icon={MessagesSquare} crumb={meta.crumb} title={meta.title} subtitle={meta.subtitle} actions={<>
      {data.canManageFlows && <NavLink className="mt-button outline" to="/chamados/tipos"><Workflow />Tipos de chamado</NavLink>}
      {data.canManageDepartments && <button type="button" className="mt-button outline" onClick={() => setManageDepartments(true)}><Settings2 />Setores</button>}
      {data.canCreate && <NavLink className="mt-button tk-cta" to="/chamados/novo"><Plus />Abrir chamado</NavLink>}
    </>} />
    {uploadErrors.length > 0 && <div className="mt-notice warn" role="alert"><AlertTriangle /><span>O chamado foi salvo, mas alguns anexos não foram enviados: {uploadErrors.join(" · ")}. Anexe de novo pelo detalhe do chamado.</span><button type="button" aria-label="Fechar aviso" onClick={() => setUploadErrors([])}><X /></button></div>}
    <section className="tk-kpis">{kpis.map((item) => <article key={item.label} className={item.tone}><span><item.icon /></span><div><small>{item.label}</small><b>{item.value}</b></div></article>)}</section>
    <section className="mt-card tk-list-card">
      <div className="tk-toolbar">
        <label className="tk-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por chamado, cliente, pessoa ou etapa…" /></label>
        <div className="tk-filter"><SearchableSelect value={scope} onChange={(value) => setScope(value as typeof scope)} searchable={false} options={[{ value: "ALL", label: "Todos" }, { value: "WITH_ME", label: "Comigo agora" }, { value: "REQUESTED", label: "Abertos por mim" }, ...(view === "done" ? [] : [{ value: "OTHERS", label: "Com terceiros" }, { value: "LATE", label: "Atrasados" }])]} /></div>
        <div className="tk-filter"><SearchableSelect value={clientFilter} onChange={setClientFilter} searchPlaceholder="Buscar cliente…" options={[{ value: "", label: "Todos os clientes" }, ...clientsInUse.map((client) => ({ value: client.id, label: client.name }))]} /></div>
        <div className="tk-filter"><SearchableSelect value={priorityFilter} onChange={setPriorityFilter} searchable={false} options={[{ value: "", label: "Todas as prioridades" }, ...Object.entries(priorityMeta).map(([value, item]) => ({ value, label: item.label }))]} /></div>
        {view !== "done" && <div className="tk-layout-toggle">
          <button type="button" className={layout === "LIST" ? "active" : ""} onClick={() => setLayout("LIST")} aria-label="Ver em lista"><List /></button>
          <button type="button" className={layout === "KANBAN" ? "active" : ""} onClick={() => setLayout("KANBAN")} aria-label="Ver em quadro"><KanbanSquare /></button>
        </div>}
      </div>
      {!visible.length ? <div className="tk-empty"><MessagesSquare /><b>{search || clientFilter || priorityFilter || scope !== "ALL" ? "Nenhum chamado com esses filtros." : meta.empty}</b>{data.canCreate && view !== "done" && <NavLink className="mt-button tk-cta" to="/chamados/novo"><Plus />Abrir chamado</NavLink>}</div>
        : layout === "LIST" || view === "done" ? <div className="tk-table">
          <div className="tk-table-head"><span>Chamado</span><span>Etapa atual</span><span>Responsável</span><span>Prioridade</span><span>Status</span><span>Prazo</span></div>
          {visible.map((ticket) => {
            const step = activeStep(ticket), total = ticket.steps?.length || 0;
            return <button type="button" key={ticket.id} className="tk-row" onClick={() => select(ticket)}>
              <span className="tk-row-title"><b>{ticket.title}</b><small>{ticket.code}{ticket.clientName ? ` · ${ticket.clientName}` : ""}</small></span>
              <span className="tk-row-step">{total ? <><b>{step?.name || (ticket.status === "RESOLVED" ? "Fluxo concluído" : "—")}{step?.adjustment && <span className="tk-adjust-tag" title={step.adjustment.note}><Undo2 />Ajustes</span>}</b><i style={{ "--done": `${(doneSteps(ticket) / total) * 100}%` } as CSSProperties}><em /></i><small>{doneSteps(ticket)}/{total} etapas</small></> : <small>Sem fluxo</small>}</span>
              <span className="tk-row-person"><PersonAvatar size="sm" name={ticket.assigneeName} src={data.availableUsers.find((item) => item.id === ticket.assigneeId)?.avatarDataUrl} />{ticket.assigneeName}</span>
              <span><TicketPill kind="priority" value={ticket.priority} /></span>
              <span><TicketPill kind="status" value={ticket.status} /></span>
              <span className={`tk-due ${isLate(ticket) ? "late" : ""}`}>{dateTime(ticket.dueAt)}{isLate(ticket) && <em>Atrasado</em>}</span>
            </button>;
          })}
        </div>
        : <div className="tk-kanban">{(["OPEN", "IN_PROGRESS", "WAITING"] as const).map((status) => {
          const column = visible.filter((ticket) => ticket.status === status);
          return <section key={status} className={statusMeta[status].tone}>
            <header><b>{statusMeta[status].label}</b><span>{column.length}</span></header>
            {column.map((ticket) => <button type="button" key={ticket.id} onClick={() => select(ticket)}>
              <small>{ticket.code}{ticket.clientName ? ` · ${ticket.clientName}` : ""}</small>
              <b>{ticket.title}</b>
              {activeStep(ticket) && <span className="tk-card-step">{activeStep(ticket)?.name} · {doneSteps(ticket) + 1}/{ticket.steps?.length}{activeStep(ticket)?.adjustment && <span className="tk-adjust-tag"><Undo2 />Ajustes</span>}</span>}
              <span className="tk-row-person"><PersonAvatar size="sm" name={ticket.assigneeName} />{ticket.assigneeName}</span>
              <footer><TicketPill kind="priority" value={ticket.priority} />{isLate(ticket) ? <em className="tk-late">Atrasado</em> : <time>{shortDay(ticket.dueAt)}</time>}</footer>
            </button>)}
          </section>;
        })}</div>}
    </section>
    {selected && <TicketDetails key={selected.id} ticket={selected} data={data} currentUser={user} onClose={() => select(null)} onEdit={() => navigate(`/chamados/editar/${selected.id}`)} onChange={() => void load()} onDeleted={() => { select(null); void load(); }} />}
    {manageDepartments && <DepartmentManager departments={data.departments} onClose={() => setManageDepartments(false)} onChange={load} />}
  </div>;
}

/* ---------- Detalhe ---------- */

function TicketDetails({ ticket, data, currentUser, onClose, onEdit, onChange, onDeleted }: { ticket: Ticket; data: TicketsData; currentUser: SessionUser; onClose: () => void; onEdit: () => void; onChange: () => void; onDeleted: () => void }) {
  const [message, setMessage] = useState(""), [suggestions, setSuggestions] = useState<TicketUser[]>([]), [error, setError] = useState(""),
    [returning, setReturning] = useState(false), [note, setNote] = useState(""), [busy, setBusy] = useState(false);
  const users = data.availableUsers, step = activeStep(ticket), steps = ticket.steps || [];
  const canMove = !!step && ticket.status !== "CLOSED" && (step.assigneeId === currentUser.id || data.canEdit);
  const canManage = data.canEdit || ticket.requesterId === currentUser.id;
  const next = step ? steps[steps.indexOf(step) + 1] : undefined;
  // Quem está no chamado: solicitante, responsáveis das etapas e quem já foi mencionado.
  const involvedIds = [...new Set([ticket.requesterId, ticket.assigneeId, ...steps.map((item) => item.assigneeId), ...ticket.participantIds].filter(Boolean))];
  const involved = involvedIds.map((id) => users.find((user) => user.id === id) || (id === ticket.requesterId ? { id, name: ticket.requesterName, email: "" } : undefined)).filter((user): user is TicketUser => !!user);
  const bodyRef = useRef<HTMLDivElement>(null), conversationRef = useRef<HTMLElement>(null);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); onChange(); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const flow = (action: "COMPLETE" | "RETURN" | "CANCEL" | "REOPEN", text = "") => run(async () => { await ticketApi(`/tickets/${ticket.id}/flow`, { method: "POST", json: { action, note: text } }); setReturning(false); setNote(""); });
  const type = (value: string) => {
    setMessage(value);
    const match = value.match(/(?:^|\s)@([^@\n]*)$/);
    // Participantes do chamado aparecem primeiro; quem for mencionado de fora passa a fazer parte dele.
    const found = match ? users.filter((user) => user.id !== currentUser.id && user.name.toLowerCase().includes(match[1].toLowerCase())) : [];
    setSuggestions([...found.filter((user) => involvedIds.includes(user.id)), ...found.filter((user) => !involvedIds.includes(user.id))].slice(0, 6));
  };
  const remove = async () => {
    if (!await systemConfirm({ title: "Excluir este chamado?", message: `O chamado ${ticket.code} e seus anexos serão removidos permanentemente.`, confirmLabel: "Excluir chamado", tone: "danger" })) return;
    await run(() => ticketApi(`/tickets/${ticket.id}`, { method: "DELETE" }));
    onDeleted();
  };
  const completeLabel = !step ? "" : step.role === "CLIENT" ? "Cliente aprovou" : step.role === "APPROVER" ? "Aprovar" : next ? "Concluir etapa" : "Concluir chamado";

  return <div className="modal-backdrop tk-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="tk-detail" aria-label={`Chamado ${ticket.code}`}>
      <header className="tk-detail-head">
        <div><small>{ticket.code}{ticket.flowName ? ` · ${ticket.flowName}` : ""}</small><h2>{ticket.title}</h2><div className="tk-pills"><TicketPill kind="status" value={ticket.status} /><TicketPill kind="priority" value={ticket.priority} />{isLate(ticket) && <span className="tk-pill red">Atrasado</span>}{pendingAdjustment(steps) && <span className="tk-pill orange"><Undo2 />Ajustes solicitados</span>}</div></div>
        <button type="button" className="mt-icon-button" onClick={onClose} aria-label="Fechar"><X /></button>
      </header>
      <div className="tk-detail-tools">
        {data.canEdit && <button type="button" className="mt-button outline small" onClick={onEdit}><Edit3 />Editar</button>}
        {canManage && isOpen(ticket) && <button type="button" className="mt-button outline small" disabled={busy} onClick={async () => { if (await systemConfirm({ title: "Cancelar este chamado?", message: "O fluxo é interrompido e o chamado vai para Concluídos como cancelado. Você pode reabrir depois.", confirmLabel: "Cancelar chamado", tone: "danger" })) void flow("CANCEL"); }}><XCircle />Cancelar chamado</button>}
        {canManage && !isOpen(ticket) && <button type="button" className="mt-button outline small" disabled={busy} onClick={() => void flow("REOPEN")}><RotateCcw />Reabrir</button>}
        {data.canDelete && <button type="button" className="mt-button outline small danger" disabled={busy} onClick={() => void remove()}><Trash2 />Excluir</button>}
      </div>
      <div className="tk-detail-body" ref={bodyRef}>
        {step && ticket.status !== "CLOSED" && <section className={`tk-now ${step.role.toLowerCase()} ${step.adjustment ? "adjust" : ""}`}>
          {step.adjustment && <div className="tk-adjust" role="status">
            <header><Undo2 /><b>Ajustes solicitados</b><time>{dateTime(step.adjustment.at)}</time></header>
            <p><b>{step.adjustment.byName}</b> devolveu de “{step.adjustment.fromStepName}” pedindo:</p>
            <blockquote>{step.adjustment.note}</blockquote>
            <small>Faça os ajustes e conclua a etapa para enviar de volta.</small>
          </div>}
          <div className="tk-now-head">
            <PersonAvatar name={step.assigneeName} src={users.find((user) => user.id === step.assigneeId)?.avatarDataUrl} />
            <div><small>Etapa {steps.indexOf(step) + 1} de {steps.length} · {stepRoleLabels[step.role]}</small><b>{step.name}</b><span>Com {step.assigneeId === currentUser.id ? "você" : step.assigneeName} · prazo {dateTime(step.dueAt)}</span></div>
          </div>
          {canMove && !returning && <div className="tk-now-actions">
            <button type="button" className="mt-button tk-cta" disabled={busy} onClick={() => void flow("COMPLETE")}><Check />{completeLabel}</button>
            {canReturnStep(steps) && <button type="button" className="mt-button outline" disabled={busy} onClick={() => setReturning(true)}><Undo2 />Solicitar ajustes</button>}
            <p>{next ? <>Vai para <b>{next.assigneeName}</b> em “{next.name}”.</> : "Esta é a última etapa: o chamado será concluído."}</p>
          </div>}
          {canMove && returning && <div className="tk-return">
            <label>O que precisa ser ajustado? <em>*</em><textarea autoFocus rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva os ajustes. O chamado volta para a etapa anterior." /></label>
            <div><button type="button" className="mt-button outline small" onClick={() => { setReturning(false); setNote(""); }}>Voltar</button><button type="button" className="mt-button primary small" disabled={busy || !note.trim()} onClick={() => void flow("RETURN", note)}><Undo2 />Devolver para {steps[steps.indexOf(step) - 1]?.assigneeName}</button></div>
          </div>}
          {!canMove && <p className="tk-now-hint">Somente {step.assigneeName} pode concluir esta etapa.</p>}
        </section>}
        {!steps.length && isOpen(ticket) && <section className="tk-now executor">
          <div className="tk-now-head">
            <PersonAvatar name={ticket.assigneeName || "Responsável"} src={users.find((user) => user.id === ticket.assigneeId)?.avatarDataUrl} />
            <div><small>Chamado sem etapas</small><b>Atendimento</b><span>Com {ticket.assigneeId === currentUser.id ? "você" : ticket.assigneeName || "responsável não definido"} · prazo {dateTime(ticket.dueAt)}</span></div>
          </div>
          {ticket.assigneeId === currentUser.id || data.canEdit
            ? <div className="tk-now-actions"><button type="button" className="mt-button tk-cta" disabled={busy} onClick={() => void flow("COMPLETE")}><Check />Concluir chamado</button><p>O chamado vai para Concluídos.</p></div>
            : <p className="tk-now-hint">Somente {ticket.assigneeName || "o responsável"} pode concluir este chamado.</p>}
        </section>}
        {error && <p className="mt-alert" role="alert">{error}</p>}
        <section className="tk-facts">
          <div><small>Cliente</small><b>{ticket.clientName || "Interno"}{ticket.unit ? ` · ${ticket.unit}` : ""}</b></div>
          <div><small>Solicitante</small><b>{ticket.requesterName}</b></div>
          <div><small>Setor</small><b>{data.departments.find((item) => item.id === ticket.departmentId)?.name || "—"}</b></div>
          <div><small>Prazo final</small><b className={isLate(ticket) ? "negative" : ""}>{dateTime(ticket.dueAt)}</b></div>
          <div><small>Origem</small><b>{ticket.origin?.meetingId ? <NavLink to={`/reunioes/${ticket.origin.meetingId}`}>{ticket.origin.label}</NavLink> : ticket.origin?.label || "—"}</b></div>
          <div><small>Aberto em</small><b>{dateTime(ticket.createdAt)}</b></div>
        </section>
        {steps.length > 0 && <section><h3>Fluxo</h3><StepRail vertical steps={steps} users={users} /></section>}
        <section><h3>Descrição</h3><p className="tk-text">{ticket.description || "Nenhuma descrição informada."}</p>{ticket.notes && <p className="tk-text muted"><b>Observações:</b> {ticket.notes}</p>}</section>
        <section><h3>Pessoas no chamado</h3><div className="tk-people">{involved.map((person) => <span key={person.id} className="tk-person-chip"><PersonAvatar size="sm" name={person.name} src={person.avatarDataUrl} /><b>{person.id === currentUser.id ? "Você" : person.name}</b></span>)}</div></section>
        <TicketAttachments ticket={ticket} canDelete={data.canDelete} canUpload={data.canCreate || data.canEdit || data.canComment} onChange={onChange} />
        <section ref={conversationRef}>
          <div className="tk-section-title"><h3>Conversa e histórico</h3><span>{ticket.comments.filter((item) => item.kind !== "SYSTEM").length}</span></div>
          <div className="tk-comments">
            <article className="system"><span><FileText /></span><p><b>{ticket.requesterName}</b> abriu o chamado · <time>{dateTime(ticket.createdAt)}</time></p></article>
            {ticket.comments.map((item) => returnNote(item) !== null
              ? <article key={item.id} className="adjust"><span><Undo2 /></span><div><header><b>Ajustes solicitados</b><time>{dateTime(item.createdAt)}</time></header><p><b>{item.authorName}</b> {item.message.replace(/ — “[\s\S]*”$/, "")}</p>{returnNote(item) && <blockquote>{returnNote(item)}</blockquote>}</div></article>
              : item.kind === "SYSTEM"
              ? <article key={item.id} className="system"><span><Clock3 /></span><p><b>{item.authorName}</b> {item.message} · <time>{dateTime(item.createdAt)}</time></p></article>
              : <article key={item.id}><PersonAvatar size="sm" name={item.authorName} src={users.find((user) => user.id === item.authorId)?.avatarDataUrl} /><div><header><b>{item.authorName}</b><time>{dateTime(item.createdAt)}</time></header><EditableComment ticketId={ticket.id} comment={item} userId={currentUser.id} canDelete={data.canDelete} onChange={onChange}><p>{highlightMentions(item.message, users.map((user) => user.name))}</p></EditableComment></div></article>)}
          </div>
        </section>
      </div>
      {data.canComment && <footer className="tk-composer">
        {suggestions.length > 0 && <div className="tk-mentions" role="listbox">{suggestions.map((user) => <button type="button" key={user.id} onClick={() => { setMessage((value) => value.replace(/@[^@\n]*$/, `@${user.name} `)); setSuggestions([]); }}><PersonAvatar size="sm" name={user.name} src={user.avatarDataUrl} /><b>{user.name}</b>{!involvedIds.includes(user.id) && <small>será incluído no chamado</small>}</button>)}</div>}
        <textarea rows={2} value={message} onChange={(event) => type(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSuggestions([]); }} placeholder="Escreva um comentário. Use @ para mencionar e avisar alguém…" />
        <div className="tk-composer-actions">
          <button type="button" className="mt-link" onClick={() => conversationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><MessageSquare />Ver conversa ({ticket.comments.filter((item) => item.kind !== "SYSTEM").length})</button>
          <small>Quem for mencionado recebe um aviso no sino e passa a ver o chamado.</small>
          <button type="button" className="mt-button primary small" disabled={busy || !message.trim()} onClick={() => void run(async () => { await ticketApi(`/tickets/${ticket.id}/comments`, { method: "POST", json: { message } }); setMessage(""); setSuggestions([]); window.setTimeout(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }), 150); })}><Send />Comentar</button>
        </div>
      </footer>}
    </aside>
  </div>;
}

// Quem escreveu edita ou apaga o próprio comentário; quem pode excluir chamados também apaga.
// Registros automáticos e pedidos de ajuste fazem parte do fluxo e não mudam.
export function EditableComment({ ticketId, comment, userId, canDelete, onChange, children }: { ticketId: string; comment: TicketComment; userId: string; canDelete: boolean; onChange: () => unknown; children: ReactNode }) {
  const [draft, setDraft] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const fixed = comment.kind === "SYSTEM" || comment.action === "RETURN", mine = comment.authorId === userId;
  // Só o Master e a Diretoria (canDelete) mexem em mensagens; os demais reenviam.
  const canEdit = !fixed && mine && canDelete, canRemove = !fixed && canDelete;
  const send = async (method: "PATCH" | "DELETE") => {
    if (method === "DELETE" && !await systemConfirm({ title: "Apagar comentário?", message: "O comentário sai da conversa do chamado.", confirmLabel: "Apagar", tone: "danger" })) return;
    setBusy(true); setError("");
    try {
      await ticketApi(`/tickets/${ticketId}/comments/${encodeURIComponent(comment.id)}`, { method, ...(method === "PATCH" ? { json: { message: draft } } : {}) });
      setDraft(null); await onChange();
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  if (draft !== null) return <div className="tk-comment-edit">
    <textarea aria-label="Editar comentário" rows={3} autoFocus value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setDraft(null); if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && draft.trim()) void send("PATCH"); }} />
    {error && <small className="tk-comment-error" role="alert">{error}</small>}
    <div><button type="button" className="mt-button outline small" disabled={busy} onClick={() => setDraft(null)}>Cancelar</button><button type="button" className="mt-button primary small" disabled={busy || !draft.trim()} onClick={() => void send("PATCH")}><Check />Salvar</button></div>
  </div>;
  return <>
    {children}
    {(comment.editedAt || canEdit || canRemove) && <div className="tk-comment-actions">
      {comment.editedAt && <small title={`Editado em ${dateTime(comment.editedAt)}`}>editado</small>}
      {canEdit && <button type="button" disabled={busy} onClick={() => setDraft(comment.message)}><Pencil />Editar</button>}
      {canRemove && <button type="button" className="danger" disabled={busy} onClick={() => void send("DELETE")}><Trash2 />Apagar</button>}
    </div>}
    {error && <small className="tk-comment-error" role="alert">{error}</small>}
  </>;
}

function TicketAttachments({ ticket, canDelete, canUpload, onChange }: { ticket: Ticket; canDelete: boolean; canUpload: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const files = ticket.attachments || [];
  const upload = async (list: FileList | null) => {
    setError("");
    for (const file of Array.from(list || [])) {
      setBusy(`Enviando ${file.name}…`);
      try { await uploadTicketFile(ticket.id, file); } catch (reason) { setError((reason as Error).message); }
    }
    setBusy(""); onChange();
  };
  const remove = async (attachment: TicketAttachment) => {
    if (!await systemConfirm({ title: "Remover anexo?", message: `“${attachment.name}” será apagado do chamado.`, confirmLabel: "Remover", tone: "danger" })) return;
    try { await ticketApi(`/tickets/${ticket.id}/attachments/${attachment.id}`, { method: "DELETE" }); onChange(); } catch (reason) { setError((reason as Error).message); }
  };
  if (!files.length && !canUpload) return null;
  return <section>
    <div className="tk-section-title"><h3>Anexos</h3><span>{files.length}</span>{canUpload && <label className="mt-link tk-attach-link"><Paperclip />Anexar<input type="file" multiple hidden onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} /></label>}</div>
    {busy && <p className="tk-hint">{busy}</p>}
    {error && <p className="mt-alert" role="alert">{error}</p>}
    {files.length ? <div className="tk-files">{files.map((file) => <div key={file.id} className="tk-file">
      <span className="tk-file-icon">{file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span>
      <a href={`/api/tickets/${ticket.id}/attachments/${file.id}/content`} target="_blank" rel="noreferrer"><b>{file.name}</b><small>{fileSize(file.sizeBytes)} · {file.uploadedByName}</small></a>
      <a className="mt-icon-button" href={`/api/tickets/${ticket.id}/attachments/${file.id}/content`} download={file.name} aria-label={`Baixar ${file.name}`}><Download /></a>
      {canDelete && <button type="button" className="mt-icon-button" onClick={() => void remove(file)} aria-label={`Remover ${file.name}`}><Trash2 /></button>}
    </div>)}</div> : <p className="tk-hint">Nenhum arquivo anexado.</p>}
  </section>;
}

// Texto do pedido de ajustes (registros antigos guardavam só a frase, com o pedido entre aspas no fim).
function returnNote(comment: Comment): string | null {
  if (comment.action === "RETURN") return comment.note || "";
  if (comment.kind === "SYSTEM" && comment.message.startsWith("pediu ajustes")) return comment.message.match(/ — “([\s\S]*)”$/)?.[1] || "";
  return null;
}

// Destaca só "@Nome" de pessoas reais (o nome mais longo primeiro), sem engolir o resto da frase.
function highlightMentions(message: string, names: string[]) {
  const escaped = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return message;
  const parts = message.split(new RegExp(`(@(?:${escaped.join("|")}))`, "giu"));
  return <>{parts.map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part)}</>;
}

/* ---------- Setores ---------- */

function DepartmentManager({ departments, onClose, onChange }: { departments: Department[]; onClose: () => void; onChange: () => Promise<void> }) {
  const [error, setError] = useState("");
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    try { await ticketApi("/departments", { method: "POST", json: Object.fromEntries(new FormData(form)) }); form.reset(); setError(""); await onChange(); } catch (reason) { setError((reason as Error).message); }
  };
  const remove = async (id: string) => {
    try { await ticketApi(`/departments/${id}`, { method: "DELETE" }); await onChange(); } catch (reason) { setError((reason as Error).message); }
  };
  return <div className="modal-backdrop">
    <section className="department-modal">
      <header><div><Building2 /><span><h2>Setores de atendimento</h2><p>Organize para onde os chamados podem ser direcionados.</p></span></div><button type="button" onClick={onClose}><X /></button></header>
      <form onSubmit={create}><input name="name" required placeholder="Nome do setor" /><input name="description" placeholder="Descrição breve" /><button className="primary"><Plus /> Adicionar</button></form>
      {error && <div className="form-error">{error}</div>}
      <div className="department-list">{departments.map((item) => <article key={item.id}><span><b>{item.name}</b><small>{item.description || "Sem descrição"} · Responsável: {item.managerName || "não definido"}</small></span><button type="button" onClick={() => void remove(item.id)}><Trash2 /></button></article>)}</div>
    </section>
  </div>;
}
