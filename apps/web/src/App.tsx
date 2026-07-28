import { useMemo, useState } from "react";
import { useNavigate, useParams, Routes, Route, NavLink } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleDollarSign, Download, FileText, Gauge,
  HelpCircle, LayoutDashboard, Megaphone, Menu, MoreHorizontal, Plus, Search,
  Settings, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Users, X
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { campaigns, clients, trend, type Health } from "./data";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const nav = [
  { to: "/", icon: LayoutDashboard, label: "Visão geral" },
  { to: "/clientes", icon: BriefcaseBusiness, label: "Clientes" },
  { to: "/midia", icon: Megaphone, label: "Mídia paga" },
  { to: "/relatorios", icon: FileText, label: "Relatórios" },
  { to: "/equipe", icon: Users, label: "Equipe & acesso" },
];

function Status({ value }: { value: Health | string }) {
  const icon = value === "Saudável" ? <Check /> : <AlertTriangle />;
  return <span className={`status ${value.toLowerCase().replace(" ", "-")}`}>{icon}{value}</span>;
}

function Shell() {
  const [menu, setMenu] = useState(false);
  return <div className="app-shell">
    <aside className={menu ? "sidebar open" : "sidebar"}>
      <div className="brand"><span>PW</span><strong>OS</strong><small>PERFORMANCE WORKSPACE</small></div>
      <button className="close-menu" onClick={() => setMenu(false)} aria-label="Fechar menu"><X /></button>
      <nav aria-label="Navegação principal">{nav.map(item => <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setMenu(false)}><item.icon />{item.label}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        <NavLink to="/configuracoes"><Settings />Configurações</NavLink>
        <button><HelpCircle />Central de ajuda</button>
        <div className="user-card"><span className="avatar">ES</span><div><b>Emerson Santos</b><small>Administrador</small></div><MoreHorizontal /></div>
      </div>
    </aside>
    {menu && <button className="backdrop" onClick={() => setMenu(false)} aria-label="Fechar menu" />}
    <main>
      <header className="topbar">
        <button className="menu" onClick={() => setMenu(true)} aria-label="Abrir menu"><Menu /></button>
        <div className="search"><Search /><input aria-label="Buscar" placeholder="Buscar cliente, campanha ou relatório..." /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><span className="sync"><span /> Dados atualizados há 8 min</span><button className="icon-button" aria-label="Notificações"><Bell /><i>3</i></button><button className="profile">ES<ChevronDown /></button></div>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/midia" element={<Media />} />
        <Route path="/midia/:id" element={<CampaignDetail />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/equipe" element={<Team />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      <MobileNav />
    </main>
  </div>;
}

function PageHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Kpi({ label, value, delta, icon: Icon, tone = "blue" }: { label: string; value: string; delta: string; icon: typeof Gauge; tone?: string }) {
  const down = delta.startsWith("-");
  return <article className="kpi"><div className={`kpi-icon ${tone}`}><Icon /></div><div className="kpi-label">{label}<HelpCircle /></div><strong>{value}</strong><small className={down ? "negative" : "positive"}>{down ? <TrendingDown /> : <TrendingUp />}{delta} <span>vs. período anterior</span></small></article>;
}

function Dashboard() {
  const navigate = useNavigate();
  return <div className="page">
    <PageHead eyebrow="SEGUNDA-FEIRA, 28 DE JULHO" title="Bom dia, Emerson 👋" description="Aqui está o que merece sua atenção hoje." action={<button className="primary"><Plus /> Nova atividade</button>} />
    <section className="kpi-grid">
      <Kpi label="Investimento gerenciado" value="R$ 184,2 mil" delta="+12,8%" icon={CircleDollarSign} />
      <Kpi label="Conversões no período" value="1.284" delta="+8,4%" icon={Activity} tone="green" />
      <Kpi label="CPA médio" value="R$ 71,72" delta="-4,2%" icon={Gauge} tone="orange" />
      <Kpi label="Clientes saudáveis" value="18 de 23" delta="+2 este mês" icon={ShieldCheck} tone="purple" />
    </section>
    <section className="attention">
      <div className="section-title"><div><span className="alert-icon"><Sparkles /></span><div><h2>O que exige sua atenção</h2><p>Priorizado por impacto e urgência</p></div></div><button>Ver todos <ArrowRight /></button></div>
      <div className="attention-grid">
        <article className="action-card critical"><span className="tag"><AlertTriangle />Crítico</span><small>GOOGLE ADS • NORTE CLINIC</small><h3>Orçamento deve esgotar em 3 dias</h3><p>O ritmo atual está 24% acima do planejado. Ajuste sugerido: reduzir R$ 180/dia.</p><div><span>Impacto alto</span><button onClick={() => navigate("/midia/norte")}>Analisar <ArrowRight /></button></div></article>
        <article className="action-card warning"><span className="tag"><TrendingUp />Oportunidade</span><small>META ADS • LINX ACADEMY</small><h3>Campanha superou a meta em 21%</h3><p>Há margem para escalar mantendo o CPA abaixo da meta de R$ 42,00.</p><div><span>Potencial +38 leads</span><button onClick={() => navigate("/midia/linx")}>Analisar <ArrowRight /></button></div></article>
        <article className="action-card neutral"><span className="tag"><CalendarDays />Hoje</span><small>RELACIONAMENTO • SOLAR PRIME</small><h3>Reunião de resultados às 15h</h3><p>Relatório pronto. Dois pontos de decisão foram destacados para a conversa.</p><div><span>Em 3 horas</span><button>Preparar <ArrowRight /></button></div></article>
      </div>
    </section>
    <section className="two-columns">
      <article className="panel performance"><div className="section-title"><div><h2>Performance da carteira</h2><p>01–28 jul • Todas as plataformas</p></div><button className="select">Conversões <ChevronDown /></button></div>
        <div className="chart-summary"><strong>858</strong><span className="positive"><TrendingUp />+14,7%</span><small>conversões acumuladas</small></div>
        <div className="chart"><ResponsiveContainer width="100%" height={210}><AreaChart data={trend}><defs><linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f84607" stopOpacity={.32}/><stop offset="100%" stopColor="#f84607" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ebef"/><XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip/><Area type="monotone" dataKey="anterior" stroke="#9ba5b2" strokeDasharray="5 5" fill="transparent"/><Area type="monotone" dataKey="atual" stroke="#f84607" strokeWidth={3} fill="url(#colorAtual)"/></AreaChart></ResponsiveContainer></div>
      </article>
      <article className="panel health"><div className="section-title"><div><h2>Saúde dos clientes</h2><p>23 clientes ativos</p></div><button onClick={() => navigate("/clientes")}>Ver carteira <ArrowRight /></button></div>
        <div className="health-ring"><div><strong>78%</strong><span>saudáveis</span></div></div>
        <div className="health-list"><div><span className="dot green"/>Saudáveis <b>18</b></div><div><span className="dot yellow"/>Em atenção <b>3</b></div><div><span className="dot red"/>Em risco <b>2</b></div></div>
        <div className="recommendation"><Sparkles /><p><b>Recomendação do dia</b>Priorize Norte Clinic antes das 14h para evitar interrupção.</p></div>
      </article>
    </section>
  </div>;
}

function Clients() {
  return <div className="page"><PageHead eyebrow="CARTEIRA" title="Clientes" description="Saúde, pendências e próximas ações em uma visão." action={<button className="primary"><Plus /> Novo cliente</button>} />
    <div className="summary-row"><span><b>23</b> ativos</span><span><b className="green-text">18</b> saudáveis</span><span><b className="yellow-text">3</b> em atenção</span><span><b className="red-text">2</b> em risco</span></div>
    <div className="panel table-panel"><div className="table-tools"><div className="search small"><Search /><input placeholder="Buscar cliente..." /></div><button className="select">Todos os status <ChevronDown /></button></div>
      <div className="client-grid">{clients.map((c, i) => <article className="client-card" key={c.name}><div className="client-name"><span>{c.name.slice(0,2).toUpperCase()}</span><div><h3>{c.name}</h3><small>{c.channels}</small></div></div><Status value={c.status}/><dl><div><dt>Responsável</dt><dd>{c.owner}</dd></div><div><dt>Próxima ação</dt><dd>{c.next}</dd></div></dl><p><Sparkles />{c.note}</p><button>Ver detalhes <ArrowRight /></button></article>)}</div>
    </div>
  </div>;
}

function Media() {
  const [filter, setFilter] = useState("Todos");
  const navigate = useNavigate();
  const rows = useMemo(() => campaigns.filter(c => filter === "Todos" || c.platform === filter), [filter]);
  const spend = rows.reduce((n, c) => n + c.spend, 0);
  const conv = rows.reduce((n, c) => n + c.conversions, 0);
  return <div className="page"><PageHead eyebrow="MÍDIA PAGA" title="Performance de campanhas" description="01–28 jul 2026 • Comparado a 01–28 jun" action={<button className="secondary"><Download /> Exportar relatório</button>} />
    <div className="segmented" role="tablist">{["Todos", "Meta Ads", "Google Ads"].map(v => <button role="tab" aria-selected={filter === v} className={filter === v ? "active" : ""} onClick={() => setFilter(v)} key={v}>{v}</button>)}</div>
    <section className="kpi-grid compact"><Kpi label="Investimento" value={money(spend)} delta="+11,2%" icon={CircleDollarSign}/><Kpi label="Conversões" value={String(conv)} delta="+9,7%" icon={Activity} tone="green"/><Kpi label="CPA médio" value={money(spend/conv)} delta="-3,1%" icon={Gauge} tone="orange"/><Kpi label="Saldo disponível" value={money(rows.reduce((n,c)=>n+c.budget-c.spend,0))} delta="+6 dias" icon={BarChart3} tone="purple"/></section>
    <div className="panel campaigns"><div className="section-title"><div><h2>Campanhas ativas</h2><p>{rows.length} resultados • Atualizado há 8 min</p></div><div className="search small"><Search/><input placeholder="Buscar campanha"/></div></div>
      <div className="table-scroll"><table><thead><tr><th>Cliente / campanha</th><th>Plataforma</th><th>Status</th><th>Investimento</th><th>Conversões</th><th>CPA</th><th>Variação</th><th></th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><b>{c.client}</b><small>{c.campaign}</small></td><td>{c.platform}</td><td><Status value={c.status}/></td><td>{money(c.spend)}<small>de {money(c.budget)}</small></td><td>{c.conversions}</td><td>{money(c.cpa)}</td><td><span className={c.change > 0 ? "positive" : "negative"}>{c.change > 0 ? "↑" : "↓"} {Math.abs(c.change)}%</span></td><td><button className="analyze" onClick={() => navigate(`/midia/${c.id}`)}>Analisar <ArrowRight/></button></td></tr>)}</tbody></table></div>
    </div>
  </div>;
}

