import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowUp, CheckCircle2, ClipboardList, FilePlus2, FileText, Info, Save, Send, UploadCloud, Workflow, X } from "lucide-react";
import { SearchableSelect } from "./SearchableSelect";
import { UnitField } from "./BranchSelect";
import { DateTimePicker } from "./DateTimePicker";
import { scheduleSteps, type TicketStep } from "./ticketFlows";
import {
  PersonAvatar, StepRail, TicketHeader, dateTime, fileSize, originLabels, priorityMeta, ticketApi, uploadTicketFile, useTicketsData,
  type SessionUser, type Ticket, type TicketOriginType,
} from "./TicketsManagement";

type FormState = {
  clientId: string; unit: string; origin: string; flowId: string; priority: Ticket["priority"]; departmentId: string;
  title: string; description: string; dueAt: string; notes: string; assignees: Record<number, string>;
};
const emptyForm: FormState = { clientId: "", unit: "", origin: "INTERNAL", flowId: "", priority: "MEDIUM", departmentId: "", title: "", description: "", dueAt: "", notes: "", assignees: {} };
const draftKey = (userId: string) => `pwos:ticket-draft:${userId}`;
const pad = (value: number) => String(value).padStart(2, "0");
// O DateTimePicker trabalha com "AAAA-MM-DDTHH:mm" no horário local.
const toLocalInput = (iso: string) => { if (!iso) return ""; const date = new Date(iso); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; };
const readDraft = (userId: string): FormState | null => { try { const raw = localStorage.getItem(draftKey(userId)); return raw ? { ...emptyForm, ...JSON.parse(raw) } : null; } catch { return null; } };

