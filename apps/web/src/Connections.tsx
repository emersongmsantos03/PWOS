import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2,
  ChevronDown, Clock3, Eye, Filter, KeyRound, Link2, LoaderCircle, Megaphone,
  MoreHorizontal, Pause, Play, Plus, RefreshCw, Search, Settings2, ShieldCheck,
  TestTube2, Trash2, Unplug, Users, X, Zap
} from "lucide-react";

type Platform = "GOOGLE_ADS" | "META_ADS";
type Connection = {
  id: string; platform: Platform; name: string; status: string; demo: boolean;
  managerName: string; accountCount: number; campaignCount: number; responsible: string;
  lastSyncAt: string | null; nextSyncAt: string | null; frequency: string;
};

const platformLabel = (platform: Platform) => platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";
const demoAccounts = [
  { id: "demo-001", name: "Conta demonstrativa principal", currency: "BRL", timezone: "America/Sao_Paulo", status: "Ativa", campaigns: 3 },
  { id: "demo-002", name: "Conta demonstrativa secundária", currency: "BRL", timezone: "America/Sao_Paulo", status: "Ativa", campaigns: 2 },
];
const demoCampaigns = [
  { id: "campaign-001", name: "Campanha demonstrativa • Pesquisa", status: "Ativa", objective: "Conversões", budget: "R$ 100/dia" },
  { id: "campaign-002", name: "Campanha demonstrativa • Remarketing", status: "Pausada", objective: "Tráfego", budget: "R$ 50/dia" },
  { id: "campaign-003", name: "Campanha demonstrativa • Institucional", status: "Ativa", objective: "Alcance", budget: "R$ 80/dia" },
];
const steps = ["Plataforma", "Autorizar", "Gerenciadora", "Contas", "Clientes", "Campanhas", "Portal", "Frequência", "Revisar"];

function Status({ value }: { value: string }) {
  const good = value === "Conectada";
  return <span className={`connection-status ${good ? "connected" : value.toLowerCase()}`}>{good ? <CheckCircle2/> : <AlertTriangle/>}{value}</span>;
}

function EmptyConnections({ onCreate }: { onCreate: () => void }) {
  return <div className="connections-empty"><span><Link2/></span><h2>Nenhuma conexão configurada</h2><p>Conecte Google Ads ou Meta Ads para organizar contas e campanhas. O acesso inicial será somente para leitura.</p><button className="primary" onClick={onCreate}><Plus/> Nova conexão</button></div>;
}

export function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [wizard, setWizard] = useState(false);
  const [detail, setDetail] = useState<Connection | null>(null);
  const [filter, setFilter] = useState("Todas");
  const load = () => fetch("/api/integrations").then(response => response.json()).then(data => setConnections(data.integrations || []));
  useEffect(() => { void load(); }, []);
  const visible = connections.filter(item => filter === "Todas" || platformLabel(item.platform) === filter);
  const healthy = connections.filter(item => item.status === "Conectada").length;

  return <div className="page connections-page">
    <div className="page-head"><div><span className="eyebrow">CONFIGURAÇÕES · INTEGRAÇÕES</span><h1>Central de Conexões</h1><p>Conecte e acompanhe as contas de anúncios utilizadas pela PW Media e por seus clientes.</p></div><button className="primary" onClick={() => setWizard(true)}><Plus/> Nova conexão</button></div>
    <section className="connection-kpis">
      <article><span><Link2/></span><div><small>Total de conexões</small><strong>{connections.length}</strong></div></article>
      <article><span className="success"><CheckCircle2/></span><div><small>Saudáveis</small><strong>{healthy}</strong></div></article>
      <article><span className="warning"><AlertTriangle/></span><div><small>Exigem atenção</small><strong>0</strong></div></article>
      <article><span className="danger"><Unplug/></span><div><small>Com erro</small><strong>0</strong></div></article>
      <article className="last-sync"><span><Clock3/></span><div><small>Última sincronização geral</small><strong>{connections.some(item => item.lastSyncAt) ? "Agora mesmo" : "Ainda não realizada"}</strong></div></article>
    </section>
    <div className="connection-tools"><div className="segmented">{["Todas","Google Ads","Meta Ads"].map(value => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}</div><div><div className="search small"><Search/><input placeholder="Pesquisar conexão..."/></div><button className="secondary"><Filter/> Filtros</button></div></div>
    {visible.length === 0 ? <EmptyConnections onCreate={() => setWizard(true)}/> : <div className="platform-grid">{visible.map(connection => <PlatformCard key={connection.id} connection={connection} onOpen={() => setDetail(connection)}/>)}</div>}
    <section className="platform-start"><div><span className="platform-logo google">G</span><div><h3>Google Ads</h3><p>Contas Manager, clientes e campanhas.</p></div></div><button className="secondary" onClick={() => setWizard(true)}>Conectar Google Ads</button><div><span className="platform-logo meta">∞</span><div><h3>Meta Ads</h3><p>Portfólios empresariais e contas de anúncios.</p></div></div><button className="secondary" onClick={() => setWizard(true)}>Conectar Meta Ads</button></section>
    {wizard && <ConnectionWizard onClose={() => setWizard(false)} onSaved={() => { setWizard(false); void load(); }}/>}
    {detail && <ConnectionDetail connection={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); void load(); }}/>}
  </div>;
}

