import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileText,
  FileSignature,
  Gauge,
  Eye,
  EyeOff,
  HelpCircle,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  X,
  MessagesSquare,
  KanbanSquare,
  ListTodo,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { campaigns, clients, trend, type Health } from "./data";
import { Connections } from "./Connections";
import { AccessManagement } from "./AccessManagement";
import { ClientsManagement } from "./ClientsManagement";
import { TicketsManagement } from "./TicketsManagement";
import { DashboardBoards } from "./DashboardBoards";
import { CrmManagement } from "./CrmManagement";
import { TasksManagement } from "./TasksManagement";
import { CalendarManagement } from "./CalendarManagement";
import { OperationalReports } from "./OperationalReports";
import { PublicProposal } from "./PublicProposal";
import { ProposalManagement } from "./ProposalManagement";

const MediaDashboard = lazy(() => import("./MediaDashboard").then((module) => ({ default: module.MediaDashboard })));
import { FinancialManagement } from "./FinancialManagement";
import { SettingsManagement } from "./SettingsManagement";
import { HelpCenter } from "./HelpCenter";
import { maskPhone } from "./inputMasks";
import "./Notifications.css";
import "./SidebarMediaSubmenu.css";
import "./SidebarMediaGapFix.css";

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const nav = [
  { to: "/", icon: LayoutDashboard, label: "Visão geral" },
  { to: "/clientes", icon: BriefcaseBusiness, label: "Clientes" },
  { to: "/crm", icon: KanbanSquare, label: "CRM's" },
  { to: "/propostas", icon: FileSignature, label: "Propostas" },
  { to: "/tarefas", icon: ListTodo, label: "Creative Ops" },
  { to: "/agenda", icon: CalendarDays, label: "Agenda" },
  { to: "/financeiro", icon: CircleDollarSign, label: "Financeiro" },
  { to: "/midia", icon: Megaphone, label: "Mídia paga" },
  { to: "/relatorios", icon: FileText, label: "Relatórios" },
  { to: "/chamados", icon: MessagesSquare, label: "Chamados internos" },
  { to: "/equipe", icon: Users, label: "Equipe & acesso" },
  {
    to: "/configuracoes/integracoes",
    icon: Plug,
    label: "Central de Conexões",
  },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
  { to: "/ajuda", icon: HelpCircle, label: "Central de ajuda" },
];

function Status({ value }: { value: Health | string }) {
  const icon = value === "Saudável" ? <Check /> : <AlertTriangle />;
  return (
    <span className={`status ${value.toLowerCase().replace(" ", "-")}`}>
      {icon}
      {value}
    </span>
  );
}

type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarDataUrl?: string;
  profile: string;
  role: string;
  roleId?: string;
  mustChangePassword: boolean;
  clientId?: string;
  permissions: string[];
  departmentId?: string;
  departmentName?: string;
};
type MediaNotification = {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  clientName: string;
  campaignName?: string;
  responsibleName: string;
  createdAt: string;
  read: boolean;
  targetUrl?: string;
};

function UserAvatar({
  user,
  className = "",
}: {
  user: SessionUser;
  className?: string;
}) {
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={`avatar ${className}`}>
      {user.avatarDataUrl ? (
        <img src={user.avatarDataUrl} alt="Foto do perfil" />
      ) : (
        initials
      )}
    </span>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`brand${compact ? " compact-brand" : ""}`}
      aria-label="PW OS - Performance Workspace"
    >
      <img src="/logo-pw-os.png" alt="PW OS" />
      {!compact && <small>PERFORMANCE WORKSPACE</small>}
    </div>
  );
}

