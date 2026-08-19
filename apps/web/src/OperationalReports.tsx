import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Filter,
  KanbanSquare,
  ListChecks,
  Search,
  TrendingUp,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ReportsDashboard.css";

type User = { id: string; profile: string; permissions: string[] };
type Opportunity = {
  id: string;
  name: string;
  company: string;
  status: string;
  potentialValue: number;
  responsibleId: string;
  responsibleName: string;
  clientId?: string;
  createdAt: string;
  convertedAt?: string;
  lossReason?: string;
};
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  responsibleId: string;
  responsibleName: string;
  clientId?: string;
  dueAt: string;
  createdAt: string;
  updatedAt?: string;
};
type Client = { id: string; name: string; status: string; segment?: string };
type Event = {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  startAt: string;
  category: string;
};
type Entry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  dueDate: string;
  paidAt: string;
  status: string;
  clientId: string;
};
type Data = {
  opportunities: Opportunity[];
  tasks: Task[];
  clients: Client[];
  events: Event[];
  finance: Entry[];
  canViewFinanceValues: boolean;
};
type View = "OVERVIEW" | "COMMERCIAL" | "OPERATIONS" | "FINANCE";
type Sort = "name" | "owner" | "status" | "value";
const empty: Data = {
  opportunities: [],
  tasks: [],
  clients: [],
  events: [],
  finance: [],
  canViewFinanceValues: false,
};
const colors = ["#1677d2", "#19a974", "#f59e0b", "#dc5a5a", "#7c5ce7"];
const iso = (d: Date) => d.toISOString().slice(0, 10),
  startFor = (days: number) =>
    iso(new Date(Date.now() - (days - 1) * 86400000));
const money = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }),
  number = (v: number) => v.toLocaleString("pt-BR");
const formatDate = (v: string) =>
  v
    ? new Date(v.length === 10 ? `${v}T12:00` : v).toLocaleDateString("pt-BR")
    : "Sem data";
const inRange = (v: string, since: string, until: string) =>
  !!v &&
  (!since || v.slice(0, 10) >= since) &&
  (!until || v.slice(0, 10) <= until);
const taskLabel: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  WAITING_CLIENT: "Aguardando cliente",
  REVIEW: "Em revisão",
  WAITING_APPROVAL: "Aguardando aprovação",
  CHANGES_REQUESTED: "Alterações solicitadas",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  PUBLISHED: "Publicada",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};
const opportunityLabel: Record<string, string> = {
  OPEN: "Em aberto",
  WON: "Ganha",
  CONVERTED: "Convertida",
  LOST: "Perdida",
};

