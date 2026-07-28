import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Routes, Route, NavLink } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleDollarSign, Download, FileText, Gauge,
  Eye, EyeOff, HelpCircle, LayoutDashboard, LogOut, Megaphone, Menu, MoreHorizontal, Plus, Search,
  Settings, ShieldCheck, Sparkles, Sun, Moon, TrendingDown, TrendingUp, UserPlus, Users, X
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

type SessionUser = { id: string; name: string; email: string; profile: string; role: string };

function Shell({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("pw-os-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(current => current === "light" ? "dark" : "light");

  return <div className="app-shell">
    <aside className={menu ? "sidebar open" : "sidebar"}>
      <div className="brand"><span>PW</span><strong>OS</strong><small>PERFORMANCE WORKSPACE</small></div>
      <button className="close-menu" onClick={() => setMenu(false)} aria-label="Fechar menu"><X /></button>
      <nav aria-label="Navegação principal">{nav.map(item => <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setMenu(false)}><item.icon />{item.label}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        <NavLink to="/configuracoes"><Settings />Configurações</NavLink>
        <button><HelpCircle />Central de ajuda</button>
        <div className="user-card"><span className="avatar">{user.name.split(" ").map(part => part[0]).join("").slice(0, 2)}</span><div><b>{user.name}</b><small>{user.role}</small></div><button onClick={onLogout} aria-label="Sair"><LogOut /></button></div>
      </div>
    </aside>
    {menu && <button className="backdrop" onClick={() => setMenu(false)} aria-label="Fechar menu" />}
    <main>
      <header className="topbar">
        <button className="menu" onClick={() => setMenu(true)} aria-label="Abrir menu"><Menu /></button>
        <div className="search"><Search /><input aria-label="Buscar" placeholder="Buscar cliente, campanha ou relatório..." /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><span className="sync"><span /> Ambiente local</span><button className="theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`} title={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`}>{theme === "light" ? <Moon /> : <Sun />}</button><button className="icon-button" aria-label="Notificações"><Bell /></button><button className="profile">{user.name.split(" ").map(part => part[0]).join("").slice(0, 2)}<ChevronDown /></button></div>
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
  return <div className="page">
    <PageHead eyebrow="VISÃO GERAL" title="Bem-vindo ao PW OS" description="Seu ambiente está pronto. Comece cadastrando a equipe e os clientes." action={<button className="primary"><Plus /> Nova atividade</button>} />
    <section className="kpi-grid">
      <Kpi label="Investimento gerenciado" value="R$ 0" delta="0%" icon={CircleDollarSign} />
      <Kpi label="Conversões no período" value="0" delta="0%" icon={Activity} tone="green" />
      <Kpi label="CPA médio" value="R$ 0" delta="0%" icon={Gauge} tone="orange" />
      <Kpi label="Clientes ativos" value="0" delta="0 neste mês" icon={ShieldCheck} tone="purple" />
    </section>
    <section className="panel empty-state">
      <span><Sparkles /></span><h2>Nenhum dado cadastrado ainda</h2><p>Cadastre usuários, clientes e campanhas para começar a acompanhar a operação.</p>
      <div><NavLink to="/equipe" className="primary"><UserPlus /> Criar primeiro usuário</NavLink><NavLink to="/clientes" className="secondary"><BriefcaseBusiness /> Cadastrar cliente</NavLink></div>
    </section>
  </div>;
}

function Clients() {
  return <div className="page"><PageHead eyebrow="CARTEIRA" title="Clientes" description="Saúde, pendências e próximas ações em uma visão." action={<button className="primary"><Plus /> Novo cliente</button>} />
    <div className="summary-row"><span><b>0</b> ativos</span><span><b className="green-text">0</b> saudáveis</span><span><b className="yellow-text">0</b> em atenção</span><span><b className="red-text">0</b> em risco</span></div>
    <div className="panel table-panel"><div className="table-tools"><div className="search small"><Search /><input placeholder="Buscar cliente..." /></div><button className="select">Todos os status <ChevronDown /></button></div>
      {clients.length === 0 ? <div className="inline-empty"><BriefcaseBusiness /><h3>Nenhum cliente cadastrado</h3><p>Use “Novo cliente” para criar o primeiro registro.</p></div> : <div className="client-grid">{clients.map(c => <article className="client-card" key={c.name}><div className="client-name"><span>{c.name.slice(0,2).toUpperCase()}</span><div><h3>{c.name}</h3><small>{c.channels}</small></div></div><Status value={c.status}/><dl><div><dt>Responsável</dt><dd>{c.owner}</dd></div><div><dt>Próxima ação</dt><dd>{c.next}</dd></div></dl><p><Sparkles />{c.note}</p><button>Ver detalhes <ArrowRight /></button></article>)}</div>}
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
    <section className="kpi-grid compact"><Kpi label="Investimento" value={money(spend)} delta="0%" icon={CircleDollarSign}/><Kpi label="Conversões" value={String(conv)} delta="0%" icon={Activity} tone="green"/><Kpi label="CPA médio" value={money(conv ? spend/conv : 0)} delta="0%" icon={Gauge} tone="orange"/><Kpi label="Saldo disponível" value={money(rows.reduce((n,c)=>n+c.budget-c.spend,0))} delta="0 dias" icon={BarChart3} tone="purple"/></section>
    <div className="panel campaigns"><div className="section-title"><div><h2>Campanhas ativas</h2><p>{rows.length} resultados • Atualizado há 8 min</p></div><div className="search small"><Search/><input placeholder="Buscar campanha"/></div></div>
      {rows.length === 0 ? <div className="inline-empty"><Megaphone /><h3>Nenhuma campanha cadastrada</h3><p>Vincule uma conta de mídia e crie a primeira campanha.</p></div> : <div className="table-scroll"><table><thead><tr><th>Cliente / campanha</th><th>Plataforma</th><th>Status</th><th>Investimento</th><th>Conversões</th><th>CPA</th><th>Variação</th><th></th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><b>{c.client}</b><small>{c.campaign}</small></td><td>{c.platform}</td><td><Status value={c.status}/></td><td>{money(c.spend)}<small>de {money(c.budget)}</small></td><td>{c.conversions}</td><td>{money(c.cpa)}</td><td><span className={c.change > 0 ? "positive" : "negative"}>{c.change > 0 ? "↑" : "↓"} {Math.abs(c.change)}%</span></td><td><button className="analyze" onClick={() => navigate(`/midia/${c.id}`)}>Analisar <ArrowRight/></button></td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}

function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = campaigns.find(item => item.id === id);
  if (!c) return <div className="page"><button className="back" onClick={() => navigate("/midia")}><ArrowLeft/> Voltar para campanhas</button><div className="panel inline-empty"><Megaphone/><h3>Campanha não encontrada</h3><p>Nenhuma campanha foi cadastrada ainda.</p></div></div>;
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
  return <div className="page"><PageHead eyebrow="INTELIGÊNCIA" title="Relatórios" description="Compartilhe resultados claros, seguros e fáceis de entender." action={<button className="primary"><Plus/> Gerar relatório</button>} />
    <div className="panel inline-empty"><FileText/><h3>Nenhum relatório gerado</h3><p>Os relatórios aparecerão aqui depois que clientes e campanhas tiverem dados.</p></div>
    <div className="security-note"><ShieldCheck/><div><b>Compartilhamento protegido</b><p>Links usam tokens não enumeráveis, expiram em 24 horas e podem ser revogados a qualquer momento. O acesso não concede entrada ao sistema.</p></div></div>
  </div>;
}

function Team() {
  const [usersList, setUsersList] = useState<SessionUser[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const loadUsers = () => fetch("/api/users").then(response => response.json()).then(data => setUsersList(data.users || []));
  useEffect(() => { void loadUsers(); }, []);
  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setOpen(false);
    await loadUsers();
  };
  return <div className="page"><PageHead eyebrow="ADMINISTRAÇÃO" title="Equipe e acessos" description="Pessoas, cargos e permissões efetivas da organização." action={<button className="primary" onClick={() => setOpen(true)}><Plus/> Criar usuário</button>} />
    <div className="permission-banner"><ShieldCheck/><div><b>Modelo híbrido de acesso ativo</b><p>Negação individual → concessão individual → cargo → hierarquia → negar.</p></div><button>Simular acesso</button></div>
    <div className="panel team-table"><div className="section-title"><div><h2>Usuários ativos</h2><p>{usersList.length} {usersList.length === 1 ? "usuário" : "usuários"}</p></div><button className="select">Todos os perfis <ChevronDown/></button></div>
      {usersList.map(user => <div className="team-row" key={user.id}><span className="avatar">{user.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><div><b>{user.name}</b><small>{user.email}</small></div><span className="role">{user.profile}</span><span>{user.role}</span><span><ShieldCheck/>{user.profile === "MASTER" ? "Todos os módulos" : "Conforme permissões"}</span><button><MoreHorizontal/></button></div>)}
    </div>
    {open && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-user-title"><button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar"><X/></button><span className="modal-icon"><UserPlus/></span><h2 id="new-user-title">Criar usuário</h2><p>Defina os dados de acesso e o perfil técnico inicial.</p><form onSubmit={createUser}><label>Nome completo<input name="name" required autoFocus /></label><label>E-mail<input name="email" type="email" required /></label><div className="form-grid"><label>Perfil<select name="profile"><option value="COLLABORATOR">Colaborador</option><option value="ADMIN">Administrador</option><option value="CLIENT">Cliente externo</option></select></label><label>Cargo<input name="role" required placeholder="Ex.: Gestor de Tráfego" /></label></div><label>Senha inicial<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="primary">Criar usuário</button></div></form></div></div>}
  </div>;
}

function MobileNav() {
  return <nav className="mobile-nav">{nav.slice(0,4).map(item=><NavLink key={item.to} to={item.to} end={item.to==="/"}><item.icon/><span>{item.label.split(" ")[0]}</span></NavLink>)}</nav>;
}

function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else onLogin(data.user);
    } catch {
      setError("Não foi possível conectar ao ambiente local.");
    } finally {
      setLoading(false);
    }
  };
  return <main className="login-page"><section className="login-brand"><div className="brand login-logo"><span>PW</span><strong>OS</strong><small>PERFORMANCE WORKSPACE</small></div><div><span className="eyebrow">PW MEDIA</span><h1>Estratégia, operação e resultados em um só lugar.</h1><p>Uma visão clara para transformar dados em próximas ações.</p></div><small>Ambiente local protegido</small></section><section className="login-area"><div className="login-card"><span className="login-badge"><ShieldCheck/> Acesso seguro</span><h2>Bem-vindo</h2><p>Entre com sua conta para acessar o PW OS.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="username" required placeholder="seuemail@empresa.com" /></label><label>Senha<div className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Digite sua senha" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label><div className="login-options"><label><input type="checkbox"/> Manter conectado</label><button type="button">Esqueci minha senha</button></div>{error && <div className="form-error"><AlertTriangle/>{error}</div>}<button className="primary login-submit" disabled={loading}>{loading ? "Entrando..." : "Entrar no PW OS"}<ArrowRight/></button></form><small>Suas credenciais são validadas somente no ambiente local.</small></div></section></main>;
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { fetch("/api/auth/session").then(async response => response.ok && setUser((await response.json()).user)).finally(() => setChecking(false)); }, []);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); };
  if (checking) return <div className="app-loading"><div className="brand login-logo"><span>PW</span><strong>OS</strong></div><p>Carregando ambiente seguro...</p></div>;
  return user ? <Shell user={user} onLogout={logout} /> : <Login onLogin={setUser} />;
}