export function TicketForm({ user }: { user: SessionUser }) {
  const { id: editId } = useParams();
  const { data, error } = useTicketsData();
  const navigate = useNavigate(), [params] = useSearchParams();
  const [form, setForm] = useState<FormState>(emptyForm), [files, setFiles] = useState<File[]>([]), [dragging, setDragging] = useState(false),
    [ready, setReady] = useState(false), [saving, setSaving] = useState(""), [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null),
    [touched, setTouched] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const editing = editId ? data?.tickets.find((ticket) => ticket.id === editId) : undefined;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  // Estado inicial: chamado em edição, atalho vindo de outra tela (?cliente=&reuniao=&tipo=) ou rascunho salvo.
  useEffect(() => {
    if (!data || ready) return;
    if (editing) {
      setForm({ clientId: editing.clientId || "", unit: editing.unit || "", origin: editing.origin?.type === "MEETING" ? `MEETING:${editing.origin.meetingId}` : editing.origin?.type || "INTERNAL", flowId: editing.flowId || "", priority: editing.priority, departmentId: editing.departmentId, title: editing.title, description: editing.description, dueAt: toLocalInput(editing.dueAt), notes: editing.notes || "", assignees: {} });
    } else if (!editId) {
      const meeting = data.meetings.find((item) => item.id === params.get("reuniao"));
      const flow = data.flows.find((item) => item.id === params.get("tipo"));
      if (meeting || params.get("cliente") || flow)
        setForm({ ...emptyForm, clientId: meeting?.clientId || params.get("cliente") || "", unit: meeting?.unit || "", origin: meeting ? `MEETING:${meeting.id}` : "INTERNAL", flowId: flow?.id || "", departmentId: flow?.departmentId || "" });
      else {
        const draft = readDraft(user.id);
        if (draft) { setForm(draft); setNotice({ tone: "warn", text: "Rascunho restaurado. Os anexos precisam ser selecionados de novo." }); }
      }
    }
    setReady(true);
  }, [data, editing, editId, params, ready, user.id]);

  const flow = data?.flows.find((item) => item.id === (editing?.flowId || form.flowId));
  const users = data?.availableUsers || [];
  const department = data?.departments.find((item) => item.id === form.departmentId);
  const me = { id: user.id, name: user.name };
  // Sugestão de responsáveis: quem pediu, o último chamado do mesmo tipo ou o responsável do setor.
  const remembered = useMemo(() => data?.canAssign && flow ? data.tickets.filter((ticket) => ticket.flowId === flow.id && ticket.steps?.length === flow.steps.length).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] : undefined, [data, flow]);
  const assigneeFor = (index: number) => {
    const chosen = users.find((item) => item.id === form.assignees[index]);
    if (chosen) return { id: chosen.id, name: chosen.name };
    if (editing?.steps?.[index]) return { id: editing.steps[index].assigneeId, name: editing.steps[index].assigneeName };
    if (!flow || flow.steps[index].owner === "REQUESTER") return me;
    const previous = remembered?.steps?.[index];
    if (previous && users.some((item) => item.id === previous.assigneeId)) return { id: previous.assigneeId, name: previous.assigneeName };
    return department?.managerUserId ? { id: department.managerUserId, name: department.managerName || "Responsável do setor" } : me;
  };
  const steps: TicketStep[] = useMemo(() => {
    if (editing?.steps?.length) return editing.steps.map((item, index) => { const assignee = assigneeFor(index); return { ...item, assigneeId: assignee.id, assigneeName: assignee.name }; });
    if (!flow) return [];
    const now = new Date();
    return scheduleSteps(flow.steps.map((item, index): TicketStep => ({ id: String(index), name: item.name, role: item.role, days: item.days, assigneeId: assigneeFor(index).id, assigneeName: assigneeFor(index).name, status: index === 0 ? "ACTIVE" : "PENDING", dueAt: "", startedAt: index === 0 ? now.toISOString() : undefined })), now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, editing, form.assignees, form.departmentId, remembered, users]);

  if (error && !data) return <div className="mt-page"><p className="mt-alert" role="alert">{error}</p></div>;
  if (!data || !ready) return <div className="mt-page"><div className="mt-loading" role="status"><FilePlus2 /> Carregando…</div></div>;
  if (editId && !editing) return <div className="mt-page tk-page"><TicketHeader icon={FilePlus2} crumb="Editar" title="Chamado não encontrado" subtitle="Ele pode ter sido excluído ou você não tem acesso a ele." /><NavLink className="mt-button outline" to="/chamados">Voltar para os chamados</NavLink></div>;
  if (!editId && !data.canCreate) return <div className="mt-page tk-page"><TicketHeader icon={FilePlus2} crumb="Abrir chamado" title="Sem permissão" subtitle="Seu cargo não permite abrir chamados. Fale com a gestão." /></div>;

  const client = data.clients.find((item) => item.id === form.clientId);
  const needsClient = !!flow?.steps.some((item) => item.role === "CLIENT");
  const clientMeetings = data.meetings.filter((item) => !form.clientId || item.clientId === form.clientId);
  const units = [...new Set(["Matriz", ...data.meetings.filter((item) => item.clientId === form.clientId).map((item) => item.unit), ...data.tickets.filter((item) => item.clientId === form.clientId).map((item) => item.unit || "")].filter(Boolean))];
  const suggestedDue = steps.length ? steps[steps.length - 1].dueAt : "";
  const current = steps.find((item) => item.status === "ACTIVE") || steps[0];
  const missing = {
    clientId: needsClient && !form.clientId,
    flowId: !flow,
    departmentId: !form.departmentId,
    title: form.title.trim().length < 4,
    description: !form.description.trim(),
  };
  const invalid = (key: keyof typeof missing) => touched && missing[key] ? "invalid" : "";
  const meetingLabel = (item: (typeof data.meetings)[number]) => `Reunião (${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.startAt)).replace(",", " -")})${item.subject ? ` · ${item.subject}` : ""}`;
  const originOptions = [
    ...(["INTERNAL", "WHATSAPP", "EMAIL", "PHONE"] as TicketOriginType[]).map((value) => ({ value, label: originLabels[value] })),
    ...clientMeetings.slice(0, 30).map((item) => ({ value: `MEETING:${item.id}`, label: meetingLabel(item), description: form.clientId ? undefined : data.clients.find((entry) => entry.id === item.clientId)?.name })),
  ];
  const chooseFlow = (flowId: string) => {
    const next = data.flows.find((item) => item.id === flowId);
    setForm((current) => ({ ...current, flowId, assignees: {}, departmentId: next?.departmentId || current.departmentId || user.departmentId || "" }));
  };
  const chooseOrigin = (value: string) => {
    const meeting = data.meetings.find((item) => `MEETING:${item.id}` === value);
    setForm((current) => ({ ...current, origin: value, ...(meeting && !current.clientId ? { clientId: meeting.clientId, unit: current.unit || meeting.unit } : {}) }));
  };
  const addFiles = (list: FileList | null) => {
    const added = Array.from(list || []);
    setFiles((current) => [...current, ...added].slice(0, 20 - (editing?.attachments?.length || 0)));
  };
  const drop = (event: DragEvent) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };
  const saveDraft = () => {
    try { localStorage.setItem(draftKey(user.id), JSON.stringify(form)); setNotice({ tone: "ok", text: "Rascunho salvo neste navegador. Os anexos não ficam no rascunho." }); }
    catch { setNotice({ tone: "error", text: "Não foi possível salvar o rascunho neste navegador." }); }
  };
  const submit = async () => {
    setTouched(true);
    if (Object.values(missing).some(Boolean)) { setNotice({ tone: "error", text: "Preencha os campos obrigatórios destacados." }); return; }
    setSaving(editing ? "Salvando…" : "Abrindo chamado…"); setNotice(null);
    const [originType, meetingId] = form.origin.split(":");
    const payload = { title: form.title, description: form.description, clientId: form.clientId, unit: form.unit, origin: { type: originType, meetingId }, departmentId: form.departmentId, priority: form.priority, dueAt: form.dueAt || toLocalInput(suggestedDue), notes: form.notes, ...(data.canAssign ? { stepAssignees: steps.map((item) => item.assigneeId) } : {}) };
    try {
      const { ticket } = editing
        ? await ticketApi<{ ticket: Ticket }>(`/tickets/${editing.id}`, { method: "PATCH", json: payload })
        : await ticketApi<{ ticket: Ticket }>("/tickets", { method: "POST", json: { ...payload, flowId: form.flowId } });
      const failed: string[] = [];
      for (const [index, file] of files.entries()) {
        setSaving(`Enviando anexos ${index + 1}/${files.length}…`);
        await uploadTicketFile(ticket.id, file).catch((reason: Error) => failed.push(reason.message));
      }
      if (!editing) try { localStorage.removeItem(draftKey(user.id)); } catch { /* rascunho é só conveniência */ }
      navigate(`/chamados?ticket=${ticket.id}`, { state: failed.length ? { uploadErrors: failed } : undefined });
    } catch (reason) {
      setNotice({ tone: "error", text: (reason as Error).message });
    } finally { setSaving(""); }
  };

  const stepCard = (number: number, title: string, subtitle: string) => <header className="tk-card-head"><span>{number}</span><div><h2>{title}</h2><p>{subtitle}</p></div></header>;
  const userOptions = users.map((item) => ({ value: item.id, label: item.name, description: item.departmentName }));

  return <div className="mt-page tk-page tk-form-page">
    <TicketHeader icon={FilePlus2} crumb={editing ? `Editar ${editing.code}` : "Abrir chamado"} title={editing ? "Editar Chamado" : "Abrir Novo Chamado"} subtitle={editing ? "Ajuste os dados e os responsáveis das etapas que ainda não foram concluídas." : "Registre a solicitação, escolha o tipo e o sistema monta as etapas, os responsáveis e os prazos."} quote />
    {notice && <div className={`mt-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.tone === "ok" ? <CheckCircle2 /> : <AlertCircle />}<span>{notice.text}</span>
      {notice.text.startsWith("Rascunho restaurado") && <button type="button" className="mt-link" onClick={() => { try { localStorage.removeItem(draftKey(user.id)); } catch { /* ignore */ } setForm(emptyForm); setNotice(null); }}>Descartar rascunho</button>}
      <button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}><X /></button></div>}
    <div className="tk-form-grid">
      <div className="tk-form-main">
        <section className="mt-card tk-form-card">
          {stepCard(1, "Informações do chamado", "Preencha os dados básicos da solicitação.")}
          <div className="mt-form">
            <label className={`span-6 ${invalid("clientId")}`}>Cliente / Projeto {needsClient && <em>*</em>}
              <SearchableSelect value={form.clientId} onChange={(clientId) => setForm((current) => ({ ...current, clientId, unit: "", origin: current.origin.startsWith("MEETING:") ? "INTERNAL" : current.origin }))} placeholder="Selecione o cliente" searchPlaceholder="Buscar cliente…" options={[{ value: "", label: "Interno (sem cliente)" }, ...data.clients.map((item) => ({ value: item.id, label: item.name }))]} />
              {touched && missing.clientId && <small className="tk-field-error">Este tipo tem aprovação do cliente: selecione o cliente.</small>}
            </label>
            <label className="span-6">Loja / Unidade
              <UnitField listId="tk-units" branches={data.clients.find((item) => item.id === form.clientId)?.branches} value={form.unit} suggestions={units} disabled={!form.clientId} placeholder={form.clientId ? "Ex.: Matriz, Cambé - PR (opcional)" : "Selecione o cliente primeiro"} onChange={(value) => set("unit", value)} />
            </label>
            <label className="span-4">Origem <em>*</em><SearchableSelect value={form.origin} onChange={chooseOrigin} searchPlaceholder="Buscar reunião…" options={originOptions} /></label>
            <label className={`span-4 tk-flow-select ${invalid("flowId")}`}><span className="tk-flow-label">Tipo de solicitação <em>*</em>{data.canManageFlows && !editing && <NavLink to="/chamados/tipos" className="tk-flow-manage">Gerenciar tipos</NavLink>}</span>
              <SearchableSelect value={editing?.flowId || form.flowId} onChange={chooseFlow} disabled={!!editing} placeholder="Selecione o tipo" searchable={false} options={data.flows.map((item) => ({ value: item.id, label: item.name, description: `${item.steps.length} ${item.steps.length === 1 ? "etapa" : "etapas"}` }))} /></label>
            <label className="span-4">Prioridade <em>*</em><SearchableSelect value={form.priority} onChange={(value) => set("priority", value as Ticket["priority"])} searchable={false} options={Object.entries(priorityMeta).map(([value, item]) => ({ value, label: item.label }))} /></label>
            <label className={`span-12 ${invalid("title")}`}>Nome do chamado <em>*</em><input value={form.title} maxLength={150} placeholder={flow && client ? `${flow.name} - ${client.name}` : "Ex.: Landing page institucional - Cliente"} onChange={(event) => set("title", event.target.value)} /><small>{form.title.length}/150</small></label>
            <label className={`span-12 ${invalid("description")}`}>Descrição detalhada <em>*</em><textarea rows={4} maxLength={2000} value={form.description} placeholder="O que precisa ser feito, contexto, referências e resultado esperado." onChange={(event) => set("description", event.target.value)} /><small>{form.description.length}/2000</small></label>
            <div className="span-12 tk-field">
              <span className="tk-field-label">Anexos</span>
              <div className={`tk-dropzone ${dragging ? "over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
                <button type="button" className="tk-drop-target" onClick={() => fileInput.current?.click()}><UploadCloud /><span><b>Arraste e solte os arquivos aqui ou clique para selecionar</b><small>Imagens, PDFs, documentos, vídeos, ZIP… até 500 MB cada.</small></span></button>
                <input ref={fileInput} type="file" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
                {(files.length > 0 || !!editing?.attachments?.length) && <div className="tk-chips">
                  {editing?.attachments?.map((file) => <span key={file.id} className="tk-chip saved"><span className="tk-file-icon">{file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span><span><b>{file.name}</b><small>{fileSize(file.sizeBytes)} · já anexado</small></span></span>)}
                  {files.map((file, index) => <span key={`${file.name}-${index}`} className="tk-chip"><span className="tk-file-icon">{file.name.split(".").pop()?.slice(0, 4).toUpperCase()}</span><span><b>{file.name}</b><small>{fileSize(file.size)}</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))} aria-label={`Remover ${file.name}`}><X /></button></span>)}
                </div>}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-card tk-form-card">
          {stepCard(2, "Fluxo de aprovação", editing ? "Etapas deste chamado. Você pode trocar o responsável das etapas que ainda não foram concluídas." : "As etapas, os responsáveis e os prazos vêm do tipo de solicitação.")}
          {!flow ? <div className="tk-flow-empty"><Workflow /><p>Escolha o <b>tipo de solicitação</b> para ver as etapas do fluxo.</p></div> : <>
            <div className="tk-flow-info"><Info /><p><b>{flow.name}:</b> {flow.description} {flow.steps.length} {flow.steps.length === 1 ? "etapa" : "etapas"}{flow.steps.some((item) => item.role !== "EXECUTOR") ? ", com aprovações" : ""}.</p>
              <label className="tk-flow-department">Setor <SearchableSelect value={form.departmentId} onChange={(value) => setForm((current) => ({ ...current, departmentId: value }))} placeholder="Selecione o setor" searchPlaceholder="Buscar setor…" options={data.departments.filter((item) => item.active || item.id === form.departmentId).map((item) => ({ value: item.id, label: item.name, description: item.managerName ? `Responsável: ${item.managerName}` : undefined }))} /></label>
            </div>
            {touched && missing.departmentId && <p className="tk-field-error">Selecione o setor responsável.</p>}
            <div className="tk-rail-head"><b>Etapas do fluxo</b><span className="tk-legend"><i className="done" />Concluída<i className="active" />Em andamento<i className="pending" />Pendente</span></div>
            <StepRail steps={steps} users={users} renderAssignee={(index) => {
              const item = steps[index], assignee = { id: item.assigneeId, name: item.assigneeName };
              const editable = data.canAssign && item.status !== "DONE";
              return <span className={`tk-rail-person ${editable ? "editable" : ""}`}>
                <PersonAvatar size="sm" name={assignee.name} src={users.find((entry) => entry.id === assignee.id)?.avatarDataUrl} />
                {editable ? <span className="tk-rail-select"><SearchableSelect value={assignee.id} onChange={(value) => setForm((current) => ({ ...current, assignees: { ...current.assignees, [index]: value } }))} searchPlaceholder="Buscar pessoa…" options={userOptions.some((option) => option.value === assignee.id) ? userOptions : [{ value: assignee.id, label: assignee.name }, ...userOptions]} /></span> : <span>{assignee.name}</span>}
              </span>;
            }} />
            <p className="tk-flow-note"><CheckCircle2 />{editing ? "Etapas concluídas ficam registradas como estão." : "O chamado nasce na etapa 1. Cada responsável conclui a sua e envia para a próxima; aprovações podem devolver para ajustes."}</p>
          </>}
        </section>

        <section className="mt-card tk-form-card">
          {stepCard(3, "Prazo e observações", "O prazo final é sugerido pela soma das etapas, em dias úteis.")}
          <div className="mt-form">
            <label className="span-5">Prazo final
              <DateTimePicker value={form.dueAt} onChange={(value) => set("dueAt", value)} placeholder={suggestedDue ? `Sugerido: ${dateTime(suggestedDue)}` : "Sem prazo"} />
              <small className="tk-due-hint">{form.dueAt ? <button type="button" className="mt-link" onClick={() => set("dueAt", "")}>Usar o prazo sugerido pelo fluxo</button> : suggestedDue ? "Em branco, vale o prazo sugerido pelo fluxo." : ""}</small>
            </label>
            <label className="span-7">Observações adicionais <small className="tk-optional">(opcional)</small><textarea rows={2} maxLength={500} value={form.notes} placeholder="Ex.: preferências de layout, sites de referência, cuidados especiais…" onChange={(event) => set("notes", event.target.value)} /></label>
          </div>
        </section>
      </div>

      <aside className="tk-form-side">
        <section className="mt-card">
          <header className="mt-card-head"><ClipboardList /><h2>Resumo da solicitação</h2></header>
          <dl className="tk-summary">
            <dt>Cliente</dt><dd>{client ? `${client.name}${form.unit ? ` · ${form.unit}` : ""}` : "Interno"}</dd>
            <dt>Tipo</dt><dd>{flow?.name || "—"}</dd>
            <dt>Prioridade</dt><dd className={`tk-priority ${form.priority.toLowerCase()}`}>{["HIGH", "URGENT"].includes(form.priority) && <ArrowUp />}{priorityMeta[form.priority].label}</dd>
            <dt>Solicitante</dt><dd className="tk-summary-person"><PersonAvatar size="sm" name={editing?.requesterName || user.name} src={editing ? undefined : user.avatarDataUrl} />{editing?.requesterName || user.name}</dd>
            <dt>{editing ? "Com quem está" : "Começa com"}</dt><dd className="tk-summary-person">{current ? <><PersonAvatar size="sm" name={current.assigneeName} src={users.find((item) => item.id === current.assigneeId)?.avatarDataUrl} />{current.assigneeName}</> : "—"}</dd>
            <dt>Etapas</dt><dd>{steps.length ? `${steps.length} · ${steps.filter((item) => item.role !== "EXECUTOR").length} aprovação(ões)` : "—"}</dd>
            <dt>Prazo final</dt><dd>{form.dueAt ? dateTime(new Date(form.dueAt).toISOString()) : suggestedDue ? `${dateTime(suggestedDue)} (sugerido)` : "—"}</dd>
            <dt>Anexos</dt><dd>{files.length + (editing?.attachments?.length || 0) || "Nenhum"}</dd>
          </dl>
        </section>
        <section className="mt-card">
          <header className="mt-card-head"><FileText /><h2>Como funciona</h2></header>
          <ul className="tk-rules">
            <li><CheckCircle2 /><span>Cada etapa tem um responsável e um prazo; o chamado aparece em <b>Em andamento</b> para quem está com ele.</span></li>
            <li><CheckCircle2 /><span>A etapa só é concluída quando o responsável envia para a próxima.</span></li>
            <li><CheckCircle2 /><span>Aprovações (interna e do cliente) podem devolver o chamado para ajustes.</span></li>
            <li><CheckCircle2 /><span>Cada passagem avisa o próximo responsável no sino e fica no histórico.</span></li>
          </ul>
        </section>
      </aside>
    </div>

    <footer className="tk-form-footer">
      <button type="button" className="mt-button outline" onClick={() => navigate(editing ? `/chamados?ticket=${editing.id}` : "/chamados")}>Cancelar</button>
      <span className="tk-footer-status">{saving}</span>
      {!editing && <button type="button" className="mt-button outline" disabled={!!saving} onClick={saveDraft}><Save />Salvar rascunho</button>}
      <button type="button" className="mt-button tk-cta big" disabled={!!saving} onClick={() => void submit()}>{editing ? <><Save />Salvar alterações</> : <><Send />Abrir chamado</>}</button>
    </footer>
  </div>;
}

