import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  Eye,
  FileBarChart,
  History,
  KeyRound,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "./ClientReportAgenda.css";
import "./ClientReportWorkflow.css";
import "./ClientReportSettings.css";
import { systemConfirm, systemPrompt } from "./SystemDialog";

type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type Workflow = "SCHEDULED" | "PREPARING" | "READY" | "BLOCKED";
type Delivery = "EMAIL" | "WHATSAPP" | "MEETING" | "OTHER";
type Schedule = {
  id: string;
  clientId: string;
  clientName: string;
  frequency: Frequency;
  nextDueAt: string;
  responsibleId: string;
  responsibleName: string;
  recipients: string[];
  useMediaResponsible?: boolean;
  template: "PERFORMANCE" | "EXECUTIVE" | "COMPLETE";
  reportRange: "FIRST_HALF" | "LAST_30" | "FULL_MONTH";
  deliveryMethod: Delivery;
  deliveryLagDays?: 0 | 1 | 2;
  workflowStatus: Workflow;
  blockedReason?: string;
  active: boolean;
  notes: string;
  lastSentAt?: string;
  history: Array<{
    id: string;
    dueAt: string;
    sentAt: string;
    sentByName: string;
    deliveryMethod?: Delivery;
  }>;
  activities?: Array<{
    id: string;
    action:
      | "GENERATED"
      | "VIEWED"
      | "DOWNLOADED"
      | "LINK_COPIED"
      | "STATUS_CHANGED"
      | "SENT";
    actorName: string;
    createdAt: string;
    detail?: string;
  }>;
  artifacts?: Array<{
    id: string;
    version: number;
    fileName: string;
    since: string;
    until: string;
    createdAt: string;
    createdByName: string;
    shareExpiresAt?: string;
  }>;
};
type Option = {
  id: string;
  name: string;
  primaryContactEmail?: string;
  mediaAssignmentCount?: number;
  mediaResponsibleId?: string;
  mediaResponsibleName?: string;
  portalUserCount?: number;
};
type AgendaFilter = "ALL" | "LATE" | "TODAY" | "WEEK" | "READY" | "SENT";

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const frequencyLabel: Record<Frequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "A cada 15 dias",
  MONTHLY: "Mensal",
};
const templateLabel = {
  PERFORMANCE: "Performance",
  EXECUTIVE: "Executivo",
  COMPLETE: "Completo",
};
const rangeLabel = {
  FIRST_HALF: "Primeiros 15 dias",
  LAST_30: "Últimos 30 dias",
  FULL_MONTH: "Mês inteiro",
};
const workflowLabel: Record<Workflow, string> = {
  SCHEDULED: "Agendado",
  PREPARING: "Em preparação",
  READY: "Pronto para enviar",
  BLOCKED: "Bloqueado",
};
const deliveryLabel: Record<Delivery, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  MEETING: "Reunião",
  OTHER: "Outro canal",
};
const preparationDate = (dueAt: string) => {
  const date = new Date(`${dueAt}T12:00:00`);
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6)
    date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

