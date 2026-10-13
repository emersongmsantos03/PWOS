import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bold, Calendar, CalendarCheck, Check, CheckCircle2, ChevronDown, ClipboardList, Clock3, Download, Edit3,
  FileText, Flag, Forward, History, Info, Italic, Link2, List, ListOrdered, MessageSquare, MoreVertical, Paperclip, Pause, Pencil, Play, Plus,
  RotateCcw, Send, ShieldCheck, Square, Trash2, Undo2, Upload, UserRound, X, XCircle,
} from "lucide-react";
import { systemConfirm } from "./SystemDialog";
import { PersonAvatar, dateTime, fileSize, ticketApi, uploadTicketFile, type Ticket, type TicketAttachment, type TicketComment, type TicketsData } from "./TicketsManagement";
import { activeStep, clientJustApproved, isOpenTicket, sentForApproval } from "./marketingTickets";
import { ClientMark, PriorityTag } from "./MarketingBoard";
import { stepRoleLabels, type TicketStep } from "./ticketFlows";
import { formatWorkTime, workElapsed, workStateLabels, type TicketWorkAction } from "./ticketWork";
import "./MarketingBoard.css";
import "./TicketPage.css";

// Página do chamado: cabeçalho, abas (visão geral, arquivos, comentários, histórico, checklist,
// aprovações) e, à direita, as etapas do processo e as informações adicionais. A visão geral
// muda conforme quem olha: quem executa a etapa trabalha nela (iniciar, pausar, finalizar,
// enviar); quem aprova aprova ou devolve; quem entregou acompanha a aprovação.
type SessionUser = { id: string; name: string };
type Tab = "overview" | "files" | "comments" | "history" | "checklist" | "approvals";

