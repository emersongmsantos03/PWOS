import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Copy, Plus, Save, Trash2, Workflow } from "lucide-react";
import { systemConfirm } from "./SystemDialog";
import { stepRoleLabels, ticketStepOwnerLabels, type TicketFlow, type TicketFlowStep, type TicketStepOwner, type TicketStepRole } from "./ticketFlows";
import { TicketHeader, ticketApi, useTicketsData, type Department } from "./TicketsManagement";
import "./Meetings.css";
import "./Tickets.css";

// Tela da Diretoria para os tipos de chamado: criar, editar, duplicar e excluir tipos e as
// suas etapas. Chamados já abertos guardam as próprias etapas e não mudam.
type Draft = { name: string; description: string; departmentId: string; steps: TicketFlowStep[] };
const blankStep = (): TicketFlowStep => ({ name: "", role: "EXECUTOR", owner: "DEPARTMENT", days: 1 });
const blankDraft = (): Draft => ({ name: "", description: "", departmentId: "", steps: [blankStep()] });
const toDraft = (flow: TicketFlow): Draft => ({ name: flow.name, description: flow.description, departmentId: flow.departmentId, steps: flow.steps.map((step) => ({ ...step })) });
const NEW = "novo";

export function TicketTypes() {
  const { data, error: loadError, load } = useTicketsData();
  const [params, setParams] = useSearchParams(), selectedId = params.get("tipo") || "";
  const [draft, setDraft] = useState<Draft | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false),
    [seed, setSeed] = useState<Draft | null>(null);
  const flows = data?.flows || [], selected = flows.find((flow) => flow.id === selectedId);
  const original = useMemo(() => (selected ? toDraft(selected) : selectedId === NEW ? seed || blankDraft() : null), [selected, selectedId, seed]);
  const dirty = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);

  // Sem tipo escolhido, abre o primeiro da lista.
  useEffect(() => { if (data && !selectedId && flows[0]) setParams({ tipo: flows[0].id }, { replace: true }); }, [data, selectedId, flows, setParams]);
  useEffect(() => { setDraft(original); setError(""); }, [original]);

  const choose = async (id: string) => {
    if (id === selectedId) return;
    if (dirty && !await systemConfirm({ title: "Descartar alterações?", message: "As mudanças neste tipo ainda não foram salvas.", confirmLabel: "Descartar", tone: "warning" })) return;
    setNotice("");
    setSeed(null);
    setParams({ tipo: id });
  };
  const duplicate = async () => {
    if (!draft) return;
    if (dirty && !await systemConfirm({ title: "Descartar alterações?", message: "As mudanças neste tipo ainda não foram salvas.", confirmLabel: "Descartar", tone: "warning" })) return;
    setNotice("");
    setSeed({ ...draft, name: `${draft.name} (cópia)`.slice(0, 80), steps: draft.steps.map((step) => ({ ...step })) });
    setParams({ tipo: NEW });
  };
  const update = (patch: Partial<Draft>) => setDraft((current) => current && { ...current, ...patch });
  const updateStep = (index: number, patch: Partial<TicketFlowStep>) => setDraft((current) => current && { ...current, steps: current.steps.map((step, position) => position === index ? { ...step, ...patch } : step) });
  const moveStep = (index: number, delta: number) => setDraft((current) => {
    if (!current) return current;
    const steps = [...current.steps], target = index + delta;
    if (target < 0 || target >= steps.length) return current;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    return { ...current, steps };
  });
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await ticketApi<{ flow: TicketFlow }>(selected ? `/tickets/flows/${encodeURIComponent(selected.id)}` : "/tickets/flows", { method: selected ? "PATCH" : "POST", json: draft });
      await load();
      setParams({ tipo: result.flow.id }, { replace: true });
      setNotice(selected ? "Tipo de chamado atualizado. Vale para os próximos chamados." : "Tipo de chamado criado.");
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!selected) return;
    if (!await systemConfirm({ title: `Excluir o tipo “${selected.name}”?`, message: "Ele deixa de aparecer ao abrir chamados. Os chamados já abertos com este tipo continuam com as etapas que têm.", confirmLabel: "Excluir tipo", tone: "danger" })) return;
    setBusy(true); setError("");
    try {
      await ticketApi(`/tickets/flows/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      await load();
      setParams({}, { replace: true });
      setNotice(`Tipo “${selected.name}” excluído.`);
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  };

  if (!data) return <div className="mt-page tk-page"><p className={loadError ? "mt-alert" : "mt-empty big"} role={loadError ? "alert" : "status"}>{loadError || "Carregando tipos de chamado…"}</p></div>;
  if (!data.canManageFlows) return <div className="mt-page tk-page"><p className="mt-alert" role="alert">Somente a Diretoria pode gerenciar os tipos de chamado. <NavLink to="/chamados">Voltar para Chamados</NavLink></p></div>;

  const totalDays = draft?.steps.reduce((sum, step) => sum + (Number(step.days) || 0), 0) || 0;
  const usage = (flow: TicketFlow) => data.tickets.filter((ticket) => ticket.flowId === flow.id && !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  return <div className="mt-page tk-page tk-flows-page">
    <TicketHeader icon={Workflow} crumb="Tipos de chamado" title="Tipos de chamado" subtitle="Crie tipos e defina as etapas, os responsáveis e os prazos de cada um. Mudanças valem para os próximos chamados." actions={<button type="button" className="mt-button tk-cta" onClick={() => void choose(NEW)}><Plus />Novo tipo</button>} />
    {notice && <div className="mt-notice ok" role="status"><span>{notice}</span></div>}
    <div className="tk-flows-layout">
      <aside className="tk-flows-list" aria-label="Tipos de chamado">
        {flows.map((flow) => <button type="button" key={flow.id} className={flow.id === selectedId ? "active" : ""} onClick={() => void choose(flow.id)}>
          <b>{flow.name}{flow.custom && <em className="tk-flow-tag">Personalizado</em>}</b>
          <small>{flow.steps.length} {flow.steps.length === 1 ? "etapa" : "etapas"}{usage(flow) ? ` · ${usage(flow)} em andamento` : ""}</small>
        </button>)}
        {selectedId === NEW && <button type="button" className="active"><b>{draft?.name || "Novo tipo"}</b><small>Ainda não salvo</small></button>}
      </aside>
      {draft ? <form className="tk-flows-editor" onSubmit={save}>
        <header>
          <div><h2>{selected ? selected.name : "Novo tipo de chamado"}</h2><p>{!selected ? "Preencha o nome e monte as etapas." : usage(selected) ? `${usage(selected)} ${usage(selected) === 1 ? "chamado em andamento usa" : "chamados em andamento usam"} este tipo e ${usage(selected) === 1 ? "mantém" : "mantêm"} as etapas atuais.` : "Nenhum chamado em andamento usa este tipo."}</p></div>
          <div className="tk-flows-editor-actions">
            {selected && <button type="button" className="mt-button outline small" onClick={() => void duplicate()} disabled={busy}><Copy />Duplicar</button>}
            {selected && <button type="button" className="mt-button outline small danger" onClick={() => void remove()} disabled={busy}><Trash2 />Excluir</button>}
          </div>
        </header>
        <div className="tk-flow-editor-fields">
          <label><span>Nome do tipo <em>*</em></span><input value={draft.name} onChange={(event) => update({ name: event.target.value })} required minLength={2} maxLength={80} placeholder="Ex.: Landing Page" /></label>
          <label>Setor padrão<select value={draft.departmentId} onChange={(event) => update({ departmentId: event.target.value })}><option value="">Escolhido ao abrir o chamado</option>{data.departments.filter((item: Department) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="wide">Descrição<input value={draft.description} onChange={(event) => update({ description: event.target.value })} maxLength={300} placeholder="Quando usar este tipo de chamado" /></label>
        </div>
        <div className="tk-flow-steps-head"><b>Etapas</b><small>{draft.steps.length} {draft.steps.length === 1 ? "etapa" : "etapas"} · {totalDays} {totalDays === 1 ? "dia útil" : "dias úteis"} no total</small></div>
        <div className="tk-flow-steps-labels" aria-hidden="true"><span /><span>Nome da etapa</span><span>Papel</span><span>Quem assume</span><span>Prazo</span><span /></div>
        <ol className="tk-flow-steps">{draft.steps.map((step, index) => <li key={index}>
          <span className="tk-flow-step-number">{index + 1}</span>
          <input aria-label={`Nome da etapa ${index + 1}`} value={step.name} onChange={(event) => updateStep(index, { name: event.target.value })} placeholder="Nome da etapa" maxLength={80} required />
          <select aria-label="Papel" value={step.role} onChange={(event) => updateStep(index, { role: event.target.value as TicketStepRole })}>{Object.entries(stepRoleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Quem assume" value={step.owner} onChange={(event) => updateStep(index, { owner: event.target.value as TicketStepOwner })}>{Object.entries(ticketStepOwnerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label className="tk-flow-days"><input type="number" min={0} max={60} value={step.days} onChange={(event) => updateStep(index, { days: Number(event.target.value) })} aria-label="Prazo em dias úteis" /><small>dias</small></label>
          <span className="tk-flow-step-actions">
            <button type="button" onClick={() => moveStep(index, -1)} disabled={index === 0} aria-label="Subir etapa" title="Subir"><ArrowUp /></button>
            <button type="button" onClick={() => moveStep(index, 1)} disabled={index === draft.steps.length - 1} aria-label="Descer etapa" title="Descer"><ArrowDown /></button>
            <button type="button" onClick={() => update({ steps: draft.steps.filter((_, position) => position !== index) })} disabled={draft.steps.length === 1} aria-label="Excluir etapa" title="Excluir etapa"><Trash2 /></button>
          </span>
        </li>)}</ol>
        <button type="button" className="secondary tk-flow-add-step" onClick={() => update({ steps: [...draft.steps, blankStep()] })} disabled={draft.steps.length >= 20}><Plus /> Adicionar etapa</button>
        <p className="tk-flow-help"><b>Executor</b> faz a entrega. <b>Aprovador</b> e <b>Cliente</b> aprovam ou devolvem para a etapa anterior pedindo ajustes. A primeira etapa precisa ser de Executor. O prazo conta dias úteis.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <footer>
          {dirty && <span className="tk-flows-dirty">Alterações não salvas</span>}
          <button type="button" className="secondary" disabled={!dirty || busy} onClick={() => setDraft(original)}>Desfazer</button>
          <button className="primary" disabled={busy || (!dirty && !!selected)}><Save />{busy ? "Salvando…" : selected ? "Salvar alterações" : "Criar tipo"}</button>
        </footer>
      </form> : <div className="tk-flows-editor tk-flows-empty"><Workflow /><p>Escolha um tipo na lista ou crie um novo.</p></div>}
    </div>
  </div>;
}