function PlatformCard({ connection, onOpen }: { connection: Connection; onOpen: () => void }) {
  return <article className="platform-card"><div className="platform-card-head"><span className={`platform-logo ${connection.platform === "GOOGLE_ADS" ? "google" : "meta"}`}>{connection.platform === "GOOGLE_ADS" ? "G" : "∞"}</span><div><h2>{platformLabel(connection.platform)}</h2><p>{connection.managerName}</p></div><Status value={connection.status}/></div>{connection.demo && <span className="demo-badge"><TestTube2/> Modo demonstração</span>}<dl><div><dt>Contas vinculadas</dt><dd>{connection.accountCount}</dd></div><div><dt>Campanhas sincronizadas</dt><dd>{connection.campaignCount}</dd></div><div><dt>Última sincronização</dt><dd>{connection.lastSyncAt ? "Agora mesmo" : "Ainda não realizada"}</dd></div><div><dt>Próxima sincronização</dt><dd>{connection.nextSyncAt ? "Em 3 horas" : connection.frequency}</dd></div><div><dt>Responsável interno</dt><dd>{connection.responsible}</dd></div></dl><button className="primary manage-connection" onClick={onOpen}>Gerenciar conexão <ArrowRight/></button></article>;
}

function ConnectionWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [linked, setLinked] = useState(false);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [frequency, setFrequency] = useState("A cada 3 horas");
  const [tested, setTested] = useState(false);
  const [saving, setSaving] = useState(false);
  const canNext = step === 0 ? !!platform : step === 1 ? authorized : step === 3 ? accounts.length > 0 : step === 4 ? linked : true;
  const next = () => canNext && setStep(value => Math.min(8, value + 1));
  const save = async () => {
    if (!platform || !tested) return;
    setSaving(true);
    await fetch(`/api/integrations/${platform.toLowerCase()}/demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountCount: accounts.length, campaignCount: campaigns.length, frequency }) });
    setSaving(false); onSaved();
  };
  return <div className="connection-wizard-backdrop"><div className="connection-wizard" role="dialog" aria-modal="true"><header><div><span className="eyebrow">NOVA CONEXÃO</span><h2>{steps[step]}</h2></div><button onClick={onClose} aria-label="Fechar"><X/></button></header><div className="wizard-progress"><div style={{width:`${((step+1)/9)*100}%`}}/><span>Etapa {step+1} de 9</span></div><div className="wizard-steps">{steps.map((label,index)=><span className={index === step ? "active" : index < step ? "done" : ""} key={label}>{index < step ? <Check/> : index+1}<small>{label}</small></span>)}</div><main className="wizard-body">
      {step === 0 && <div className="platform-choice"><Choice selected={platform === "GOOGLE_ADS"} icon="G" title="Google Ads" text="Consulte contas Manager, contas de clientes, campanhas e métricas em modo de leitura." onClick={() => setPlatform("GOOGLE_ADS")}/><Choice selected={platform === "META_ADS"} icon="∞" title="Meta Ads" text="Consulte portfólios empresariais, contas de anúncios, campanhas e métricas em modo de leitura." onClick={() => setPlatform("META_ADS")}/></div>}
      {step === 1 && <div className="authorization-step"><span className="large-platform">{platform === "GOOGLE_ADS" ? "G" : "∞"}</span><h3>Autorize o acesso de leitura</h3><p>Você será direcionado à {platform === "GOOGLE_ADS" ? "Google" : "Meta"}. O PW OS nunca solicitará sua senha da plataforma.</p><button className="primary" disabled>Continuar com {platform === "GOOGLE_ADS" ? "Google" : "Meta"} <ArrowRight/></button><div className="demo-callout"><TestTube2/><div><b>Credenciais oficiais ainda não configuradas</b><p>Use uma conexão simulada para validar todo o fluxo sem acessar contas reais.</p></div><button onClick={() => setAuthorized(true)}>{authorized ? <><Check/> Simulação autorizada</> : "Usar conexão simulada"}</button></div></div>}
      {step === 2 && <SelectionList title={platform === "GOOGLE_ADS" ? "Selecione a conta Manager" : "Selecione o portfólio empresarial"} rows={[platform === "GOOGLE_ADS" ? "PW Media • Manager demonstrativa" : "PW Media • Portfólio demonstrativo"]}/>}
      {step === 3 && <div><StepIntro title="Selecione as contas de anúncios" text="Somente as contas marcadas serão configuradas."/><div className="demo-table"><div className="table-head"><input type="checkbox" checked={accounts.length === demoAccounts.length} onChange={event => setAccounts(event.target.checked ? demoAccounts.map(item=>item.id) : [])}/><b>Conta</b><b>Identificador</b><b>Moeda</b><b>Status</b><b>Campanhas</b></div>{demoAccounts.map(account=><label key={account.id}><input type="checkbox" checked={accounts.includes(account.id)} onChange={() => setAccounts(value => value.includes(account.id) ? value.filter(id=>id!==account.id) : [...value,account.id])}/><span><b>{account.name}</b><small>{account.timezone}</small></span><code>•••{account.id.slice(-3)}</code><span>{account.currency}</span><span className="mini-status"><Check/> {account.status}</span><span>{account.campaigns}</span></label>)}</div></div>}
      {step === 4 && <div><StepIntro title="Vincule as contas" text="Toda conta precisa pertencer a um cliente ou ser marcada como interna."/><div className="link-account"><Building2/><div><b>{accounts.length} {accounts.length === 1 ? "conta selecionada" : "contas selecionadas"}</b><p>Como ainda não há clientes cadastrados, marque-as como contas internas da PW.</p></div><label><input type="checkbox" checked={linked} onChange={event=>setLinked(event.target.checked)}/> Conta interna da PW Media</label></div><div className="form-grid connection-form"><label>Nome de exibição<input defaultValue="Operação interna PW"/></label><label>Responsável interno<select><option>Emerson Santos</option></select></label><label>Equipe responsável<select><option>Administração</option></select></label></div></div>}
      {step === 5 && <div><StepIntro title="Escolha as campanhas" text="Você controla exatamente o que será sincronizado."/><div className="sync-options"><label><input type="radio" name="sync-mode" defaultChecked/> Apenas campanhas ativas</label><label><input type="radio" name="sync-mode"/> Todas as campanhas</label><label><input type="radio" name="sync-mode"/> Selecionar manualmente</label></div><div className="campaign-select">{demoCampaigns.map(campaign=><label key={campaign.id}><input type="checkbox" checked={campaigns.includes(campaign.id)} onChange={()=>setCampaigns(value=>value.includes(campaign.id)?value.filter(id=>id!==campaign.id):[...value,campaign.id])}/><span><b>{campaign.name}</b><small>{campaign.objective} · {campaign.budget}</small></span><em>{campaign.status}</em></label>)}</div><label className="future-option"><input type="checkbox" defaultChecked/> Incluir automaticamente novas campanhas ativas</label></div>}
      {step === 6 && <div><StepIntro title="Permissões do portal do cliente" text="Clientes externos verão somente o que for explicitamente liberado."/><div className="permission-options">{["Visualizar campanhas selecionadas","Ver investimento, impressões, cliques e conversões","Baixar relatórios em PDF","Abrir links protegidos de relatório","Visualizar histórico de desempenho"].map((item,index)=><label key={item}><input type="checkbox" defaultChecked={index < 2}/><span>{item}</span></label>)}</div><label className="period-field">Período máximo de consulta<select defaultValue="90"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">12 meses</option></select></label><div className="security-inline"><ShieldCheck/> Tokens, IDs técnicos, custos internos e comentários privados nunca serão exibidos ao cliente.</div></div>}
      {step === 7 && <div><StepIntro title="Frequência de sincronização" text="Escolha o intervalo de coleta. Uma consolidação histórica será executada diariamente."/><div className="frequency-grid">{["Manual","A cada hora","A cada 3 horas","A cada 6 horas","Diariamente"].map(value=><button className={frequency===value?"selected":""} onClick={()=>setFrequency(value)} key={value}><Clock3/><b>{value}</b>{frequency===value&&<Check/>}</button>)}</div><div className="info-callout"><Activity/> Dados recentes podem sofrer ajustes posteriores pelas plataformas. O histórico consolidado preservará as revisões.</div></div>}
      {step === 8 && <div><StepIntro title="Revise e conclua" text="Confira as escolhas antes de salvar a conexão."/><div className="review-grid"><Review label="Plataforma" value={platform ? platformLabel(platform) : ""}/><Review label="Modo" value="Demonstração"/><Review label="Contas selecionadas" value={String(accounts.length)}/><Review label="Campanhas selecionadas" value={String(campaigns.length)}/><Review label="Responsável" value="Emerson Santos"/><Review label="Frequência" value={frequency}/></div><div className="test-panel"><TestTube2/><div><b>Teste básico da conexão</b><p>{tested ? "Conexão simulada validada com sucesso." : "Teste a autorização e o acesso antes de salvar."}</p></div><button className={tested ? "tested" : ""} onClick={()=>setTested(true)}>{tested ? <><Check/> Testada</> : "Testar conexão"}</button></div></div>}
    </main><footer><button className="secondary" onClick={step === 0 ? onClose : ()=>setStep(value=>value-1)}><ArrowLeft/> {step === 0 ? "Cancelar" : "Voltar"}</button>{step < 8 ? <button className="primary" disabled={!canNext} onClick={next}>Continuar <ArrowRight/></button> : <button className="primary" disabled={!tested || saving} onClick={save}>{saving ? <LoaderCircle/> : <Check/>} Salvar conexão</button>}</footer></div></div>;
}

function Choice({ selected, icon, title, text, onClick }: { selected: boolean; icon: string; title: string; text: string; onClick: () => void }) { return <button className={selected ? "platform-option selected" : "platform-option"} onClick={onClick}><span>{icon}</span><div><h3>{title}</h3><p>{text}</p></div>{selected && <CheckCircle2/>}</button>; }
function StepIntro({ title, text }: { title: string; text: string }) { return <div className="step-intro"><h3>{title}</h3><p>{text}</p></div>; }
function SelectionList({ title, rows }: { title: string; rows: string[] }) { return <div><StepIntro title={title} text="Encontramos estas opções usando a autorização simulada."/><div className="selection-list">{rows.map(row=><label key={row}><input type="radio" name="manager" defaultChecked/><Building2/><span><b>{row}</b><small>ID demonstrativo • somente leitura</small></span><CheckCircle2/></label>)}</div></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><b>{value}</b></div>; }

function ConnectionDetail({ connection, onClose, onChanged }: { connection: Connection; onClose: () => void; onChanged: () => void }) {
  const [tab,setTab]=useState("Visão geral");
  const [confirm,setConfirm]=useState(false);
  const sync = async () => { await fetch(`/api/integrations/${connection.id}/sync`,{method:"POST"}); onChanged(); };
  const remove = async () => { await fetch(`/api/integrations/${connection.id}`,{method:"DELETE"}); onChanged(); };
  return <div className="connection-wizard-backdrop"><div className="connection-detail"><header><div><span className={`platform-logo ${connection.platform==="GOOGLE_ADS"?"google":"meta"}`}>{connection.platform==="GOOGLE_ADS"?"G":"∞"}</span><div><h2>{platformLabel(connection.platform)}</h2><Status value={connection.status}/></div></div><button onClick={onClose}><X/></button></header><div className="detail-actions"><button className="primary" onClick={sync}><RefreshCw/> Sincronizar agora</button><button className="secondary"><TestTube2/> Testar conexão</button><button className="secondary"><Pause/> Pausar</button><button className="danger-button" onClick={()=>setConfirm(true)}><Unplug/> Desconectar</button></div><nav>{["Visão geral","Contas vinculadas","Campanhas","Sincronizações","Permissões","Auditoria"].map(value=><button className={tab===value?"active":""} onClick={()=>setTab(value)} key={value}>{value}</button>)}</nav><main>{tab==="Visão geral"?<div className="overview-grid"><Review label="Plataforma" value={platformLabel(connection.platform)}/><Review label="Conta administradora" value={connection.managerName}/><Review label="Tipo de acesso" value="Somente leitura"/><Review label="Responsável" value={connection.responsible}/><Review label="Última sincronização" value={connection.lastSyncAt?"Agora mesmo":"Ainda não realizada"}/><Review label="Frequência" value={connection.frequency}/><Review label="Contas" value={String(connection.accountCount)}/><Review label="Campanhas" value={String(connection.campaignCount)}/></div>:<div className="inline-empty detail-empty"><Settings2/><h3>{tab}</h3><p>Nenhum registro disponível nesta conexão demonstrativa.</p></div>}</main>{confirm&&<div className="disconnect-confirm"><AlertTriangle/><h3>Desconectar esta integração?</h3><p>Novos dados deixarão de ser atualizados. O histórico já coletado será preservado e os dashboards vinculados deixarão de receber atualizações.</p><label><input type="checkbox" onChange={event=>(event.currentTarget.dataset.confirmed=String(event.target.checked))}/> Entendo os impactos da desconexão.</label><div><button className="secondary" onClick={()=>setConfirm(false)}>Cancelar</button><button className="danger-button" onClick={remove}>Confirmar desconexão</button></div></div>}</div></div>;
}