const two = (value: number) => String(value).padStart(2, "0");
const day = (value?: string) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const full = (value?: string) => value ? `${day(value)} ${new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "—";
const money = (value?: number) => value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const extension = (name: string) => (name.split(".").pop() || "").slice(0, 4).toUpperCase();
const isImage = (file: TicketAttachment) => file.contentType.startsWith("image/");
const fileUrl = (ticket: Ticket, file: TicketAttachment) => `/api/tickets/${ticket.id}/attachments/${file.id}/content`;
const stepDuration = (step: TicketStep) => {
  const worked = workElapsed(step.work);
  if (worked) return formatWorkTime(worked);
  return step.startedAt && step.completedAt ? formatWorkTime(new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) : "—";
};

export function TicketPage({ user }: { user: SessionUser }) {
  const { id = "" } = useParams(), navigate = useNavigate();
  const [data, setData] = useState<TicketsData | null>(null), [error, setError] = useState(""), [tab, setTab] = useState<Tab>("overview");
  const load = useCallback(() => ticketApi<TicketsData>("/tickets").then((value) => { setData(value); setError(""); }).catch((reason: Error) => setError(reason.message)), []);
  useEffect(() => { void load(); }, [load]);
  // O cronômetro da etapa em produção anda sozinho na tela.
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 30000); return () => window.clearInterval(timer); }, []);
  const ticket = data?.tickets.find((item) => item.id === id);
  if (error && !data) return <div className="tp-page"><p className="mc-alert" role="alert">{error}</p></div>;
  if (!data) return <div className="tp-page"><p className="mc-loading" role="status"><Clock3 />Carregando chamado…</p></div>;
  if (!ticket) return <div className="tp-page"><p className="mc-alert" role="alert">Chamado não encontrado ou sem acesso.</p><NavLink className="mc-link-button" to="/chamados/meus"><ArrowLeft />Voltar para Meus Chamados</NavLink></div>;
  const back = () => window.history.length > 1 ? navigate(-1) : navigate("/chamados/meus");
  return <TicketView key={ticket.id} ticket={ticket} data={data} user={user} tab={tab} setTab={setTab} reload={load} back={back} />;
}

function TicketView({ ticket, data, user, tab, setTab, reload, back }: { ticket: Ticket; data: TicketsData; user: SessionUser; tab: Tab; setTab: (tab: Tab) => void; reload: () => Promise<void>; back: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const steps = ticket.steps || [], step = activeStep(ticket), index = step ? steps.indexOf(step) : -1, next = index >= 0 ? steps[index + 1] : undefined;
  const mine = !!step && step.assigneeId === user.id && ticket.status !== "CLOSED";
  // Agir no lugar de quem está na etapa: líder do setor do chamado ou Diretoria (com permissão de edição).
  const manager = data.canEdit && (!!data.canManageFlows || data.departments.some((item) => item.id === ticket.departmentId && item.managerUserId === user.id));
  const canAct = !!step && ticket.status !== "CLOSED" && (mine || manager);
  const canManage = data.canEdit || ticket.requesterId === user.id;
  const avatar = (userId?: string) => data.availableUsers.find((item) => item.id === userId)?.avatarDataUrl;
  const requester = data.availableUsers.find((item) => item.id === ticket.requesterId);
  const client = data.clients.find((item) => item.id === ticket.clientId);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await action(); await reload(); return true; } catch (reason) { setError((reason as Error).message); return false; } finally { setBusy(false); }
  };
  const work = (action: TicketWorkAction, draft?: string) => run(() => ticketApi(`/tickets/${ticket.id}/work`, { method: "POST", json: { action, draft } }));
  const flow = (action: "COMPLETE" | "RETURN" | "CANCEL" | "REOPEN", note = "") => run(() => ticketApi(`/tickets/${ticket.id}/flow`, { method: "POST", json: { action, note } }));
  const comments = ticket.comments.filter((item) => item.kind !== "SYSTEM");
  const checklist = ticket.checklist || [];
  const badge = headerBadge(ticket, user.id);
  const tabs: { key: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { key: "overview", label: "Visão geral", icon: CalendarCheck },
    { key: "files", label: "Arquivos", icon: FileText, count: ticket.attachments?.length || 0 },
    { key: "comments", label: "Comentários", icon: MessageSquare, count: comments.length },
    { key: "history", label: "Histórico", icon: History },
    { key: "checklist", label: "Checklist", icon: ClipboardList, count: checklist.length ? checklist.filter((item) => item.done).length : undefined },
    { key: "approvals", label: "Aprovações", icon: ShieldCheck },
  ];

  return <div className="tp-page">
    <button type="button" className="tp-back-link" onClick={back}><ArrowLeft />Voltar para Meus Chamados</button>
    <section className="tp-head">
      <div className="tp-title-row">
        <button type="button" className="tp-back" onClick={back} aria-label="Voltar"><ArrowLeft /></button>
        <h1>{ticket.code}</h1><span className={`tp-badge ${badge.tone}`}>{badge.label}</span>
        <MoreActions ticket={ticket} canEdit={data.canEdit} canManage={canManage} canDelete={data.canDelete} busy={busy}
          onEdit={() => navigate(`/chamados/editar/${ticket.id}`)}
          onCancel={async () => { if (await systemConfirm({ title: "Cancelar este chamado?", message: "O fluxo é interrompido e o chamado vai para Concluídos como cancelado. Você pode reabrir depois.", confirmLabel: "Cancelar chamado", tone: "danger" })) void flow("CANCEL"); }}
          onReopen={() => void flow("REOPEN")}
          onDelete={async () => { if (!await systemConfirm({ title: "Excluir este chamado?", message: `O chamado ${ticket.code} e seus anexos serão removidos permanentemente.`, confirmLabel: "Excluir chamado", tone: "danger" })) return; if (await run(() => ticketApi(`/tickets/${ticket.id}`, { method: "DELETE" }))) navigate("/chamados/meus"); }} />
      </div>
      <div className="tp-facts">
        <div className="tp-client"><ClientMark name={ticket.clientName} /><div><b>{ticket.clientName || "Interno"}</b><span>{ticket.title}</span></div></div>
        <div><small>Solicitante</small><span className="tp-person"><PersonAvatar name={ticket.requesterName} src={requester?.avatarDataUrl} /><span><b>{ticket.requesterName}</b><small>{requester?.departmentName || "—"}</small></span></span></div>
        <div><small>Data de abertura</small><b>{day(ticket.createdAt)}</b><b>{new Date(ticket.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b></div>
        <div><small>Prazo final do projeto</small><b className={isOpenTicket(ticket) && ticket.dueAt && new Date(ticket.dueAt) < new Date() ? "late" : ""}>{day(ticket.dueAt)}</b></div>
        <div><small>Prioridade</small><PriorityTag value={ticket.priority} /></div>
        <div><small>Tipo</small><b>{ticket.flowName || "Chamado"}</b></div>
      </div>
    </section>

    <div className="tp-layout">
      <main className="tp-main">
        <nav className="tp-tabs" role="tablist" aria-label="Seções do chamado">{tabs.map((item) => <button type="button" role="tab" key={item.key} aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><item.icon />{item.label}{item.count ? <em>{item.count}</em> : null}</button>)}</nav>
        {error && <p className="mc-alert" role="alert">{error}</p>}
        {tab === "overview" && <Overview ticket={ticket} data={data} user={user} busy={busy} mine={mine} canAct={canAct} next={next} work={work} flow={flow} run={run} reload={reload} avatar={avatar} onHistory={() => setTab("history")} />}
        {tab === "files" && <FilesTab ticket={ticket} canEdit={data.canEdit} userId={user.id} canUpload={data.canCreate || data.canEdit || data.canComment} reload={reload} />}
        {tab === "comments" && <CommentsTab ticket={ticket} data={data} canComment={data.canComment} run={run} avatar={avatar} />}
        {tab === "history" && <HistoryTab ticket={ticket} avatar={avatar} />}
        {tab === "checklist" && <ChecklistTab ticket={ticket} run={run} busy={busy} />}
        {tab === "approvals" && <ApprovalsTab ticket={ticket} />}
      </main>

      <aside className="tp-side">
        {mine && step?.work?.state === "PAUSED" && <div className="tp-paused" role="status"><span><Pause /></span><div><b>Projeto pausado</b><small>O cronômetro está parado e o chamado continua com você. Retome quando puder.</small></div></div>}
        <section className="tp-card">
          <header className="tp-card-head"><span className="mc-card-icon dark"><List /></span><div><h2>Etapas do processo</h2><p>{ticket.flowName || "Chamado"} ({steps.length} {steps.length === 1 ? "etapa" : "etapas"})</p></div></header>
          {steps.length ? <ol className="tp-steps">{steps.map((item, position) => {
            const current = item.status === "ACTIVE" && ticket.status !== "CLOSED";
            const tag = item.status === "DONE" ? "" : current ? (item.role !== "EXECUTOR" ? "Aguardando" : item.work?.state === "RUNNING" ? "Em produção" : item.work?.state === "PAUSED" ? "Pausada" : "Atual") : "Aguardando";
            return <li key={item.id} className={`${item.status.toLowerCase()} ${current ? "current" : ""}`}>
              <i className="tp-step-dot">{item.status === "DONE" ? <Check /> : null}</i>
              <span className="tp-step-number">{two(position + 1)}</span>
              <div><b>{item.name}</b>
                {item.taskId && <NavLink className="tp-step-task" to={`/tarefas?task=${encodeURIComponent(item.taskId)}`}>Creative Ops</NavLink>}
                {item.status === "DONE" && <small>Concluído em {full(item.completedAt)}</small>}
                {current && item.startedAt && <small>Início em {full(item.startedAt)}</small>}
                <small>Responsável: {item.role === "CLIENT" ? `Cliente (registra ${item.assigneeName})` : item.assigneeName}</small>
                {current && item.work && item.work.state !== "NOT_STARTED" && <small className="tp-step-time">Tempo: {formatWorkTime(workElapsed(item.work))}</small>}
                {current && item.adjustment && <small className="tp-step-adjust"><Undo2 />Ajuste solicitado</small>}
              </div>
              {tag && <em className={current ? "current" : ""}>{tag}</em>}
            </li>;
          })}</ol> : <p className="mc-empty">Chamado sem etapas: {ticket.assigneeName || "o responsável"} resolve e conclui.</p>}
        </section>
        <ExtraInfo ticket={ticket} client={client} canEdit={data.canEdit} run={run} />
        {mine && step?.role === "EXECUTOR" && <p className="tp-tip"><Info /><span><b>Dica:</b> finalize a etapa, anexe o que foi produzido e envie{next ? ` para ${next.role === "CLIENT" ? "aprovação do cliente" : next.assigneeName}` : ""}. O chamado segue automaticamente para a próxima etapa.</span></p>}
      </aside>
    </div>
  </div>;
}

function headerBadge(ticket: Ticket, userId: string): { label: string; tone: string } {
  if (ticket.status === "CLOSED") return { label: "Cancelado", tone: "gray" };
  if (ticket.status === "RESOLVED") return { label: "Concluído", tone: "green" };
  const step = activeStep(ticket);
  if (!step) return { label: "Em andamento", tone: "blue" };
  if (sentForApproval(ticket, userId)) return { label: "Etapa enviada para aprovação", tone: "green" };
  if (step.role === "CLIENT") return { label: "Aguardando cliente", tone: "purple" };
  if (step.role === "APPROVER") return { label: "Aguardando aprovação", tone: "yellow" };
  if (step.adjustment && step.work?.state !== "RUNNING") return { label: "Ajuste solicitado", tone: "red" };
  if (clientJustApproved(ticket)) return { label: "Aprovado pelo cliente", tone: "green" };
  return { label: step.work?.state === "RUNNING" ? "Em produção" : step.work?.state === "PAUSED" ? "Pausado" : step.work?.state === "FINISHED" ? "Pronto para enviar" : "Em andamento", tone: step.work?.state === "PAUSED" ? "orange" : "blue" };
}

function MoreActions({ ticket, canEdit, canManage, canDelete, busy, onEdit, onCancel, onReopen, onDelete }: { ticket: Ticket; canEdit: boolean; canManage: boolean; canDelete: boolean; busy: boolean; onEdit: () => void; onCancel: () => void; onReopen: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false), ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const item = (label: string, icon: ReactNode, action: () => void, danger = false) => <button type="button" role="menuitem" className={danger ? "danger" : ""} disabled={busy} onClick={() => { setOpen(false); action(); }}>{icon}{label}</button>;
  return <div className="tp-more" ref={ref}>
    <button type="button" className="tp-more-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Mais ações<MoreVertical /></button>
    {open && <div className="mc-menu" role="menu">
      {item("Copiar link", <Link2 />, () => void navigator.clipboard?.writeText(window.location.href))}
      {canEdit && item("Editar chamado", <Edit3 />, onEdit)}
      {canManage && isOpenTicket(ticket) && item("Cancelar chamado", <XCircle />, onCancel, true)}
      {canManage && !isOpenTicket(ticket) && item("Reabrir chamado", <RotateCcw />, onReopen)}
      {canDelete && item("Excluir chamado", <Trash2 />, onDelete, true)}
    </div>}
  </div>;
}

/* ---------- Visão geral ---------- */

type OverviewProps = {
  ticket: Ticket; data: TicketsData; user: SessionUser; busy: boolean; mine: boolean; canAct: boolean; next?: TicketStep;
  work: (action: TicketWorkAction, draft?: string) => Promise<boolean>; flow: (action: "COMPLETE" | "RETURN" | "CANCEL" | "REOPEN", note?: string) => Promise<boolean>;
  run: (action: () => Promise<unknown>) => Promise<boolean>; reload: () => Promise<void>; avatar: (id?: string) => string | undefined; onHistory: () => void;
};

function Overview(props: OverviewProps) {
  const { ticket, user, mine, canAct, flow, busy } = props;
  // A gestão pode agir por quem está na etapa, mas só quando escolhe fazer isso.
  const [asManager, setAsManager] = useState(false);
  const steps = ticket.steps || [], step = activeStep(ticket);
  if (ticket.status === "CLOSED") return <><Banner tone="gray" icon={<XCircle />} title="Chamado cancelado" text="O fluxo foi interrompido. Quem abriu o chamado ou a gestão pode reabrir em “Mais ações”." /><Briefing ticket={ticket} /></>;
  if (ticket.status === "RESOLVED") return <><Banner tone="green" icon={<CheckCircle2 />} title="Chamado concluído" text={`Todas as etapas foram finalizadas${steps.at(-1)?.completedAt ? ` em ${full(steps.at(-1)?.completedAt)}` : ""}.`} /><Delivered {...props} /><Briefing ticket={ticket} /></>;
  if (!steps.length) return <>
    <section className="tp-card"><header className="tp-card-head"><span className="mc-card-icon blue"><UserRound /></span><div><h2>Atendimento</h2><p>Com {ticket.assigneeId === user.id ? "você" : ticket.assigneeName} · prazo {dateTime(ticket.dueAt)}</p></div></header>
      {(ticket.assigneeId === user.id || props.data.canEdit) && <div className="tp-send"><button type="button" className="tp-send-button" disabled={busy} onClick={() => void flow("COMPLETE")}><Check />Concluir chamado</button></div>}
    </section><Briefing ticket={ticket} /><ReceivedFiles ticket={ticket} exclude="" />
  </>;
  const acting = mine || (canAct && asManager);
  if (step && step.role === "EXECUTOR" && acting) return <ExecutorView {...props} step={step} />;
  if (step && step.role !== "EXECUTOR" && acting) return <ApproverView {...props} step={step} />;
  // Quem só acompanha: entregou e espera aprovação, ou observa o andamento.
  return <><SentBanner {...props} />
    {canAct && step && <p className="tp-manager"><ShieldCheck /><span>Esta etapa está com <b>{step.assigneeName}</b>. Como gestão, você pode agir no lugar da pessoa.</span><button type="button" className="mc-link-button" onClick={() => setAsManager(true)}>Agir pela gestão<ArrowRight /></button></p>}
    <Delivered {...props} /><Briefing ticket={ticket} /><ReceivedFiles ticket={ticket} exclude="" /></>;
}

function Banner({ tone, icon, title, text, side, action }: { tone: string; icon: ReactNode; title: string; text: ReactNode; side?: ReactNode; action?: ReactNode }) {
  return <section className={`tp-banner ${tone}`}><span className="tp-banner-icon">{icon}</span><div><h2>{title}</h2><p>{text}</p></div>{side && <aside>{side}</aside>}{action}</section>;
}

// Quem acompanha (normalmente quem entregou a etapa anterior): onde o chamado está agora.
function SentBanner({ ticket, user, onHistory }: OverviewProps) {
  const steps = ticket.steps || [], step = activeStep(ticket);
  if (!step) return null;
  const index = steps.indexOf(step), previous = steps[index - 1];
  if (sentForApproval(ticket, user.id) && previous) {
    const to = step.role === "CLIENT" ? "o cliente" : step.assigneeName;
    return <Banner tone="green" icon={<Check />} title={`${previous.name} enviado para aprovação!`}
      text={<>A etapa {two(index)} – {previous.name} foi concluída e enviada para {to} em {full(previous.completedAt)}.<br />Agora o chamado segue para a próxima etapa: <b>{two(index + 1)}. {step.name}</b>.</>}
      action={<button type="button" className="mc-link-button" onClick={onHistory}>Ver histórico do chamado<ArrowRight /></button>} />;
  }
  return <Banner tone="blue" icon={<Clock3 />} title={`Etapa ${two(index + 1)} – ${step.name}`}
    text={<>Com {step.role === "CLIENT" ? `o cliente (registro por ${step.assigneeName})` : step.assigneeName} desde {full(step.startedAt)} · prazo {full(step.dueAt)}{step.work && step.work.state !== "NOT_STARTED" ? ` · ${workStateLabels[step.work.state].toLowerCase()} · ${formatWorkTime(workElapsed(step.work))}` : ""}.</>}
    action={<button type="button" className="mc-link-button" onClick={onHistory}>Ver histórico<ArrowRight /></button>} />;
}

// A última etapa que a pessoa executou: tempos, arquivos entregues, comentário e próxima etapa.
function Delivered({ ticket, user, avatar }: OverviewProps) {
  const steps = ticket.steps || [];
  const done = [...steps].reverse().find((item) => item.status === "DONE" && item.role === "EXECUTOR" && item.assigneeId === user.id)
    || (ticket.status === "RESOLVED" ? [...steps].reverse().find((item) => item.role === "EXECUTOR") : undefined);
  if (!done) return null;
  const position = steps.indexOf(done), files = (ticket.attachments || []).filter((file) => file.stepId === done.id);
  const comment = [...ticket.comments].reverse().find((item) => item.stepId === done.id && item.delivery);
  const current = activeStep(ticket);
  return <>
    <section className="tp-card">
      <header className="tp-card-head"><span className="mc-card-icon blue"><Upload /></span><div><h2>{done.assigneeId === user.id ? "Minha etapa" : "Etapa entregue"} – {done.name}</h2></div><span className="mc-pill green"><CheckCircle2 />Concluída</span></header>
      <div className="tp-step-summary">
        <StepRing position={position + 1} total={steps.length} />
        <div><h3>{done.name}</h3><p>{stepRoleLabels[done.role]} · {ticket.flowName || "Chamado"}</p>
          <div className="tp-meta-grid">
            <Meta icon={<Calendar />} label="Início da etapa" value={full(done.work?.firstStartedAt || done.startedAt)} />
            <Meta icon={<CalendarCheck />} label="Conclusão da etapa" value={full(done.completedAt)} />
            <Meta icon={<Clock3 />} label="Tempo de execução" value={stepDuration(done)} />
            <Meta icon={<UserRound />} label="Responsável" value={done.assigneeName} />
          </div>
        </div>
      </div>
    </section>
    <div className="tp-grid two">
      <section className="tp-card"><header className="tp-card-head"><span className="mc-card-icon blue"><Paperclip /></span><div><h2>Arquivos entregues nesta etapa</h2></div><span className="mc-pill green">{files.length} {files.length === 1 ? "arquivo" : "arquivos"}</span></header>
        {files.length ? <FileList ticket={ticket} files={files} /> : <p className="mc-empty">Nenhum arquivo anexado nesta etapa.</p>}</section>
      <section className="tp-card"><header className="tp-card-head"><PersonAvatar name={done.assigneeName} src={avatar(done.assigneeId)} /><div><h2>{done.assigneeId === user.id ? "Meu comentário na entrega" : "Comentário na entrega"}</h2></div></header>
        {comment ? <><p className="tp-delivery-note">{comment.message}</p><small className="tp-muted-right">Enviado em {full(comment.createdAt)}</small></> : <p className="mc-empty">Entregue sem comentário.</p>}</section>
    </div>
    {current && <section className="tp-card tp-next"><header className="tp-card-head"><span className="mc-card-icon yellow"><Forward /></span><div><h2>Próxima etapa</h2></div></header>
      <h3>{two(steps.indexOf(current) + 1)}. {current.name}</h3>
      <span className="tp-person"><PersonAvatar name={current.assigneeName} src={avatar(current.assigneeId)} /><span>Responsável: <b>{current.role === "CLIENT" ? `Cliente (registro por ${current.assigneeName})` : current.assigneeName}</b></span></span>
      <p className="tp-next-note"><Clock3 />{current.work?.state === "RUNNING" ? "Etapa em produção." : "Aguardando início desta etapa."} Você será notificado em caso de retorno.</p>
    </section>}
  </>;
}

function StepRing({ position, total }: { position: number; total: number }) {
  return <div className="tp-ring" style={{ "--progress": `${total ? (position / total) * 100 : 0}%` } as CSSProperties}><span><small>Etapa</small><b>{two(position)}<em>/{two(total)}</em></b></span></div>;
}
const Meta = ({ icon, label, value, tone = "" }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) =>
  <div className={`tp-meta ${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>;

/* Quem executa a etapa ativa: briefing, cronômetro, andamento, anexos e envio. */
function ExecutorView({ ticket, user, busy, next, work, flow, run, reload, step, avatar }: OverviewProps & { step: TicketStep }) {
  const steps = ticket.steps || [], position = steps.indexOf(step), state = step.work?.state || "NOT_STARTED";
  const [text, setText] = useState(step.work?.draft || ""), [savedAt, setSavedAt] = useState(""), [uploading, setUploading] = useState(""), [uploadError, setUploadError] = useState("");
  const previous = steps[position - 1];
  const stepFiles = (ticket.attachments || []).filter((file) => file.stepId === step.id);
  const lastNote = [...ticket.comments].reverse().find((item) => item.stepId === step.id && !item.delivery);
  const upload = async (list: FileList | File[] | null) => {
    setUploadError("");
    for (const file of Array.from(list || [])) {
      setUploading(file.name);
      try { await uploadTicketFile(ticket.id, file, step.id); } catch (reason) { setUploadError((reason as Error).message); }
    }
    setUploading(""); await reload();
  };
  const sendLabel = !next ? "Concluir chamado" : next.assigneeId === user.id && next.role !== "CLIENT" ? `Enviar para ${next.name} (você)` : next.role === "CLIENT" ? "Enviar para aprovação do cliente" : next.role === "APPROVER" ? `Enviar para aprovação de ${next.assigneeName.split(" ")[0]}` : `Enviar para ${next.assigneeName.split(" ")[0]} (${next.name})`;
  const send = async () => {
    if (!await systemConfirm({ title: `${sendLabel}?`, message: next ? `A etapa “${step.name}” será concluída e o chamado segue para “${next.name}”${next.role === "CLIENT" ? "" : ` com ${next.assigneeName}`}.` : "Esta é a última etapa: o chamado será concluído.", confirmLabel: next ? "Enviar" : "Concluir" })) return;
    if (await flow("COMPLETE", text)) setText("");
  };
  const status = (value: string) => {
    if (value === state) return;
    if (value === "RUNNING") void work(state === "NOT_STARTED" ? "START" : state === "FINISHED" ? "REOPEN" : "RESUME").then((ok) => { if (ok && state === "FINISHED") void work("RESUME"); });
    if (value === "PAUSED") void work(state === "FINISHED" ? "REOPEN" : "PAUSE");
    if (value === "FINISHED") void work("FINISH");
  };
  const mainCard = <section className="tp-card tp-my-step">
    <header className="tp-card-head"><span className="mc-card-icon blue"><Upload /></span><div><h2>Minha etapa – {step.name}</h2>{step.taskId && <NavLink className="tp-creative-link" to={`/tarefas?task=${encodeURIComponent(step.taskId)}`}><Link2 />Demanda no Creative Ops</NavLink>}</div>
      {state !== "NOT_STARTED" && <label className={`tp-state-select ${state.toLowerCase()}`}><small>Status da etapa</small><span><i />{workStateLabels[state] === "Em produção" ? "Em produção" : workStateLabels[state]}<ChevronDown /></span>
        <select value={state} disabled={busy} onChange={(event) => status(event.target.value)} aria-label="Status da etapa"><option value="RUNNING">Em produção</option><option value="PAUSED">Pausada</option><option value="FINISHED">Finalizada</option></select></label>}
    </header>
    <div className="tp-step-summary">
      <StepRing position={position + 1} total={steps.length} />
      <div><h3>{step.name}</h3><p>{stepRoleLabels[step.role]} · {ticket.flowName || "Chamado"}{previous ? ` · depois de “${previous.name}”` : ""}</p>
        <div className="tp-meta-grid">
          <Meta icon={<Calendar />} label="Início da etapa" value={step.work?.firstStartedAt ? full(step.work.firstStartedAt) : "—"} />
          <Meta icon={<Flag />} label="Prazo desta etapa" value={full(step.dueAt)} tone={new Date(step.dueAt) < new Date() ? "late" : "warn"} />
          <Meta icon={<Clock3 />} label={state === "RUNNING" ? "Tempo em produção" : "Tempo nesta etapa"} value={formatWorkTime(workElapsed(step.work))} />
          <Meta icon={<UserRound />} label="Responsável atual" value={step.assigneeName} />
        </div>
      </div>
    </div>
    {state === "NOT_STARTED" && <button type="button" className="tp-start" disabled={busy} onClick={() => void work("START")}><Play /><span><b>{step.adjustment ? "Iniciar ajustes" : "Iniciar produção"}</b><small>Clique para começar a trabalhar nesta etapa</small></span></button>}
    {state !== "NOT_STARTED" && <div className="tp-work-actions">
      <button type="button" className="green" disabled={busy || state === "RUNNING"} onClick={() => void work(state === "FINISHED" ? "REOPEN" : "RESUME").then((ok) => { if (ok && state === "FINISHED") void work("RESUME"); })}><Play /><span><b>{state === "FINISHED" ? "Reabrir produção" : "Continuar produção"}</b><small>Retoma o cronômetro da etapa</small></span></button>
      <button type="button" className="orange" disabled={busy || state !== "RUNNING"} onClick={() => void work("PAUSE")}><Pause /><span><b>Pausar projeto</b><small>Mantém a etapa em pausa com você</small></span></button>
      <button type="button" className="red" disabled={busy || state === "FINISHED"} onClick={() => void work("FINISH")}><Square /><span><b>Finalizar etapa</b><small>Conclui e libera o envio</small></span></button>
    </div>}
  </section>;
  return <>
    {clientJustApproved(ticket) && previous && <Banner tone="green" icon={<Check />} title="Aprovado pelo cliente" text={`O cliente aprovou e o chamado segue para ${step.name}.`} side={<><CheckCircle2 /><span>Aprovado em<br /><b>{full(previous.completedAt)}</b><br />por {previous.completedByName || previous.assigneeName}</span></>} />}
    {step.adjustment && <Banner tone="red" icon={<Undo2 />} title="Ajustes solicitados" text={<><b>{step.adjustment.byName}</b> devolveu de “{step.adjustment.fromStepName}” em {full(step.adjustment.at)}: “{step.adjustment.note}”</>} />}
    {state !== "NOT_STARTED" && mainCard}
    <div className="tp-grid two"><Briefing ticket={ticket} /><ReceivedFiles ticket={ticket} exclude={step.id} /></div>
    {state === "NOT_STARTED" && mainCard}
    <section className="tp-card tp-work-bottom">
      <div className="tp-grid two flat">
        <div className="tp-note">
          <h3><PersonAvatar size="sm" name={step.assigneeName} src={avatar(step.assigneeId)} />Meu andamento (comentário interno)</h3>
          <RichText value={text} onChange={setText} disabled={busy} placeholder={"Registre seu andamento, dúvidas ou observações…\nEsse comentário fica no histórico do chamado."} onSave={() => void run(async () => { await ticketApi(`/tickets/${ticket.id}/comments`, { method: "POST", json: { message: text, stepId: step.id } }); setText(""); })} />
          <small className="tp-muted-right">{savedAt ? `Rascunho salvo às ${savedAt}` : lastNote ? `Última atualização: ${full(lastNote.createdAt)}` : "O texto que estiver aqui ao enviar vai junto como comentário da entrega."}</small>
        </div>
        <div className="tp-attach">
          <h3>Anexar arquivos da etapa</h3>
          <div className="tp-thumbs">{stepFiles.map((file) => <div key={file.id} className="tp-thumb">
            <a href={fileUrl(ticket, file)} target="_blank" rel="noreferrer">{isImage(file) ? <img src={fileUrl(ticket, file)} alt="" /> : <span>{extension(file.name)}</span>}</a>
            <b title={file.name}>{file.name}</b><small>{fileSize(file.sizeBytes)}</small>
            <button type="button" aria-label={`Remover ${file.name}`} onClick={async () => { if (await systemConfirm({ title: "Remover anexo?", message: `“${file.name}” será apagado do chamado.`, confirmLabel: "Remover", tone: "danger" })) void run(() => ticketApi(`/tickets/${ticket.id}/attachments/${file.id}`, { method: "DELETE" })); }}><X /></button>
          </div>)}
            <DropZone compact={stepFiles.length > 0} busy={uploading} onFiles={(files) => void upload(files)} />
          </div>
          {uploadError && <p className="mc-alert" role="alert">{uploadError}</p>}
        </div>
      </div>
      <footer className="tp-send">
        <button type="button" className="tp-draft" disabled={busy} onClick={() => void work("DRAFT", text).then((ok) => { if (ok) setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })); })}><CalendarCheck />Salvar rascunho</button>
        <div><button type="button" className="tp-send-button" disabled={busy || state !== "FINISHED"} onClick={() => void send()}><Send />{sendLabel}</button>
          <small>{state === "FINISHED" ? stepFiles.length ? "Tudo pronto: envie para a próxima etapa." : "Etapa finalizada. Anexe o que foi produzido, se houver, e envie." : "Finalize a etapa e anexe o que foi produzido para enviar."}</small></div>
      </footer>
    </section>
  </>;
}