function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = campaigns.find(item => item.id === id) || campaigns[0];
  return <div className="page"><button className="back" onClick={() => navigate("/midia")}><ArrowLeft/> Voltar para campanhas</button>
    <PageHead eyebrow={`${c.platform.toUpperCase()} • ${c.client.toUpperCase()}`} title={c.campaign} description={`Responsável: ${c.owner} • Sincronizado há 8 min`} action={<Status value={c.status}/>} />
    <section className="kpi-grid compact"><Kpi label="Investimento" value={money(c.spend)} delta="+8,2%" icon={CircleDollarSign}/><Kpi label="Conversões" value={String(c.conversions)} delta={`${c.change > 0 ? "+" : ""}${c.change}%`} icon={Activity} tone="green"/><Kpi label="CPA" value={money(c.cpa)} delta="-4,1%" icon={Gauge} tone="orange"/><Kpi label="Saldo" value={money(c.budget-c.spend)} delta="6 dias" icon={BarChart3} tone="purple"/></section>
    <section className="two-columns detail"><article className="panel performance"><div className="section-title"><div><h2>Conversões por dia</h2><p>Período atual x anterior</p></div></div><div className="chart"><ResponsiveContainer width="100%" height={300}><AreaChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" axisLine={false}/><YAxis axisLine={false}/><Tooltip/><Area type="monotone" dataKey="anterior" stroke="#9ba5b2" fill="transparent" strokeDasharray="5 5"/><Area type="monotone" dataKey="atual" stroke="#f84607" fill="#f8460718" strokeWidth={3}/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel insight-panel"><span className="ai-label"><Sparkles/>LEITURA PW</span><h2>Ritmo saudável, com espaço para crescer</h2><p>A campanha está entregando conversões 12% acima do período anterior com redução no custo por aquisição.</p><div className="insight-row"><Check/><p><b>Ponto positivo</b>Taxa de conversão cresceu 1,8 p.p.</p></div><div className="insight-row warn"><AlertTriangle/><p><b>Ponto de atenção</b>Mobile concentra 74% do gasto e 61% das conversões.</p></div><button className="primary">Criar ação de otimização</button></article>
    </section>
    <section className="panel actions"><div className="section-title"><div><h2>Ações e próximos passos</h2><p>Histórico operacional da campanha</p></div><button className="secondary"><Plus/> Registrar ação</button></div><div className="timeline"><div><span/><p><b>Ajuste de palavras-chave negativas</b><small>Hoje, 09:42 • Lucas Andrade</small></p><em>Concluído</em></div><div><span/><p><b>Revisar distribuição por dispositivo</b><small>Próxima ação • até 30 jul</small></p><em className="pending">Pendente</em></div></div></section>
  </div>;
}

