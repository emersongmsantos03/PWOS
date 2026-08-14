import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Gauge,
  Link2,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import "./MediaDashboard.css";
import "./MediaPlatforms.css";
import "./MediaAvatars.css";
import "./MediaAssignments.css";
import "./MediaCampaignCode.css";
import "./MediaClientIdentity.css";

type Campaign = {
  platform?: "META_ADS" | "GOOGLE_ADS";
  id: string;
  accountId: string;
  client: string;
  currency: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: number;
  lifetimeBudget: number;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
  cpl: number | null;
  frequency: number;
};
type Account = {
  platform?: "META_ADS" | "GOOGLE_ADS";
  id: string;
  name: string;
  businessPortfolioId?: string | null;
  pageName?: string | null;
  profilePictureUrl?: string | null;
  currency: string;
  amountSpent: number;
  spendCap: number;
};
type Payload = {
  schemaVersion?: number;
  since: string;
  until: string;
  syncedAt: string;
  accounts: Account[];
  campaigns: Campaign[];
  cache?: { status: string; cachedAt: string; nextSyncAt: string };
};
type Client = {
  id: string;
  name: string;
  legalName?: string;
  status: string;
  segment?: string;
};
type User = { id: string; name: string; role: string; avatarDataUrl?: string };
type Assignment = {
  accountId: string;
  platform: "META_ADS" | "GOOGLE_ADS";
  clientId: string;
  responsibleId: string;
  identitySource?: "CLIENT" | "META_PORTFOLIO" | "UNLINKED";
  updatedAt: string;
};
type Totals = {
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
};
type ClientGroup = {
  platform: "META_ADS" | "GOOGLE_ADS";
  key: string;
  account: Account;
  accounts: Account[];
  client?: Client;
  responsible?: User;
  assignment?: Assignment;
  campaigns: Campaign[];
  totals: Totals;
  active: number;
  delivered: number;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const initialSince = () => iso(new Date(Date.now() - 6 * 86400000));
const number = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const money = (value: number, currency = "BRL") =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
const statusLabel: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  IN_PROCESS: "Em análise",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Pausada",
};
const objectiveLabel = (value: string) =>
  value
    .replace(/^OUTCOME_/, "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
const emptyTotals = (): Totals => ({
  spend: 0,
  reach: 0,
  impressions: 0,
  clicks: 0,
  leads: 0,
  conversations: 0,
});
const add = (sum: Totals, item: Campaign): Totals => ({
  spend: sum.spend + item.spend,
  reach: sum.reach + item.reach,
  impressions: sum.impressions + item.impressions,
  clicks: sum.clicks + item.clicks,
  leads: sum.leads + item.leads,
  conversations: sum.conversations + item.conversations,
});
const hasDelivery = (item: Campaign) =>
  item.spend > 0 ||
  item.reach > 0 ||
  item.impressions > 0 ||
  item.clicks > 0 ||
  item.leads > 0 ||
  item.conversations > 0;
const isBoostedPost = (item: Campaign) =>
  /^(publica[cç][aã]o|instagram post|facebook post)|impulsion/i.test(item.name);
const accountLabel = (account: Account) => {
  const preferred = account.pageName || account.name || "";
  return /^\d+$/.test(preferred.trim())
    ? "Cliente não vinculado"
    : preferred || "Cliente não vinculado";
};

function ClientAvatar({
  name,
  picture,
}: {
  name: string;
  picture?: string | null;
}) {
  const [failed, setFailed] = useState(false),
    initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  useEffect(() => setFailed(false), [picture]);
  return (
    <span
      className={`traffic-client-avatar ${picture && !failed ? "has-picture" : ""}`}
    >
      {picture && !failed ? (
        <img
          src={picture}
          alt={`Foto da página ${name} na Meta`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials || "CL"
      )}
    </span>
  );
}
function GroupStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="client-group-stat">
      <small>{label}</small>
      <b>{value}</b>
      {detail && <em>{detail}</em>}
    </div>
  );
}
function ResponsibleAvatar({ user }: { user?: User }) {
  const initials =
    user?.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      className={`media-responsible-avatar ${user?.avatarDataUrl ? "has-photo" : ""}`}
    >
      {user?.avatarDataUrl ? (
        <img src={user.avatarDataUrl} alt={`Foto de ${user.name}`} />
      ) : (
        initials
      )}
    </span>
  );
}
function PlatformMark({ platform }: { platform: "META_ADS" | "GOOGLE_ADS" }) {
  const isMeta = platform === "META_ADS";
  return (
    <span className={`platform-mark ${isMeta ? "meta" : "google"}`} aria-label={isMeta ? "Meta Ads" : "Google Ads"}>
      <span className="platform-mark-icon" aria-hidden="true">
        {isMeta ? (
          <svg viewBox="0 0 48 30"><path d="M4 23.5C7.8 8.5 12.4 3 18 3c7.8 0 12.6 18 18 18 3.1 0 5.4-4.5 5.4-9.2C41.4 6.2 39.1 3 35.8 3 30 3 25 20.8 17.4 20.8 13 20.8 10 13 7.3 13 5.6 13 4.6 17.1 4 23.5Z" /></svg>
        ) : (
          <svg viewBox="0 0 34 34">
            <path className="google-blue" d="M14.7 4.1a4.3 4.3 0 0 1 7.5 0l9.1 16a4.3 4.3 0 0 1-7.5 4.3l-9.1-16a4.3 4.3 0 0 1 0-4.3Z" />
            <path className="google-green" d="M14.9 4.2 2.7 25.4a4.3 4.3 0 0 0 7.5 4.3L22.4 8.5a4.3 4.3 0 0 0-7.5-4.3Z" />
            <circle className="google-yellow" cx="6.4" cy="27.5" r="4.3" />
          </svg>
        )}
      </span>
      <span className="platform-mark-copy"><b>{isMeta ? "Meta Ads" : "Google Ads"}</b><small>Plataforma de anúncios</small></span>
    </span>
  );
}
function CampaignClientCode({
  portfolioId,
  accountId,
  platform,
}: {
  portfolioId?: string | null;
  accountId: string;
  platform: "META_ADS" | "GOOGLE_ADS";
}) {
  const [copied, setCopied] = useState(false),
    accountCode = accountId.replace(/^(act_|google_)/, ""),
    code = portfolioId || accountCode,
    label = portfolioId
      ? "Portfólio empresarial"
      : platform === "GOOGLE_ADS"
        ? "ID do cliente Google Ads"
        : "Conta de anúncios";
  return (
    <div className="campaign-client-identifier">
      <button
        type="button"
        className={`campaign-client-code ${copied ? "copied" : ""}`}
        title={`Copiar ID da ${label.toLowerCase()}`}
        onClick={async (event) => {
          event.stopPropagation();
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }}
      >
        <span>
          {label} {code}
        </span>
        {copied ? (
          <>
            <Check />
            <em>Copiado</em>
          </>
        ) : (
          <Copy />
        )}
      </button>
      {!portfolioId && platform === "META_ADS" && (
        <small>
          Use este ID para localizar a conta dentro do portfólio na Meta
        </small>
      )}
    </div>
  );
}