export function ClientReportAgenda({
  onGenerate,
  onManageClientAccess,
}: {
  onGenerate?: (request: {
    clientId: string;
    since: string;
    until: string;
    frequency: Frequency;
    includeThirtyDaySummary: boolean;
    previewWindow: Window | null;
  }) => void;
  onManageClientAccess?: (clientId: string) => void;
}) {
  const setupHandled = useRef(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]),
    [clients, setClients] = useState<Option[]>([]),
    [users, setUsers] = useState<Option[]>([]);
  const historyMode =
    new URLSearchParams(window.location.search).get("view") === "history" ||
    window.location.pathname.endsWith("/historico");
  const [loading, setLoading] = useState(true),
    [tab, setTab] = useState<"AGENDA" | "SETTINGS">("AGENDA"),
    [filter, setFilter] = useState<AgendaFilter>(historyMode ? "SENT" : "ALL");
  const [search, setSearch] = useState(""),
    [responsibleFilter, setResponsibleFilter] = useState("ALL"),
    [statusFilter, setStatusFilter] = useState("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState("ALL"),
    [deliveryFilter, setDeliveryFilter] = useState("ALL"),
    [timingFilter, setTimingFilter] = useState("ALL");
  const [page, setPage] = useState(1),
    [settingsPage, setSettingsPage] = useState(1),
    [historyPage, setHistoryPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null),
    [modal, setModal] = useState(false),
    [saving, setSaving] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const emptyForm = {
    clientId: "",
    frequency: "WEEKLY" as Frequency,
    nextDueAt: today(),
    responsibleId: "",
    useMediaResponsible: false,
    recipients: "",
    template: "PERFORMANCE",
    reportRange: "LAST_30",
    deliveryMethod: "EMAIL",
    deliveryLagDays: 1,
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const response = await fetch("/api/client-report-schedules"),
      payload = await response.json();
    if (response.ok) {
      setSchedules(payload.schedules || []);
      setClients(payload.clients || []);
      setUsers(payload.users || []);
    } else setMessage(payload.message || "Não foi possível carregar a agenda.");
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);
  const daysUntil = (date: string) =>
    Math.round(
      (new Date(`${date}T12:00:00`).getTime() -
        new Date(`${today()}T12:00:00`).getTime()) /
        86400000,
    );
  const timing = (item: Schedule) =>
    daysUntil(item.nextDueAt) < 0
      ? "LATE"
      : preparationDate(item.nextDueAt) <= today()
        ? "TODAY"
        : daysUntil(preparationDate(item.nextDueAt)) <= 7
          ? "WEEK"
          : "FUTURE";
  const counts = useMemo(
    () => ({
      late: schedules.filter((item) => item.active && timing(item) === "LATE")
        .length,
      today: schedules.filter((item) => item.active && timing(item) === "TODAY")
        .length,
      week: schedules.filter(
        (item) => item.active && ["TODAY", "WEEK"].includes(timing(item)),
      ).length,
      ready: schedules.filter(
        (item) => item.active && item.workflowStatus === "READY",
      ).length,
      sent: schedules.reduce(
        (sum, item) =>
          sum +
          item.history.filter(
            (entry) => entry.sentAt.slice(0, 7) === today().slice(0, 7),
          ).length,
        0,
      ),
      uncovered: clients.filter(
        (client) =>
          !schedules.some((item) => item.clientId === client.id && item.active),
      ).length,
    }),
    [schedules, clients],
  );
  const visible = useMemo(
    () =>
      schedules
        .filter((item) => {
          const normalized = search.trim().toLocaleLowerCase("pt-BR");
          const matchesSearch =
            !normalized ||
            [
              item.clientName,
              item.responsibleName,
              item.notes,
              ...item.recipients,
            ].some((value) =>
              value.toLocaleLowerCase("pt-BR").includes(normalized),
            );
          const matchesQuick =
            filter === "ALL" ||
            (filter === "SENT" && item.history.length > 0) ||
            (filter === "READY" && item.workflowStatus === "READY") ||
            filter === timing(item);
          return (
            matchesSearch &&
            matchesQuick &&
            (timingFilter === "ALL" || timing(item) === timingFilter) &&
            (responsibleFilter === "ALL" ||
              item.responsibleId === responsibleFilter) &&
            (statusFilter === "ALL" || item.workflowStatus === statusFilter) &&
            (frequencyFilter === "ALL" || item.frequency === frequencyFilter) &&
            (deliveryFilter === "ALL" || item.deliveryMethod === deliveryFilter)
          );
        })
        .sort((a, b) => {
          const priority = (item: Schedule) =>
            !item.active
              ? 5
              : timing(item) === "LATE"
                ? 0
                : item.workflowStatus === "BLOCKED"
                  ? 1
                  : item.workflowStatus === "READY"
                    ? 2
                    : timing(item) === "TODAY"
                      ? 3
                      : 4;
          return (
            priority(a) - priority(b) || a.nextDueAt.localeCompare(b.nextDueAt)
          );
        }),
    [
      schedules,
      search,
      filter,
      timingFilter,
      responsibleFilter,
      statusFilter,
      frequencyFilter,
      deliveryFilter,
    ],
  );
  useEffect(() => {
    setPage(1);
    setSettingsPage(1);
    setHistoryPage(1);
  }, [
    search,
    filter,
    timingFilter,
    responsibleFilter,
    statusFilter,
    frequencyFilter,
    deliveryFilter,
    tab,
  ]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setMessage("");
    const response = await fetch(`/api/client-report-schedules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Não foi possível atualizar a rotina.");
      return false;
    }
    await load();
    return true;
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(
        editingId
          ? `/api/client-report-schedules/${editingId}`
          : "/api/client-report-schedules",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            recipients: form.recipients
              .split(/[,;\n]/)
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        },
      ),
      payload = await response.json();
    setSaving(false);
    if (!response.ok)
      return setMessage(payload.message || "Não foi possível salvar a rotina.");
    setModal(false);
    setEditingId(null);
    setForm(emptyForm);
    await load();
  };
  const configure = (client: Option, schedule?: Schedule) => {
    const useMediaResponsible = schedule
      ? !!schedule.useMediaResponsible
      : !!client.mediaResponsibleId;
    setEditingId(schedule?.id || null);
    setForm(
      schedule
        ? {
            clientId: schedule.clientId,
            frequency: schedule.frequency,
            nextDueAt: schedule.nextDueAt,
            responsibleId: useMediaResponsible
              ? client.mediaResponsibleId || schedule.responsibleId
              : schedule.responsibleId,
            useMediaResponsible,
            recipients: schedule.recipients.join(", "),
            template: schedule.template,
            reportRange: schedule.reportRange,
            deliveryMethod: schedule.deliveryMethod || "EMAIL",
            deliveryLagDays: schedule.deliveryLagDays ?? 1,
            notes: schedule.notes || "",
          }
        : {
            ...emptyForm,
            clientId: client.id,
            frequency: "MONTHLY",
            responsibleId: client.mediaResponsibleId || "",
            useMediaResponsible,
            recipients: client.primaryContactEmail || "",
          },
    );
    setModal(true);
  };
  useEffect(() => {
    const setupClient = new URLSearchParams(window.location.search).get(
      "setupClient",
    );
    if (!setupHandled.current && setupClient && clients.length) {
      const client = clients.find((item) => item.id === setupClient);
      if (client) {
        setupHandled.current = true;
        setTab("SETTINGS");
        configure(
          client,
          schedules.find((item) => item.clientId === client.id),
        );
      }
    }
  }, [clients.length, schedules.length]);
  const sent = async (item: Schedule) => {
    if (
      !(await systemConfirm({
        title: item.deliveryMethod === "EMAIL" ? "Enviar relatório por e-mail?" : "Confirmar entrega do relatório?",
        message: item.deliveryMethod === "EMAIL" ? `O relatório de ${item.clientName} será enviado para ${item.recipients.join(", ")} usando seu Gmail conectado.` : `Confirme somente se o relatório de ${item.clientName} já foi entregue ao cliente. A próxima entrega será agendada automaticamente.`,
        confirmLabel: item.deliveryMethod === "EMAIL" ? "Enviar relatório" : "Confirmar entrega",
        tone: "primary",
      }))
    )
      return;
    const response = await fetch(
        `/api/client-report-schedules/${item.id}/sent`,
        { method: "POST" },
      ),
      payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.message || "Não foi possível enviar o relatório.",
      );
    setMessage(
      `Relatório de ${item.clientName} ${item.deliveryMethod === "EMAIL" ? "enviado por e-mail" : "marcado como entregue"}. A próxima tarefa foi agendada para ${dateLabel(preparationDate(payload.schedule.nextDueAt))}.`,
    );
    await load();
  };
  const reportUrl = (item: Schedule) =>
    `${window.location.origin}/midia/relatorios?reportClient=${encodeURIComponent(item.clientId)}&reportRange=${item.reportRange}`;
  const copyLink = async (item: Schedule) => {
    const response = await fetch(
        `/api/client-report-schedules/${item.id}/share`,
        { method: "POST" },
      ),
      payload = await response.json();
    if (!response.ok)
      return setMessage(payload.message || "Não foi possível criar o link.");
    await navigator.clipboard.writeText(
      `${window.location.origin}${payload.url}`,
    );
    setMessage(
      `Link protegido da versão ${payload.version} copiado. Ele expira em 7 dias.`,
    );
    await load();
  };
  const shareArtifact = async (item: Schedule, artifactId: string) => {
    const response = await fetch(
        `/api/client-report-schedules/${item.id}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId }),
        },
      ),
      payload = await response.json();
    if (!response.ok)
      return setMessage(
        payload.message || "Não foi possível compartilhar esta versão.",
      );
    await navigator.clipboard.writeText(
      `${window.location.origin}${payload.url}`,
    );
    setMessage(
      `Link protegido da versão ${payload.version} copiado. Ele expira em 7 dias.`,
    );
    await load();
  };
  const changeStatus = async (item: Schedule, workflowStatus: Workflow) => {
    let blockedReason = "";
    if (workflowStatus === "BLOCKED") {
      blockedReason =
        (await systemPrompt({
          title: "Por que este relatório está bloqueado?",
          message:
            "O motivo ficará visível para a equipe na agenda de entregas.",
          initialValue: item.blockedReason || "",
          placeholder: "Descreva o impedimento…",
          confirmLabel: "Bloquear relatório",
          tone: "warning",
          required: true,
        })) || "";
      if (!blockedReason) return;
    }
    await patch(item.id, { workflowStatus, blockedReason });
  };
  const toggleSchedule = async (item: Schedule) => {
    const pausing = item.active;
    const confirmed = await systemConfirm({
      title: pausing ? "Pausar esta rotina?" : "Reativar esta rotina?",
      message: pausing
        ? `Enquanto a rotina de ${item.clientName} estiver pausada, ela não entrará nas prioridades nem gerará novas pendências de entrega.`
        : `A rotina de ${item.clientName} voltará para a agenda e será considerada nas próximas entregas.`,
      confirmLabel: pausing ? "Sim, pausar rotina" : "Reativar rotina",
      tone: pausing ? "warning" : "primary",
    });
    if (!confirmed) return;
    setTogglingScheduleId(item.id);
    try {
      if (await patch(item.id, { active: !item.active }))
        setMessage(
          pausing
            ? `Rotina de ${item.clientName} pausada com sucesso.`
            : `Rotina de ${item.clientName} reativada com sucesso.`,
        );
    } finally {
      setTogglingScheduleId(null);
    }
  };
  const recordActivity = (item: Schedule, action: "GENERATED" | "VIEWED") =>
    fetch(`/api/client-report-schedules/${item.id}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  const generate = (
    item: Schedule,
    action: "GENERATED" | "VIEWED" = "GENERATED",
  ) => {
    void recordActivity(item, action);
    if (!onGenerate) {
      window.location.href = reportUrl(item);
      return;
    }
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.title = `Gerando relatório · ${item.clientName}`;
      previewWindow.document.body.innerHTML =
        '<main style="font:16px system-ui;padding:40px;color:#17324d"><b>Preparando o relatório...</b><p style="color:#6b7f92">A visualização do PDF abrirá automaticamente.</p></main>';
    } else
      setMessage(
        "O navegador bloqueou a nova aba. Permita pop-ups para visualizar o PDF automaticamente.",
      );
    const untilDate = new Date(`${item.nextDueAt}T12:00:00`),
      lag = item.deliveryLagDays ?? 1;
    untilDate.setDate(untilDate.getDate() - lag);
    const periodDays =
        item.frequency === "WEEKLY"
          ? 7
          : item.frequency === "BIWEEKLY"
            ? 15
            : 30,
      sinceDate = new Date(untilDate);
    sinceDate.setDate(sinceDate.getDate() - (periodDays - 1));
    onGenerate({
      clientId: item.clientId,
      since: sinceDate.toISOString().slice(0, 10),
      until: untilDate.toISOString().slice(0, 10),
      frequency: item.frequency,
      includeThirtyDaySummary:
        item.frequency === "BIWEEKLY" && untilDate.getDate() > 15,
      previewWindow,
    });
  };

  if (loading)
    return (
      <div className="cra-loading">
        <CalendarClock />
        <b>Organizando a agenda de relatórios...</b>
      </div>
    );
  if (historyMode) {
    const entries = schedules
      .flatMap((schedule) => [
        ...(schedule.artifacts || []).map((artifact) => ({
          kind: "VERSION" as const,
          id: artifact.id,
          schedule,
          date: artifact.createdAt,
          title: `Versão ${artifact.version}`,
          period:
            artifact.since && artifact.until
              ? `${dateLabel(artifact.since)} a ${dateLabel(artifact.until)}`
              : artifact.fileName,
          actor: artifact.createdByName,
          channel: schedule.deliveryMethod,
          artifact,
        })),
        ...schedule.history.map((entry) => ({
          kind: "SENT" as const,
          id: entry.id,
          schedule,
          date: entry.sentAt,
          title: "Envio confirmado",
          period: `Competência ${dateLabel(entry.dueAt)}`,
          actor: entry.sentByName,
          channel: entry.deliveryMethod || schedule.deliveryMethod,
          artifact: null,
        })),
      ])
      .filter(
        (entry) =>
          (!search ||
            `${entry.schedule.clientName} ${entry.actor} ${entry.title}`
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR"))) &&
          (deliveryFilter === "ALL" || entry.channel === deliveryFilter),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const versions = entries.filter((entry) => entry.kind === "VERSION").length,
      sentCount = entries.filter((entry) => entry.kind === "SENT").length,
      clientCount = new Set(entries.map((entry) => entry.schedule.clientId))
        .size,
      historyTotalPages = Math.max(1, Math.ceil(entries.length / 20)),
      historySafePage = Math.min(historyPage, historyTotalPages),
      historyVisible = entries.slice(
        (historySafePage - 1) * 20,
        historySafePage * 20,
      );
    return (
      <section className="cra cra-history-page">
        {message && (
          <div className="cra-message success">
            <CheckCircle2 />
            {message}
            <button onClick={() => setMessage("")}>
              <X />
            </button>
          </div>
        )}
        <div className="cra-history-summary">
          <article>
            <FileBarChart />
            <span>
              <b>{versions}</b>
              <small>versões armazenadas</small>
            </span>
          </article>
          <article>
            <Send />
            <span>
              <b>{sentCount}</b>
              <small>envios confirmados</small>
            </span>
          </article>
          <article>
            <History />
            <span>
              <b>{entries.length}</b>
              <small>registros auditáveis</small>
            </span>
          </article>
          <article>
            <CheckCircle2 />
            <span>
              <b>{clientCount}</b>
              <small>clientes no histórico</small>
            </span>
          </article>
        </div>
        <section className="cra-history-panel">
          <header>
            <div>
              <span>ARQUIVO E AUDITORIA</span>
              <h2>Entregas concluídas</h2>
              <p>
                Consulte PDFs gerados e confirmações de envio sem alterar a
                agenda atual.
              </p>
            </div>
            <b>{entries.length} registro(s)</b>
          </header>
          <div className="cra-history-toolbar">
            <label>
              <Search />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, responsável ou registro…"
              />
            </label>
            <select
              value={deliveryFilter}
              onChange={(event) => setDeliveryFilter(event.target.value)}
            >
              <option value="ALL">Todos os canais</option>
              {Object.entries(deliveryLabel).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="cra-history-table">
            <div className="head">
              <span>Registro</span>
              <span>Cliente</span>
              <span>Período / competência</span>
              <span>Responsável</span>
              <span>Data</span>
              <span>Canal</span>
              <span>Ações</span>
            </div>
            {historyVisible.map((entry) => (
              <div className="row" key={`${entry.kind}:${entry.id}`}>
                <span>
                  <i className={entry.kind.toLowerCase()}>
                    {entry.kind === "VERSION" ? <FileBarChart /> : <Send />}
                  </i>
                  <b>{entry.title}</b>
                </span>
                <span>
                  <b>{entry.schedule.clientName}</b>
                  <small>{frequencyLabel[entry.schedule.frequency]}</small>
                </span>
                <span>{entry.period}</span>
                <span>{entry.actor}</span>
                <span>{new Date(entry.date).toLocaleString("pt-BR")}</span>
                <span>{deliveryLabel[entry.channel]}</span>
                <div>
                  {entry.artifact ? (
                    <>
                      <a
                        href={`/api/client-report-artifacts/${entry.artifact.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir PDF"
                      >
                        <Eye />
                      </a>
                      <a
                        href={`/api/client-report-artifacts/${entry.artifact.id}/download`}
                        download
                        title="Baixar PDF"
                      >
                        <Download />
                      </a>
                      <button
                        onClick={() =>
                          void shareArtifact(entry.schedule, entry.artifact!.id)
                        }
                        title="Copiar link protegido"
                      >
                        <Copy />
                      </button>
                    </>
                  ) : (
                    <span className="sent-badge">
                      <CheckCircle2 /> Enviado
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!entries.length && (
              <div className="cra-history-empty">
                <History />
                <b>Nenhum registro encontrado</b>
                <span>
                  Gere ou confirme o envio de um relatório para iniciar o
                  histórico.
                </span>
              </div>
            )}
          </div>
          {!!entries.length && (
            <ListPagination
              page={historySafePage}
              totalPages={historyTotalPages}
              total={entries.length}
              onPage={setHistoryPage}
            />
          )}
        </section>
      </section>
    );
  }
  const quickFilters: Array<[AgendaFilter, string, number]> = [
    ["LATE", "Atrasados", counts.late],
    ["TODAY", "Vencem hoje", counts.today],
    ["WEEK", "Próximos 7 dias", counts.week],
    ["READY", "Prontos para enviar", counts.ready],
    ["SENT", "Enviados no mês", counts.sent],
  ];
  const blockedCount = schedules.filter(
    (item) => item.active && item.workflowStatus === "BLOCKED",
  ).length;
  const totalPages = Math.max(1, Math.ceil(visible.length / 20)),
    safePage = Math.min(page, totalPages),
    pageItems = visible.slice((safePage - 1) * 20, safePage * 20),
    settingsTotalPages = Math.max(1, Math.ceil(clients.length / 20)),
    settingsSafePage = Math.min(settingsPage, settingsTotalPages),
    settingsClients = clients.slice(
      (settingsSafePage - 1) * 20,
      settingsSafePage * 20,
    );

  return (
    <section className="cra">
      <header className="cra-hero">
        <div>
          <span>CENTRAL OPERACIONAL DE ENTREGAS</span>
          <h2>Controle de relatórios</h2>
          <p>Prepare, acompanhe e registre cada relatório de mídia paga.</p>
        </div>
        <button
          className="primary"
          onClick={() => configure({ id: "", name: "" })}
        >
          <Plus /> Nova rotina
        </button>
      </header>
      {message && (
        <div
          className={`cra-message ${/confirmado|copiado|sucesso|pausada|reativada/i.test(message) ? "success" : ""}`}
        >
          <CheckCircle2 />
          {message}
          <button onClick={() => setMessage("")}>
            <X />
          </button>
        </div>
      )}
      {(counts.late > 0 || blockedCount > 0) && (
        <div className="cra-alert">
          <AlertTriangle />
          <div>
            <b>Atenção necessária</b>
            <span>
              {counts.late} relatório(s) atrasado(s) e {blockedCount}{" "}
              bloqueado(s). A lista já está ordenada por prioridade.
            </span>
          </div>
        </div>
      )}
      <nav className="cra-tabs">
        <button
          className={tab === "AGENDA" ? "active" : ""}
          onClick={() => setTab("AGENDA")}
        >
          <CalendarClock /> Agenda de entregas
        </button>
        <button
          className={tab === "SETTINGS" ? "active" : ""}
          onClick={() => setTab("SETTINGS")}
        >
          <Settings2 /> Configurações{" "}
          <span>
            {counts.uncovered ? `${counts.uncovered} sem rotina` : ""}
          </span>
        </button>
      </nav>

      {tab === "AGENDA" ? (
        <>
          <div className="cra-kpis">
            {quickFilters.map(([key, label, value]) => (
              <button
                className={`${filter === key ? "active" : ""} ${key === "LATE" && value ? "danger" : ""}`}
                onClick={() => setFilter(filter === key ? "ALL" : key)}
                key={key}
              >
                <span className="icon">
                  {key === "LATE" ? (
                    <CircleAlert />
                  ) : key === "TODAY" ? (
                    <Clock3 />
                  ) : key === "WEEK" ? (
                    <CalendarClock />
                  ) : (
                    <CheckCircle2 />
                  )}
                </span>
                <span>
                  <b>{value}</b>
                  <small>{label}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="cra-toolbar">
            <label className="cra-search">
              <Search />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, responsável ou destinatário…"
              />
            </label>
            <div className="cra-selectors">
              <SlidersHorizontal />
              <select
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
              >
                <option value="ALL">Todos os responsáveis</option>
                {users.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os status</option>
                {Object.entries(workflowLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
              >
                <option value="ALL">Toda frequência</option>
                {Object.entries(frequencyLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={deliveryFilter}
                onChange={(e) => setDeliveryFilter(e.target.value)}
              >
                <option value="ALL">Todo canal</option>
                {Object.entries(deliveryLabel).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={timingFilter}
                onChange={(e) => setTimingFilter(e.target.value)}
              >
                <option value="ALL">Qualquer prazo</option>
                <option value="LATE">Atrasado</option>
                <option value="TODAY">Preparar hoje</option>
                <option value="WEEK">Próximos 7 dias</option>
                <option value="FUTURE">Futuro</option>
              </select>
            </div>
          </div>
          <div className="cra-operational-table">
            <div className="head">
              <span>Cliente / rotina</span>
              <span>Período analisado</span>
              <span>Entrega</span>
              <span>Responsável</span>
              <span>Status</span>
              <span>Último envio</span>
              <span>Ações</span>
            </div>
            {!visible.length && (
              <div className="cra-empty">
                <CheckCircle2 />
                <b>Nenhum relatório encontrado</b>
                <span>Ajuste os filtros ou configure uma nova rotina.</span>
              </div>
            )}
            {pageItems.map((item) => (
              <div
                className={`cra-table-row ${timing(item).toLowerCase()} ${!item.active ? "paused" : ""}`}
                key={item.id}
              >
                <span className="client">
                  <b>{item.clientName}</b>
                  <small>
                    {frequencyLabel[item.frequency]} ·{" "}
                    {deliveryLabel[item.deliveryMethod]} · D+
                    {item.deliveryLagDays ?? 1}
                  </small>
                </span>
                <span>
                  <b>{rangeLabel[item.reportRange]}</b>
                  <small>Modelo {templateLabel[item.template]}</small>
                </span>
                <span>
                  <b>{dateLabel(item.nextDueAt)}</b>
                  <small>
                    Preparar {dateLabel(preparationDate(item.nextDueAt))}
                  </small>
                </span>
                <span>
                  <b>{item.responsibleName}</b>
                  <small>
                    {item.recipients.length || "Sem"} destinatário(s)
                  </small>
                </span>
                <label
                  className={`cra-inline-status ${item.workflowStatus.toLowerCase()}`}
                >
                  <select
                    value={item.workflowStatus}
                    disabled={!item.active}
                    onChange={(event) =>
                      void changeStatus(item, event.target.value as Workflow)
                    }
                  >
                    {Object.entries(workflowLabel).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {item.workflowStatus === "BLOCKED" && (
                    <small title={item.blockedReason}>
                      {item.blockedReason}
                    </small>
                  )}
                </label>
                <span>
                  <b>
                    {item.lastSentAt
                      ? new Date(item.lastSentAt).toLocaleDateString("pt-BR")
                      : "Nunca enviado"}
                  </b>
                  <small>{item.history.length} registro(s)</small>
                </span>
                <div className="cra-row-actions">
                  <button
                    title="Gerar relatório"
                    onClick={() => generate(item, "GENERATED")}
                  >
                    <FileBarChart />
                  </button>
                  <button
                    title="Visualizar relatório"
                    onClick={() => generate(item, "VIEWED")}
                  >
                    <Eye />
                  </button>
                  <button
                    title="Copiar link protegido"
                    onClick={() => void copyLink(item)}
                  >
                    <Copy />
                  </button>
                  <button
                    className="send"
                    title="Confirmar envio"
                    disabled={!item.active}
                    onClick={() => void sent(item)}
                  >
                    <Send />
                  </button>
                  <button
                    title="Histórico"
                    onClick={() =>
                      setExpanded(expanded === item.id ? null : item.id)
                    }
                  >
                    <History />
                    <ChevronDown
                      className={expanded === item.id ? "open" : ""}
                    />
                  </button>
                </div>
                {expanded === item.id && (
                  <div className="cra-history">
                    <header>
                      <div>
                        <h4>Histórico auditável</h4>
                        <p>
                          Versões, envios e ações registradas para esta rotina.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          configure(
                            { id: item.clientId, name: item.clientName },
                            item,
                          )
                        }
                      >
                        <Settings2 /> Editar rotina
                      </button>
                    </header>
                    {item.artifacts?.map((artifact) => (
                      <div key={artifact.id}>
                        <FileBarChart />
                        <span>
                          <b>
                            Versão {artifact.version} ·{" "}
                            {artifact.since
                              ? `${dateLabel(artifact.since)} a ${dateLabel(artifact.until)}`
                              : artifact.fileName}
                          </b>
                          <small>
                            Gerada por {artifact.createdByName} em{" "}
                            {new Date(artifact.createdAt).toLocaleString(
                              "pt-BR",
                            )}
                            {artifact.shareExpiresAt
                              ? ` · link válido até ${new Date(artifact.shareExpiresAt).toLocaleDateString("pt-BR")}`
                              : ""}
                          </small>
                        </span>
                      </div>
                    ))}
                    {item.history.map((entry) => (
                      <div key={entry.id}>
                        <CheckCircle2 />
                        <span>
                          <b>
                            Envio de {dateLabel(entry.dueAt)} ·{" "}
                            {
                              deliveryLabel[
                                entry.deliveryMethod || item.deliveryMethod
                              ]
                            }
                          </b>
                          <small>
                            Enviado por {entry.sentByName} em{" "}
                            {new Date(entry.sentAt).toLocaleString("pt-BR")} ·{" "}
                            {item.recipients.join(", ") ||
                              "destinatários não informados"}
                          </small>
                        </span>
                      </div>
                    ))}
                    {item.activities?.map((activity) => (
                      <div key={activity.id}>
                        <History />
                        <span>
                          <b>
                            {
                              (
                                {
                                  GENERATED: "Relatório solicitado",
                                  VIEWED: "Relatório visualizado",
                                  DOWNLOADED: "PDF baixado",
                                  LINK_COPIED: "Link compartilhável criado",
                                  STATUS_CHANGED: "Status alterado",
                                  SENT: "Envio confirmado",
                                } as const
                              )[activity.action]
                            }
                          </b>
                          <small>
                            {activity.actorName} ·{" "}
                            {new Date(activity.createdAt).toLocaleString(
                              "pt-BR",
                            )}
                            {activity.detail ? ` · ${activity.detail}` : ""}
                          </small>
                        </span>
                      </div>
                    ))}
                    {!item.history.length &&
                      !item.activities?.length &&
                      !item.artifacts?.length && (
                        <p>Nenhuma atividade registrada ainda.</p>
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!!visible.length && (
            <ListPagination
              page={safePage}
              totalPages={totalPages}
              total={visible.length}
              onPage={setPage}
            />
          )}
        </>
      ) : (
        <section className="cra-client-settings">
          <header>
            <div>
              <span>CONFIGURAÇÃO DOS CLIENTES</span>
              <h2>Preferências, login e rotinas</h2>
              <p>
                Frequência, canal, responsável, acesso do cliente, destinatários
                e histórico.
              </p>
            </div>
            <b>{clients.length} clientes</b>
          </header>
          <div className="cra-client-table">
            <div className="head">
              <span>Cliente / configuração</span>
              <span>Rotina</span>
              <span>Responsável</span>
              <span>Próxima entrega</span>
              <span>Histórico</span>
              <span>Ações</span>
            </div>
            {settingsClients.map((client) => {
              const schedule =
                schedules.find(
                  (item) => item.clientId === client.id && item.active,
                ) || schedules.find((item) => item.clientId === client.id);
              const checks = [
                { label: "Conta", ok: !!client.mediaAssignmentCount },
                { label: "Responsável", ok: !!client.mediaResponsibleId },
                { label: "Rotina", ok: !!schedule },
                { label: "Destinatários", ok: !!schedule?.recipients.length },
                { label: "Portal", ok: !!client.portalUserCount },
              ];
              return (
                <div
                  className={`row ${schedule && !schedule.active ? "paused" : ""}`}
                  key={client.id}
                >
                  <span>
                    <b>{client.name}</b>
                    <small>
                      {schedule
                        ? `${deliveryLabel[schedule.deliveryMethod]} · D+${schedule.deliveryLagDays ?? 1}${schedule.active ? "" : " · Pausada"}`
                        : "Sem rotina configurada"}
                    </small>
                    <span
                      className="client-setup-checks"
                      aria-label={`${checks.filter((item) => item.ok).length} de 5 configurações concluídas`}
                    >
                      {checks.map((check) => (
                        <i
                          className={check.ok ? "done" : ""}
                          key={check.label}
                          title={`${check.label}: ${check.ok ? "configurado" : "pendente"}`}
                        >
                          {check.label}
                        </i>
                      ))}
                    </span>
                  </span>
                  <span>
                    {schedule ? frequencyLabel[schedule.frequency] : "—"}
                  </span>
                  <span>
                    {schedule?.responsibleName ||
                      client.mediaResponsibleName ||
                      "—"}
                    <small>
                      {schedule?.useMediaResponsible ? "Herdado da mídia" : ""}
                    </small>
                  </span>
                  <span>{schedule ? dateLabel(schedule.nextDueAt) : "—"}</span>
                  <button
                    className="history-count"
                    disabled={!schedule}
                    onClick={() => {
                      if (schedule) {
                        setTab("AGENDA");
                        setExpanded(schedule.id);
                        setSearch(client.name);
                      }
                    }}
                  >
                    <History /> {schedule?.history.length || 0}
                  </button>
                  <div className="settings-actions">
                    <button
                      type="button"
                      onClick={() => configure(client, schedule)}
                    >
                      Configurar
                    </button>
                    {onManageClientAccess && (
                      <button
                        type="button"
                        className="access"
                        title={`Gerenciar login de ${client.name}`}
                        aria-label={`Gerenciar login de ${client.name}`}
                        onClick={() => onManageClientAccess(client.id)}
                      >
                        <KeyRound />
                        <span>Acesso</span>
                      </button>
                    )}
                    {schedule && (
                      <button
                        className="toggle"
                        disabled={togglingScheduleId === schedule.id}
                        title={
                          schedule.active ? "Pausar rotina" : "Reativar rotina"
                        }
                        onClick={() => void toggleSchedule(schedule)}
                      >
                        {schedule.active ? <Pause /> : <Play />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination
            page={settingsSafePage}
            totalPages={settingsTotalPages}
            total={clients.length}
            onPage={setSettingsPage}
          />
        </section>
      )}

      {modal && (
        <div
          className="cra-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setModal(false)
          }
        >
          <form className="cra-modal" onSubmit={create}>
            <header>
              <div>
                <span>{editingId ? "EDITAR ROTINA" : "NOVA ROTINA"}</span>
                <h2>
                  {editingId ? "Configurar cliente" : "Programar relatório"}
                </h2>
                <p>Defina como este cliente prefere receber os resultados.</p>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </header>
            <div className="cra-form-grid">
              <label className="full">
                Cliente
                <select
                  required
                  disabled={Boolean(editingId)}
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                >
                  <option value="">Selecione o cliente</option>
                  {clients
                    .filter(
                      (client) =>
                        editingId ||
                        !schedules.some(
                          (item) => item.clientId === client.id && item.active,
                        ),
                    )
                    .map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Frequência
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm({ ...form, frequency: e.target.value as Frequency })
                  }
                >
                  <option value="WEEKLY">Toda semana</option>
                  <option value="BIWEEKLY">A cada 15 dias</option>
                  <option value="MONTHLY">Todo mês</option>
                </select>
              </label>
              <label>
                Primeira entrega
                <input
                  required
                  type="date"
                  value={form.nextDueAt}
                  onChange={(e) =>
                    setForm({ ...form, nextDueAt: e.target.value })
                  }
                />
              </label>
              <label>
                Responsável
                <select
                  disabled={form.useMediaResponsible}
                  value={form.responsibleId}
                  onChange={(e) =>
                    setForm({ ...form, responsibleId: e.target.value })
                  }
                >
                  <option value="">Eu serei responsável</option>
                  {users.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modelo
                <select
                  value={form.template}
                  onChange={(e) =>
                    setForm({ ...form, template: e.target.value })
                  }
                >
                  <option value="PERFORMANCE">Performance</option>
                  <option value="EXECUTIVE">Executivo</option>
                  <option value="COMPLETE">Completo</option>
                </select>
              </label>
              <label className="full cra-inherit-responsible">
                <input
                  type="checkbox"
                  checked={form.useMediaResponsible}
                  disabled={
                    !clients.find((item) => item.id === form.clientId)
                      ?.mediaResponsibleId
                  }
                  onChange={(e) => {
                    const client = clients.find(
                      (item) => item.id === form.clientId,
                    );
                    setForm({
                      ...form,
                      useMediaResponsible: e.target.checked,
                      responsibleId: e.target.checked
                        ? client?.mediaResponsibleId || ""
                        : form.responsibleId,
                    });
                  }}
                />
                <span>
                  <b>Usar o responsável da mídia também nos relatórios</b>
                  <small>
                    {clients.find((item) => item.id === form.clientId)
                      ?.mediaResponsibleName
                      ? `Responsável atual: ${clients.find((item) => item.id === form.clientId)?.mediaResponsibleName}`
                      : "Defina primeiro um responsável em Contas e vínculos."}
                  </small>
                </span>
              </label>
              <label>
                Período do relatório
                <select
                  value={form.reportRange}
                  onChange={(e) =>
                    setForm({ ...form, reportRange: e.target.value })
                  }
                >
                  <option value="FIRST_HALF">Primeiros 15 dias</option>
                  <option value="LAST_30">Últimos 30 dias</option>
                  <option value="FULL_MONTH">Mês inteiro</option>
                </select>
              </label>
              <label>
                Forma de envio
                <select
                  value={form.deliveryMethod}
                  onChange={(e) =>
                    setForm({ ...form, deliveryMethod: e.target.value })
                  }
                >
                  <option value="EMAIL">E-mail</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="MEETING">Apresentado em reunião</option>
                  <option value="OTHER">Outro canal</option>
                </select>
              </label>
              <label>
                Disponibilidade dos dados
                <select
                  value={form.deliveryLagDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      deliveryLagDays: Number(e.target.value),
                    })
                  }
                >
                  <option value={0}>D+0 · No mesmo dia</option>
                  <option value={1}>D+1 · Dia seguinte</option>
                  <option value={2}>D+2 · Dois dias depois</option>
                </select>
              </label>
              <label className="full">
                Destinatários
                <input
                  placeholder="cliente@empresa.com, gestor@empresa.com"
                  value={form.recipients}
                  onChange={(e) =>
                    setForm({ ...form, recipients: e.target.value })
                  }
                />
                <small>Separe vários e-mails por vírgula.</small>
              </label>
              <label className="full">
                Observações
                <textarea
                  rows={3}
                  placeholder="Ex.: destacar leads por região e comparar com o mês anterior"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setModal(false)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving}>
                {saving
                  ? "Salvando..."
                  : editingId
                    ? "Salvar configuração"
                    : "Criar rotina"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function ListPagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const first = total ? (page - 1) * 20 + 1 : 0,
    last = Math.min(page * 20, total);
  return (
    <footer className="media-list-pagination">
      <span>
        Exibindo {first}–{last} de <b>{total}</b>
      </span>
      <nav>
        <button
          disabled={page === 1}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          Anterior
        </button>
        <em>
          Página {page} de {totalPages}
        </em>
        <button
          disabled={page === totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
        >
          Próxima
        </button>
      </nav>
    </footer>
  );
}