function Shell({
  user,
  onLogout,
  onUserUpdate,
}: {
  user: SessionUser;
  onLogout: () => void;
  onUserUpdate: (user: SessionUser) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(() => location.pathname.startsWith("/midia"));
  const [accountMenu, setAccountMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<MediaNotification[]>([]),
    [unreadCount, setUnreadCount] = useState(0);
  const [profilePanel, setProfilePanel] = useState<
    "profile" | "security" | null
  >(null);
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("pw-os-theme", theme);
  }, [theme]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenu(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    setAccountMenu(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const response = await fetch("/api/notifications"),
        payload = await response.json();
      if (response.ok) {
        setNotifications(payload.notifications || []);
        setUnreadCount(payload.unreadCount || 0);
      }
    } catch {
      /* mantém a navegação disponível se os alertas estiverem offline */
    }
  };
  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(
      () => void loadNotifications(),
      5 * 60_000,
    );
    return () => window.clearInterval(timer);
  }, [user.id]);
  const openNotification = async (item: MediaNotification) => {
    if (!item.read) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: item.id }),
      });
      setNotifications((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, read: true } : value,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    setNotificationsOpen(false);
    navigate(item.targetUrl || "/midia");
  };
  const readAll = async () => {
    const ids = notifications
      .filter((item) => !item.read)
      .map((item) => item.id);
    if (!ids.length) return;
    await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertIds: ids }),
    });
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true })),
    );
    setUnreadCount(0);
  };

  const toggleTheme = () =>
    setTheme((current) => (current === "light" ? "dark" : "light"));

  const can = (permission: string) =>
    user.profile === "MASTER" || user.permissions?.includes(permission);
  const visibleNav = nav.filter((item) => {
    const permissionByPath: Record<string, string> = {
      "/": "dashboard.view",
      "/clientes": "clients.view",
      "/crm": "crm.view",
      "/propostas": "proposals.view",
      "/tarefas": "creative_ops.view",
      "/agenda": "calendar.view",
      "/financeiro": "finance.view",
      "/midia": "media.view",
      "/relatorios": "reports.view",
      "/chamados": "tickets.view",
      "/equipe": "users.view",
      "/configuracoes/integracoes": "integrations.view",
      "/configuracoes": "settings.view",
    };
    if (item.to === "/crm") return can("crm.view") || can("opportunities.view");
    return !permissionByPath[item.to] || can(permissionByPath[item.to]);
  });
  const firstAccessiblePath = visibleNav[0]?.to || "/ajuda";

  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <Brand />
        <button
          className="close-menu"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <nav aria-label="Navegação principal">
          {visibleNav.map((item) => item.to === "/midia" ? (
            <div className={`sidebar-media-group ${mediaMenuOpen ? "open" : ""}`} key={item.to}>
              <button type="button" className={`sidebar-media-parent ${location.pathname.startsWith("/midia") ? "active" : ""}`} onClick={() => setMediaMenuOpen((value) => !value)} aria-expanded={mediaMenuOpen}>
                <item.icon />{item.label}<ChevronDown className="sidebar-media-chevron" />
              </button>
              <div className="sidebar-media-submenu">
                <NavLink to="/midia/hoje" onClick={() => setMenu(false)}>Hoje</NavLink>
                <NavLink to="/midia/compilado" onClick={() => setMenu(false)}>Visão geral</NavLink>
                <NavLink to="/midia/campanhas" onClick={() => setMenu(false)}>Campanhas</NavLink>
                <NavLink to="/midia/gestao" onClick={() => setMenu(false)}>Contas e vínculos</NavLink>
                <NavLink to="/midia/relatorios" onClick={() => setMenu(false)}>Relatórios</NavLink>
                <NavLink to="/midia/historico" onClick={() => setMenu(false)}>Histórico</NavLink>
              </div>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/" || item.to === "/configuracoes"}
              onClick={() => setMenu(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <UserAvatar user={user} />
            <div>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </div>
            <button onClick={onLogout} aria-label="Sair">
              <LogOut />
            </button>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="backdrop"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        />
      )}
      <main>
        <header className="topbar">
          <button
            className="menu"
            onClick={() => setMenu(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <div className="search">
            <Search />
            <input
              aria-label="Buscar"
              placeholder="Buscar cliente, campanha ou relatório..."
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <span className="sync">
              <span /> Ambiente local
            </span>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`}
              title={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`}
            >
              {theme === "light" ? <Moon /> : <Sun />}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setAccountMenu(false);
                  void loadNotifications();
                }}
                aria-label={`${unreadCount} notificações não lidas`}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
              >
                <Bell />
                {unreadCount > 0 && (
                  <i>{unreadCount > 99 ? "99+" : unreadCount}</i>
                )}
              </button>
              {notificationsOpen && (
                <>
                  <button
                    className="notification-dismiss"
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Fechar notificações"
                  />
                  <section
                    className="notification-popover"
                    role="dialog"
                    aria-label="Central de notificações"
                  >
                    <header>
                      <div>
                        <b>Alertas importantes</b>
                        <small>Campanhas sob sua responsabilidade</small>
                      </div>
                      <span>
                        {unreadCount > 0 && (
                          <button
                            className="notification-read-all"
                            onClick={() => void readAll()}
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                        <button
                          onClick={() => setNotificationsOpen(false)}
                          aria-label="Fechar"
                        >
                          <X />
                        </button>
                      </span>
                    </header>
                    {notifications.length ? (
                      <div className="notification-list">
                        {notifications.slice(0, 20).map((item) => (
                          <button
                            key={item.id}
                            className={`${item.severity.toLowerCase()} ${item.read ? "read" : "unread"}`}
                            onClick={() => void openNotification(item)}
                          >
                            <i>
                              {item.severity === "CRITICAL" ? (
                                <AlertTriangle />
                              ) : item.severity === "WARNING" ? (
                                <Bell />
                              ) : (
                                <Megaphone />
                              )}
                            </i>
                            <span>
                              <small>
                                {item.clientName}
                                {item.campaignName
                                  ? ` · ${item.campaignName}`
                                  : ""}
                              </small>
                              <b>{item.title}</b>
                              <p>{item.message}</p>
                              <em>Responsável: {item.responsibleName}</em>
                            </span>
                            {!item.read && <u />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="notification-empty">
                        <span>
                          <Bell />
                        </span>
                        <b>Você está em dia</b>
                        <p>Não há alertas importantes no momento.</p>
                      </div>
                    )}
                    <footer>
                      <span>
                        <i /> Atualização automática a cada 5 minutos
                      </span>
                    </footer>
                  </section>
                </>
              )}
            </div>
            <div className="account-menu-wrap">
              <button
                className="profile"
                onClick={() => {
                  setAccountMenu((value) => !value);
                  setNotificationsOpen(false);
                }}
                aria-expanded={accountMenu}
                aria-haspopup="menu"
              >
                <UserAvatar user={user} />
                <ChevronDown />
              </button>
              {accountMenu && (
                <>
                  <button
                    className="account-menu-dismiss"
                    onClick={() => setAccountMenu(false)}
                    aria-label="Fechar menu"
                  />
                  <div className="account-dropdown" role="menu">
                    <div className="account-cover">
                      <span>PW</span>
                      <i />
                      <button type="button" className="account-menu-close" onClick={() => setAccountMenu(false)} aria-label="Fechar menu"><X /></button>
                    </div>
                    <header>
                      <UserAvatar user={user} className="large" />
                      <div>
                        <b>{user.name}</b>
                        <span>{user.email}</span>
                        <small>
                          <i />
                          {user.role}
                        </small>
                      </div>
                    </header>
                    <div className="account-section-label">SUA CONTA</div>
                    <div className="account-menu-items">
                      <button
                        onClick={() => {
                          setProfilePanel("profile");
                          setAccountMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">
                          <UserPlus />
                        </span>
                        <span>
                          <b>Meu perfil</b>
                          <small>Dados pessoais e foto</small>
                        </span>
                        <ChevronDown />
                      </button>
                      <button
                        onClick={() => {
                          setProfilePanel("security");
                          setAccountMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">
                          <LockKeyhole />
                        </span>
                        <span>
                          <b>Segurança</b>
                          <small>Senha e proteção da conta</small>
                        </span>
                        <ChevronDown />
                      </button>
                      <button onClick={toggleTheme}>
                        <span className="menu-item-icon">
                          {theme === "light" ? <Moon /> : <Sun />}
                        </span>
                        <span>
                          <b>Aparência</b>
                          <small>
                            Tema {theme === "light" ? "claro" : "escuro"} ativo
                          </small>
                        </span>
                        <span className="theme-pill">
                          {theme === "light" ? "Claro" : "Escuro"}
                        </span>
                      </button>
                    </div>
                    <footer>
                      <span>PW OS · {user.profile}</span>
                      <button onClick={() => { setAccountMenu(false); setNotificationsOpen(false); onLogout(); }}>
                        <LogOut /> Sair
                      </button>
                    </footer>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <Suspense fallback={<div className="route-skeleton" role="status"><i/><i/><i/><span>Carregando módulo…</span></div>}><Routes>
          <Route
            path="/"
            element={
              can("dashboard.view") ? (
                <DashboardBoards user={user} />
              ) : (
                <Navigate to={firstAccessiblePath} replace />
              )
            }
          />
          <Route
            path="/clientes"
            element={
              <ClientsManagement
                permissions={user.permissions || []}
                profile={user.profile}
              />
            }
          />
          <Route
            path="/crm"
            element={
              <CrmManagement
                permissions={user.permissions || []}
                profile={user.profile}
              />
            }
          />
          <Route
            path="/propostas"
            element={
              can("proposals.view") ? (
                <ProposalManagement
                  permissions={user.permissions || []}
                  profile={user.profile}
                />
              ) : (
                <Navigate to={firstAccessiblePath} replace />
              )
            }
          />
          <Route
            path="/tarefas"
            element={
              can("creative_ops.view") ? (
                <TasksManagement
                  permissions={user.permissions || []}
                  profile={user.profile}
                />
              ) : (
                <Navigate to={firstAccessiblePath} replace />
              )
            }
          />
          <Route
            path="/agenda"
            element={
              can("calendar.view") ? (
                <CalendarManagement />
              ) : (
                <Navigate to={firstAccessiblePath} replace />
              )
            }
          />
          <Route path="/financeiro" element={can("finance.view")?<FinancialManagement />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia" element={can("media.view")?<Navigate to="/midia/hoje" replace />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/hoje" element={can("media.view")?<MediaDashboard section="TODAY" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/gestao" element={can("media.view")?<MediaDashboard section="CLIENTS" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/campanhas" element={can("media.view")?<MediaDashboard section="CAMPAIGNS" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/compilado" element={can("media.view")?<MediaDashboard section="COMPILED" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/relatorios" element={can("media.view")?<MediaDashboard section="REPORTS" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/historico" element={can("media.view")?<MediaDashboard section="HISTORY" />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/midia/:id" element={can("media.view")?<MediaDashboard />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/relatorios" element={can("reports.view")?<OperationalReports />:<Navigate to={firstAccessiblePath} replace />} />
          <Route path="/chamados" element={can("tickets.view")?<TicketsManagement user={user} />:<Navigate to={firstAccessiblePath} replace />} />
          <Route
            path="/equipe"
            element={
              can("users.view") ? <AccessManagement
                permissions={user.permissions || []}
                profile={user.profile}
                role={user.role}
                roleId={user.roleId}
              /> : <Navigate to={firstAccessiblePath} replace />
            }
          />
          <Route path="/configuracoes/integracoes" element={can("integrations.view")?<Connections />:<Navigate to={firstAccessiblePath} replace />} />
          <Route
            path="/configuracoes"
            element={
              can("settings.view") ? <SettingsManagement
                theme={theme}
                onTheme={setTheme}
                onOpenProfile={() => setProfilePanel("profile")}
                onOpenSecurity={() => setProfilePanel("security")}
              /> : <Navigate to={firstAccessiblePath} replace />
            }
          />
          <Route path="/ajuda" element={<HelpCenter user={user} />} />
          <Route
            path="*"
            element={
              can("dashboard.view") ? (
                <DashboardBoards user={user} />
              ) : (
                <Navigate to={firstAccessiblePath} replace />
              )
            }
          />
        </Routes></Suspense>
        <MobileNav />
        {profilePanel && (
          <ProfilePanel
            user={user}
            initialTab={profilePanel}
            onClose={() => setProfilePanel(null)}
            onUserUpdate={onUserUpdate}
          />
        )}
      </main>
    </div>
  );
}

function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof Gauge;
  tone?: string;
}) {
  const down = delta.startsWith("-");
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>
        <Icon />
      </div>
      <div className="kpi-label">
        {label}
        <HelpCircle />
      </div>
      <strong>{value}</strong>
      <small className={down ? "negative" : "positive"}>
        {down ? <TrendingDown /> : <TrendingUp />}
        {delta} <span>vs. período anterior</span>
      </small>
    </article>
  );
}

function Dashboard() {
  return (
    <div className="page">
      <PageHead
        eyebrow="VISÃO GERAL"
        title="Bem-vindo ao PW OS"
        description="Seu ambiente está pronto. Comece cadastrando a equipe e os clientes."
        action={
          <button className="primary">
            <Plus /> Nova atividade
          </button>
        }
      />
      <section className="kpi-grid">
        <Kpi
          label="Investimento gerenciado"
          value="R$ 0"
          delta="0%"
          icon={CircleDollarSign}
        />
        <Kpi
          label="Conversões no período"
          value="0"
          delta="0%"
          icon={Activity}
          tone="green"
        />
        <Kpi
          label="CPA médio"
          value="R$ 0"
          delta="0%"
          icon={Gauge}
          tone="orange"
        />
        <Kpi
          label="Clientes ativos"
          value="0"
          delta="0 neste mês"
          icon={ShieldCheck}
          tone="purple"
        />
      </section>
      <section className="panel empty-state">
        <span>
          <Sparkles />
        </span>
        <h2>Nenhum dado cadastrado ainda</h2>
        <p>
          Cadastre usuários, clientes e campanhas para começar a acompanhar a
          operação.
        </p>
        <div>
          <NavLink to="/equipe" className="primary">
            <UserPlus /> Criar primeiro usuário
          </NavLink>
          <NavLink to="/clientes" className="secondary">
            <BriefcaseBusiness /> Cadastrar cliente
          </NavLink>
        </div>
      </section>
    </div>
  );
}

function Clients() {
  return (
    <div className="page">
      <PageHead
        eyebrow="CARTEIRA"
        title="Clientes"
        description="Saúde, pendências e próximas ações em uma visão."
        action={
          <button className="primary">
            <Plus /> Novo cliente
          </button>
        }
      />
      <div className="summary-row">
        <span>
          <b>0</b> ativos
        </span>
        <span>
          <b className="green-text">0</b> saudáveis
        </span>
        <span>
          <b className="yellow-text">0</b> em atenção
        </span>
        <span>
          <b className="red-text">0</b> em risco
        </span>
      </div>
      <div className="panel table-panel">
        <div className="table-tools">
          <div className="search small">
            <Search />
            <input placeholder="Buscar cliente..." />
          </div>
          <button className="select">
            Todos os status <ChevronDown />
          </button>
        </div>
        {clients.length === 0 ? (
          <div className="inline-empty">
            <BriefcaseBusiness />
            <h3>Nenhum cliente cadastrado</h3>
            <p>Use “Novo cliente” para criar o primeiro registro.</p>
          </div>
        ) : (
          <div className="client-grid">
            {clients.map((c) => (
              <article className="client-card" key={c.name}>
                <div className="client-name">
                  <span>{c.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <h3>{c.name}</h3>
                    <small>{c.channels}</small>
                  </div>
                </div>
                <Status value={c.status} />
                <dl>
                  <div>
                    <dt>Responsável</dt>
                    <dd>{c.owner}</dd>
                  </div>
                  <div>
                    <dt>Próxima ação</dt>
                    <dd>{c.next}</dd>
                  </div>
                </dl>
                <p>
                  <Sparkles />
                  {c.note}
                </p>
                <button>
                  Ver detalhes <ArrowRight />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Media() {
  const [filter, setFilter] = useState("Todos");
  const navigate = useNavigate();
  const rows = useMemo(
    () => campaigns.filter((c) => filter === "Todos" || c.platform === filter),
    [filter],
  );
  const spend = rows.reduce((n, c) => n + c.spend, 0);
  const conv = rows.reduce((n, c) => n + c.conversions, 0);
  return (
    <div className="page">
      <PageHead
        eyebrow="MÍDIA PAGA"
        title="Performance de campanhas"
        description="01–28 jul 2026 • Comparado a 01–28 jun"
        action={
          <button className="secondary">
            <Download /> Exportar relatório
          </button>
        }
      />
      <div className="segmented" role="tablist">
        {["Todos", "Meta Ads", "Google Ads"].map((v) => (
          <button
            role="tab"
            aria-selected={filter === v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
            key={v}
          >
            {v}
          </button>
        ))}
      </div>
      <section className="kpi-grid compact">
        <Kpi
          label="Investimento"
          value={money(spend)}
          delta="0%"
          icon={CircleDollarSign}
        />
        <Kpi
          label="Conversões"
          value={String(conv)}
          delta="0%"
          icon={Activity}
          tone="green"
        />
        <Kpi
          label="CPA médio"
          value={money(conv ? spend / conv : 0)}
          delta="0%"
          icon={Gauge}
          tone="orange"
        />
        <Kpi
          label="Saldo disponível"
          value={money(rows.reduce((n, c) => n + c.budget - c.spend, 0))}
          delta="0 dias"
          icon={BarChart3}
          tone="purple"
        />
      </section>
      <div className="panel campaigns">
        <div className="section-title">
          <div>
            <h2>Campanhas ativas</h2>
            <p>{rows.length} resultados • Atualizado há 8 min</p>
          </div>
          <div className="search small">
            <Search />
            <input placeholder="Buscar campanha" />
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="inline-empty">
            <Megaphone />
            <h3>Nenhuma campanha cadastrada</h3>
            <p>Vincule uma conta de mídia e crie a primeira campanha.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente / campanha</th>
                  <th>Plataforma</th>
                  <th>Status</th>
                  <th>Investimento</th>
                  <th>Conversões</th>
                  <th>CPA</th>
                  <th>Variação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.client}</b>
                      <small>{c.campaign}</small>
                    </td>
                    <td>{c.platform}</td>
                    <td>
                      <Status value={c.status} />
                    </td>
                    <td>
                      {money(c.spend)}
                      <small>de {money(c.budget)}</small>
                    </td>
                    <td>{c.conversions}</td>
                    <td>{money(c.cpa)}</td>
                    <td>
                      <span className={c.change > 0 ? "positive" : "negative"}>
                        {c.change > 0 ? "↑" : "↓"} {Math.abs(c.change)}%
                      </span>
                    </td>
                    <td>
                      <button
                        className="analyze"
                        onClick={() => navigate(`/midia/${c.id}`)}
                      >
                        Analisar <ArrowRight />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const c = campaigns.find((item) => item.id === id);
  if (!c)
    return (
      <div className="page">
        <button className="back" onClick={() => navigate("/midia")}>
          <ArrowLeft /> Voltar para campanhas
        </button>
        <div className="panel inline-empty">
          <Megaphone />
          <h3>Campanha não encontrada</h3>
          <p>Nenhuma campanha foi cadastrada ainda.</p>
        </div>
      </div>
    );
  return (
    <div className="page">
      <button className="back" onClick={() => navigate("/midia")}>
        <ArrowLeft /> Voltar para campanhas
      </button>
      <PageHead
        eyebrow={`${c.platform.toUpperCase()} • ${c.client.toUpperCase()}`}
        title={c.campaign}
        description={`Responsável: ${c.owner} • Sincronizado há 8 min`}
        action={<Status value={c.status} />}
      />
      <section className="kpi-grid compact">
        <Kpi
          label="Investimento"
          value={money(c.spend)}
          delta="+8,2%"
          icon={CircleDollarSign}
        />
        <Kpi
          label="Conversões"
          value={String(c.conversions)}
          delta={`${c.change > 0 ? "+" : ""}${c.change}%`}
          icon={Activity}
          tone="green"
        />
        <Kpi
          label="CPA"
          value={money(c.cpa)}
          delta="-4,1%"
          icon={Gauge}
          tone="orange"
        />
        <Kpi
          label="Saldo"
          value={money(c.budget - c.spend)}
          delta="6 dias"
          icon={BarChart3}
          tone="purple"
        />
      </section>
      <section className="two-columns detail">
        <article className="panel performance">
          <div className="section-title">
            <div>
              <h2>Conversões por dia</h2>
              <p>Período atual x anterior</p>
            </div>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} />
                <YAxis axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="anterior"
                  stroke="#9ba5b2"
                  fill="transparent"
                  strokeDasharray="5 5"
                />
                <Area
                  type="monotone"
                  dataKey="atual"
                  stroke="#0c79d8"
                  fill="#0c79d818"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel insight-panel">
          <span className="ai-label">
            <Sparkles />
            LEITURA PW
          </span>
          <h2>Ritmo saudável, com espaço para crescer</h2>
          <p>
            A campanha está entregando conversões 12% acima do período anterior
            com redução no custo por aquisição.
          </p>
          <div className="insight-row">
            <Check />
            <p>
              <b>Ponto positivo</b>Taxa de conversão cresceu 1,8 p.p.
            </p>
          </div>
          <div className="insight-row warn">
            <AlertTriangle />
            <p>
              <b>Ponto de atenção</b>Mobile concentra 74% do gasto e 61% das
              conversões.
            </p>
          </div>
          <button className="primary">Criar ação de otimização</button>
        </article>
      </section>
      <section className="panel actions">
        <div className="section-title">
          <div>
            <h2>Ações e próximos passos</h2>
            <p>Histórico operacional da campanha</p>
          </div>
          <button className="secondary">
            <Plus /> Registrar ação
          </button>
        </div>
        <div className="timeline">
          <div>
            <span />
            <p>
              <b>Ajuste de palavras-chave negativas</b>
              <small>Hoje, 09:42 • Lucas Andrade</small>
            </p>
            <em>Concluído</em>
          </div>
          <div>
            <span />
            <p>
              <b>Revisar distribuição por dispositivo</b>
              <small>Próxima ação • até 30 jul</small>
            </p>
            <em className="pending">Pendente</em>
          </div>
        </div>
      </section>
    </div>
  );
}

function Reports() {
  return (
    <div className="page">
      <PageHead
        eyebrow="INTELIGÊNCIA"
        title="Relatórios"
        description="Compartilhe resultados claros, seguros e fáceis de entender."
        action={
          <button className="primary">
            <Plus /> Gerar relatório
          </button>
        }
      />
      <div className="panel inline-empty">
        <FileText />
        <h3>Nenhum relatório gerado</h3>
        <p>
          Os relatórios aparecerão aqui depois que clientes e campanhas tiverem
          dados.
        </p>
      </div>
      <div className="security-note">
        <ShieldCheck />
        <div>
          <b>Compartilhamento protegido</b>
          <p>
            Links usam tokens não enumeráveis, expiram em 24 horas e podem ser
            revogados a qualquer momento. O acesso não concede entrada ao
            sistema.
          </p>
        </div>
      </div>
    </div>
  );
}

function Team() {
  const [usersList, setUsersList] = useState<SessionUser[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const loadUsers = () =>
    fetch("/api/users")
      .then((response) => response.json())
      .then((data) => setUsersList(data.users || []));
  useEffect(() => {
    void loadUsers();
  }, []);
  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setOpen(false);
    await loadUsers();
  };
  return (
    <div className="page">
      <PageHead
        eyebrow="ADMINISTRAÇÃO"
        title="Equipe e acessos"
        description="Pessoas, cargos e permissões efetivas da organização."
        action={
          <button className="primary" onClick={() => setOpen(true)}>
            <Plus /> Criar usuário
          </button>
        }
      />
      <div className="permission-banner">
        <ShieldCheck />
        <div>
          <b>Modelo híbrido de acesso ativo</b>
          <p>
            Negação individual → concessão individual → cargo → hierarquia →
            negar.
          </p>
        </div>
        <button>Simular acesso</button>
      </div>
      <div className="panel team-table">
        <div className="section-title">
          <div>
            <h2>Usuários ativos</h2>
            <p>
              {usersList.length}{" "}
              {usersList.length === 1 ? "usuário" : "usuários"}
            </p>
          </div>
          <button className="select">
            Todos os perfis <ChevronDown />
          </button>
        </div>
        {usersList.map((user) => (
          <div className="team-row" key={user.id}>
            <span className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
            <span className="role">{user.profile}</span>
            <span>{user.role}</span>
            <span>
              <ShieldCheck />
              {user.profile === "MASTER"
                ? "Todos os módulos"
                : "Conforme permissões"}
            </span>
            <button>
              <MoreHorizontal />
            </button>
          </div>
        ))}
      </div>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-user-title"
          >
            <button
              className="modal-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X />
            </button>
            <span className="modal-icon">
              <UserPlus />
            </span>
            <h2 id="new-user-title">Criar usuário</h2>
            <p>Defina os dados de acesso e o perfil técnico inicial.</p>
            <form onSubmit={createUser}>
              <label>
                Nome completo
                <input name="name" required autoFocus />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required />
              </label>
              <div className="form-grid">
                <label>
                  Perfil
                  <select name="profile">
                    <option value="COLLABORATOR">Colaborador</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="CLIENT">Cliente externo</option>
                  </select>
                </label>
                <label>
                  Cargo
                  <input
                    name="role"
                    required
                    placeholder="Ex.: Gestor de Tráfego"
                  />
                </label>
              </div>
              <label>
                Senha inicial
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
                <button className="primary">Criar usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfilePanel({
  user,
  initialTab,
  onClose,
  onUserUpdate,
}: {
  user: SessionUser;
  initialTab: "profile" | "security";
  onClose: () => void;
  onUserUpdate: (user: SessionUser) => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [avatar, setAvatar] = useState(user.avatarDataUrl || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirmation: false,
  });
  const passwordRules = [
    { label: "8 ou mais caracteres", valid: newPassword.length >= 8 },
    {
      label: "Letra maiúscula e minúscula",
      valid: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
    },
    { label: "Pelo menos um número", valid: /\d/.test(newPassword) },
    { label: "Pelo menos um símbolo", valid: /[^A-Za-z0-9]/.test(newPassword) },
    {
      label: "Sem espaços e sem seus dados pessoais",
      valid:
        !!newPassword &&
        !/\s/.test(newPassword) &&
        ![user.name, ...user.email.split("@")]
          .flatMap((value) => value.toLowerCase().split(/\W+/))
          .filter((value) => value.length >= 4)
          .some((value) => newPassword.toLowerCase().includes(value)),
    },
  ];
  const strengthScore = passwordRules.filter((rule) => rule.valid).length;
  const strengthLabels = [
    "Muito fraca",
    "Fraca",
    "Razoável",
    "Boa",
    "Forte",
    "Muito forte",
  ];
  const passwordsMatch =
    !!passwordConfirmation && newPassword === passwordConfirmation;
  const canChangePassword =
    !!currentPassword &&
    passwordRules.every((rule) => rule.valid) &&
    passwordsMatch &&
    newPassword !== currentPassword &&
    !saving;
  const upload = (file?: File) => {
    if (!file) return;
    setError("");
    setMessage("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1_000_000
    )
      return setError("Use uma imagem PNG, JPG ou WebP de até 1 MB.");
    const reader = new FileReader();
    reader.onerror = () =>
      setError("Não foi possível ler a imagem selecionada.");
    reader.onload = async () => {
      const avatarDataUrl = String(reader.result);
      setAvatar(avatarDataUrl);
      setSaving(true);
      try {
        const response = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, avatarDataUrl }),
        });
        const data = await response.json();
        if (!response.ok) setError(data.message);
        else {
          onUserUpdate(data.user);
          setMessage("Foto salva com sucesso.");
        }
      } catch {
        setError("Não foi possível salvar a foto. Tente novamente.");
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, avatarDataUrl: avatar }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.message);
    else {
      onUserUpdate(data.user);
      setMessage("Perfil atualizado com sucesso.");
    }
    setSaving(false);
  };
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canChangePassword) return;
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        password: newPassword,
        confirmation: passwordConfirmation,
      }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.message);
    else {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setMessage("Senha alterada com segurança.");
    }
    setSaving(false);
  };
  return (
    <div className="modal-backdrop account-settings-backdrop">
      <section className="account-settings" role="dialog" aria-modal="true">
        <header>
          <div>
            <UserAvatar
              user={{ ...user, name, avatarDataUrl: avatar }}
              className="settings-avatar"
            />
            <div>
              <h2>Configurações da conta</h2>
              <p>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="account-settings-layout">
          <nav>
            <button
              className={tab === "profile" ? "active" : ""}
              onClick={() => {
                setTab("profile");
                setError("");
                setMessage("");
              }}
            >
              <UserPlus /> Meu perfil
            </button>
            <button
              className={tab === "security" ? "active" : ""}
              onClick={() => {
                setTab("security");
                setError("");
                setMessage("");
              }}
            >
              <LockKeyhole /> Segurança
            </button>
          </nav>
          <main>
            {tab === "profile" ? (
              <form onSubmit={saveProfile}>
                <div className="settings-title">
                  <h3>Informações pessoais</h3>
                  <p>Atualize como você aparece no PW OS.</p>
                </div>
                <div className="avatar-editor">
                  <UserAvatar
                    user={{ ...user, name, avatarDataUrl: avatar }}
                    className="profile-preview"
                  />
                  <div>
                    <label className="upload-avatar">
                      <Camera /> Alterar foto
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => upload(event.target.files?.[0])}
                      />
                    </label>
                    {avatar && (
                      <button type="button" onClick={() => setAvatar("")}>
                        Remover
                      </button>
                    )}
                    <small>PNG, JPG ou WebP. Máximo 1 MB.</small>
                  </div>
                </div>
                <div className="settings-fields">
                  <label>
                    Nome completo
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    E-mail
                    <input value={user.email} disabled />
                    <small>
                      O e-mail de acesso não pode ser alterado aqui.
                    </small>
                  </label>
                  <label>
                    Telefone
                    <input
                      value={phone}
                      inputMode="tel"
                      onChange={(event) =>
                        setPhone(maskPhone(event.target.value))
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label>
                    Cargo
                    <input value={user.role} disabled />
                  </label>
                </div>
                {error && <div className="form-error">{error}</div>}
                {message && (
                  <div className="form-success">
                    <Check />
                    {message}
                  </div>
                )}
                <div className="settings-actions">
                  <button type="button" className="secondary" onClick={onClose}>
                    Cancelar
                  </button>
                  <button className="primary" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={changePassword}>
                <div className="settings-title">
                  <h3>Senha e segurança</h3>
                  <p>
                    Confirme sua senha atual e escolha uma nova senha forte.
                  </p>
                </div>
                <div className="security-card">
                  <ShieldCheck />
                  <div>
                    <b>Sessão protegida</b>
                    <p>
                      Sua sessão usa cookie HttpOnly e não expõe credenciais ao
                      navegador.
                    </p>
                  </div>
                </div>
                <div className="settings-fields one-column security-password-fields">
                  <label>
                    Senha atual
                    <div className="security-password-input">
                      <input
                        value={currentPassword}
                        onChange={(event) => {
                          setCurrentPassword(event.target.value);
                          setError("");
                          setMessage("");
                        }}
                        type={passwordVisibility.current ? "text" : "password"}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPasswordVisibility((value) => ({
                            ...value,
                            current: !value.current,
                          }))
                        }
                        aria-label={
                          passwordVisibility.current
                            ? "Ocultar senha atual"
                            : "Mostrar senha atual"
                        }
                      >
                        {passwordVisibility.current ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </label>
                  <label>
                    Nova senha
                    <div className="security-password-input">
                      <input
                        value={newPassword}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          setError("");
                          setMessage("");
                        }}
                        type={passwordVisibility.new ? "text" : "password"}
                        minLength={8}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPasswordVisibility((value) => ({
                            ...value,
                            new: !value.new,
                          }))
                        }
                        aria-label={
                          passwordVisibility.new
                            ? "Ocultar nova senha"
                            : "Mostrar nova senha"
                        }
                      >
                        {passwordVisibility.new ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </label>
                  {newPassword && (
                    <div
                      className={`password-strength strength-${strengthScore}`}
                      aria-live="polite"
                    >
                      <div className="password-strength-heading">
                        <span>Força da senha</span>
                        <b>{strengthLabels[strengthScore]}</b>
                      </div>
                      <div className="password-strength-bars">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <i
                            key={level}
                            className={strengthScore >= level ? "active" : ""}
                          />
                        ))}
                      </div>
                      <div className="password-rule-list">
                        {passwordRules.map((rule) => (
                          <span
                            className={rule.valid ? "valid" : ""}
                            key={rule.label}
                          >
                            {rule.valid ? (
                              <Check />
                            ) : (
                              <span className="rule-dot" />
                            )}
                            {rule.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <label>
                    Confirmar nova senha
                    <div
                      className={`security-password-input ${passwordConfirmation ? (passwordsMatch ? "matches" : "mismatch") : ""}`}
                    >
                      <input
                        value={passwordConfirmation}
                        onChange={(event) => {
                          setPasswordConfirmation(event.target.value);
                          setError("");
                          setMessage("");
                        }}
                        type={
                          passwordVisibility.confirmation ? "text" : "password"
                        }
                        minLength={8}
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPasswordVisibility((value) => ({
                            ...value,
                            confirmation: !value.confirmation,
                          }))
                        }
                        aria-label={
                          passwordVisibility.confirmation
                            ? "Ocultar confirmação"
                            : "Mostrar confirmação"
                        }
                      >
                        {passwordVisibility.confirmation ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                    {passwordConfirmation && (
                      <small
                        className={
                          passwordsMatch
                            ? "password-match"
                            : "password-mismatch"
                        }
                      >
                        {passwordsMatch ? (
                          <>
                            <Check />
                            As senhas coincidem.
                          </>
                        ) : (
                          <>As senhas ainda não coincidem.</>
                        )}
                      </small>
                    )}
                  </label>
                </div>
                {error && <div className="form-error">{error}</div>}
                {message && (
                  <div className="form-success">
                    <Check />
                    {message}
                  </div>
                )}
                <div className="settings-actions">
                  <button type="button" className="secondary" onClick={onClose}>
                    Cancelar
                  </button>
                  <button className="primary" disabled={!canChangePassword}>
                    {saving ? "Alterando..." : "Alterar senha"}
                  </button>
                </div>
              </form>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function MobileNav() {
  return (
    <nav className="mobile-nav">
      {nav.slice(0, 4).map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/"}>
          <item.icon />
          <span>{item.label.split(" ")[0]}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Login({
  onLogin,
  clientPortal = false,
}: {
  onLogin: (user: SessionUser) => void;
  clientPortal?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [help, setHelp] = useState(false);
  const [email, setEmail] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const resetToken = new URLSearchParams(window.location.search).get("resetToken") || "";
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const rememberedEmailKey = clientPortal
    ? "pw-client-remembered-email"
    : "pw-os-remembered-email";
  const rememberedEmail = localStorage.getItem(rememberedEmailKey) || "";
  useEffect(() => { if (!email && rememberedEmail) setEmail(rememberedEmail); }, [email, rememberedEmail]);
  const toggleTheme = () =>
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      localStorage.setItem("pw-os-theme", next);
      return next;
    });
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const payload: Record<string, FormDataEntryValue | string> = {
      ...Object.fromEntries(new FormData(event.currentTarget)),
      ...(clientPortal ? { portal: "client" } : {}),
    };
    try {
      if (resetToken) {
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: resetToken, password: newPassword, confirmation: passwordConfirmation }) });
        const data = await response.json();
        if (!response.ok) setError(data.message); else { window.history.replaceState({}, "", window.location.pathname); setRecoveryMessage(data.message); setNewPassword(""); setPasswordConfirmation(""); window.setTimeout(() => window.location.assign("/"), 1200); }
        return;
      }
      const response = await fetch(
        clientPortal ? "/api/client-auth/login" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) setError(data.message);
      else {
        if (payload.remember)
          localStorage.setItem(rememberedEmailKey, String(payload.email || ""));
        else localStorage.removeItem(rememberedEmailKey);
        onLogin(data.user);
      }
    } catch {
      setError("Não foi possível conectar ao ambiente local.");
    } finally {
      setLoading(false);
    }
  };
  const requestRecovery = async () => {
    if (!email) { setError("Informe seu e-mail para recuperar a senha."); return; }
    setLoading(true); setError(""); setRecoveryMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }), data = await response.json();
      response.ok ? setRecoveryMessage(data.message) : setError(data.message);
    } catch { setError("Não foi possível solicitar a recuperação agora."); }
    finally { setLoading(false); }
  };
  const features = [
    [BarChart3, "Operação", "Tudo em um só lugar"],
    [Gauge, "Clareza", "Indicadores essenciais"],
    [ShieldCheck, "Confiança", "Acesso protegido"],
  ] as const;
  return (
    <main
      className={`login-page login-premium ${clientPortal ? "client-login-page" : ""}`}
    >
      {!clientPortal && (
        <button
          className="login-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`}
          title={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`}
        >
          {theme === "light" ? <Moon /> : <Sun />}
          <span>{theme === "light" ? "Tema escuro" : "Tema claro"}</span>
        </button>
      )}
      <section className="login-brand">
        <Brand />
        <div className="login-pitch">
          <h1>
            {clientPortal ? (
              <>
                Seus resultados,
                <br />
                <strong>sempre à vista.</strong>
              </>
            ) : (
              <>
                O Sistema Operacional
                <br />
                exclusivo do <strong>Grupo PW.</strong>
              </>
            )}
          </h1>
          <p>
            {clientPortal ? (
              <>
                Acompanhe suas campanhas Meta e Google em um ambiente claro,
                seguro e preparado para você.
              </>
            ) : (
              <>
                Gestão clara para decisões melhores.
                <br />
                Pessoas, dados e resultados no mesmo lugar.
              </>
            )}
          </p>
          {!clientPortal && (
            <div className="login-feature-grid">
              {features.map(([Icon, title, caption]) => (
                <article key={title}>
                  <span>
                    <Icon />
                  </span>
                  <b>
                    {clientPortal
                      ? (
                          {
                            Gestão: "Campanhas",
                            Performance: "Indicadores",
                            Decisões: "Resultados",
                            IA: "Transparência",
                            Segurança: "Proteção",
                          } as Record<string, string>
                        )[title]
                      : title}
                  </b>
                  <small>
                    {clientPortal
                      ? (
                          {
                            Gestão: "Meta e Google",
                            Performance: "Atualizados",
                            Decisões: "Em um só lugar",
                            IA: "Nos dados",
                            Segurança: "Dos acessos",
                          } as Record<string, string>
                        )[title]
                      : caption}
                  </small>
                </article>
              ))}
            </div>
          )}
        </div>
        {!clientPortal && (
          <footer>
            <span>
              <ShieldCheck /> Segurança de nível empresarial <i /> Dados
              protegidos <i /> Conformidade LGPD
            </span>
            <small>Todos os direitos reservados — Grupo PW</small>
          </footer>
        )}
      </section>
      <section className="login-area">
        <div className="login-card">
          {!clientPortal && (
            <span className="login-badge">
              <ShieldCheck /> Acesso seguro
            </span>
          )}
          <h2>{resetToken ? "Crie uma nova senha" : clientPortal ? "Portal do Cliente" : "Bem-vindo de volta"}</h2>
          <p>
            {clientPortal
              ? "Consulte os resultados das suas campanhas com segurança."
              : resetToken ? "Defina uma senha forte para recuperar seu acesso." : "Entre com sua conta para acessar o PW OS."}
          </p>
          <form onSubmit={submit}>
            {resetToken ? <>
              <label>Nova senha<div className="password-field login-input"><LockKeyhole/><input type="password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="Nova senha"/></div></label>
              <label>Confirmar nova senha<div className="password-field login-input"><LockKeyhole/><input type="password" value={passwordConfirmation} onChange={event=>setPasswordConfirmation(event.target.value)} minLength={8} required autoComplete="new-password" placeholder="Repita a nova senha"/></div></label>
            </> : <>
            <label>
              E-mail
              <div className="login-input">
                <MessagesSquare />
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="seuemail@empresa.com"
                />
              </div>
            </label>
            <label>
              Senha
              <div className="password-field login-input">
                <LockKeyhole />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
            <div className="login-options">
              <label>
                <input
                  name="remember"
                  type="checkbox"
                  defaultChecked={!!rememberedEmail}
                />{" "}
                Manter conectado
              </label>
              <button type="button" onClick={() => setHelp((value) => !value)}>
                Esqueci minha senha
              </button>
            </div>
            {help && (
              <div className="login-help">
                <HelpCircle />
                <span>
                  <b>Recupere seu acesso</b>Enviaremos um link seguro para o e-mail informado acima.
                  <button type="button" onClick={() => void requestRecovery()} disabled={loading}>Enviar link de recuperação</button>
                </span>
              </div>
            )}
            </>}
            {recoveryMessage && <div className="login-help"><ShieldCheck/><span>{recoveryMessage}</span></div>}
            {error && (
              <div className="form-error">
                <AlertTriangle />
                {error}
              </div>
            )}
            <button className="primary login-submit" disabled={loading}>
              {loading
                ? "Processando..."
                : resetToken
                  ? "Redefinir senha"
                : clientPortal
                  ? "Acessar minhas campanhas"
                  : "Entrar no PW OS"}
              <ArrowRight />
            </button>
          </form>
          {!clientPortal && (
            <small>
              <LockKeyhole /> Suas credenciais são validadas somente pelo servidor
              seguro do PW OS.
            </small>
          )}
        </div>
      </section>
    </main>
  );
}

type PortalCampaign = {
  id: string;
  accountId: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
  cpl: number | null;
  currency?: string;
};
function ClientPortal({
  user,
  onLogout,
}: {
  user: SessionUser;
  onLogout: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const [portalPlatform, setPortalPlatform] = useState<
    "ALL" | "META_ADS" | "GOOGLE_ADS"
  >("ALL");
  const [portalStatus, setPortalStatus] = useState<"ACTIVE" | "PAUSED" | "ALL">(
    "ACTIVE",
  );
  const [portalSearch, setPortalSearch] = useState("");
  useEffect(() => {
    fetch("/api/client-portal/data")
      .then(async (response) => {
        const payload = await response.json();
        if (response.ok) setData(payload);
        else setError(payload.message);
      })
      .catch(() => setError("Não foi possível carregar os dados."));
  }, []);
  const meta = ((data?.meta?.campaigns || []) as PortalCampaign[]).map(
    (item) => ({
      ...item,
      // Messaging results are now normalized into leads by the Meta adapter.
      // Avoid counting the legacy conversations field a second time.
      conversations: item.leads > 0 ? 0 : item.conversations,
    }),
  );
  const google = (data?.google?.campaigns || []) as PortalCampaign[];
  const all = [...meta, ...google];
  const statusMatches = (item: PortalCampaign) =>
    portalStatus === "ALL" ||
    (portalStatus === "ACTIVE"
      ? ["ACTIVE", "ENABLED"].includes(item.status)
      : !["ACTIVE", "ENABLED"].includes(item.status));
  const searchMatches = (item: PortalCampaign) =>
    !portalSearch.trim() ||
    item.name.toLowerCase().includes(portalSearch.trim().toLowerCase());
  const visibleMeta =
    portalPlatform !== "GOOGLE_ADS"
      ? meta.filter((item) => statusMatches(item) && searchMatches(item))
      : [];
  const visibleGoogle =
    portalPlatform !== "META_ADS"
      ? google.filter((item) => statusMatches(item) && searchMatches(item))
      : [];
  const visibleCampaigns = [...visibleMeta, ...visibleGoogle];
  const total = (key: "spend" | "impressions" | "clicks" | "leads") =>
    visibleCampaigns.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  const clientName = data?.client?.name || user.name;
  return (
    <main className="client-portal-page">
      <header className="client-portal-header">
        <div className="client-portal-brand">
          <Brand compact />
          <i />
          <span>Portal do cliente</span>
        </div>
        <div className="client-portal-account">
          <span className="client-portal-avatar">
            {clientName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <b>{clientName}</b>
            <small>{user.email}</small>
          </div>
          <button onClick={onLogout} title="Sair">
            <LogOut />
            <span>Sair</span>
          </button>
        </div>
      </header>
      <section className="client-portal-content">
        <div className="client-portal-welcome">
          <div>
            <span className="eyebrow">VISÃO GERAL</span>
            <h1>Olá, {user.name.split(" ")[0]}.</h1>
            <p>Acompanhe a performance das campanhas de {clientName}.</p>
          </div>
          <span className="client-readonly">
            <ShieldCheck /> Ambiente seguro
          </span>
        </div>
        {error ? (
          <div className="client-portal-state error">
            <AlertTriangle />
            <h2>Não conseguimos carregar seus dados</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </div>
        ) : !data ? (
          <div className="client-portal-loading">
            <span />
            <p>Preparando seus resultados...</p>
          </div>
        ) : !all.length ? (
          <div className="client-portal-state empty">
            <span className="client-state-icon">
              <BarChart3 />
            </span>
            <small>TUDO PRONTO POR AQUI</small>
            <h2>Suas campanhas aparecerão neste espaço</h2>
            <p>
              Ainda não existem portfólios vinculados a este acesso. Quando a PW
              Mídia concluir a configuração, seus indicadores e campanhas serão
              exibidos automaticamente.
            </p>
            <div className="client-empty-steps">
              <span>
                <b>1</b>Vínculo do portfólio
              </span>
              <i />
              <span>
                <b>2</b>Sincronização dos dados
              </span>
              <i />
              <span>
                <b>3</b>Resultados disponíveis
              </span>
            </div>
            <a href="mailto:suporte@pwmedia.com.br">
              <MessagesSquare /> Falar com a PW Mídia
            </a>
          </div>
        ) : (
          <>
            <section className="client-portal-filterbar">
              <div className="client-platform-tabs">
                <button
                  className={portalPlatform === "ALL" ? "active" : ""}
                  onClick={() => setPortalPlatform("ALL")}
                >
                  <BarChart3 /> Todas
                </button>
                <button
                  className={portalPlatform === "META_ADS" ? "active" : ""}
                  onClick={() => setPortalPlatform("META_ADS")}
                >
                  <i className="meta" /> Meta Ads
                </button>
                <button
                  className={portalPlatform === "GOOGLE_ADS" ? "active" : ""}
                  onClick={() => setPortalPlatform("GOOGLE_ADS")}
                >
                  <i className="google" /> Google Ads
                </button>
              </div>
              <div className="client-filter-controls">
                <label className="client-campaign-search">
                  <Search />
                  <input
                    value={portalSearch}
                    onChange={(event) => setPortalSearch(event.target.value)}
                    placeholder="Buscar campanha..."
                  />
                </label>
                <label className="client-status-select">
                  <span>Status</span>
                  <select
                    value={portalStatus}
                    onChange={(event) =>
                      setPortalStatus(event.target.value as typeof portalStatus)
                    }
                  >
                    <option value="ACTIVE">Campanhas ativas</option>
                    <option value="PAUSED">Pausadas e inativas</option>
                    <option value="ALL">Todos os status</option>
                  </select>
                  <ChevronDown />
                </label>
              </div>
            </section>
            <section className="client-portal-filter-summary">
              <span>
                <i />
                {visibleCampaigns.length} campanha(s){" "}
                {portalStatus === "ACTIVE" ? "ativa(s)" : "encontrada(s)"}
              </span>
              <small>Indicadores atualizados conforme os filtros</small>
            </section>
            <section className="client-portal-kpis">
              {[
                [
                  CircleDollarSign,
                  "Investimento",
                  money(total("spend")),
                  "Total filtrado",
                ],
                [
                  Eye,
                  "Impressões",
                  total("impressions").toLocaleString("pt-BR"),
                  "Visualizações dos anúncios",
                ],
                [
                  Activity,
                  "Cliques",
                  total("clicks").toLocaleString("pt-BR"),
                  "Acessos gerados",
                ],
                [
                  TrendingUp,
                  "Resultados",
                  total("leads").toLocaleString("pt-BR"),
                  "Conversões registradas",
                ],
              ].map(([Icon, label, value, detail]) => (
                <article key={label as string}>
                  <span>
                    <Icon />
                  </span>
                  <div>
                    <small>{label as string}</small>
                    <b>{value as string}</b>
                    <em>{detail as string}</em>
                  </div>
                </article>
              ))}
            </section>
            <section className="client-campaigns">
              <header>
                <div>
                  <span className="eyebrow">CAMPANHAS</span>
                  <h2>Performance por campanha</h2>
                  <p>Visão detalhada no mesmo formato operacional do PW OS</p>
                </div>
                <span className="client-readonly">
                  <Eye /> Somente leitura
                </span>
              </header>
              {visibleCampaigns.length ? (
                [
                  ["Meta Ads", visibleMeta],
                  ["Google Ads", visibleGoogle],
                ].map(([label, items]) =>
                  (items as PortalCampaign[]).length ? (
                    <div
                      className="client-platform-group"
                      key={label as string}
                    >
                      <h3>
                        <i
                          className={
                            (label as string).startsWith("Meta")
                              ? "meta"
                              : "google"
                          }
                        />
                        {label as string}
                        <span>{(items as PortalCampaign[]).length}</span>
                      </h3>
                      <div className="client-campaign-table-head">
                        <span>Campanha</span>
                        <span>Status</span>
                        <span>Investimento</span>
                        <span>Impressões</span>
                        <span>Cliques</span>
                        <span>Resultados</span>
                      </div>
                      {(items as PortalCampaign[]).map((item) => (
                        <article key={`${label}-${item.id}`}>
                          <div>
                            <b>{item.name}</b>
                            <small>ID {item.id}</small>
                          </div>
                          <span>
                            <small
                              className={`client-campaign-status ${["ACTIVE", "ENABLED"].includes(item.status) ? "active" : "paused"}`}
                            >
                              {["ACTIVE", "ENABLED"].includes(item.status)
                                ? "Ativa"
                                : "Pausada"}
                            </small>
                          </span>
                          <span>
                            <small>Investimento</small>
                            <b>{money(item.spend || 0)}</b>
                          </span>
                          <span>
                            <small>Impressões</small>
                            <b>
                              {Number(item.impressions || 0).toLocaleString(
                                "pt-BR",
                              )}
                            </b>
                          </span>
                          <span>
                            <small>Cliques</small>
                            <b>
                              {Number(item.clicks || 0).toLocaleString("pt-BR")}
                            </b>
                          </span>
                          <span>
                            <small>Resultados</small>
                            <b>
                              {Number(item.leads || 0) +
                                Number(item.conversations || 0)}
                            </b>
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : null,
                )
              ) : (
                <div className="client-filter-empty">
                  <Search />
                  <h3>Nenhuma campanha encontrada</h3>
                  <p>Ajuste a plataforma, o status ou o termo de busca.</p>
                  <button
                    onClick={() => {
                      setPortalPlatform("ALL");
                      setPortalStatus("ACTIVE");
                      setPortalSearch("");
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </section>
      <footer className="client-portal-footer">
        <span>PW Mídia · Performance com transparência</span>
        <span>
          <ShieldCheck /> Seus dados estão protegidos
        </span>
      </footer>
    </main>
  );
}

function PasswordSetup({
  user,
  onComplete,
  onLogout,
  clientPortal = false,
}: {
  user: SessionUser;
  onComplete: (user: SessionUser) => void;
  onLogout: () => void;
  clientPortal?: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const normalized = password.toLowerCase();
  const nameParts = user.name
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 4);
  const internalRules = [
    { label: "Pelo menos 8 caracteres", valid: password.length >= 8 },
    {
      label: "Uma letra maiúscula e uma minúscula",
      valid: /[A-Z]/.test(password) && /[a-z]/.test(password),
    },
    { label: "Um número", valid: /\d/.test(password) },
    { label: "Um símbolo especial", valid: /[^A-Za-z0-9]/.test(password) },
    {
      label: "Sem espaços, nome ou parte do e-mail",
      valid:
        password.length > 0 &&
        !/\s/.test(password) &&
        !nameParts.some((part) => normalized.includes(part)) &&
        !normalized.includes(user.email.split("@")[0].toLowerCase()),
    },
  ];
  const rules = clientPortal
    ? [
        { label: "Pelo menos 8 caracteres", valid: password.length >= 8 },
        {
          label: "Sem espaços",
          valid: password.length > 0 && !/\s/.test(password),
        },
      ]
    : internalRules;
  const strong = rules.every((rule) => rule.valid) && password === confirmation;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!strong) return;
    setLoading(true);
    setError("");
    const response = await fetch(
      clientPortal
        ? "/api/client-auth/change-password"
        : "/api/auth/change-password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      },
    );
    const data = await response.json();
    if (!response.ok) setError(data.message);
    else onComplete(data.user);
    setLoading(false);
  };
  return (
    <div className="password-setup-page" role="presentation">
      <section
        className="password-setup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-access-title"
      >
        <div className="password-setup-header">
          <div className="password-security-icon">
            <ShieldCheck />
          </div>
          <div>
            <span className="eyebrow">PRIMEIRO ACESSO</span>
            <h1 id="first-access-title">Proteja sua conta</h1>
            <p>
              Crie uma senha definitiva para continuar{" "}
              {clientPortal ? "no Portal do Cliente" : "no PW OS"}.
            </p>
          </div>
        </div>
        <div className="password-welcome">
          <b>Olá, {user.name.split(" ")[0]}!</b>
          <span>
            Substitua sua senha temporária antes de acessar{" "}
            {clientPortal ? "o Portal do Cliente" : "o sistema"}.
          </span>
        </div>
        <form onSubmit={submit}>
          <label>
            Nova senha
            <div className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={show ? "text" : "password"}
                minLength={8}
                autoComplete="new-password"
                autoFocus
              />
              <button type="button" onClick={() => setShow((value) => !value)}>
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <div className="password-strength">
            <div>
              <i
                className={
                  rules.filter((rule) => rule.valid).length >=
                  Math.ceil(rules.length / 3)
                    ? "active"
                    : ""
                }
              />
              <i
                className={
                  rules.filter((rule) => rule.valid).length >=
                  Math.ceil((rules.length * 2) / 3)
                    ? "active"
                    : ""
                }
              />
              <i
                className={
                  rules.every((rule) => rule.valid) ? "active strong" : ""
                }
              />
            </div>
            <span>
              {rules.every((rule) => rule.valid)
                ? "Senha forte"
                : "Complete os requisitos abaixo"}
            </span>
          </div>
          <ul className="password-rules">
            {rules.map((rule) => (
              <li className={rule.valid ? "valid" : ""} key={rule.label}>
                {rule.valid ? <Check /> : <span />}
                {rule.label}
              </li>
            ))}
          </ul>
          <label>
            Confirmar nova senha
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
            {confirmation && (
              <small
                className={password === confirmation ? "match" : "mismatch"}
              >
                {password === confirmation
                  ? "As senhas correspondem"
                  : "As senhas não correspondem"}
              </small>
            )}
          </label>
          {error && (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          )}
          <button
            className="primary password-submit"
            disabled={!strong || loading}
          >
            {loading ? "Salvando..." : "Salvar senha e continuar"}
            <ArrowRight />
          </button>
        </form>
        <button className="logout-setup" onClick={onLogout}>
          Sair e usar outra conta
        </button>
      </section>
    </div>
  );
}

export function App() {
  const clientPortal = window.location.pathname.startsWith("/portal-cliente");
  const publicProposal = window.location.pathname.startsWith("/proposta/");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (publicProposal) {
      setChecking(false);
      return;
    }
    fetch(clientPortal ? "/api/client-auth/session" : "/api/auth/session")
      .then(
        async (response) =>
          response.ok && setUser((await response.json()).user),
      )
      .finally(() => setChecking(false));
  }, [publicProposal]);
  useEffect(() => {
    if (
      user &&
      ((clientPortal && user.profile !== "CLIENT") ||
        (!clientPortal && user.profile === "CLIENT"))
    ) {
      void fetch(
        clientPortal ? "/api/client-auth/logout" : "/api/auth/logout",
        { method: "POST" },
      ).finally(() => setUser(null));
    }
  }, [clientPortal, user?.id]);
  const logout = async () => {
    await fetch(clientPortal ? "/api/client-auth/logout" : "/api/auth/logout", {
      method: "POST",
    });
    setUser(null);
  };
  if (publicProposal) return <PublicProposal />;
  if (checking)
    return (
      <div className="app-loading">
        <Brand compact />
        <p>Carregando ambiente seguro...</p>
      </div>
    );
  if (!user) return <Login onLogin={setUser} clientPortal={clientPortal} />;
  if (user.mustChangePassword)
    return (
      <>
        <div className="password-locked-content" inert aria-hidden="true">
          {clientPortal && user.profile === "CLIENT" ? (
            <ClientPortal user={user} onLogout={logout} />
          ) : (
            <Shell user={user} onLogout={logout} onUserUpdate={setUser} />
          )}
        </div>
        <PasswordSetup
          user={user}
          onComplete={setUser}
          onLogout={logout}
          clientPortal={clientPortal}
        />
      </>
    );
  if (clientPortal && user.profile === "CLIENT")
    return <ClientPortal user={user} onLogout={logout} />;
  return <Shell user={user} onLogout={logout} onUserUpdate={setUser} />;
}