/* Quem aprova (interna) ou registra a aprovação do cliente. */
function ApproverView({ ticket, busy, next, flow, step, avatar, user }: OverviewProps & { step: TicketStep }) {
  const steps = ticket.steps || [], position = steps.indexOf(step);
  const delivered = [...steps.slice(0, position)].reverse().find((item) => item.role === "EXECUTOR");
  const files = delivered ? (ticket.attachments || []).filter((file) => file.stepId === delivered.id) : [];
  const comment = delivered ? [...ticket.comments].reverse().find((item) => item.stepId === delivered.id && item.delivery) : undefined;
  const [returning, setReturning] = useState(false), [note, setNote] = useState("");
  const isClient = step.role === "CLIENT", previous = steps[position - 1];
  const approve = async () => {
    if (!await systemConfirm({ title: isClient ? "Registrar aprovação do cliente?" : "Aprovar esta entrega?", message: next ? `O chamado segue para “${next.name}” com ${next.assigneeName}.` : "Esta é a última etapa: o chamado será concluído.", confirmLabel: isClient ? "Cliente aprovou" : "Aprovar" })) return;
    void flow("COMPLETE");
  };
  return <>
    <Banner tone={isClient ? "purple" : "yellow"} icon={<ShieldCheck />} title={isClient ? "Aguardando aprovação do cliente" : `Entrega para ${step.assigneeId === user.id ? "sua aprovação" : `aprovação de ${step.assigneeName}`}`}
      text={<>{previous ? <>“{previous.name}” foi entregue por <b>{previous.completedByName || previous.assigneeName}</b> em {full(previous.completedAt)}. </> : null}{isClient ? "Registre aqui a resposta do cliente." : "Revise os arquivos e aprove ou peça ajustes."} Prazo: {full(step.dueAt)}.</>} />
    <section className="tp-card">
      <header className="tp-card-head"><span className="mc-card-icon yellow"><ShieldCheck /></span><div><h2>{step.name}</h2><p>Etapa {position + 1} de {steps.length} · {stepRoleLabels[step.role]}</p></div></header>
      {!returning ? <div className="tp-approve-actions">
        <button type="button" className="tp-send-button green" disabled={busy} onClick={() => void approve()}><Check />{isClient ? "Cliente aprovou" : "Aprovar"}{next ? ` e enviar para ${next.name}` : " e concluir"}</button>
        <button type="button" className="tp-draft" disabled={busy} onClick={() => setReturning(true)}><Undo2 />{isClient ? "Cliente pediu ajustes" : "Solicitar ajustes"}</button>
      </div> : <div className="tp-return">
        <label>O que precisa ser ajustado? <em>*</em><textarea autoFocus rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva os ajustes. O chamado volta para a etapa anterior." /></label>
        <div><button type="button" className="tp-draft" onClick={() => { setReturning(false); setNote(""); }}>Voltar</button><button type="button" className="tp-send-button red" disabled={busy || !note.trim()} onClick={() => void flow("RETURN", note)}><Undo2 />Devolver para {previous?.assigneeName}</button></div>
      </div>}
    </section>
    <div className="tp-grid two">
      <section className="tp-card"><header className="tp-card-head"><span className="mc-card-icon blue"><Paperclip /></span><div><h2>Arquivos entregues</h2><p>{delivered ? `Etapa “${delivered.name}”` : "—"}</p></div></header>
        {files.length ? <FileList ticket={ticket} files={files} /> : <p className="mc-empty">Nenhum arquivo anexado na entrega.</p>}</section>
      <section className="tp-card"><header className="tp-card-head">{delivered && <PersonAvatar name={delivered.assigneeName} src={avatar(delivered.assigneeId)} />}<div><h2>Comentário na entrega</h2></div></header>
        {comment ? <><p className="tp-delivery-note">{comment.message}</p><small className="tp-muted-right">Enviado em {full(comment.createdAt)}</small></> : <p className="mc-empty">Entregue sem comentário.</p>}</section>
    </div>
    <Briefing ticket={ticket} />
  </>;
}