const META_PORTFOLIO = "__META_PORTFOLIO__";
function ClientCampaignGroup({
  group,
  initialOpen,
  clients,
  users,
  onAssign,
  platform,
  showPlatform,
}: {
  group: ClientGroup;
  initialOpen: boolean;
  clients: Client[];
  users: User[];
  platform: "META_ADS" | "GOOGLE_ADS";
  showPlatform: boolean;
  onAssign: (
    platform: "META_ADS" | "GOOGLE_ADS",
    accountIds: string[],
    clientId: string,
    responsibleId: string,
    identitySource: Assignment["identitySource"],
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [linkOpen, setLinkOpen] = useState(false);
  const [clientId, setClientId] = useState(
      group.assignment?.identitySource === "META_PORTFOLIO"
        ? META_PORTFOLIO
        : group.assignment?.clientId || group.client?.id || "",
    ),
    [responsibleId, setResponsibleId] = useState(
      group.assignment?.responsibleId || "",
    ),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [linkError, setLinkError] = useState("");
  const selectedClient = clients.find((item) => item.id === clientId),
    selectedResponsible = users.find((item) => item.id === responsibleId),
    portfolioName = accountLabel(group.account),
    name =
      clientId === META_PORTFOLIO
        ? portfolioName === "Cliente não vinculado"
          ? "Nome do portfólio indisponível"
          : portfolioName
        : selectedClient?.name || group.client?.name || portfolioName;
  const cpl = group.totals.leads
    ? group.totals.spend / group.totals.leads
    : null;
  return (
    <article
      className={`traffic-client-group ${platform === "META_ADS" ? "platform-meta" : "platform-google"} ${open ? "open" : ""} ${linkOpen ? "link-editing" : ""}`}
    >
      <div
        className="traffic-client-summary"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
      >
        <ClientAvatar name={name} picture={group.account.profilePictureUrl} />
        <div className="traffic-client-identity">
          <span className="traffic-client-name-row">
            <h2>{name}</h2>
            {group.client && <i>Cliente PW</i>}
          </span>
          <CampaignClientCode
            portfolioId={group.account.businessPortfolioId}
            accountId={group.account.id}
            platform={platform}
          />
          <p>{group.client?.segment || group.account.currency}</p>
          <small>
            {group.accounts.length} conta(s) · {group.campaigns.length}{" "}
            campanhas · {group.active} ativas · {group.delivered} com entrega no
            período
          </small>
        </div>
        <div className="traffic-client-quick">
          <GroupStat
            label="Investimento"
            value={money(group.totals.spend, group.account.currency)}
          />
          <GroupStat label="Leads" value={number(group.totals.leads)} />
          <GroupStat
            label="CPL médio"
            value={cpl === null ? "—" : money(cpl, group.account.currency)}
          />
        </div>
        {showPlatform && (
          <span className="traffic-client-platform-corner">
            <PlatformMark platform={platform} />
          </span>
        )}
        <ChevronDown />
      </div>
      <section className={`media-account-links ${linkOpen ? "editing" : ""}`}>
        <div className="media-link-summary">
          <div>
            <span className={clientId ? "linked" : ""}>
              <Building2 />
            </span>
            <p>
              <small>Cliente</small>
              <b>
                {clientId === META_PORTFOLIO
                  ? portfolioName
                  : selectedClient?.name || "Não vinculado"}
              </b>
            </p>
          </div>
          <div>
            <span className={responsibleId ? "linked" : ""}>
              <ResponsibleAvatar user={selectedResponsible} />
            </span>
            <p>
              <small>Responsável</small>
              <b>{selectedResponsible?.name || "Não atribuído"}</b>
            </p>
          </div>
          <button type="button" onClick={() => setLinkOpen((value) => !value)}>
            {linkOpen ? (
              "Fechar"
            ) : (
              <>
                <Link2 /> Vincular cliente e responsável
              </>
            )}
          </button>
        </div>
        {linkOpen && (
          <div className="media-link-editor">
            <header>
              <div>
                <h3>Vincular conta</h3>
                <p>
                  Escolha como identificar esta conta e quem será o responsável.
                </p>
              </div>
              <button type="button" onClick={() => setLinkOpen(false)}>
                ×
              </button>
            </header>
            <div className="media-link-fields">
              <label>
                <span>
                  <Building2 />
                  <b>
                    {platform === "META_ADS"
                      ? "Cliente ou portfólio"
                      : "Cliente"}
                  </b>
                </span>
                <select
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setSaved(false);
                    setLinkError("");
                  }}
                >
                  {platform === "META_ADS" && (
                    <option value={META_PORTFOLIO}>
                      Nome do portfólio Meta — {portfolioName}
                    </option>
                  )}
                  <option value="">Sem cliente vinculado</option>
                  <optgroup label={`Clientes cadastrados (${clients.length})`}>
                    {clients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {!clients.length && (
                  <small>Nenhum cliente cadastrado no PW OS.</small>
                )}
              </label>
              <label>
                <span>
                  <ResponsibleAvatar user={selectedResponsible} />
                  <b>Responsável</b>
                </span>
                <select
                  value={responsibleId}
                  onChange={(event) => {
                    setResponsibleId(event.target.value);
                    setSaved(false);
                    setLinkError("");
                  }}
                >
                  <option value="">Sem responsável</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.role}
                    </option>
                  ))}
                </select>
                {!users.length && (
                  <small>Nenhum usuário disponível para atribuição.</small>
                )}
              </label>
            </div>
            {linkError && (
              <div className="media-assignment-error">
                <AlertTriangle />
                {linkError}
              </div>
            )}
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setLinkOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={saved ? "saved" : ""}
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setLinkError("");
                  try {
                    const identitySource =
                      clientId === META_PORTFOLIO
                        ? "META_PORTFOLIO"
                        : clientId
                          ? "CLIENT"
                          : "UNLINKED";
                    await onAssign(
                      platform,
                      group.accounts.map((account) => account.id),
                      clientId === META_PORTFOLIO ? "" : clientId,
                      responsibleId,
                      identitySource,
                    );
                    setSaved(true);
                    setLinkOpen(false);
                  } catch (cause) {
                    setLinkError(
                      cause instanceof Error
                        ? cause.message
                        : "Falha ao salvar",
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? (
                  <>
                    <RefreshCw className="spin" /> Salvando…
                  </>
                ) : saved ? (
                  <>
                    <Check /> Salvo
                  </>
                ) : (
                  <>
                    <CheckCircle2 /> Salvar vínculo
                  </>
                )}
              </button>
            </footer>
          </div>
        )}
      </section>
      {open && (
        <div className="traffic-client-body">
          <section className="traffic-client-kpis">
            <GroupStat
              label="Investimento no período"
              value={money(group.totals.spend, group.account.currency)}
              detail={`${group.delivered} campanhas com entrega`}
            />
            <GroupStat
              label="Alcance"
              value={number(group.totals.reach)}
              detail="Pessoas alcançadas"
            />
            <GroupStat
              label="Impressões"
              value={number(group.totals.impressions)}
              detail={`${number(group.totals.reach ? group.totals.impressions / group.totals.reach : 0, 2)} de frequência`}
            />
            <GroupStat
              label="Cliques"
              value={number(group.totals.clicks)}
              detail={`${number(group.totals.impressions ? (group.totals.clicks / group.totals.impressions) * 100 : 0, 2)}% de CTR`}
            />
            <GroupStat
              label="Conversas"
              value={number(group.totals.conversations)}
              detail="Conversas iniciadas"
            />
          </section>
          <div className="traffic-group-table">
            <table>
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Tipo</th>
                  <th>Objetivo</th>
                  <th>Status</th>
                  <th>Investimento</th>
                  <th>Resultados</th>
                  <th>Custo por resultado</th>
                  <th>Alcance</th>
                  <th>Cliques</th>
                </tr>
              </thead>
              <tbody>
                {group.campaigns.map((item) => (
                  <tr
                    key={item.id}
                    className={hasDelivery(item) ? "" : "no-delivery"}
                  >
                    <td>
                      <b>{item.name}</b>
                      <small>
                        {hasDelivery(item)
                          ? `Campanha ${item.id}`
                          : "Sem veiculação no período"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`campaign-kind ${isBoostedPost(item) ? "boosted" : "structured"}`}
                      >
                        {isBoostedPost(item)
                          ? "Publicação impulsionada"
                          : "Campanha"}
                      </span>
                    </td>
                    <td>{objectiveLabel(item.objective)}</td>
                    <td>
                      <span
                        className={`campaign-state ${item.status.toLowerCase()}`}
                      >
                        {statusLabel[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      <b>{money(item.spend, item.currency)}</b>
                      {item.dailyBudget > 0 && (
                        <small>
                          {money(item.dailyBudget, item.currency)}/dia
                        </small>
                      )}
                    </td>
                    <td>
                      <b>{number(item.leads || item.conversations)}</b>
                      <small>
                        {item.leads
                          ? "Leads"
                          : item.conversations
                            ? "Conversas"
                            : "Sem resultado"}
                      </small>
                    </td>
                    <td>
                      {item.cpl === null ? "—" : money(item.cpl, item.currency)}
                    </td>
                    <td>{number(item.reach)}</td>
                    <td>{number(item.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

function GoogleAdsEmpty() {
  return (
    <section className="traffic-platform-empty">
      <span className="google-ads-symbol">
        <i />
        <i />
        <i />
      </span>
      <h2>Google Ads ainda não conectado</h2>
      <p>
        Quando a autorização for configurada, clientes, contas e campanhas
        aparecerão aqui com a mesma organização usada na Meta Ads.
      </p>
      <div>
        <span>
          <b>1</b>Conectar a conta Google
        </span>
        <i />
        <span>
          <b>2</b>Vincular aos clientes
        </span>
        <i />
        <span>
          <b>3</b>Sincronizar campanhas
        </span>
      </div>
      <NavLink className="primary" to="/configuracoes/integracoes">
        <Link2 /> Abrir Central de Conexões
      </NavLink>
    </section>
  );
}

type MediaView = "ALL" | "META_ADS" | "GOOGLE_ADS";
const normalizeMetaCampaignResults = (campaign: Campaign): Campaign => {
  const leads = Number(campaign.leads || campaign.conversations || 0);
  return {
    ...campaign,
    leads,
    cpl: leads > 0 ? Number(campaign.spend || 0) / leads : null,
  };
};

const normalizeCachedPayload = (payload: Payload): Payload => ({
  ...payload,
  campaigns: (payload.campaigns || []).map((campaign) =>
    (campaign.platform || "META_ADS") === "META_ADS"
      ? normalizeMetaCampaignResults(campaign)
      : campaign,
  ),
});

export function MediaDashboard() {
  const [platform, setPlatform] = useState<MediaView>("META_ADS");
  const [data, setData] = useState<Payload | null>(() => {
      try {
        const cached = JSON.parse(
          localStorage.getItem("pw-os-meta-dashboard-cache") || "null",
        ) as Payload | null;
        return cached?.schemaVersion === 5
          ? normalizeCachedPayload(cached)
          : null;
      } catch {
        return null;
      }
    }),
    [clients, setClients] = useState<Client[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]);
  const [since, setSince] = useState(initialSince),
    [until, setUntil] = useState(() => iso(new Date()));
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("ACTIVE"),
    [delivery, setDelivery] = useState("ALL");
  const [loading, setLoading] = useState(!data),
    [error, setError] = useState("");
  const load = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const providers =
          platform === "ALL"
            ? (["META_ADS", "GOOGLE_ADS"] as const)
            : ([platform] as ("META_ADS" | "GOOGLE_ADS")[]),
        [mediaResults, clientsResponse, usersResponse, assignmentsResponse] =
          await Promise.all([
            Promise.all(
              providers.map(async (source) => {
                const response = await fetch(
                    `/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${since}&until=${until}${force ? "&refresh=1" : ""}`,
                  ),
                  payload = await response.json();
                return { source, response, payload };
              }),
            ),
            fetch("/api/clients"),
            fetch("/api/users"),
            fetch("/api/media/assignments"),
          ]),
        successful = mediaResults.filter((item) => item.response.ok);
      if (clientsResponse.ok) {
        const clientPayload = await clientsResponse.json();
        setClients(clientPayload.clients || []);
      }
      if (usersResponse.ok) {
        const userPayload = await usersResponse.json();
        setUsers(userPayload.users || []);
      }
      if (assignmentsResponse.ok) {
        const assignmentPayload = await assignmentsResponse.json();
        setAssignments(assignmentPayload.assignments || []);
      }
      if (!successful.length)
        throw new Error(
          mediaResults
            .map((item) => item.payload.message)
            .filter(Boolean)
            .join(" · ") || "Não foi possível consultar as campanhas.",
        );
      const payload: Payload = {
        schemaVersion: 5,
        since,
        until,
        syncedAt: new Date().toISOString(),
        accounts: successful.flatMap(({ source, payload }) => {
          return (payload.accounts || []).map((account: Account) => ({
            ...account,
            platform: source,
          }));
        }),
        campaigns: successful.flatMap(({ source, payload }) => {
          return (payload.campaigns || []).map((campaign: Campaign) => ({
            ...(source === "META_ADS"
              ? normalizeMetaCampaignResults(campaign)
              : campaign),
            platform: source,
          }));
        }),
      };
      setData(payload);
      localStorage.setItem(
        platform === "META_ADS"
          ? "pw-os-meta-dashboard-cache"
          : platform === "GOOGLE_ADS"
            ? "pw-os-google-dashboard-cache"
            : "pw-os-all-dashboard-cache",
        JSON.stringify(payload),
      );
      const failures = mediaResults.filter((item) => !item.response.ok);
      if (failures.length)
        setError(
          failures
            .map(
              (item) =>
                `${item.source === "META_ADS" ? "Meta Ads" : "Google Ads"}: ${item.payload.message || "indisponível"}`,
            )
            .join(" · "),
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível consultar as campanhas.",
      );
    } finally {
      setLoading(false);
    }
  };
  const saveAssignment = async (
    assignmentPlatform: "META_ADS" | "GOOGLE_ADS",
    accountIds: string[],
    clientId: string,
    responsibleId: string,
    identitySource: Assignment["identitySource"],
  ) => {
    const savedAssignments = await Promise.all(
      accountIds.map(async (accountId) => {
        const response = await fetch(
          `/api/media/accounts/${encodeURIComponent(accountId)}/assignment`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: assignmentPlatform,
              clientId,
              responsibleId,
              identitySource,
            }),
          },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.message || "Não foi possível salvar o vínculo.",
          );
        return payload.assignment as Assignment;
      }),
    );
    setAssignments((current) => [
      ...current.filter(
        (item) =>
          !(
            item.platform === assignmentPlatform &&
            accountIds.includes(item.accountId)
          ),
      ),
      ...savedAssignments,
    ]);
    if (identitySource === "META_PORTFOLIO") void load(true);
  };
  const selectPlatform = (next: MediaView) => {
    if (next === platform) return;
    const cacheKey =
      next === "META_ADS"
        ? "pw-os-meta-dashboard-cache"
        : next === "GOOGLE_ADS"
          ? "pw-os-google-dashboard-cache"
          : "pw-os-all-dashboard-cache";
    try {
      const cached = JSON.parse(
        localStorage.getItem(cacheKey) || "null",
      ) as Payload | null;
      setData(
        cached?.schemaVersion === 5 ? normalizeCachedPayload(cached) : null,
      );
    } catch {
      setData(null);
    }
    setError("");
    setPlatform(next);
  };
  useEffect(() => {
    void load();
  }, [since, until, platform]);
  const filtered = useMemo(
    () =>
      (data?.campaigns || []).filter((item) => {
        const portfolioId =
          data?.accounts.find((account) => account.id === item.accountId)
            ?.businessPortfolioId || "";
        return (
          (status === "ALL" || item.status === status) &&
          (delivery === "ALL" ||
            (delivery === "WITH_DATA"
              ? hasDelivery(item)
              : !hasDelivery(item))) &&
          `${item.client} ${item.name} ${portfolioId} ${item.accountId.replace(/^act_/, "")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [data, status, delivery, query],
  );
  const groups = useMemo<ClientGroup[]>(() => {
    const accountsById = new Map(
      (data?.accounts || []).map((account) => [account.id, account]),
    );
    const byPortfolio = new Map<string, Campaign[]>();
    filtered.forEach((item) => {
      const account = accountsById.get(item.accountId),
        source = item.platform || account?.platform || "META_ADS",
        key = account?.businessPortfolioId
          ? `${source}:portfolio:${account.businessPortfolioId}`
          : `${source}:account:${item.accountId}`;
      byPortfolio.set(key, [...(byPortfolio.get(key) || []), item]);
    });
    return [...byPortfolio]
      .map(([groupKey, campaigns]) => {
        const accountIds = [
            ...new Set(campaigns.map((campaign) => campaign.accountId)),
          ],
          groupAccounts = accountIds.map(
            (id) =>
              accountsById.get(id) || {
                id,
                name:
                  campaigns.find((campaign) => campaign.accountId === id)
                    ?.client || id,
                currency:
                  campaigns.find((campaign) => campaign.accountId === id)
                    ?.currency || "BRL",
                amountSpent: 0,
                spendCap: 0,
              },
          );
        const account = groupAccounts[0],
          groupPlatform =
            campaigns[0]?.platform || account.platform || "META_ADS";
        const assignment = assignments.find(
          (item) =>
            item.platform === groupPlatform &&
            accountIds.includes(item.accountId),
        );
        const assignedClient = clients.find(
            (item) => item.id === assignment?.clientId,
          ),
          client = assignment?.clientId ? assignedClient : undefined,
          responsible = users.find(
            (item) => item.id === assignment?.responsibleId,
          );
        return {
          platform: groupPlatform,
          key: groupKey,
          account,
          accounts: groupAccounts,
          client,
          responsible,
          assignment,
          campaigns: campaigns.sort((a, b) => b.spend - a.spend),
          totals: campaigns.reduce(add, emptyTotals()),
          active: campaigns.filter((item) => item.status === "ACTIVE").length,
          delivered: campaigns.filter(hasDelivery).length,
        };
      })
      .sort((a, b) => b.totals.spend - a.totals.spend);
  }, [filtered, data, clients, users, assignments, platform]);
  const statuses = [
    ...new Set((data?.campaigns || []).map((item) => item.status)),
  ];
  const totalCampaigns = groups.reduce(
      (sum, item) => sum + item.campaigns.length,
      0,
    ),
    activeCampaigns = groups.reduce((sum, item) => sum + item.active, 0),
    deliveredCampaigns = groups.reduce((sum, item) => sum + item.delivered, 0),
    overall = groups.reduce(
      (sum, item) =>
        add(sum, {
          ...item.totals,
          id: "",
          accountId: "",
          client: "",
          currency: "BRL",
          name: "",
          objective: "",
          status: "",
          dailyBudget: 0,
          lifetimeBudget: 0,
          cpl: null,
          frequency: 0,
        }),
      emptyTotals(),
    ),
    periodDays = Math.max(
      1,
      Math.round(
        (new Date(`${until}T12:00`).getTime() -
          new Date(`${since}T12:00`).getTime()) /
          86400000,
      ) + 1,
    ),
    dailyBudget = groups
      .flatMap((group) => group.campaigns)
      .reduce((sum, item) => sum + item.dailyBudget, 0),
    averageCpl = overall.leads ? overall.spend / overall.leads : null,
    frequency = overall.reach ? overall.impressions / overall.reach : 0;
  const allCampaigns = groups.flatMap((group) =>
      group.campaigns.map((campaign) => ({
        ...campaign,
        groupName: accountLabel(group.account),
      })),
    ),
    objectiveRows = Object.entries(
      allCampaigns.reduce<Record<string, number>>((map, item) => {
        const key = objectiveLabel(item.objective);
        map[key] = (map[key] || 0) + item.spend;
        return map;
      }, {}),
    ).sort((a, b) => b[1] - a[1]),
    statusRows = Object.entries(
      allCampaigns.reduce<Record<string, number>>((map, item) => {
        const key = statusLabel[item.status] || item.status;
        map[key] = (map[key] || 0) + 1;
        return map;
      }, {}),
    ).sort((a, b) => b[1] - a[1]),
    topLeads = [...allCampaigns].sort((a, b) => b.leads - a.leads).slice(0, 5),
    topCpl = allCampaigns
      .filter((item) => item.cpl !== null && item.leads > 0)
      .sort((a, b) => (a.cpl || 0) - (b.cpl || 0))
      .slice(0, 5);
  return (
    <div className="page traffic-page">
      <header className="traffic-head">
        <div>
          <span className="eyebrow">
            {platform === "META_ADS"
              ? "META ADS"
              : platform === "GOOGLE_ADS"
                ? "GOOGLE ADS"
                : "TODAS AS MÍDIAS"}
          </span>
          <h1>Gestão de tráfego por cliente</h1>
          <p>
            Visão organizada da conta do cliente até cada campanha e seus
            resultados oficiais.
          </p>
        </div>
        <div className="traffic-period">
          <label>
            <CalendarDays />
            <input
              type="date"
              value={since}
              max={until}
              onChange={(event) => setSince(event.target.value)}
            />
            <span>até</span>
            <input
              type="date"
              value={until}
              min={since}
              onChange={(event) => setUntil(event.target.value)}
            />
          </label>
          <button
            className="secondary"
            onClick={() => void load(true)}
            disabled={loading}
          >
            <RefreshCw className={loading ? "spin" : ""} />{" "}
            {loading ? "Sincronizando…" : "Atualizar agora"}
          </button>
        </div>
      </header>
      {error && (
        <div className="traffic-error">
          <Megaphone />
          <div>
            <b>
              {platform === "ALL"
                ? "Atenção na sincronização das plataformas"
                : `Não foi possível carregar a ${platform === "META_ADS" ? "Meta Ads" : "Google Ads"}`}
            </b>
            <p>{error}</p>
          </div>
          <button onClick={() => void load()}>Tentar novamente</button>
        </div>
      )}
      <nav
        className="traffic-platform-switch"
        aria-label="Plataforma de anúncios"
      >
        <button
          className={platform === "ALL" ? "active all" : ""}
          onClick={() => selectPlatform("ALL")}
        >
          <span className="all-ads-symbol">
            <b>∞</b>
            <b>G</b>
          </span>
          <span>
            <b>Todos</b>
            <small>
              {platform === "ALL"
                ? `${data?.accounts.length || 0} contas conectadas`
                : "Meta Ads + Google Ads"}
            </small>
          </span>
        </button>
        <button
          className={platform === "META_ADS" ? "active meta" : ""}
          onClick={() => selectPlatform("META_ADS")}
        >
          <span className="meta-ads-symbol">∞</span>
          <span>
            <b>Meta Ads</b>
            <small>
              {platform === "META_ADS"
                ? `${data?.accounts.length || 0} contas conectadas`
                : "Clique para consultar"}
            </small>
          </span>
        </button>
        <button
          className={platform === "GOOGLE_ADS" ? "active google" : ""}
          onClick={() => selectPlatform("GOOGLE_ADS")}
        >
          <span className="google-ads-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            <b>Google Ads</b>
            <small>
              {platform === "GOOGLE_ADS"
                ? `${data?.accounts.length || 0} contas conectadas`
                : "Clique para consultar"}
            </small>
          </span>
        </button>
      </nav>
      <>
        <section className="traffic-overview traffic-executive-kpis">
          <article>
            <WalletCards />
            <span>
              <small>Investimento diário</small>
              <b>{money(overall.spend / periodDays)}</b>
              <em>Orçamento configurado: {money(dailyBudget)}/dia</em>
            </span>
          </article>
          <article>
            <TrendingUp />
            <span>
              <small>Investimento no período</small>
              <b>{money(overall.spend)}</b>
              <em>{periodDays} dia(s) selecionado(s)</em>
            </span>
          </article>
          <article>
            <Users />
            <span>
              <small>Alcance</small>
              <b>{number(overall.reach)}</b>
              <em>Pessoas alcançadas</em>
            </span>
          </article>
          <article>
            <Eye />
            <span>
              <small>Impressões</small>
              <b>{number(overall.impressions)}</b>
              <em>Frequência média {number(frequency, 2)}</em>
            </span>
          </article>
          <article>
            <MousePointerClick />
            <span>
              <small>Cliques</small>
              <b>{number(overall.clicks)}</b>
              <em>
                CTR{" "}
                {number(
                  overall.impressions
                    ? (overall.clicks / overall.impressions) * 100
                    : 0,
                  2,
                )}
                %
              </em>
            </span>
          </article>
          <article>
            <Target />
            <span>
              <small>Leads</small>
              <b>{number(overall.leads)}</b>
              <em>Em todas as contas</em>
            </span>
          </article>
          <article>
            <Gauge />
            <span>
              <small>CPL médio</small>
              <b>{averageCpl === null ? "—" : money(averageCpl)}</b>
              <em>Custo por lead</em>
            </span>
          </article>
          <article>
            <BarChart3 />
            <span>
              <small>Campanhas</small>
              <b>{totalCampaigns}</b>
              <em>
                {activeCampaigns} ativas · {deliveredCampaigns} com entrega
              </em>
            </span>
          </article>
        </section>
        <section className="traffic-toolbar">
          <div>
            <h2>Clientes e campanhas</h2>
            <p>Clique em um cliente para consultar suas campanhas.</p>
          </div>
          <div className="traffic-filters">
            <label className="traffic-search">
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar cliente ou campanha…"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">Todos os status</option>
              {statuses.map((item) => (
                <option value={item} key={item}>
                  {statusLabel[item] || item}
                </option>
              ))}
            </select>
            <select
              value={delivery}
              onChange={(event) => setDelivery(event.target.value)}
            >
              <option value="ALL">Todas as entregas</option>
              <option value="WITH_DATA">Com entrega</option>
              <option value="NO_DATA">Sem entrega</option>
            </select>
          </div>
        </section>
        {loading && !data ? (
          <div className="panel inline-empty">
            <RefreshCw className="spin" />
            <h3>Organizando os dados por cliente</h3>
            <p>
              Aguarde a sincronização com a{" "}
              {platform === "META_ADS" ? "Meta" : "Google Ads"}.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="panel inline-empty">
            <Megaphone />
            <h3>Nenhum cliente encontrado</h3>
            <p>Ajuste os filtros ou o período selecionado.</p>
          </div>
        ) : (
          <section className="traffic-client-list">
            {groups.map((group, index) => (
              <ClientCampaignGroup
                key={group.key}
                group={group}
                initialOpen={index === 0}
                clients={clients}
                users={users}
                onAssign={saveAssignment}
                platform={group.platform}
                showPlatform={platform === "ALL"}
              />
            ))}
          </section>
        )}
        {data && (
          <>
            <section className="meta-analysis-grid">
              <AnalysisList
                title="Distribuição por objetivo"
                rows={objectiveRows}
                total={overall.spend}
                moneyValues
              />
              <AnalysisList
                title="Status das campanhas"
                rows={statusRows}
                total={totalCampaigns}
              />
              <Ranking
                title="Top campanhas por leads"
                rows={topLeads.map((item) => ({
                  name: item.name,
                  value: number(item.leads),
                }))}
              />
              <Ranking
                title="Melhores campanhas por CPL"
                rows={topCpl.map((item) => ({
                  name: item.name,
                  value: money(item.cpl || 0, item.currency),
                }))}
              />
              <article className="meta-alerts">
                <header>
                  <AlertTriangle />
                  <h3>Alertas operacionais</h3>
                </header>
                <p
                  className={
                    allCampaigns.filter((item) => item.status === "WITH_ISSUES")
                      .length
                      ? "warning"
                      : "ok"
                  }
                >
                  <i />
                  {allCampaigns.filter((item) => item.status === "WITH_ISSUES")
                    .length || "Nenhuma"}{" "}
                  campanha(s) com problemas
                </p>
                <p
                  className={
                    allCampaigns.filter((item) =>
                      item.status.includes("PAUSED"),
                    ).length
                      ? "attention"
                      : "ok"
                  }
                >
                  <i />
                  {
                    allCampaigns.filter((item) =>
                      item.status.includes("PAUSED"),
                    ).length
                  }{" "}
                  campanha(s) pausada(s)
                </p>
                <p
                  className={
                    allCampaigns.filter((item) => !hasDelivery(item)).length
                      ? "attention"
                      : "ok"
                  }
                >
                  <i />
                  {
                    allCampaigns.filter((item) => !hasDelivery(item)).length
                  }{" "}
                  campanha(s) sem entrega
                </p>
              </article>
            </section>
            <p className="traffic-sync-note">
              Dados oficiais da{" "}
              {platform === "META_ADS" ? "Meta" : "Google Ads"} · última
              atualização {new Date(data.syncedAt).toLocaleString("pt-BR")}
            </p>
          </>
        )}
      </>
    </div>
  );
}

function AnalysisList({
  title,
  rows,
  total,
  moneyValues = false,
}: {
  title: string;
  rows: [string, number][];
  total: number;
  moneyValues?: boolean;
}) {
  return (
    <article className="meta-analysis-card">
      <header>
        <h3>{title}</h3>
      </header>
      <div>
        {rows.slice(0, 5).map(([label, value], index) => (
          <span key={label}>
            <i
              style={{
                background: [
                  "#42b87b",
                  "#2f8cff",
                  "#845ef7",
                  "#f2a42b",
                  "#ef5350",
                ][index],
              }}
            />
            <b>{label}</b>
            <em>{total ? Math.round((value / total) * 100) : 0}%</em>
            <strong>{moneyValues ? money(value) : value}</strong>
          </span>
        ))}
      </div>
    </article>
  );
}
function Ranking({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <article className="meta-analysis-card meta-ranking">
      <header>
        <h3>{title}</h3>
      </header>
      <div>
        {rows.map((row, index) => (
          <span key={`${row.name}-${index}`}>
            <i>{index + 1}</i>
            <b>{row.name}</b>
            <strong>{row.value}</strong>
          </span>
        ))}
        {!rows.length && <p>Sem dados suficientes no período.</p>}
      </div>
    </article>
  );
}