function Reports() {
  const [created, setCreated] = useState(false);
  return <div className="page"><PageHead eyebrow="INTELIGÊNCIA" title="Relatórios" description="Compartilhe resultados claros, seguros e fáceis de entender." action={<button className="primary" onClick={() => setCreated(true)}><Plus/> Gerar relatório</button>} />
    {created && <div className="toast"><Check/><div><b>Relatório gerado com segurança</b><span>Link protegido válido até 29 jul, 10:30.</span></div><button onClick={()=>setCreated(false)}><X/></button></div>}
    <div className="report-grid"><article className="report-feature"><span><FileText/></span><div><small>RELATÓRIO MAIS RECENTE</small><h2>Resultados • Solar Prime</h2><p>01–28 jul 2026 • Google Ads + Meta Ads</p><div><span className="status saudável"><Check/>Pronto</span><small>Atualizado há 12 min</small></div></div><button className="primary">Abrir relatório</button></article>
      {[["Vivaz Urbanismo","Expira em 18h","Acessado"],["Norte Clinic","Expira em 22h","Não acessado"],["Linx Academy","Expirado","Expirado"]].map(r=><article className="report-card" key={r[0]}><FileText/><div><h3>{r[0]}</h3><p>Relatório mensal • Julho</p></div><span>{r[2]}</span><small>{r[1]}</small><button><MoreHorizontal/></button></article>)}</div>
    <div className="security-note"><ShieldCheck/><div><b>Compartilhamento protegido</b><p>Links usam tokens não enumeráveis, expiram em 24 horas e podem ser revogados a qualquer momento. O acesso não concede entrada ao sistema.</p></div></div>
  </div>;
}