/* ---------- Briefing e arquivos ---------- */

function Briefing({ ticket }: { ticket: Ticket }) {
  const lines = (ticket.description || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => /^[-•*]\s+/.test(line)).map((line) => line.replace(/^[-•*]\s+/, ""));
  const text = lines.filter((line) => !/^[-•*]\s+/.test(line));
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><FileText /></span><div><h2>Descrição do projeto / Briefing</h2></div></header>
    {text.length ? text.map((line, index) => <p className="tp-text" key={index}>{line}</p>) : !bullets.length && <p className="mc-empty">Nenhuma descrição informada.</p>}
    {bullets.length > 0 && <div className="tp-points"><b>Pontos principais:</b><ul>{bullets.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    {ticket.notes && <p className="tp-text muted"><b>Observações:</b> {ticket.notes}</p>}
  </section>;
}

function ReceivedFiles({ ticket, exclude }: { ticket: Ticket; exclude: string }) {
  const files = (ticket.attachments || []).filter((file) => file.stepId !== exclude || !exclude);
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><Paperclip /></span><div><h2>Arquivos recebidos</h2></div>{files.length > 1 && <a className="mc-link-button" href={`/api/tickets/${ticket.id}/attachments/${files[0].id}/content`} onClick={(event) => { event.preventDefault(); files.forEach((file, index) => window.setTimeout(() => { const link = document.createElement("a"); link.href = fileUrl(ticket, file); link.download = file.name; link.click(); }, index * 300)); }}><Download />Baixar todos</a>}</header>
    {files.length ? <FileList ticket={ticket} files={files} /> : <p className="mc-empty">Nenhum arquivo recebido.</p>}
  </section>;
}

function FileList({ ticket, files, onRemove, canRemove }: { ticket: Ticket; files: TicketAttachment[]; onRemove?: (file: TicketAttachment) => void; canRemove?: (file: TicketAttachment) => boolean }) {
  return <ul className="tp-files">{files.map((file) => <li key={file.id}>
    <span className={`tp-file-icon ${extension(file.name).toLowerCase()}`}>{extension(file.name) || "ARQ"}</span>
    <a href={fileUrl(ticket, file)} target="_blank" rel="noreferrer"><b title={file.name}>{file.name}</b><small>{extension(file.name) || "Arquivo"} • {fileSize(file.sizeBytes)} • {file.uploadedByName}</small></a>
    <a className="mc-icon-button bordered" href={fileUrl(ticket, file)} download={file.name} aria-label={`Baixar ${file.name}`}><Download /></a>
    {onRemove && (!canRemove || canRemove(file)) && <button type="button" className="mc-icon-button bordered" onClick={() => onRemove(file)} aria-label={`Remover ${file.name}`}><Trash2 /></button>}
  </li>)}</ul>;
}

function DropZone({ onFiles, busy, compact = false }: { onFiles: (files: File[]) => void; busy: string; compact?: boolean }) {
  const [over, setOver] = useState(false), input = useRef<HTMLInputElement>(null);
  return <div className={`tp-drop ${over ? "over" : ""} ${compact ? "compact" : ""}`} role="button" tabIndex={0}
    onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.current?.click(); } }}
    onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
    onDrop={(event) => { event.preventDefault(); setOver(false); onFiles(Array.from(event.dataTransfer.files)); }}>
    <Upload />{busy ? <b>Enviando {busy}…</b> : compact ? <b>Adicionar mais arquivos</b> : <b>Arraste os arquivos aqui<br />ou clique para selecionar</b>}<small>PDF, PNG, JPG, ZIP até 500 MB</small>
    <input ref={input} type="file" multiple hidden onChange={(event) => { onFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
  </div>;
}

// Campo de texto com atalhos de formatação simples (o texto fica em markdown leve).
function RichText({ value, onChange, onSave, disabled, placeholder }: { value: string; onChange: (value: string) => void; onSave: () => void; disabled: boolean; placeholder: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const wrap = (before: string, after = before) => {
    const element = area.current; if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    onChange(`${value.slice(0, start)}${before}${value.slice(start, end)}${after}${value.slice(end)}`);
    window.setTimeout(() => { element.focus(); element.setSelectionRange(start + before.length, end + before.length); });
  };
  const prefix = (marker: (index: number) => string) => {
    const element = area.current; if (!element) return;
    const start = value.lastIndexOf("\n", element.selectionStart - 1) + 1, end = element.selectionEnd;
    const block = value.slice(start, end).split("\n").map((line, index) => `${marker(index)}${line}`).join("\n");
    onChange(`${value.slice(0, start)}${block}${value.slice(end)}`);
  };
  return <div className="tp-rich">
    <textarea ref={area} rows={4} value={value} maxLength={2000} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    <div className="tp-rich-tools">
      <button type="button" aria-label="Negrito" onClick={() => wrap("**")}><Bold /></button>
      <button type="button" aria-label="Itálico" onClick={() => wrap("_")}><Italic /></button>
      <button type="button" aria-label="Lista" onClick={() => prefix(() => "• ")}><List /></button>
      <button type="button" aria-label="Lista numerada" onClick={() => prefix((index) => `${index + 1}. `)}><ListOrdered /></button>
      <button type="button" aria-label="Link" onClick={() => wrap("[", "](https://)")}><Link2 /></button>
      <button type="button" className="tp-save" disabled={disabled || !value.trim()} onClick={onSave}>Salvar</button>
    </div>
  </div>;
}

/* ---------- Informações adicionais ---------- */

function ExtraInfo({ ticket, client, canEdit, run }: { ticket: Ticket; client?: TicketsData["clients"][number]; canEdit: boolean; run: (action: () => Promise<unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false), [value, setValue] = useState(ticket.projectValue ? String(ticket.projectValue).replace(".", ",") : ""), [notes, setNotes] = useState(ticket.notes || "");
  const save = async () => { if (await run(() => ticketApi(`/tickets/${ticket.id}`, { method: "PATCH", json: { projectValue: value, notes } }))) setEditing(false); };
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><Info /></span><div><h2>Informações adicionais</h2></div>{canEdit && !editing && <button type="button" className="mc-link-button" onClick={() => setEditing(true)}><Pencil />Editar</button>}</header>
    <dl className="tp-info">
      <dt>Cliente</dt><dd><span className="tp-inline"><ClientMark name={ticket.clientName} />{ticket.clientName || "Interno"}</span></dd>
      <dt>Contato</dt><dd>{client?.contactName || client?.contactPhone || client?.contactEmail ? <><b>{client.contactName || "—"}</b><small>{[client.contactPhone, client.contactEmail].filter(Boolean).join(" | ")}</small></> : "—"}</dd>
      <dt>Categoria</dt><dd>{ticket.flowName || "Chamado"}</dd>
      <dt>Valor do projeto</dt><dd>{editing ? <input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0,00" aria-label="Valor do projeto" /> : <b>{money(ticket.projectValue)}</b>}</dd>
      <dt>Observações</dt><dd>{editing ? <textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Observações" /> : ticket.notes || "—"}</dd>
    </dl>
    {editing && <div className="tp-info-actions"><button type="button" className="tp-draft" onClick={() => { setEditing(false); setValue(ticket.projectValue ? String(ticket.projectValue).replace(".", ",") : ""); setNotes(ticket.notes || ""); }}>Cancelar</button><button type="button" className="tp-send-button" onClick={() => void save()}><Check />Salvar</button></div>}
  </section>;
}

/* ---------- Abas ---------- */

function FilesTab({ ticket, canEdit, userId, canUpload, reload }: { ticket: Ticket; canEdit: boolean; userId: string; canUpload: boolean; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const steps = ticket.steps || [], files = ticket.attachments || [];
  const groups = [{ id: "", name: "Abertura do chamado" }, ...steps.map((step) => ({ id: step.id, name: step.name }))]
    .map((group) => ({ ...group, files: files.filter((file) => (file.stepId || "") === group.id) })).filter((group) => group.files.length);
  const upload = async (list: File[]) => {
    setError("");
    for (const file of list) { setBusy(file.name); try { await uploadTicketFile(ticket.id, file, activeStep(ticket)?.id); } catch (reason) { setError((reason as Error).message); } }
    setBusy(""); await reload();
  };
  const remove = async (file: TicketAttachment) => {
    if (!await systemConfirm({ title: "Remover anexo?", message: `“${file.name}” será apagado do chamado.`, confirmLabel: "Remover", tone: "danger" })) return;
    try { await ticketApi(`/tickets/${ticket.id}/attachments/${file.id}`, { method: "DELETE" }); await reload(); } catch (reason) { setError((reason as Error).message); }
  };
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><Paperclip /></span><div><h2>Arquivos</h2><p>{files.length} de 20 anexos · agrupados pela etapa em que foram enviados</p></div></header>
    {error && <p className="mc-alert" role="alert">{error}</p>}
    {groups.length ? groups.map((group) => <div key={group.id || "start"} className="tp-file-group"><h3>{group.name}</h3><FileList ticket={ticket} files={group.files} onRemove={(file) => void remove(file)} canRemove={(file) => canEdit || file.uploadedById === userId} /></div>) : <p className="mc-empty">Nenhum arquivo anexado.</p>}
    {canUpload && <DropZone busy={busy} onFiles={(list) => void upload(list)} />}
  </section>;
}

function CommentsTab({ ticket, data, canComment, run, avatar }: { ticket: Ticket; data: TicketsData; canComment: boolean; run: (action: () => Promise<unknown>) => Promise<boolean>; avatar: (id?: string) => string | undefined }) {
  const [message, setMessage] = useState("");
  const comments = ticket.comments.filter((item) => item.kind !== "SYSTEM");
  const stepName = (comment: TicketComment) => ticket.steps?.find((step) => step.id === comment.stepId)?.name;
  const mentionable = useMemo(() => {
    const match = message.match(/(?:^|\s)@([^@\n]*)$/);
    return match ? data.availableUsers.filter((item) => item.name.toLowerCase().includes(match[1].toLowerCase())).slice(0, 5) : [];
  }, [message, data.availableUsers]);
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><MessageSquare /></span><div><h2>Comentários</h2><p>Use @ para mencionar alguém da equipe: a pessoa recebe um aviso e passa a ver o chamado.</p></div></header>
    {comments.length ? <ul className="tp-comments">{comments.map((item) => <li key={item.id} className={item.action === "RETURN" ? "adjust" : item.delivery ? "delivery" : ""}>
      <PersonAvatar size="sm" name={item.authorName} src={avatar(item.authorId)} />
      <div><header><b>{item.authorName}</b>{item.delivery && <em className="mc-pill green">Entrega</em>}{stepName(item) && <small>{stepName(item)}</small>}<time>{full(item.createdAt)}</time></header><p>{item.message}</p></div>
    </li>)}</ul> : <p className="mc-empty">Nenhum comentário ainda.</p>}
    {canComment && <div className="tp-composer">
      {mentionable.length > 0 && <div className="tp-mentions">{mentionable.map((person) => <button type="button" key={person.id} onClick={() => setMessage((value) => value.replace(/@[^@\n]*$/, `@${person.name} `))}><PersonAvatar size="sm" name={person.name} src={person.avatarDataUrl} />{person.name}</button>)}</div>}
      <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva um comentário…" />
      <button type="button" className="tp-send-button" disabled={!message.trim()} onClick={() => void run(async () => { await ticketApi(`/tickets/${ticket.id}/comments`, { method: "POST", json: { message } }); setMessage(""); })}><Send />Comentar</button>
    </div>}
  </section>;
}

function HistoryTab({ ticket, avatar }: { ticket: Ticket; avatar: (id?: string) => string | undefined }) {
  const items = [...ticket.comments].reverse();
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><History /></span><div><h2>Histórico do chamado</h2><p>Tudo o que aconteceu, do mais recente ao mais antigo.</p></div></header>
    <ol className="tp-history">
      {items.map((item) => <li key={item.id} className={item.action === "RETURN" ? "adjust" : item.kind === "SYSTEM" ? "system" : "comment"}>
        <span className="tp-history-dot">{item.action === "RETURN" ? <Undo2 /> : item.kind === "SYSTEM" ? <Check /> : <MessageSquare />}</span>
        <div><b>{item.action === "RETURN" ? "Ajustes solicitados" : item.kind === "SYSTEM" ? item.message.replace(/ — “[\s\S]*”$/, "") : item.delivery ? "Comentário na entrega" : "Comentário"}</b>
          <time>{full(item.createdAt)}</time>
          {item.kind !== "SYSTEM" && <p>{item.message}</p>}{item.action === "RETURN" && item.note && <p>“{item.note}”</p>}
          <small><PersonAvatar size="sm" name={item.authorName} src={avatar(item.authorId)} />Por: {item.authorName}</small></div>
      </li>)}
      <li className="system"><span className="tp-history-dot"><FileText /></span><div><b>Chamado aberto</b><time>{full(ticket.createdAt)}</time><small>Por: {ticket.requesterName}</small></div></li>
    </ol>
  </section>;
}

function ChecklistTab({ ticket, run, busy }: { ticket: Ticket; run: (action: () => Promise<unknown>) => Promise<boolean>; busy: boolean }) {
  const steps = ticket.steps || [], active = activeStep(ticket);
  const [text, setText] = useState(""), [stepId, setStepId] = useState(active?.id || "");
  const items = ticket.checklist || [];
  const groups = [...steps.map((step) => ({ id: step.id, name: step.name })), { id: "", name: "Geral" }]
    .map((group) => ({ ...group, items: items.filter((item) => (item.stepId || "") === group.id) })).filter((group) => group.items.length);
  const call = (json: Record<string, unknown>) => run(() => ticketApi(`/tickets/${ticket.id}/checklist`, { method: "POST", json }));
  const done = items.filter((item) => item.done).length;
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><ClipboardList /></span><div><h2>Checklist</h2><p>{items.length ? `${done} de ${items.length} itens concluídos` : "Próximas ações de cada etapa."}</p></div></header>
    {items.length > 0 && <i className="tp-checklist-bar" style={{ "--done": `${(done / items.length) * 100}%` } as CSSProperties}><em /></i>}
    {groups.map((group) => <div key={group.id || "general"} className="tp-checklist-group"><h3>{group.name}{active?.id === group.id && <em className="mc-pill blue">Etapa atual</em>}</h3>
      <ul className="tp-checklist">{group.items.map((item) => <li key={item.id} className={item.done ? "done" : ""}>
        <label><input type="checkbox" checked={item.done} disabled={busy} onChange={() => void call({ action: "TOGGLE", itemId: item.id })} /><span>{item.text}</span></label>
        {item.done && item.doneByName && <small>{item.doneByName} · {full(item.doneAt)}</small>}
        <button type="button" className="mc-icon-button" aria-label={`Remover ${item.text}`} disabled={busy} onClick={() => void call({ action: "REMOVE", itemId: item.id })}><Trash2 /></button>
      </li>)}</ul></div>)}
    {!items.length && <p className="mc-empty">Nenhum item ainda. Liste o que precisa ser feito para não esquecer nada.</p>}
    <form className="tp-checklist-add" onSubmit={(event) => { event.preventDefault(); if (text.trim()) void call({ action: "ADD", text, stepId }).then((ok) => { if (ok) setText(""); }); }}>
      <input value={text} onChange={(event) => setText(event.target.value)} maxLength={200} placeholder="Novo item do checklist…" aria-label="Novo item do checklist" />
      {steps.length > 0 && <select value={stepId} onChange={(event) => setStepId(event.target.value)} aria-label="Etapa do item"><option value="">Geral</option>{steps.map((step) => <option key={step.id} value={step.id}>{step.name}</option>)}</select>}
      <button type="submit" className="tp-send-button" disabled={busy || !text.trim()}><Plus />Adicionar</button>
    </form>
  </section>;
}

function ApprovalsTab({ ticket }: { ticket: Ticket }) {
  const steps = ticket.steps || [], approvals = steps.filter((step) => step.role !== "EXECUTOR");
  const returns = ticket.comments.filter((item) => item.action === "RETURN" || (item.kind === "SYSTEM" && item.message.startsWith("pediu ajustes")));
  return <section className="tp-card">
    <header className="tp-card-head"><span className="mc-card-icon dark"><ShieldCheck /></span><div><h2>Aprovações</h2><p>Aprovações internas e do cliente, e os pedidos de ajuste.</p></div></header>
    {approvals.length ? <ul className="tp-approvals">{approvals.map((step) => {
      const state = step.status === "DONE" ? "done" : step.status === "ACTIVE" && ticket.status !== "CLOSED" ? "active" : "pending";
      return <li key={step.id} className={state}>
        <span className="tp-approval-icon">{state === "done" ? <CheckCircle2 /> : state === "active" ? <Clock3 /> : <ShieldCheck />}</span>
        <div><b>{step.name}</b><small>{step.role === "CLIENT" ? `Cliente · registro por ${step.assigneeName}` : `Aprovador: ${step.assigneeName}`}</small></div>
        <em>{state === "done" ? `Aprovado em ${full(step.completedAt)}${step.completedByName ? ` por ${step.completedByName}` : ""}` : state === "active" ? `Aguardando · prazo ${full(step.dueAt)}` : "Pendente"}</em>
      </li>;
    })}</ul> : <p className="mc-empty">Este tipo de chamado não tem aprovações.</p>}
    <h3 className="tp-subtitle">Pedidos de ajuste ({returns.length})</h3>
    {returns.length ? <ul className="tp-comments">{returns.map((item) => <li key={item.id} className="adjust"><span className="tp-history-dot"><AlertTriangle /></span><div><header><b>{item.authorName}</b><time>{full(item.createdAt)}</time></header><p>{item.note || item.message.match(/ — “([\s\S]*)”$/)?.[1] || item.message}</p></div></li>)}</ul> : <p className="mc-empty">Nenhum ajuste solicitado até agora.</p>}
  </section>;
}