function Select({
  icon: Icon,
  label,
  value,
  onChange,
  children,
}: {
  icon: typeof Filter;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="report-select">
      <Icon />
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown />
    </label>
  );
}
function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <article className={`report-kpi ${tone}`}>
      <span>
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <em>{detail}</em>
      </div>
    </article>
  );
}
function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`report-panel ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="report-empty-state">
      <BarChart3 />
      <span>{text}</span>
    </div>
  );
}

export function OperationalReports() {
  const [session, setSession] = useState<User | null>(null),
    [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(true),
    [view, setView] = useState<View>("OVERVIEW"),
    [preset, setPreset] = useState("90"),
    [since, setSince] = useState(() => startFor(90)),
    [until, setUntil] = useState(() => iso(new Date())),
    [clientId, setClientId] = useState("ALL"),
    [ownerId, setOwnerId] = useState("ALL"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<Sort>("value");
  const can = (permission: string, user = session) =>
    user?.profile === "MASTER" || !!user?.permissions?.includes(permission);
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const sr = await fetch("/api/auth/session");
      if (!sr.ok) {
        setLoading(false);
        return;
      }
      const user = (await sr.json()).user as User;
      setSession(user);
      const allowed = (p: string) =>
          user.profile === "MASTER" || user.permissions.includes(p),
        requests: Promise<{ key: string; ok: boolean; payload: any }>[] = [];
      const add = (key: string, p: string, url: string) => {
        if (allowed(p))
          requests.push(
            fetch(url).then(async (r) => ({
              key,
              ok: r.ok,
              payload: await r.json(),
            })),
          );
      };
      add("opportunities", "opportunities.view", "/api/crm/opportunities");
      add("tasks", "tasks.view", "/api/tasks");
      add("clients", "clients.view", "/api/clients");
      add("events", "calendar.view", "/api/calendar/events");
      add("finance", "finance.view", "/api/finance");
      const results = await Promise.all(requests),
        next = { ...empty };
      results.forEach((r) => {
        if (!r.ok) return;
        if (r.key === "opportunities")
          next.opportunities = r.payload.opportunities || [];
        if (r.key === "tasks") next.tasks = r.payload.tasks || [];
        if (r.key === "clients") next.clients = r.payload.clients || [];
        if (r.key === "events") next.events = r.payload.events || [];
        if (r.key === "finance") {
          next.finance = r.payload.entries || [];
          next.canViewFinanceValues = r.payload.canViewValues !== false;
        }
      });
      setData(next);
      setLoading(false);
    };
    void load();
  }, []);
  const setPeriod = (value: string) => {
    setPreset(value);
    if (value !== "CUSTOM") {
      setSince(value === "ALL" ? "" : startFor(Number(value)));
      setUntil(iso(new Date()));
    }
  };
  const owners = useMemo(() => {
    const map = new Map<string, string>();
    data.opportunities.forEach(
      (i) =>
        i.responsibleId &&
        map.set(i.responsibleId, i.responsibleName || "Sem nome"),
    );
    data.tasks.forEach(
      (i) =>
        i.responsibleId &&
        map.set(i.responsibleId, i.responsibleName || "Sem nome"),
    );
    data.events.forEach(
      (i) => i.ownerId && map.set(i.ownerId, i.ownerName || "Sem nome"),
    );
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const filtered = useMemo(() => {
    const text = (...v: string[]) =>
      !query || v.join(" ").toLowerCase().includes(query.toLowerCase());
    return {
      opportunities: data.opportunities.filter(
        (i) =>
          inRange(i.createdAt, since, until) &&
          (clientId === "ALL" || i.clientId === clientId) &&
          (ownerId === "ALL" || i.responsibleId === ownerId) &&
          text(i.name, i.company, i.responsibleName),
      ),
      tasks: data.tasks.filter(
        (i) =>
          inRange(i.dueAt || i.createdAt, since, until) &&
          (clientId === "ALL" || i.clientId === clientId) &&
          (ownerId === "ALL" || i.responsibleId === ownerId) &&
          text(i.title, i.responsibleName),
      ),
      events: data.events.filter(
        (i) =>
          inRange(i.startAt, since, until) &&
          (ownerId === "ALL" || i.ownerId === ownerId) &&
          text(i.title, i.ownerName, i.category),
      ),
      finance: data.finance.filter(
        (i) =>
          inRange(i.dueDate, since, until) &&
          (clientId === "ALL" || i.clientId === clientId) &&
          text(i.description),
      ),
    };
  }, [data, since, until, clientId, ownerId, query]);
  const open = filtered.opportunities.filter((i) => i.status === "OPEN"),
    won = filtered.opportunities.filter((i) =>
      ["WON", "CONVERTED"].includes(i.status),
    ),
    lost = filtered.opportunities.filter((i) => i.status === "LOST"),
    done = filtered.tasks.filter((i) => i.status === "DONE"),
    late = filtered.tasks.filter(
      (i) =>
        i.dueAt &&
        i.dueAt.slice(0, 10) < iso(new Date()) &&
        !["DONE", "CANCELLED"].includes(i.status),
    ),
    income = filtered.finance
      .filter((i) => i.type === "INCOME" && i.status !== "CANCELLED")
      .reduce((s, i) => s + i.amount, 0),
    expense = filtered.finance
      .filter((i) => i.type === "EXPENSE" && i.status !== "CANCELLED")
      .reduce((s, i) => s + i.amount, 0),
    visibleMoney = (v: number) =>
      data.canViewFinanceValues ? money(v) : "••••••",
    visibleOpportunityMoney = (v: number) =>
      can("opportunities.view_values") ? money(v) : "••••••";
  const monthly = useMemo(() => {
    const months = new Map<
        string,
        {
          month: string;
          opportunities: number;
          won: number;
          tasks: number;
          income: number;
          expense: number;
        }
      >(),
      row = (v: string) => {
        const key = v.slice(0, 7),
          label = new Date(`${key}-02T12:00`).toLocaleDateString("pt-BR", {
            month: "short",
          });
        if (!months.has(key))
          months.set(key, {
            month: label,
            opportunities: 0,
            won: 0,
            tasks: 0,
            income: 0,
            expense: 0,
          });
        return months.get(key)!;
      };
    filtered.opportunities.forEach((i) => {
      const r = row(i.createdAt);
      r.opportunities++;
      if (["WON", "CONVERTED"].includes(i.status)) r.won++;
    });
    filtered.tasks.forEach((i) => row(i.dueAt || i.createdAt).tasks++);
    filtered.finance.forEach(
      (i) =>
        (row(i.dueDate)[i.type === "INCOME" ? "income" : "expense"] +=
          i.amount),
    );
    return [...months]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v)
      .slice(-12);
  }, [filtered]);
  const taskRows = Object.entries(
      filtered.tasks.reduce<Record<string, number>>((m, i) => {
        const key = taskLabel[i.status] || i.status;
        m[key] = (m[key] || 0) + 1;
        return m;
      }, {}),
    ).map(([name, value]) => ({ name, value })),
    funnelRows = [
      { name: "Criadas", value: filtered.opportunities.length },
      { name: "Em aberto", value: open.length },
      { name: "Ganhas", value: won.length },
      { name: "Perdidas", value: lost.length },
    ];
  const ownerRows = owners
    .map(([id, name]) => {
      const tasks = filtered.tasks.filter((i) => i.responsibleId === id),
        completed = tasks.filter((i) => i.status === "DONE").length;
      return {
        id,
        name,
        tasks: tasks.length,
        completed,
        opportunities: filtered.opportunities.filter(
          (i) => i.responsibleId === id,
        ).length,
        rate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      };
    })
    .filter((i) => i.tasks || i.opportunities)
    .sort(
      (a, b) => b.completed - a.completed || b.opportunities - a.opportunities,
    );
  const sorted = [...filtered.opportunities].sort((a, b) =>
    sort === "name"
      ? (a.company || a.name).localeCompare(b.company || b.name)
      : sort === "owner"
        ? (a.responsibleName || "").localeCompare(b.responsibleName || "")
        : sort === "status"
          ? a.status.localeCompare(b.status)
          : Number(b.potentialValue || 0) - Number(a.potentialValue || 0),
  );
  const exportCsv = () => {
    const rows = [
        [
          "Oportunidade",
          "Empresa",
          "Responsável",
          "Status",
          "Valor",
          "Criada em",
        ],
        ...sorted.map((i) => [
          i.name,
          i.company,
          i.responsibleName,
          opportunityLabel[i.status] || i.status,
          can("opportunities.view_values")
            ? String(i.potentialValue || 0)
            : "Valor protegido",
          formatDate(i.createdAt),
        ]),
      ],
      csv = rows
        .map((r) =>
          r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"),
        )
        .join("\n"),
      link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `relatorio-pw-os-${iso(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const tabs: Array<[View, string, typeof Activity, boolean]> = [
    ["OVERVIEW", "Resumo executivo", BarChart3, true],
    ["COMMERCIAL", "Comercial", TrendingUp, can("opportunities.view")],
    [
      "OPERATIONS",
      "Operação",
      ListChecks,
      can("tasks.view") || can("calendar.view"),
    ],
    ["FINANCE", "Financeiro", WalletCards, can("finance.view")],
  ];
  if (loading)
    return (
      <div className="page report-loading">
        <Activity />
        <h2>Preparando relatórios</h2>
        <p>Organizando somente os dados permitidos para o seu acesso.</p>
      </div>
    );
  return (
    <div className="page reports-pro">
      <header className="reports-pro-head">
        <div>
          <span className="eyebrow">INTELIGÊNCIA OPERACIONAL</span>
          <h1>Relatórios</h1>
          <p>
            Indicadores consolidados da operação dentro do seu nível de acesso.
          </p>
        </div>
        {can("reports.download") && (
          <button className="secondary" onClick={exportCsv}>
            <Download /> Exportar CSV
          </button>
        )}
      </header>
      <section className="report-filterbar">
        <label className="report-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nos relatórios..."
          />
        </label>
        <Select
          icon={CalendarDays}
          label="Período"
          value={preset}
          onChange={setPeriod}
        >
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Últimos 12 meses</option>
          <option value="ALL">Todo o histórico</option>
          <option value="CUSTOM">Personalizado</option>
        </Select>
        {can("clients.view") && (
          <Select
            icon={BriefcaseBusiness}
            label="Cliente"
            value={clientId}
            onChange={setClientId}
          >
            <option value="ALL">Todos os clientes</option>
            {data.clients.map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        )}
        {owners.length > 0 && (
          <Select
            icon={UserRound}
            label="Responsável"
            value={ownerId}
            onChange={setOwnerId}
          >
            <option value="ALL">Toda a equipe</option>
            {owners.map(([id, name]) => (
              <option value={id} key={id}>
                {name}
              </option>
            ))}
          </Select>
        )}
        {preset === "CUSTOM" && (
          <div className="report-custom-dates">
            <input
              aria-label="Data inicial"
              type="date"
              value={since}
              max={until}
              onChange={(e) => setSince(e.target.value)}
            />
            <span>até</span>
            <input
              aria-label="Data final"
              type="date"
              value={until}
              min={since}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        )}
        <span className="report-scope">
          <CheckCircle2 /> Escopo protegido por permissões
        </span>
      </section>
      <nav className="report-tabs">
        {tabs
          .filter(([, , , visible]) => visible)
          .map(([key, label, Icon]) => (
            <button
              className={view === key ? "active" : ""}
              onClick={() => setView(key)}
              key={key}
            >
              <Icon />
              {label}
            </button>
          ))}
      </nav>
      {view === "OVERVIEW" && (
        <>
          <section className="report-kpi-grid">
            {can("opportunities.view") && (
              <Kpi
                icon={KanbanSquare}
                label="Pipeline aberto"
                value={visibleOpportunityMoney(
                  open.reduce((s, i) => s + Number(i.potentialValue || 0), 0),
                )}
                detail={`${open.length} oportunidades em andamento`}
              />
            )}{" "}
            {can("opportunities.view") && (
              <Kpi
                icon={TrendingUp}
                label="Conversão"
                value={`${filtered.opportunities.length ? Math.round((won.length / filtered.opportunities.length) * 100) : 0}%`}
                detail={`${won.length} ganhas de ${filtered.opportunities.length}`}
                tone="green"
              />
            )}
            {can("tasks.view") && (
              <Kpi
                icon={CheckCircle2}
                label="Conclusão de tarefas"
                value={`${filtered.tasks.length ? Math.round((done.length / filtered.tasks.length) * 100) : 0}%`}
                detail={`${done.length} de ${filtered.tasks.length} concluídas`}
                tone="purple"
              />
            )}
            {can("tasks.view") && (
              <Kpi
                icon={Clock3}
                label="Tarefas atrasadas"
                value={number(late.length)}
                detail={
                  late.length
                    ? "Exigem atenção operacional"
                    : "Nenhum atraso no período"
                }
                tone={late.length ? "orange" : "green"}
              />
            )}{" "}
            {can("clients.view") && (
              <Kpi
                icon={BriefcaseBusiness}
                label="Clientes ativos"
                value={number(
                  data.clients.filter((i) => i.status === "ACTIVE").length,
                )}
                detail={`${data.clients.length} clientes no seu escopo`}
                tone="cyan"
              />
            )}
            {can("calendar.view") && (
              <Kpi
                icon={CalendarDays}
                label="Compromissos"
                value={number(filtered.events.length)}
                detail="Eventos dentro do período"
                tone="cyan"
              />
            )}
            {can("finance.view") && (
              <Kpi
                icon={CircleDollarSign}
                label="Resultado previsto"
                value={visibleMoney(income - expense)}
                detail={`${visibleMoney(income)} em receitas`}
                tone={income >= expense ? "green" : "orange"}
              />
            )}
          </section>
          <div className="report-dashboard-grid">
            <Panel
              title="Evolução operacional"
              subtitle="Movimento mensal dos registros visíveis"
              className="wide"
            >
              <div className="report-chart">
                <ResponsiveContainer>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="opportunities"
                      name="Oportunidades"
                      stroke="#1677d2"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="tasks"
                      name="Tarefas"
                      stroke="#7c5ce7"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel
              title="Status das tarefas"
              subtitle="Distribuição do trabalho no período"
            >
              <div className="report-status-list">
                {taskRows.map((item, index) => {
                  const percentage = filtered.tasks.length
                    ? Math.round((item.value / filtered.tasks.length) * 100)
                    : 0;
                  return (
                    <article key={item.name}>
                      <header>
                        <span>
                          <i
                            style={{
                              background: colors[index % colors.length],
                            }}
                          />
                          <b>{item.name}</b>
                        </span>
                        <strong>{item.value}</strong>
                      </header>
                      <div>
                        <i
                          style={{
                            width: `${percentage}%`,
                            background: colors[index % colors.length],
                          }}
                        />
                      </div>
                      <small>{percentage}% das tarefas filtradas</small>
                    </article>
                  );
                })}
                {!taskRows.length && (
                  <Empty text="Nenhuma tarefa encontrada no período." />
                )}
              </div>
            </Panel>
            <Panel
              title="Performance da equipe"
              subtitle="Conclusões e oportunidades por responsável"
              className="wide"
            >
              <div className="report-owner-list">
                {ownerRows.slice(0, 8).map((i) => (
                  <article key={i.id}>
                    <span>
                      {i.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <b>{i.name}</b>
                      <small>
                        {i.tasks} tarefas · {i.opportunities} oportunidades
                      </small>
                      <i>
                        <em style={{ width: `${i.rate}%` }} />
                      </i>
                    </div>
                    <strong>{i.rate}%</strong>
                  </article>
                ))}
                {!ownerRows.length && (
                  <Empty text="Nenhum responsável com atividade no período." />
                )}
              </div>
            </Panel>
            <Panel
              title="Alertas de gestão"
              subtitle="Pontos que merecem acompanhamento"
            >
              <div className="report-alerts">
                <p className={late.length ? "warning" : "ok"}>
                  <Clock3 />
                  <span>
                    <b>{late.length} tarefa(s) atrasada(s)</b>
                    <small>
                      {late.length
                        ? "Revise prazos e responsáveis"
                        : "Operação dentro do prazo"}
                    </small>
                  </span>
                </p>
                <p
                  className={
                    open.filter((i) => !i.responsibleId).length
                      ? "warning"
                      : "ok"
                  }
                >
                  <UserRound />
                  <span>
                    <b>
                      {open.filter((i) => !i.responsibleId).length}{" "}
                      oportunidade(s) sem responsável
                    </b>
                    <small>Distribuição do pipeline comercial</small>
                  </span>
                </p>
                <p className={lost.length ? "warning" : "ok"}>
                  <ArrowDownRight />
                  <span>
                    <b>{lost.length} oportunidade(s) perdida(s)</b>
                    <small>Analise os motivos de perda</small>
                  </span>
                </p>
              </div>
            </Panel>
          </div>
        </>
      )}
      {view === "COMMERCIAL" && (
        <div className="report-dashboard-grid">
          <Panel
            title="Funil comercial"
            subtitle="Volume por situação da oportunidade"
          >
            <div className="report-chart">
              <ResponsiveContainer>
                <BarChart data={funnelRows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={75} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Oportunidades"
                    fill="#1677d2"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel
            title="Motivos de perda"
            subtitle="Principais causas informadas"
          >
            <div className="report-ranking">
              {Object.entries(
                lost.reduce<Record<string, number>>((m, i) => {
                  const k = i.lossReason || "Não informado";
                  m[k] = (m[k] || 0) + 1;
                  return m;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </p>
                ))}
              {!lost.length && (
                <Empty text="Nenhuma oportunidade perdida no período." />
              )}
            </div>
          </Panel>
          <Panel
            title="Oportunidades"
            subtitle={`${sorted.length} registros encontrados`}
            className="full"
          >
            <div className="report-table-tools">
              <Select
                icon={Filter}
                label="Ordenar"
                value={sort}
                onChange={(v) => setSort(v as Sort)}
              >
                <option value="value">Maior valor</option>
                <option value="name">Nome</option>
                <option value="owner">Responsável</option>
                <option value="status">Status</option>
              </Select>
            </div>
            <div className="report-table">
              <div className="head">
                <span>Oportunidade</span>
                <span>Responsável</span>
                <span>Status</span>
                <span>Criação</span>
                <span>Valor</span>
              </div>
              {sorted.map((i) => (
                <article key={i.id}>
                  <span>
                    <b>{i.name}</b>
                    <small>{i.company || "Empresa não informada"}</small>
                  </span>
                  <span>{i.responsibleName || "Sem responsável"}</span>
                  <span>
                    <em className={i.status.toLowerCase()}>
                      {opportunityLabel[i.status] || i.status}
                    </em>
                  </span>
                  <time>{formatDate(i.createdAt)}</time>
                  <strong>
                    {visibleOpportunityMoney(Number(i.potentialValue || 0))}
                  </strong>
                </article>
              ))}
              {!sorted.length && (
                <Empty text="Nenhuma oportunidade encontrada com estes filtros." />
              )}
            </div>
          </Panel>
        </div>
      )}
      {view === "OPERATIONS" && (
        <div className="report-dashboard-grid">
          <Panel title="Tarefas por status" subtitle="Distribuição operacional">
            <div className="report-chart">
              <ResponsiveContainer>
                <BarChart data={taskRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name="Tarefas"
                    fill="#7c5ce7"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel
            title="Agenda por categoria"
            subtitle={`${filtered.events.length} compromissos no período`}
          >
            <div className="report-ranking">
              {Object.entries(
                filtered.events.reduce<Record<string, number>>((m, i) => {
                  const k = i.category || "Sem categoria";
                  m[k] = (m[k] || 0) + 1;
                  return m;
                }, {}),
              )
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <b>{value}</b>
                  </p>
                ))}
              {!filtered.events.length && (
                <Empty text="Nenhum compromisso no período." />
              )}
            </div>
          </Panel>
          <Panel
            title="Produtividade por responsável"
            subtitle="Carga, entregas e taxa de conclusão"
            className="full"
          >
            <div className="report-productivity">
              <div className="head">
                <span>Responsável</span>
                <span>Tarefas</span>
                <span>Concluídas</span>
                <span>Oportunidades</span>
                <span>Conclusão</span>
              </div>
              {ownerRows.map((i) => (
                <article key={i.id}>
                  <b>{i.name}</b>
                  <span>{i.tasks}</span>
                  <span>{i.completed}</span>
                  <span>{i.opportunities}</span>
                  <strong>{i.rate}%</strong>
                </article>
              ))}
              {!ownerRows.length && (
                <Empty text="Nenhuma atividade encontrada." />
              )}
            </div>
          </Panel>
        </div>
      )}
      {view === "FINANCE" && (
        <div className="report-dashboard-grid">
          <section className="report-kpi-grid full-row">
            <Kpi
              icon={ArrowUpRight}
              label="Receitas"
              value={visibleMoney(income)}
              detail={`${filtered.finance.filter((i) => i.type === "INCOME").length} lançamentos`}
              tone="green"
            />
            <Kpi
              icon={ArrowDownRight}
              label="Despesas"
              value={visibleMoney(expense)}
              detail={`${filtered.finance.filter((i) => i.type === "EXPENSE").length} lançamentos`}
              tone="orange"
            />
            <Kpi
              icon={WalletCards}
              label="Resultado"
              value={visibleMoney(income - expense)}
              detail={
                income >= expense
                  ? "Resultado positivo"
                  : "Despesas acima das receitas"
              }
              tone={income >= expense ? "green" : "orange"}
            />
          </section>
          <Panel
            title="Fluxo financeiro"
            subtitle="Receitas e despesas por mês"
            className="wide"
          >
            {data.canViewFinanceValues ? (
              <div className="report-chart">
                <ResponsiveContainer>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip
                      formatter={(v) =>
                        data.canViewFinanceValues
                          ? money(Number(v))
                          : "Valor protegido"
                      }
                    />
                    <Bar
                      dataKey="income"
                      name="Receitas"
                      fill="#19a974"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Despesas"
                      fill="#dc5a5a"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty text="Os valores financeiros estão protegidos para este nível de acesso." />
            )}
          </Panel>
          <Panel
            title="Situação dos lançamentos"
            subtitle="Distribuição por status"
          >
            <div className="report-ranking">
              {Object.entries(
                filtered.finance.reduce<Record<string, number>>((m, i) => {
                  m[i.status] = (m[i.status] || 0) + 1;
                  return m;
                }, {}),
              ).map(([label, value]) => (
                <p key={label}>
                  <span>
                    {label === "PAID"
                      ? "Pago"
                      : label === "OPEN"
                        ? "Em aberto"
                        : label === "CANCELLED"
                          ? "Cancelado"
                          : label}
                  </span>
                  <b>{value}</b>
                </p>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