function Team() {
  return <div className="page"><PageHead eyebrow="ADMINISTRAÇÃO" title="Equipe e acessos" description="Pessoas, cargos e permissões efetivas da organização." action={<button className="primary"><Plus/> Convidar usuário</button>} />
    <div className="permission-banner"><ShieldCheck/><div><b>Modelo híbrido de acesso ativo</b><p>Negação individual → concessão individual → cargo → hierarquia → negar.</p></div><button>Simular acesso</button></div>
    <div className="panel team-table"><div className="section-title"><div><h2>Usuários ativos</h2><p>8 colaboradores • 3 clientes externos</p></div><button className="select">Todos os perfis <ChevronDown/></button></div>
      {[["Emerson Santos","MASTER","CEO","Todos os módulos"],["Marina Costa","COLABORADOR","Gestora","Equipe e carteira"],["Lucas Andrade","COLABORADOR","Gestor de Tráfego","Clientes atribuídos"],["Ana Souza","CLIENTE","Cliente externo","Solar Prime"]].map((u,i)=><div className="team-row" key={u[0]}><span className="avatar">{u[0].split(" ").map(x=>x[0]).join("").slice(0,2)}</span><div><b>{u[0]}</b><small>{i===0?"herodronecwb@gmail.com":u[0].toLowerCase().replace(" ",".")+"@exemplo.com"}</small></div><span className="role">{u[1]}</span><span>{u[2]}</span><span><ShieldCheck/>{u[3]}</span><button><MoreHorizontal/></button></div>)}
    </div>
  </div>;
}

function MobileNav() {
  return <nav className="mobile-nav">{nav.slice(0,4).map(item=><NavLink key={item.to} to={item.to} end={item.to==="/"}><item.icon/><span>{item.label.split(" ")[0]}</span></NavLink>)}</nav>;
}

export function App() { return <Shell />; }
