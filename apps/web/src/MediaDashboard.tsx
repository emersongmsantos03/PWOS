import "./ClientAnalysisRefinements.css";
import { MediaUserContext, mediaPreferenceKey, readMediaPreference } from "./mediaPreferences";
import { requestMediaPeriod } from "./mediaPeriodRequest";
import "./SimpleClientTable.css";
import { portfolioMetrics } from "./portfolioMetrics";
import "./PortfolioTotals.css";
import { MetaLogo, GoogleAdsLogo } from "./PlatformLogos";
import { Component, Fragment, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ErrorInfo, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Settings2,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileBarChart,
  Gauge,
  Globe2,
  Link2,
  LockKeyhole,
  Maximize2,
  Megaphone,
  Minimize2,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  Send,
  Target,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { SearchableSelect } from "./SearchableSelect";
import "./MediaDashboard.css";
import "./MediaPlatforms.css";
import "./MediaAvatars.css";
import "./MediaAssignments.css";
import "./MediaCampaignCode.css";
import "./MediaClientIdentity.css";
import "./MediaPresentation.css";
import "./CampaignAnalysisFix.css";
import "./ClientCampaignReport.css";
import "./MediaReportControl.css";
import "./ReportWindowSwitch.css";
import "./MediaUX.css";
import "./MediaAiInsights.css";
import "./MediaMinimal.css";
import "./MediaAdDetails.css";
import "./MediaCompactPortfolio.css";
import "./CampaignStatusCompact.css";
import "./MediaAdDetailsFix.css";
import "./MediaAiModal.css";
import "./MediaComparison.css";
import { ClientReportAgenda } from "./ClientReportAgenda";
import { matchesMediaMetric, mediaObjectiveLabel, mediaPercentChange, mediaTrendCacheKey, type MediaMetricFocus } from "./mediaUx";
import { systemConfirm } from "./SystemDialog";

type Campaign = {
  platform?: "META_ADS" | "GOOGLE_ADS";
  id: string;
  accountId: string;
  client: string;
  currency: string;
  name: string;
  objective: string;
  status: string;
  configuredStatus?: string;
  adSets?: Array<{ id: string; name: string; status: string; configuredStatus?: string }>;
  dailyBudget: number;
  lifetimeBudget: number;
  remainingBudget?: number | null;
  accountRemainingBudget?: number | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversations: number;
  cpl: number | null;
  frequency: number;
  auctionPosition?: string | null;
  optimizationStatus?: string | null;
  landingPageStatus?: "ACTIVE" | "INACTIVE" | "UNKNOWN" | null;
  landingPageUrl?: string | null;
  verified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  searchTerms?: Array<{ term: string; clicks: number; impressions: number; leads: number; spend: number }>;
  optimizationHistory?: Array<{ value: string; capturedAt: string }>;
  verificationHistory?: Array<{ action: "ANALYSIS" | "REVIEW" | "REPORT_DOWNLOADED" | "REPORT_SENT"; createdAt: string; userId: string; userName: string; score?: number; spend?: number; leads?: number; cpl?: number | null; periodDays?: number; recipientCount?: number }>;
  geography?: Array<{ name: string; level: "REGION" | "CITY" | "NEIGHBORHOOD"; leads: number; clicks: number; spend: number; source?: "PERFORMANCE" | "TARGETING" }>;
  ads?: CampaignAd[];
};
type CampaignCreative = {
  id?: string;
  name?: string;
  type: "IMAGE" | "VIDEO" | "TEXT" | "LINK" | "UNKNOWN";
  url?: string | null;
  thumbnailUrl?: string | null;
  text?: string | null;
};
type CampaignAd = {
  id: string;
  name: string;
  status: string;
  configuredStatus?: string;
  adSetStatus?: string;
  groupName?: string | null;
  format?: string | null;
  landingPageUrl?: string | null;
  previewUrl?: string | null;
  headline?: string | null;
  body?: string | null;
  spend?: number;
  impressions?: number;
  clicks?: number;
  results?: number;
  creatives: CampaignCreative[];
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
  remainingBudget?: number | null;
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
type User = { id: string; name: string; role: string; profile?: string; avatarDataUrl?: string };
type ClientPortalUser = {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
};
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
  reachAvailable: boolean;
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
const savedMediaContext = (userId: string) => {
  try { return readMediaPreference(localStorage, userId, "pw-os-media-context", {}) as { platform?: MediaView; since?: string; until?: string; client?: string; responsible?: string }; }
  catch { return {}; }
};
const safeSavedMediaPeriod = (userId: string) => {
  const saved = savedMediaContext(userId), today = iso(new Date());
  const until = /^\d{4}-\d{2}-\d{2}$/.test(saved.until || "") && saved.until! <= today
    ? saved.until!
    : today;
  const since = /^\d{4}-\d{2}-\d{2}$/.test(saved.since || "") && saved.since! <= until
    ? saved.since!
    : initialSince();
  return { since, until };
};
const savedCampaignFilters = (userId: string) => {
  try { return readMediaPreference(localStorage, userId, "pw-os-campaign-filters", {}) as Record<string, string>; }
  catch { return {}; }
};
const savedCampaignTablePreferences = (userId: string) => {
  try { return readMediaPreference(localStorage, userId, "pw-os-campaign-table-preferences", {}) as { compact?: boolean; visibleMetrics?: { balance?: boolean; impressions?: boolean; clicks?: boolean; ctr?: boolean; review?: boolean } }; }
  catch { return {}; }
};
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const safePdfNamePart = (value: string) =>
  value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim();
const initialReportPeriod = () => {
  const range = new URLSearchParams(window.location.search).get("reportRange"), now = new Date(), end = new Date(now), start = new Date(now);
  if (range === "FIRST_HALF") { start.setDate(1); end.setDate(Math.min(15, now.getDate())); }
  else if (range === "FULL_MONTH") start.setDate(1);
  else start.setDate(start.getDate() - 29);
  return { since: iso(start), until: iso(end) };
};
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
  ENABLED: "Ativo",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  IN_PROCESS: "Em análise",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Pausado pelo conjunto",
  DISAPPROVED: "Reprovado",
  PENDING_REVIEW: "Em análise",
  PREAPPROVED: "Pré-aprovado",
};
const objectiveLabel = mediaObjectiveLabel;
const emptyTotals = (): Totals => ({
  spend: 0,
  reach: 0,
  impressions: 0,
  clicks: 0,
  leads: 0,
  conversations: 0,
  reachAvailable: false,
});
const add = (sum: Totals, item: Campaign): Totals => ({
  spend: sum.spend + item.spend,
  reach: sum.reach + Math.max(0, item.reach),
  impressions: sum.impressions + item.impressions,
  clicks: sum.clicks + item.clicks,
  leads: sum.leads + item.leads,
  conversations: sum.conversations + item.conversations,
  reachAvailable: sum.reachAvailable || item.reach >= 0,
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
type PerformanceTone = "good" | "warning" | "bad" | "neutral";
const scoreTone = (score: number): PerformanceTone =>
  score < 0 ? "neutral" : score >= 90 ? "good" : score >= 70 ? "warning" : "bad";
const toneLabel: Record<PerformanceTone, string> = {
  good: "Bom",
  warning: "Atenção",
  bad: "Crítico",
  neutral: "Sem avaliação",
};
const verificationDue = (campaign: Campaign) =>
  !campaign.verifiedAt || Date.now() - new Date(campaign.verifiedAt).getTime() >= 7 * 86400000;
const campaignAnalysisDue = (campaign: Campaign) => {
  const latest = [...(campaign.verificationHistory || [])].reverse().find((entry) => entry.action === "ANALYSIS" || entry.action === "REVIEW");
  return !latest || Date.now() - new Date(latest.createdAt).getTime() >= 7 * 86400000;
};
function PerformanceValue({ value, tone, detail }: { value: string; tone: PerformanceTone; detail?: string }) {
  return <span className={`performance-value ${tone}`} title={detail || toneLabel[tone]}><i />{value}</span>;
}
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
    <span
      className={`platform-mark ${isMeta ? "meta" : "google"}`}
      aria-label={isMeta ? "Meta Ads" : "Google Ads"}
    >
      <span className="platform-mark-icon" aria-hidden="true">
        {isMeta ? (
          <MetaLogo />
        ) : (
          <GoogleAdsLogo />
        )}
      </span>
      <span className="platform-mark-copy">
        <b>{isMeta ? "Meta Ads" : "Google Ads"}</b>
        <small>Plataforma de anúncios</small>
      </span>
    </span>
  );
}
function MediaPlatformSwitch({
  platform,
  onPlatformChange,
  metaDetail,
  googleDetail,
  className = "",
}: {
  platform: MediaView;
  onPlatformChange: (platform: "META_ADS" | "GOOGLE_ADS") => void;
  metaDetail: string;
  googleDetail: string;
  className?: string;
}) {
  return (
    <nav className={`comparison-platform-switch ${className}`.trim()} aria-label="Plataforma de anúncios">
      <button type="button" className={platform === "META_ADS" ? "active" : ""} onClick={() => onPlatformChange("META_ADS")}>
        <span className="meta-ads-symbol" aria-hidden="true"><MetaLogo /></span>
        <span><b>Meta Ads</b><small>{metaDetail}</small></span>
      </button>
      <button type="button" className={platform === "GOOGLE_ADS" ? "active" : ""} onClick={() => onPlatformChange("GOOGLE_ADS")}>
        <span className="google-ads-symbol" aria-hidden="true"><GoogleAdsLogo /></span>
        <span><b>Google Ads</b><small>{googleDetail}</small></span>
      </button>
    </nav>
  );
}
function CampaignDeliveryStatus({ campaign }: { campaign: Campaign }) {
  return (
    <div className="campaign-delivery-status">
      <span className={`campaign-state ${campaign.status.toLowerCase()}`}>
        {statusLabel[campaign.status] || campaign.status}
      </span>
    </div>
  );
}
function CampaignAdsHealth({ ads }: { ads: CampaignAd[] | undefined }) {
  if (!ads?.length) return null;
  const active = ads.filter((ad) => ad.status === "ACTIVE" || ad.status === "ENABLED").length,
    paused = ads.filter((ad) => /PAUSED/.test(ad.status)).length,
    attention = ads.length - active - paused,
    parts = [active ? `${active} ativo(s)` : "", paused ? `${paused} pausado(s)` : "", attention ? `${attention} com atenção` : ""].filter(Boolean);
  return <span className={`campaign-ads-health ${attention ? "attention" : paused ? "paused" : "healthy"}`}>{parts.join(" · ")}</span>;
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
function CampaignAds({ campaign }: { campaign: Campaign }) {
  const ads = campaign.ads || [];
  const [selectedAd, setSelectedAd] = useState<CampaignAd | null>(null);
  useEffect(() => {
    if (!selectedAd) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedAd(null); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selectedAd]);
  if (!ads.length)
    return (
      <div className="campaign-assets-empty">
        <Eye />
        <div>
          <b>Anúncios ainda não sincronizados</b>
          <span>Atualize os dados da plataforma para carregar anúncios e criativos desta campanha.</span>
        </div>
      </div>
    );
  return (
    <section className="campaign-assets-panel">
      <header>
        <div><b>Anúncios e criativos</b><span>{ads.length} anúncio(s) nesta campanha</span></div>
      </header>
      <div className="campaign-ad-grid">
        {ads.map((ad) => {
          const preview = ad.creatives.find((creative) => creative.thumbnailUrl || (creative.type === "IMAGE" && creative.url)),
            previewUrl = preview?.thumbnailUrl || (preview?.type === "IMAGE" ? preview.url : null) || null;
          return (
          <article className="campaign-ad-card" key={ad.id} role="button" tabIndex={0} onClick={() => setSelectedAd(ad)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedAd(ad); } }} aria-label={`Abrir detalhes do anúncio ${ad.name}`}>
            <div className="campaign-ad-preview">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={`Criativo de ${ad.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => { event.currentTarget.hidden = true; const fallback = event.currentTarget.nextElementSibling as SVGSVGElement | null; if (fallback) fallback.style.display = ""; }}
                />
              ) : null}<Megaphone style={previewUrl ? { display: "none" } : undefined} />
              <span>{ad.format || "ANÚNCIO"}</span>
            </div>
            <div className="campaign-ad-content">
              <div className="campaign-ad-title"><b>{ad.name}</b><i className={`campaign-state ${ad.status.toLowerCase()}`}>{statusLabel[ad.status] || ad.status}</i></div>
              {ad.groupName && <small>{ad.groupName}</small>}
              {ad.headline && <h4>{ad.headline}</h4>}
              {ad.body && <p>{ad.body}</p>}
              <div className="campaign-ad-metrics">
                <span><small>Investimento</small><b>{money(ad.spend || 0, campaign.currency)}</b></span>
                <span><small>Impressões</small><b>{number(ad.impressions || 0)}</b></span>
                <span><small>Cliques</small><b>{number(ad.clicks || 0)}</b></span>
                <span><small>Resultados</small><b>{number(ad.results || 0)}</b></span>
              </div>
              <button type="button" className="campaign-ad-open" onClick={(event) => { event.stopPropagation(); setSelectedAd(ad); }}><Eye /> Ver detalhes</button>
              {!!ad.creatives.length && (
                <div className="campaign-creative-list">
                  {ad.creatives.map((creative, index) => (
                    <span key={`${creative.id || creative.type}-${index}`} title={creative.text || creative.name || creative.type}>
                      {creative.type}{creative.name ? ` · ${creative.name}` : ""}
                    </span>
                  ))}
                </div>
              )}
              {(ad.previewUrl || ad.landingPageUrl) && (
                <footer>
                  {ad.previewUrl && <a onClick={(event) => event.stopPropagation()} href={ad.previewUrl} target="_blank" rel="noreferrer"><Eye /> Visualizar</a>}
                  {ad.landingPageUrl && <a onClick={(event) => event.stopPropagation()} href={ad.landingPageUrl} target="_blank" rel="noreferrer"><ExternalLink /> Destino</a>}
                </footer>
              )}
            </div>
          </article>
        );})}
      </div>
      {selectedAd && createPortal(<div className="campaign-ad-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAd(null); }}><section className="campaign-ad-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-ad-modal-title"><header><div><PlatformMark platform={campaign.platform || "META_ADS"}/><span><small>DETALHES DO ANÚNCIO</small><h2 id="campaign-ad-modal-title">{selectedAd.name}</h2><p>{campaign.name}</p></span></div><button type="button" onClick={() => setSelectedAd(null)} aria-label="Fechar detalhes"><X/></button></header><main><section className="campaign-ad-modal-gallery">{selectedAd.creatives.filter((creative) => creative.thumbnailUrl || (creative.type === "IMAGE" && creative.url)).map((creative,index) => <figure key={`${creative.id || creative.url}-${index}`}><img src={creative.thumbnailUrl || creative.url || ""} referrerPolicy="no-referrer" alt={creative.name || `Criativo ${index + 1}`}/><figcaption>{creative.name || `Criativo ${index + 1}`}</figcaption></figure>)}{!selectedAd.creatives.some((creative) => creative.thumbnailUrl || (creative.type === "IMAGE" && creative.url)) && <div className="campaign-ad-modal-no-image"><Megaphone/><b>Sem imagem disponibilizada</b><span>Este formato pode ser composto somente por texto ou a plataforma não liberou a miniatura.</span></div>}</section><div className="campaign-ad-modal-details"><section className="campaign-ad-modal-summary"><div className="campaign-ad-modal-title-row"><span className={`campaign-state ${selectedAd.status.toLowerCase()}`}>{statusLabel[selectedAd.status] || selectedAd.status}</span><em>{selectedAd.format || "Formato não informado"}</em></div><h3>{selectedAd.headline || "Sem título informado"}</h3><p>{selectedAd.body || "Sem texto descritivo informado pela plataforma."}</p><dl><div><dt>Campanha</dt><dd>{campaign.name}</dd></div><div><dt>Grupo de anúncios</dt><dd>{selectedAd.groupName || "Não informado"}</dd></div><div><dt>ID do anúncio</dt><dd>{selectedAd.id}</dd></div><div><dt>Status configurado</dt><dd>{statusLabel[selectedAd.configuredStatus || selectedAd.status] || selectedAd.configuredStatus || selectedAd.status}</dd></div></dl></section><section className="campaign-ad-modal-metrics"><article><small>Investimento</small><b>{money(selectedAd.spend || 0,campaign.currency)}</b></article><article><small>Impressões</small><b>{number(selectedAd.impressions || 0)}</b></article><article><small>Cliques</small><b>{number(selectedAd.clicks || 0)}</b></article><article><small>Resultados</small><b>{number(selectedAd.results || 0)}</b></article></section>{selectedAd.creatives.length > 0 && <section className="campaign-ad-modal-assets"><h3>Recursos do anúncio</h3>{selectedAd.creatives.map((creative,index) => <article key={`${creative.id || creative.type}-${index}`}><span>{creative.type}</span><div><b>{creative.name || `Recurso ${index + 1}`}</b><small>{creative.text || creative.url || "Recurso visual"}</small></div></article>)}</section>}</div></main><footer>{selectedAd.previewUrl && <a href={selectedAd.previewUrl} target="_blank" rel="noreferrer"><Eye/> Abrir prévia</a>}{selectedAd.landingPageUrl && <a href={selectedAd.landingPageUrl} target="_blank" rel="noreferrer"><ExternalLink/> Abrir destino</a>}<button type="button" onClick={() => setSelectedAd(null)}>Fechar</button></footer></section></div>,document.body)}
    </section>
  );
}
function campaignTypeLabel(campaign: Campaign) {
  if (campaign.platform === "GOOGLE_ADS") return objectiveLabel(campaign.objective);
  return isBoostedPost(campaign) ? "Impulsionada" : "Campanha";
}
function campaignObjectiveLabel(campaign: Campaign) {
  return campaign.platform === "GOOGLE_ADS" ? "Não disponibilizado" : objectiveLabel(campaign.objective);
}

function LandingPageIcon({ url, status }: { url?: string | null; status?: Campaign["landingPageStatus"] }) {
  const state = url ? status || "UNKNOWN" : "UNKNOWN";
  const label = !url ? "Landing page não informada" : state === "ACTIVE" ? "Landing page ativa" : state === "INACTIVE" ? "Landing page inativa" : "Landing page com status não verificado";
  const className = `simple-landing-status ${state.toLowerCase()}`;
  return url ? <a className={className} href={url} target="_blank" rel="noreferrer" aria-label={`${label}: ${url}`} title={`${label}: ${url}`}><Globe2/></a> : <span className={className} role="img" aria-label={label} title={label}><Globe2/></span>;
}

function ClientCampaignGroup({
  group,
  initialOpen,
  clients,
  users,
  onAssign,
  platform,
  showPlatform,
  canManage,
  periodDays,
  onAnalyze,
  onVerify,
}: {
  group: ClientGroup;
  initialOpen: boolean;
  clients: Client[];
  users: User[];
  platform: "META_ADS" | "GOOGLE_ADS";
  showPlatform: boolean;
  canManage: boolean;
  periodDays: number;
  onAnalyze: (campaign: Campaign) => void;
  onVerify: (campaign: Campaign) => Promise<void>;
  onAssign: (
    platform: "META_ADS" | "GOOGLE_ADS",
    accountIds: string[],
    clientId: string,
    responsibleId: string,
    identitySource: Assignment["identitySource"],
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [openCampaignId, setOpenCampaignId] = useState("");
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
    [linkError, setLinkError] = useState(""),
    [verifyingId, setVerifyingId] = useState("");
  const [draftClientId, setDraftClientId] = useState(clientId);
  const [draftResponsibleId, setDraftResponsibleId] = useState(responsibleId);
  const editAssignment = () => {
    setDraftClientId(clientId); setDraftResponsibleId(responsibleId);
    setLinkError(""); setSaved(false); setLinkOpen(true);
  };
  const [clientAnalysisOpen, setClientAnalysisOpen] = useState(false);
  useEffect(() => {
    if (!clientAnalysisOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setClientAnalysisOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [clientAnalysisOpen]);
  const selectedClient = clients.find(item => item.id === clientId),
    selectedResponsible = users.find(item => item.id === responsibleId),
    linkedClientId = selectedClient?.id || group.client?.id || "",
    portfolioName = accountLabel(group.account),
    name = clientId === META_PORTFOLIO
      ? portfolioName === "Cliente não vinculado" ? "Nome do portfólio indisponível" : portfolioName
      : selectedClient?.name || group.client?.name || portfolioName;
  const groupPlatforms = [...new Set(group.campaigns.map(item => item.platform || "META_ADS"))];
  const scoredCampaigns = group.campaigns.map(campaignScore).filter(score => score >= 0);
  const portfolioScore = scoredCampaigns.length ? Math.round(scoredCampaigns.reduce((sum, score) => sum + score, 0) / scoredCampaigns.length) : -1;
  return (
    <article className={`simple-client-table ${open ? "open" : ""}`}>
      <div className="simple-table-scroll">
        <table>
          <colgroup><col className="simple-name-column"/>{Array.from({length:16}, (_,index) => <col key={index}/>)}</colgroup>
          <thead><tr>{["Cliente / campanha", "Tipo", "Objetivo", "Rede", "Status", "Landing page", "Inv. diário", "Impressões", "Cliques", "CTR", "CPC", "Conversões", "Custo", "Saldo", "Score", "Responsável", "Análise"].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>
          {(portfolioMetrics(group.campaigns)).map((total) => {
            const amount = (value: number | null) => value == null ? "—" : money(value,total.currency);
            return <tr className="simple-client-row" key={total.currency} onClick={event => {
              if ((event.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], .score-reason-popover')) return;
              if (window.getSelection()?.toString()) return;
              setOpen(value => !value);
            }}>
              <td><div className="simple-client-name"><button type="button" className="simple-expand" aria-expanded={open} aria-label={`${open ? "Recolher" : "Expandir"} campanhas de ${name}`} onClick={() => setOpen(value => !value)}><ChevronDown/></button><span><b title={name}>{name}</b><small>{group.campaigns.length} campanhas · {total.currency}</small></span>{canManage && <button type="button" className="simple-edit assignment-edit-trigger" title="Editar cliente e responsável" aria-label={`Editar vínculo de ${name}`} onClick={editAssignment}><Settings2/> <span>Editar</span></button>}</div></td>
              <td><span className="simple-campaign-type">{[...new Set(group.campaigns.map(item => campaignTypeLabel(item)))].join(" · ") || "—"}</span></td>
              <td><span className="simple-campaign-objective" title="Objetivos informados pela plataforma; o Google não disponibiliza o objetivo selecionado na interface.">{[...new Set(group.campaigns.map(campaignObjectiveLabel))].join(" · ") || "—"}</span></td>
              <td><span className="portfolio-network-list">{groupPlatforms.map(network => <span key={network} className="portfolio-network-icon" role="img" aria-label={network === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"} title={network === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"}>{network === "GOOGLE_ADS" ? <GoogleAdsLogo/> : <MetaLogo/>}</span>)}</span></td>
              <td><span className={`simple-status ${group.active ? "active" : "inactive"}`}>{group.active === group.campaigns.length ? "Ativa" : group.active > 0 ? "Misto" : "Inativa"}</span></td>
              <td>{[...new Set(group.campaigns.map(item => item.landingPageUrl).filter((url): url is string => !!url))].map(url => {
                const statuses = group.campaigns.filter(item => item.landingPageUrl === url).map(item => item.landingPageStatus);
                const status = statuses.includes("INACTIVE") ? "INACTIVE" : statuses.every(value => value === "ACTIVE") ? "ACTIVE" : "UNKNOWN";
                return <LandingPageIcon key={url} url={url} status={status}/>;
              })}{!group.campaigns.some(item => item.landingPageUrl) && <LandingPageIcon/>}</td>
              <td><span className="simple-value simple-money">{amount(total.dailyBudget)}</span></td><td><span className="simple-value simple-volume">{number(total.impressions)}</span></td><td><span className="simple-value simple-clicks">{number(total.clicks)}</span></td>
              <td><span className="simple-value simple-rate">{total.ctr == null ? "—" : `${number(total.ctr,2)}%`}</span></td><td><span className="simple-value simple-rate">{amount(total.cpc)}</span></td><td><span className="simple-value simple-rate">{number(total.leads)}</span></td>
              <td><span className="simple-value simple-money">{amount(total.spend)}</span></td><td><span className="simple-value simple-volume">{amount(total.remainingBudget)}</span></td>
              <td><ScoreGauge score={portfolioScore} label="Cliente" compact portfolioCampaigns={group.campaigns}/></td>
              <td><span className="simple-responsible" title={selectedResponsible?.name || "Não atribuído"}><ResponsibleAvatar user={selectedResponsible}/><span>{selectedResponsible?.name || "Não atribuído"}</span></span></td>
              <td><button type="button" className="campaign-analyze" onClick={() => setClientAnalysisOpen(true)}>Analisar</button></td>
            </tr>;
          })}
          {open && (<>{group.campaigns.map(item => <Fragment key={`${item.platform}:${item.id}`}>
                <tr className={`simple-campaign-row ${scoreTone(campaignScore(item))}`}>
                  <td><span className="simple-child-name"><span aria-hidden="true">↳</span><b title={item.name}>{item.name}</b></span><button type="button" className="campaign-assets-trigger" onClick={() => setOpenCampaignId(current => current === item.id ? "" : item.id)}><Eye/> {openCampaignId === item.id ? "Fechar anúncios" : "Ver anúncios"}</button></td>
                  <td><span className="simple-campaign-type">{campaignTypeLabel(item)}</span></td>
                  <td><span className="simple-campaign-objective" title={item.platform === "GOOGLE_ADS" ? "O Google não disponibiliza pela API o objetivo selecionado na interface." : "Objetivo informado pela Meta"}>{campaignObjectiveLabel(item)}</span></td>
                  <td><span className="portfolio-network-icon" role="img" aria-label={item.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"} title={item.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"}>{item.platform === "GOOGLE_ADS" ? <GoogleAdsLogo/> : <MetaLogo/>}</span></td>
                  <td><CampaignDeliveryStatus campaign={item}/></td>
                  <td><LandingPageIcon url={item.landingPageUrl} status={item.landingPageStatus}/></td>
                  <td><span className="simple-value simple-money">{item.dailyBudget > 0 ? money(item.dailyBudget,item.currency) : "—"}</span></td>
                  <td><span className="simple-value simple-volume">{number(item.impressions)}</span></td><td><span className="simple-value simple-clicks">{number(item.clicks)}</span></td>
                  <td><span className="simple-value simple-rate">{item.impressions > 0 ? `${number(item.clicks / item.impressions * 100,2)}%` : "—"}</span></td>
                  <td><span className="simple-value simple-rate">{item.clicks > 0 ? money(item.spend / item.clicks,item.currency) : "—"}</span></td>
                  <td><span className="simple-value simple-rate">{number(item.leads)}</span></td><td><span className="simple-value simple-money">{money(item.spend,item.currency)}</span></td>
                  <td><span className="simple-value simple-volume">{item.accountRemainingBudget != null ? money(Math.max(0,item.accountRemainingBudget),item.currency) : item.remainingBudget == null ? "—" : money(Math.max(0,item.remainingBudget),item.currency)}</span></td>
                  <td><ScoreGauge score={campaignScore(item)} label="Campanha" compact campaign={item}/></td>
                  <td><span className="simple-responsible" title={selectedResponsible?.name || "Não atribuído"}><ResponsibleAvatar user={selectedResponsible}/><span>{selectedResponsible?.name || "Não atribuído"}</span></span></td>
                  <td><button type="button" className="campaign-analyze" onClick={() => onAnalyze(item)}><BarChart3/> Analisar</button></td>
                </tr>
                {openCampaignId === item.id && <tr className="campaign-assets-row"><td colSpan={17}><CampaignAds campaign={item}/></td></tr>}
              </Fragment>)}</>)}
          </tbody>
        </table>
      </div>
      {linkOpen && (<>      <section className={`media-account-links ${linkOpen ? "editing" : ""}`}>
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
              <small>Responsável pela mídia</small>
              <b>{selectedResponsible?.name || "Não atribuído"}</b>
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setLinkOpen((value) => !value)}
            >
              {linkOpen ? (
                "Fechar"
              ) : (
                <>
                  <Link2 /> Vincular cliente e responsável
                </>
              )}
            </button>
          )}
        </div>
        {canManage && linkOpen && (
          <div className="media-link-editor">
            <header>
              <div>
                <h3>Editar cliente e responsável</h3>
                <p>
                  Escolha o cliente e o funcionário responsável pela operação de mídia.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setLinkOpen(false)}
              >
                <X />
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
                <div className="media-link-select">
                  <select
                    value={draftClientId}
                    onChange={(event) => {
                      setDraftClientId(event.target.value);
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
                    <optgroup
                      label={`Clientes cadastrados (${clients.length})`}
                    >
                      {clients.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown />
                </div>
                {!clients.length && (
                  <small>Nenhum cliente cadastrado no PW OS.</small>
                )}
              </label>
              <label>
                <span>
                  <UserRound />
                  <b>Responsável pela mídia</b>
                </span>
                <div className="media-link-select">
                  <select
                    value={draftResponsibleId}
                    onChange={(event) => {
                      setDraftResponsibleId(event.target.value);
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
                  <ChevronDown />
                </div>
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
                      draftClientId === META_PORTFOLIO
                        ? "META_PORTFOLIO"
                        : draftClientId
                          ? "CLIENT"
                          : "UNLINKED";
                    await Promise.all(groupPlatforms.map((source) => onAssign(
                      source,
                      [...new Set(group.campaigns.filter((campaign) => (campaign.platform || "META_ADS") === source).map((campaign) => campaign.accountId))],
                      draftClientId === META_PORTFOLIO ? "" : draftClientId,
                      draftResponsibleId,
                      identitySource,
                    )));
                    setClientId(draftClientId);
                    setResponsibleId(draftResponsibleId);
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
                    <CheckCircle2 /> Salvar alterações
                  </>
                )}
              </button>
            </footer>
          </div>
        )}
      </section>
</>)}
      {clientAnalysisOpen && createPortal(<div className="campaign-ad-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setClientAnalysisOpen(false); }}><section className="campaign-ad-modal client-analysis-dialog" role="dialog" aria-modal="true" aria-label={`Análise de ${name}`}><header><div><h2>Análise de {name}</h2></div><button type="button" autoFocus aria-label="Fechar análise" onClick={() => setClientAnalysisOpen(false)}><X/></button></header><div className="portfolio-client-analysis"><div className="client-analysis-overview"><div><span className="client-analysis-eyebrow">Visão geral do cliente</span><p>{group.campaigns.length} campanhas <span>·</span> {group.active} ativas</p><div className="client-analysis-owner"><ResponsibleAvatar user={selectedResponsible}/><span>{selectedResponsible?.name || "Responsável não atribuído"}</span>{canManage && <button type="button" onClick={() => { setClientAnalysisOpen(false); editAssignment(); }}>Editar vínculo <Settings2/></button>}</div></div><div className={`client-analysis-score ${scoreTone(portfolioScore)}`}><span>Score do cliente</span><strong>{portfolioScore < 0 ? "—" : portfolioScore}<small>/100</small></strong><span>{toneLabel[scoreTone(portfolioScore)]}</span></div></div>{portfolioMetrics(group.campaigns).map(total => <div className="portfolio-total-grid" key={total.currency}>{[["Investimento diário", total.dailyBudget == null ? "—" : money(total.dailyBudget,total.currency)], ["Impressões", number(total.impressions)], ["Cliques", number(total.clicks)], ["CTR", total.ctr == null ? "—" : `${number(total.ctr,2)}%`], ["CPC", total.cpc == null ? "—" : money(total.cpc,total.currency)], ["Conversões", number(total.leads)], ["Custo", money(total.spend,total.currency)], ["Saldo", total.remainingBudget == null ? "—" : money(total.remainingBudget,total.currency)]].map(([label,value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>)}<h3>Campanhas do cliente</h3>{group.campaigns.map(item => <div className="portfolio-analysis-campaign" key={`${item.platform}:${item.id}`}><b>{item.name}</b><span className="client-campaign-score">{campaignScore(item) < 0 ? "Sem avaliação" : `Score ${campaignScore(item)}`}</span><button type="button" className="client-analysis-action" aria-label={`Analisar campanha ${item.name}`} onClick={() => { setClientAnalysisOpen(false); onAnalyze(item); }}>Ver análise <ArrowUpRight/></button></div>)}</div></section></div>, document.body)}
    </article>
  );
}

function ClientAccessModal({
  client,
  users,
  loading,
  error,
  onClose,
  onReload,
}: {
  client: Client;
  users: ClientPortalUser[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const [copied, setCopied] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const portalUrl = `${window.location.origin}/portal-cliente`;
  const copy = async (value: string, key = value) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1500);
  };
  const createAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const response = await fetch(`/api/clients/${client.id}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const payload = await response.json();
    if (!response.ok) { setFormError(payload.message || "Não foi possível criar o acesso."); setSaving(false); return; }
    await onReload();
    setSaving(false);
    setCreating(false);
  };
  return (
    <div
      className="modal-backdrop media-client-access-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="media-client-access-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <span>
            <Users />
          </span>
          <div>
            <small>PORTAL DO CLIENTE</small>
            <h2>{client.name}</h2>
            <p>Usuários autorizados a consultar as campanhas vinculadas.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        {loading ? (
          <div className="media-client-access-loading">
            <RefreshCw className="spin" /> Carregando acessos…
          </div>
        ) : error ? (
          <div className="media-assignment-error">
            <AlertTriangle />
            {error}
          </div>
        ) : (
          <div className="media-client-access-users">
            {users.map((user) => (
              <article key={user.id}>
                <span>
                  {user.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <b>{user.name}</b>
                  <small>{user.email}</small>
                </div>
                <em className={user.mustChangePassword ? "pending" : "active"}>
                  {user.mustChangePassword
                    ? "Troca de senha pendente"
                    : "Acesso ativo"}
                </em>
                <button onClick={() => void copy(user.email)}>
                  {copied === user.email ? <Check /> : <Copy />}
                  {copied === user.email ? "Copiado" : "Copiar login"}
                </button>
              </article>
            ))}
            {!users.length && (
              <div className="media-client-access-empty">
                <UserRound />
                <b>Nenhum acesso criado</b>
                <p>Crie o usuário na ficha do cliente para liberar o portal.</p>
              </div>
            )}
          </div>
        )}
        {creating && (
          <form className="media-client-access-form" onSubmit={createAccess}>
            <div className="media-client-access-notice"><LockKeyhole /><span><b>Acesso protegido e somente leitura</b><small>O cliente verá apenas as campanhas vinculadas ao cadastro.</small></span></div>
            <div className="media-client-access-fields">
              <label>Nome completo<input name="name" required autoFocus placeholder="Ex.: João da Silva" /></label>
              <label>E-mail de acesso<input name="email" type="email" required placeholder="cliente@empresa.com.br" /></label>
              <label className="full">Senha temporária<input name="password" type="password" minLength={6} required placeholder="Mínimo de 6 caracteres" /><small>Será solicitada uma nova senha no primeiro login.</small></label>
              <label className="full media-client-send-invite"><input name="sendEmail" type="checkbox" defaultChecked /><span><b>Enviar acesso por e-mail</b><small>Envia login, senha temporária e link do portal usando seu Gmail conectado.</small></span></label>
            </div>
            {formError && <div className="media-assignment-error"><AlertTriangle />{formError}</div>}
            <footer><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="primary" disabled={saving}>{saving ? <RefreshCw className="spin" /> : <UserRound />}{saving ? "Criando…" : "Criar acesso"}</button></footer>
          </form>
        )}
        <footer>
          <span>
            <b>Área exclusiva do cliente</b>
            <small>O acesso continua protegido pela senha individual.</small>
          </span>
          <div className="media-client-access-footer-actions">
          {!creating && <button type="button" className="secondary" disabled={users.length >= 2} onClick={() => setCreating(true)}><Plus /> Criar acesso</button>}
          <button type="button" className="secondary" onClick={() => void copy(portalUrl, "portal-link")}><Copy />{copied === "portal-link" ? "Link copiado" : "Copiar link"}</button>
          <a
            className="primary"
            href="/portal-cliente"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink /> Abrir portal do cliente
          </a>
          </div>
        </footer>
      </section>
    </div>
  );
}

function GoogleAdsEmpty() {
  return (
    <section className="traffic-platform-empty">
      <span className="google-ads-symbol"><GoogleAdsLogo /></span>
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

export function MediaDashboard({ section = "CLIENTS" }: { section?: "TODAY" | "CLIENTS" | "CAMPAIGNS" | "COMPILED" | "REPORTS" | "HISTORY" }) {
  const userId = useContext(MediaUserContext);
  const pageRef = useRef<HTMLDivElement>(null);
  const loadRequestRef = useRef(0);
  const todayIso = iso(new Date());
  const urlParams = new URLSearchParams(window.location.search);
  const reportClientFromUrl = urlParams.get("reportClient") || "";
  const contextClientFromUrl = urlParams.get("client") || "";
  const [platform, setPlatform] = useState<MediaView>(() => {
    if (section === "REPORTS" || section === "HISTORY") return "ALL";
    if (section === "COMPILED") return "META_ADS";
    const savedPlatform = savedMediaContext(userId).platform;
    return savedPlatform === "GOOGLE_ADS" ? "GOOGLE_ADS" : "META_ADS";
  });
  const mediaMode = section;
  const [managementView, setManagementView] = useState<"PORTFOLIOS" | "CAMPAIGNS">(
    urlParams.get("campaign") || window.location.pathname.endsWith("/campanhas")
      ? "CAMPAIGNS"
      : "PORTFOLIOS",
  );
  const [reportClientSelection, setReportClientSelection] = useState(reportClientFromUrl);
  const [reportIncludeThirtyDays, setReportIncludeThirtyDays] = useState(false);
  const [reportWindows, setReportWindows] = useState<{ primary: { since: string; until: string }; thirty?: { since: string; until: string } } | null>(null);
  const [automaticReportPreview, setAutomaticReportPreview] = useState<{ id: number; clientId: string; target: Window } | null>(null);
  // Campanhas, anúncios e criativos podem ocupar vários megabytes. Além de
  // estourar a pequena cota do localStorage, esse cache fazia um usuário ver
  // por instantes o conteúdo deixado pelo usuário anterior no navegador.
  // A fonte compartilhada e segura destes dados é exclusivamente o backend.
  // Memory only: isolated to this mounted screen, never shared across logins.
  const periodCacheRef = useRef(new Map<string, Payload>());
  const [data, setData] = useState<Payload | null>(null),
    [clients, setClients] = useState<Client[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [portalAccess, setPortalAccess] = useState<{
      client: Client;
      users: ClientPortalUser[];
      loading: boolean;
      error: string;
    } | null>(null),
    [canManageAssignments, setCanManageAssignments] = useState(false),
    [canSync, setCanSync] = useState(false),
    [comparisonCampaigns, setComparisonCampaigns] = useState<Campaign[]>([]);
  const [since, setSince] = useState(() => reportClientFromUrl ? initialReportPeriod().since : safeSavedMediaPeriod(userId).since),
    [until, setUntil] = useState(() => reportClientFromUrl ? initialReportPeriod().until : safeSavedMediaPeriod(userId).until);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(section === "TODAY" ? "ALL" : "ACTIVE"),
    [delivery, setDelivery] = useState("ALL"),
    [showBoosted, setShowBoosted] = useState(false),
    [contextClient, setContextClient] = useState(() => contextClientFromUrl || savedMediaContext(userId).client || "ALL"),
    [contextResponsible, setContextResponsible] = useState(() => savedMediaContext(userId).responsible || "ALL");
  const [loading, setLoading] = useState(!data),
    [error, setError] = useState(""),
    [manualSyncing, setManualSyncing] = useState(false),
    [isFullscreen, setIsFullscreen] = useState(false),
    [todayPage, setTodayPage] = useState(1),
    [accountsPage, setAccountsPage] = useState(1);
  useEffect(() => {
    [
      "pw-os-meta-dashboard-cache",
      "pw-os-google-dashboard-cache",
      "pw-os-all-dashboard-cache",
    ].forEach((key) => localStorage.removeItem(key));
  }, []);
  useEffect(() => {
    const updateFullscreenState = () =>
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await pageRef.current?.requestFullscreen();
    } catch {
      setError("O navegador não permitiu abrir a visualização em tela cheia.");
    }
  };
  const applyReportPeriod = (preset: "FIRST_HALF" | "LAST_30" | "FULL_MONTH") => {
    const now = new Date(), end = new Date(now);
    if (preset === "LAST_30") {
      const start = new Date(now); start.setDate(start.getDate() - 29);
      setSince(iso(start)); setUntil(iso(end));
      return;
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (preset === "FIRST_HALF") end.setDate(Math.min(15, now.getDate()));
    setSince(iso(start)); setUntil(iso(end));
  };
  const openClientAccess = async (client: Client) => {
    setPortalAccess({ client, users: [], loading: true, error: "" });
    try {
      const response = await fetch(`/api/clients/${client.id}/users`),
        payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.message || "Não foi possível consultar os acessos.",
        );
      setPortalAccess({
        client,
        users: payload.users || [],
        loading: false,
        error: "",
      });
    } catch (cause) {
      setPortalAccess({
        client,
        users: [],
        loading: false,
        error:
          cause instanceof Error
            ? cause.message
            : "Não foi possível consultar os acessos.",
      });
    }
  };
  const load = async (force = false, userInitiated = false, quiet = false) => {
    const requestId = ++loadRequestRef.current;
    if (!quiet) setLoading(true);
    const periodCacheKey = `${platform}:${since}:${until}`;
    if (force) periodCacheRef.current.clear();
    const cachedPeriod = periodCacheRef.current.get(periodCacheKey);
    setData(current => cachedPeriod || (current && current.since === since && current.until === until ? current : null));
    if (!quiet) setManualSyncing(userInitiated);
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
                const { response, payload } = await requestMediaPeriod(
                  `/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${since}&until=${until}${force ? "&refresh=1" : ""}${userInitiated ? "&manual=1" : ""}`,
                  AbortSignal.timeout(255_000),
                );
                return { source, response, payload };
              }),
            ),
            fetch("/api/clients"),
            fetch("/api/users"),
            fetch("/api/media/assignments"),
          ]),
        successful = mediaResults.filter((item) => item.response.ok);
      if (
        mediaResults.some((item) => item.response.status === 401) ||
        [clientsResponse, usersResponse, assignmentsResponse].some((response) => response.status === 401)
      ) {
        // O servidor local pode reiniciar durante uma atualização e invalidar a
        // sessão em memória. Recarregar permite que o App volte ao login, em vez
        // de exibir o problema como se fosse uma falha da Meta ou do Google.
        window.location.reload();
        return;
      }
      if (clientsResponse.ok) {
        const clientPayload = await clientsResponse.json();
        setClients(clientPayload.clients || []);
      }
      if (usersResponse.ok) {
        const userPayload = await usersResponse.json();
        setUsers((userPayload.users || []).filter((user: User) => user.profile !== "CLIENT"));
      }
      if (assignmentsResponse.ok) {
        const assignmentPayload = await assignmentsResponse.json();
        setAssignments(assignmentPayload.assignments || []);
        setCanManageAssignments(!!assignmentPayload.canManage);
        setCanSync(!!assignmentPayload.canSync);
      }
      if (requestId !== loadRequestRef.current) return;
      if (!successful.length)
        throw new Error(
          mediaResults
            .map((item) => item.payload.message)
            .filter(Boolean)
            .join(" · ") || "Não foi possível consultar as campanhas.",
        );
      const payload: Payload = {
        schemaVersion: 7,
        since,
        until,
        syncedAt:
          successful
            .map((item) => item.payload.syncedAt as string | undefined)
            .filter(Boolean)
            .sort()
            .at(-1) || new Date().toISOString(),
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
            accountRemainingBudget: (payload.accounts || []).find((account: Account) => account.id === campaign.accountId)?.remainingBudget ?? null,
          }));
        }),
      };
      if (requestId !== loadRequestRef.current) return;
      if (successful.length === providers.length) {
        periodCacheRef.current.delete(periodCacheKey);
        periodCacheRef.current.set(periodCacheKey, payload);
        while (periodCacheRef.current.size > 4) periodCacheRef.current.delete(periodCacheRef.current.keys().next().value!);
      }
      setData(payload);
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
      if (requestId !== loadRequestRef.current) return;
      setError(
        cause instanceof Error && cause.name === "TimeoutError"
          ? "A consulta demorou além do limite. Os dados anteriores foram mantidos; tente novamente."
          : cause instanceof Error ? cause.message : "Não foi possível consultar as campanhas.",
      );
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
        if (userInitiated) setManualSyncing(false);
      }
    }
  };
  const sharedReloadRef = useRef(() => {});
  sharedReloadRef.current = () => { if (!loading && !manualSyncing && document.visibilityState === "visible") void load(false, false, true); };
  useEffect(() => {
    const refresh = () => sharedReloadRef.current();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const saveAssignment = async (
    assignmentPlatform: "META_ADS" | "GOOGLE_ADS",
    accountIds: string[],
    clientId: string,
    responsibleId: string,
    identitySource: Assignment["identitySource"],
  ) => {
    const isFirstClientLink =
      !!clientId && !assignments.some((item) => item.clientId === clientId);
    const orphanedClientIds = !clientId
      ? [...new Set(
          assignments
            .filter((item) => accountIds.includes(item.accountId) && item.clientId)
            .map((item) => item.clientId)
            .filter(
              (previousClientId) =>
                !assignments.some(
                  (item) =>
                    item.clientId === previousClientId &&
                    !accountIds.includes(item.accountId),
                ),
            ),
        )]
      : [];
    if (
      orphanedClientIds.length &&
      !(await systemConfirm({
        title: "Desvincular a última conta?",
        message:
          "Este cliente ficará sem contas de mídia. As rotinas de relatório ativas serão pausadas para evitar entregas sem dados.",
        confirmLabel: "Desvincular e pausar",
        cancelLabel: "Cancelar",
        tone: "danger",
      }))
    ) {
      throw new Error("Desvinculação cancelada.");
    }
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
    if (orphanedClientIds.length) {
      const schedulesResponse = await fetch("/api/client-report-schedules");
      const schedulesPayload = await schedulesResponse.json();
      if (schedulesResponse.ok) {
        await Promise.all(
          (schedulesPayload.schedules || [])
            .filter(
              (schedule: { id: string; clientId: string; active: boolean }) =>
                schedule.active && orphanedClientIds.includes(schedule.clientId),
            )
            .map((schedule: { id: string }) =>
              fetch(`/api/client-report-schedules/${schedule.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: false }),
              }),
            ),
        );
      }
    }
    if (identitySource === "META_PORTFOLIO") void load();
    if (isFirstClientLink && await systemConfirm({ title: "Configurar os relatórios agora?", message: "A primeira conta deste cliente foi vinculada. Podemos abrir a configuração já com o responsável da mídia e o contato principal preenchidos.", confirmLabel: "Configurar relatório", cancelLabel: "Fazer depois", tone: "primary" })) {
      window.location.href = `/midia/relatorios?setupClient=${encodeURIComponent(clientId)}`;
    }
  };
  const selectPlatform = (next: MediaView) => {
    if (next === platform) return;
    // Cada troca consulta novamente o snapshot compartilhado mais recente do
    // servidor, sem reutilizar dados da outra plataforma ou de outro usuário.
    setData(periodCacheRef.current.get(`${next}:${since}:${until}`) || null);
    setError("");
    setPlatform(next);
  };
  useEffect(() => {
    void load();
  }, [since, until, platform]);
  useEffect(() => {
    let cancelled = false;
    // Relatórios, histórico e campanhas não exibem estes comparativos. Evita
    // consumir a cota do Google em segundo plano ao abrir essas telas.
    if (section !== "CLIENTS" && section !== "TODAY") {
      setComparisonCampaigns([]);
      return () => { cancelled = true; };
    }
    const days = Math.max(1, Math.round((new Date(`${until}T12:00`).getTime() - new Date(`${since}T12:00`).getTime()) / 86400000) + 1), previousUntil = new Date(`${since}T12:00`), previousSince = new Date(`${since}T12:00`);
    previousUntil.setDate(previousUntil.getDate() - 1); previousSince.setDate(previousSince.getDate() - days);
    const providers = platform === "ALL" ? (["META_ADS", "GOOGLE_ADS"] as const) : ([platform] as const);
    void Promise.all(providers.map(async (source) => { const response = await fetch(`/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${iso(previousSince)}&until=${iso(previousUntil)}&comparison=1`), payload = await response.json(); return response.ok ? (payload.campaigns || []).map((item: Campaign) => ({ ...item, platform: source })) : []; })).then((values) => { if (!cancelled) setComparisonCampaigns(values.flat()); });
    return () => { cancelled = true; };
  }, [platform, since, until, section]);
  useEffect(() => {
    try {
      localStorage.setItem(mediaPreferenceKey(userId, "pw-os-media-context"), JSON.stringify({ platform, since, until, client: contextClient, responsible: contextResponsible }));
    } catch {
      // Preferências locais são opcionais e nunca devem impedir a abertura da tela.
    }
  }, [platform, since, until, contextClient, contextResponsible]);
  useEffect(() => { setTodayPage(1); }, [platform, since, until, contextClient, contextResponsible]);
  useEffect(() => { setAccountsPage(1); }, [platform, since, until, contextClient, contextResponsible, query, status, delivery]);
  const filtered = useMemo(
    () =>
      (data?.campaigns || []).filter((item) => {
        const portfolioId =
          data?.accounts.find((account) => account.id === item.accountId)
            ?.businessPortfolioId || "",
          assignment = assignments.find((value) => value.platform === (item.platform || "META_ADS") && value.accountId === item.accountId);
        return (
          (contextClient === "ALL" || assignment?.clientId === contextClient) &&
          (contextResponsible === "ALL" || assignment?.responsibleId === contextResponsible) &&
          (status === "ALL" || item.status === status) &&
          (delivery === "ALL" ||
            (delivery === "WITH_DATA"
              ? hasDelivery(item)
              : !hasDelivery(item))) &&
          (showBoosted || !isBoostedPost(item)) &&
          `${item.client} ${item.name} ${portfolioId} ${item.accountId.replace(/^act_/, "")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        );
      }),
    [data, status, delivery, showBoosted, query, assignments, contextClient, contextResponsible],
  );
  const groups = useMemo<ClientGroup[]>(() => {
    const accountsById = new Map(
      (data?.accounts || []).map((account) => [account.id, account]),
    );
    const byPortfolio = new Map<string, Campaign[]>();
    filtered.forEach((item) => {
      const account = accountsById.get(item.accountId),
        source = item.platform || account?.platform || "META_ADS",
        assignment = assignments.find((value) => value.platform === source && value.accountId === item.accountId),
        key = assignment?.clientId
          ? `client:${assignment.clientId}`
          : account?.businessPortfolioId
            ? `unlinked:${source}:portfolio:${account.businessPortfolioId}`
            : `unlinked:${source}:account:${item.accountId}`;
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
          (item) => campaigns.some((campaign) => campaign.accountId === item.accountId && (campaign.platform || "META_ADS") === item.platform),
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
          campaigns: [...campaigns].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true })),
          totals: campaigns.reduce(add, emptyTotals()),
          active: campaigns.filter((item) => item.status === "ACTIVE").length,
          delivered: campaigns.filter(hasDelivery).length,
        };
      })
      .sort((a, b) => (a.client?.name || accountLabel(a.account)).localeCompare(b.client?.name || accountLabel(b.account), "pt-BR", { sensitivity: "base", numeric: true }));
  }, [filtered, data, clients, users, assignments]);
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
    frequency =
      overall.reachAvailable && overall.reach
        ? overall.impressions / overall.reach
        : null;
  const previousFiltered = comparisonCampaigns.filter((item) => { const assignment = assignments.find((value) => value.platform === (item.platform || "META_ADS") && value.accountId === item.accountId); return (contextClient === "ALL" || assignment?.clientId === contextClient) && (contextResponsible === "ALL" || assignment?.responsibleId === contextResponsible) && (status === "ALL" || item.status === status); }),
    previousOverall = previousFiltered.reduce(add, emptyTotals()),
    comparisonText = (current: number, previous: number, inverse = false) => { if (!previous) return "Sem base anterior"; const delta = (current - previous) / previous * 100 * (inverse ? -1 : 1); return `${delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} ${number(Math.abs(delta), 1)}% vs. anterior`; };
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
  const todayRows = allCampaigns.map((item) => {
    const score = campaignScore(item), balance = item.remainingBudget == null ? null : Math.max(0, item.remainingBudget), group = groups.find((value) => value.accounts.some((account) => account.id === item.accountId));
    const issue = !campaignAnalysisDue(item) ? "" : item.status === "WITH_ISSUES" ? "Problema informado pela plataforma" : item.status === "ACTIVE" && item.spend > Math.max(item.dailyBudget * 2, 200) && item.leads + item.conversations === 0 ? "Investimento sem conversões" : item.status === "ACTIVE" && item.dailyBudget > 0 && balance != null && balance <= item.dailyBudget * 2 ? "Saldo para até dois dias" : score >= 0 && score < 70 ? `Score crítico: ${score}/100` : "Análise semanal pendente";
    return { ...item, score, balance, group, issue };
  }).filter((item) => item.issue).sort((a, b) => (a.status === "WITH_ISSUES" ? 0 : a.score < 70 ? 1 : 2) - (b.status === "WITH_ISSUES" ? 0 : b.score < 70 ? 1 : 2));
  const previousToday = previousFiltered.map((item) => { const score = campaignScore(item), balance = item.remainingBudget == null ? null : Math.max(0, item.remainingBudget), due = campaignAnalysisDue(item); return { critical: due && (item.status === "WITH_ISSUES" || score < 70), lowBalance: due && item.status === "ACTIVE" && item.dailyBudget > 0 && balance != null && balance <= item.dailyBudget * 2, pending: due }; });
  const recordTodayAnalysis = (item: Campaign) => fetch("/api/media/campaigns/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: item.platform, accountId: item.accountId, campaignId: item.id, action: "ANALYSIS", score: campaignScore(item), spend: item.spend, leads: item.leads, cpl: item.cpl }) });
  const openCampaignAnalysis = (campaign: Campaign) => {
    const params = new URLSearchParams(window.location.search);
    params.set("campaign", `${campaign.platform || "META_ADS"}:${campaign.accountId}:${campaign.id}`);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    setManagementView("CAMPAIGNS");
  };
  const markCampaignAnalyzed = async (campaign: Campaign) => {
    const response = await fetch("/api/media/campaigns/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: campaign.platform, accountId: campaign.accountId, campaignId: campaign.id, verified: true, action: "REVIEW", score: campaignScore(campaign), spend: campaign.spend, leads: campaign.leads, cpl: campaign.cpl }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível concluir a análise.");
    campaign.verified = true;
    campaign.verifiedAt = result.verifiedAt || new Date().toISOString();
    campaign.verificationHistory = result.history || campaign.verificationHistory;
    setData((current) => current ? { ...current, campaigns: [...current.campaigns] } : current);
  };
  const todayTotalPages = Math.max(1, Math.ceil(todayRows.length / 20)), todaySafePage = Math.min(todayPage, todayTotalPages), todayVisible = todayRows.slice((todaySafePage - 1) * 20, todaySafePage * 20);
  const criticalCampaigns = allCampaigns.filter((item) => { const score = campaignScore(item); return hasDelivery(item) && (item.status === "WITH_ISSUES" || score < 70); }),
    spendWithoutResults = allCampaigns.filter((item) => hasDelivery(item) && item.spend > Math.max(item.dailyBudget * 2, 200) && item.leads + item.conversations === 0),
    lowBalanceCampaigns = allCampaigns.filter((item) => item.status === "ACTIVE" && item.dailyBudget > 0 && item.remainingBudget != null && item.remainingBudget <= item.dailyBudget * 2),
    unassignedPortfolios = groups.filter((group) => !group.responsible).length;
  const accountsTotalPages = Math.max(1, Math.ceil(groups.length / 20)), accountsSafePage = Math.min(accountsPage, accountsTotalPages), visibleGroups = groups.slice((accountsSafePage - 1) * 20, accountsSafePage * 20);
  return (
    <div className={`page traffic-page ${loading && !data ? "media-awaiting-period" : ""}`} ref={pageRef}>
      {loading && <div className="media-refresh-status" role="status" aria-live="polite"><RefreshCw className="spin"/><span>{data ? "Atualizando métricas" : "Buscando o período selecionado"}</span><small>{platform === "GOOGLE_ADS" ? "Google Ads" : platform === "META_ADS" ? "Meta Ads" : "Plataformas"}</small></div>}
      <header className="traffic-head">
        <div>
          <span className="eyebrow">
            {section === "TODAY" ? "PRIORIDADES DA OPERAÇÃO" : section === "REPORTS" || section === "HISTORY" ? "CONTROLE DE RELATÓRIOS" : platform === "META_ADS"
              ? "META ADS"
              : platform === "GOOGLE_ADS"
                ? "GOOGLE ADS"
                : "TODAS AS MÍDIAS"}
          </span>
          <h1>{section === "TODAY" ? "O que precisa de atenção hoje" : section === "REPORTS" ? "Relatórios de campanhas" : section === "HISTORY" ? "Histórico de relatórios" : section === "COMPILED" ? "Comparação de performance" : "Gestão de mídia"}</h1>
          <p>
            {section === "REPORTS" ? "Organize frequências, gere os PDFs e acompanhe cada envio aos clientes." : section === "HISTORY" ? "Consulte versões, responsáveis, canais e confirmações de cada relatório enviado." : "Visão organizada da conta do cliente até cada campanha e seus resultados oficiais."}
          </p>
          <div className="traffic-presentation-status">
            <i />
            <span>Monitoramento de campanhas</span>
            <small>
              Atualizado em {data?.syncedAt
                ? new Date(data.syncedAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "aguardando dados"}
            </small>
          </div>
        </div>
        {section !== "HISTORY" && <div className="traffic-period">
          {platform === "GOOGLE_ADS" && canSync && <button type="button" className="secondary" disabled={loading || manualSyncing} onClick={() => void load(true, true)}><RefreshCw className={manualSyncing ? "spin" : ""}/>{manualSyncing ? "Sincronizando Google…" : "Sincronizar Google agora"}</button>}
          {(section === "CLIENTS" || section === "CAMPAIGNS") && <button type="button" className="traffic-ai-launcher" onClick={() => window.dispatchEvent(new Event("pw:open-media-ai"))}><BrainCircuit /><span>Analisar operação</span><small>IA</small></button>}
          {section === "REPORTS" && <div className="traffic-period-presets" aria-label="Períodos rápidos para relatório">
            <button type="button" onClick={() => applyReportPeriod("FIRST_HALF")}>1ª quinzena</button>
            <button type="button" onClick={() => applyReportPeriod("LAST_30")}>Últimos 30 dias</button>
            <button type="button" onClick={() => applyReportPeriod("FULL_MONTH")}>Mês completo</button>
          </div>}
          {section === "REPORTS" && <label>
            <CalendarDays />
            <input
              type="date"
              value={since}
              max={until < todayIso ? until : todayIso}
              onChange={(event) => setSince(event.target.value)}
            />
            <span>até</span>
            <input
              type="date"
              value={until}
              min={since}
              max={todayIso}
              onChange={(event) => setUntil(event.target.value)}
            />
          </label>}
          <button
            type="button"
            className="secondary traffic-fullscreen"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? "Sair da tela cheia" : "Exibir campanhas em tela cheia"}
            aria-label={isFullscreen ? "Sair da tela cheia" : "Exibir campanhas em tela cheia"}
          >
            {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          </button>
          <span className="traffic-auto-sync"><RefreshCw/><span><b>Sincronização automática</b><small>Diariamente às 04:00</small></span></span>
        </div>}
      </header>
      {(section === "CLIENTS" || section === "CAMPAIGNS") && <div className="media-ai-top-instance"><MediaAiBoundary><MediaAiInsights campaigns={allCampaigns} since={since} until={until} context="Gestão de mídia · visão geral" /></MediaAiBoundary></div>}
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
      {(section === "CLIENTS" || section === "CAMPAIGNS" || section === "TODAY") && <section className="media-context-bar">
        <label><Building2/><select value={contextClient} onChange={(event) => setContextClient(event.target.value)}><option value="ALL">Todos os clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
        <label><UserRound/><select value={contextResponsible} onChange={(event) => setContextResponsible(event.target.value)}><option value="ALL">Todos os responsáveis</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></label>
        <div className="media-context-period"><span><CalendarDays/> Período</span><div className="media-context-dates"><button onClick={() => { const end = new Date(), start = new Date(); start.setDate(start.getDate() - 6); setSince(iso(start)); setUntil(iso(end)); }}>7 dias</button><button onClick={() => { const end = new Date(), start = new Date(); start.setDate(start.getDate() - 14); setSince(iso(start)); setUntil(iso(end)); }}>15 dias</button><button onClick={() => applyReportPeriod("LAST_30")}>30 dias</button><button onClick={() => applyReportPeriod("FULL_MONTH")}>Mês atual</button></div><details className="media-custom-period"><summary><CalendarDays/><span>{shortDate(since)} – {shortDate(until)}</span><ChevronDown/></summary><div><label><small>Data inicial</small><input aria-label="Data inicial" type="date" value={since} max={until < todayIso ? until : todayIso} onChange={(event) => setSince(event.target.value)}/></label><i>até</i><label><small>Data final</small><input aria-label="Data final" type="date" value={until} min={since} max={todayIso} onChange={(event) => setUntil(event.target.value)}/></label></div></details></div>
        {(contextClient !== "ALL" || contextResponsible !== "ALL") && <button className="media-context-clear" onClick={() => { setContextClient("ALL"); setContextResponsible("ALL"); }}>Limpar filtros</button>}
        <div className="media-filter-chips">{contextClient !== "ALL" && <button onClick={() => setContextClient("ALL")}>{clients.find((item) => item.id === contextClient)?.name || "Cliente"}<X/></button>}{contextResponsible !== "ALL" && <button onClick={() => setContextResponsible("ALL")}>{users.find((item) => item.id === contextResponsible)?.name || "Responsável"}<X/></button>}</div>
      </section>}
      {(section === "CLIENTS" || section === "CAMPAIGNS") && <MediaPlatformSwitch
        platform={platform}
        onPlatformChange={selectPlatform}
        metaDetail={platform === "META_ADS" ? `${data?.accounts.length || 0} contas conectadas` : "Clique para consultar"}
        googleDetail={platform === "GOOGLE_ADS" ? `${data?.accounts.length || 0} contas conectadas` : "Clique para consultar"}
        className="media-management-platform-switch"
      />}
      <>
        {mediaMode === "CLIENTS" && (
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
                <em>{comparisonText(overall.spend, previousOverall.spend)} · {periodDays} dia(s)</em>
              </span>
            </article>
            <article>
              <Users />
              <span>
                <small>Alcance</small>
                <b>
                  {overall.reachAvailable
                    ? number(overall.reach)
                    : "Indisponível"}
                </b>
                <em>
                  {overall.reachAvailable
                    ? "Usuários únicos informados pelo Google"
                    : "Métrica não fornecida"}
                </em>
              </span>
            </article>
            <article>
              <Eye />
              <span>
                <small>Impressões</small>
                <b>{number(overall.impressions)}</b>
                <em>
                  {frequency === null
                    ? "Frequência indisponível"
                    : `Frequência média ${number(frequency, 2)}`}
                </em>
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
                <em>{comparisonText(overall.leads, previousOverall.leads)}</em>
              </span>
            </article>
            <article>
              <Gauge />
              <span>
                <small>CPL médio</small>
                <b>{averageCpl === null ? "—" : money(averageCpl)}</b>
                <em>{averageCpl === null ? "Custo por lead" : comparisonText(averageCpl, previousOverall.leads ? previousOverall.spend / previousOverall.leads : 0, true)}</em>
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
        )}
        {mediaMode === "TODAY" ? (
          <section className="media-today">
            <div className="media-today-summary"><article className="critical"><AlertTriangle/><span><b>{todayRows.filter((item) => item.status === "WITH_ISSUES" || item.score < 70).length}</b><small>Críticos</small><em>{previousToday.filter((item) => item.critical).length} no período anterior</em></span></article><article><WalletCards/><span><b>{todayRows.filter((item) => item.issue.includes("Saldo")).length}</b><small>Saldo baixo</small><em>{previousToday.filter((item) => item.lowBalance).length} anteriormente</em></span></article><article><Clock3/><span><b>{todayRows.filter((item) => item.issue.includes("pendente")).length}</b><small>Análises pendentes</small><em>{previousToday.filter((item) => item.pending).length} anteriormente</em></span></article><article><CheckCircle2/><span><b>{Math.max(0, allCampaigns.length - todayRows.length)}</b><small>Sem alerta</small><em>{Math.max(0, previousFiltered.length - previousToday.filter((item) => item.critical || item.lowBalance || item.pending).length)} anteriormente</em></span></article></div>
            <header><div><span>FILA PRIORIZADA</span><h2>Decisões recomendadas</h2><p>Problemas críticos aparecem primeiro. Abra a campanha sem perder seus filtros.</p></div><NavLink to="/midia/gestao">Ver todas as campanhas</NavLink></header>
            <div className="media-today-list">{todayVisible.map((item) => <article key={`${item.platform}:${item.accountId}:${item.id}`}><i className={item.status === "WITH_ISSUES" || item.score < 70 ? "critical" : "warning"}><AlertTriangle/></i><span><b>{item.name}</b><small>{item.group?.client?.name || accountLabel(item.group?.account || { id:item.accountId, name:item.client, currency:item.currency, amountSpent:0, spendCap:0 })} · {item.platform === "META_ADS" ? "Meta Ads" : "Google Ads"}</small></span><strong>{item.issue}</strong><em>{item.spend ? `${money(item.spend, item.currency)} investidos · ${number(item.leads)} conversões` : "Sem investimento no período"}</em><NavLink onClick={() => void recordTodayAnalysis(item)} to={`/midia/gestao?campaign=${encodeURIComponent(`${item.platform}:${item.accountId}:${item.id}`)}`}>Analisar</NavLink></article>)}{!todayRows.length && <div className="media-today-empty"><CheckCircle2/><b>Operação saudável</b><span>Nenhuma prioridade crítica nos filtros atuais.</span></div>}</div>
            {!!todayRows.length && <footer className="media-list-pagination"><span>Exibindo {(todaySafePage - 1) * 20 + 1}–{Math.min(todaySafePage * 20, todayRows.length)} de <b>{todayRows.length}</b></span><nav><button disabled={todaySafePage === 1} onClick={() => setTodayPage((value) => Math.max(1, value - 1))}>Anterior</button><em>Página {todaySafePage} de {todayTotalPages}</em><button disabled={todaySafePage === todayTotalPages} onClick={() => setTodayPage((value) => Math.min(todayTotalPages, value + 1))}>Próxima</button></nav></footer>}
          </section>
        ) : mediaMode === "REPORTS" || mediaMode === "HISTORY" ? (
          <section className="media-report-control">
            <ClientReportAgenda onManageClientAccess={(clientId) => { const client = clients.find((item) => item.id === clientId); if (client) void openClientAccess(client); }} onGenerate={(request) => { const end = new Date(`${request.until}T12:00:00`), start30 = new Date(end); start30.setDate(start30.getDate() - 29); setReportClientSelection(request.clientId); setReportIncludeThirtyDays(request.includeThirtyDaySummary); setReportWindows({ primary: { since: request.since, until: request.until }, ...(request.includeThirtyDaySummary ? { thirty: { since: iso(start30), until: request.until } } : {}) }); setSince(request.since); setUntil(request.until); if (request.previewWindow) setAutomaticReportPreview({ id: Date.now(), clientId: request.clientId, target: request.previewWindow }); if (platform !== "ALL") setPlatform("ALL"); window.requestAnimationFrame(() => document.querySelector(".client-report-builder")?.scrollIntoView({ behavior: "smooth", block: "center" })); }} />
            {mediaMode === "REPORTS" && reportIncludeThirtyDays && reportWindows?.thirty && <div className="report-window-switch"><span><b>Fechamento da segunda quinzena</b><small>Disponibilizamos as duas leituras exigidas pela rotina.</small></span><button type="button" className={since === reportWindows.primary.since ? "active" : ""} onClick={() => { setSince(reportWindows.primary.since); setUntil(reportWindows.primary.until); }}>Últimos 15 dias</button><button type="button" className={since === reportWindows.thirty!.since ? "active" : ""} onClick={() => { setSince(reportWindows.thirty!.since); setUntil(reportWindows.thirty!.until); }}>Consolidado 30 dias</button></div>}
            {mediaMode === "REPORTS" && <CampaignReport key={`report:${reportClientSelection}:${since}:${until}`} campaigns={allCampaigns} groups={groups} clients={clients} assignments={assignments} periodDays={periodDays} since={since} until={until} allPlatforms={platform === "ALL"} onClientReportSelected={() => setPlatform("ALL")} initialClientId={reportClientSelection} includeThirtyDaySummary={reportIncludeThirtyDays} automaticPreview={automaticReportPreview} onAutomaticPreviewDone={() => setAutomaticReportPreview(null)} reportsOnly />}
          </section>
        ) : mediaMode === "COMPILED" ? (
          <CompiledReport
            campaigns={allCampaigns}
            groups={groups}
            platform={platform}
            since={since}
            until={until}
            onSinceChange={setSince}
            onUntilChange={setUntil}
            onPlatformChange={selectPlatform}
            onAnalyze={openCampaignAnalysis}
          />
        ) : mediaMode === "CAMPAIGNS" || (mediaMode === "CLIENTS" && managementView === "CAMPAIGNS") ? (
          <CampaignReport
            campaigns={allCampaigns}
            groups={groups}
            clients={clients}
            assignments={assignments}
            periodDays={periodDays}
            since={since}
            until={until}
            allPlatforms={platform === "ALL"}
            onClientReportSelected={() => setPlatform("ALL")}
            onAnalysisClosed={mediaMode === "CLIENTS" ? () => {
              const params = new URLSearchParams(window.location.search);
              params.delete("campaign");
              window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
              setManagementView("PORTFOLIOS");
            } : undefined}
          />
        ) : (
          <>
            <section className="media-operation-pulse" aria-label="Resumo das prioridades operacionais">
              <header><div><small>LEITURA OPERACIONAL</small><h2>O que merece atenção</h2></div><NavLink to="/midia/hoje">Abrir fila priorizada <ChevronDown /></NavLink></header>
              <div>
                <NavLink className={criticalCampaigns.length ? "critical" : "healthy"} to="/midia/hoje"><AlertTriangle/><span><b>{criticalCampaigns.length}</b><small>campanhas críticas</small><em>{criticalCampaigns.length ? "Revisar score e problemas" : "Nenhum alerta crítico"}</em></span></NavLink>
                <NavLink className={spendWithoutResults.length ? "critical" : "healthy"} to="/midia/hoje"><WalletCards/><span><b>{spendWithoutResults.length}</b><small>investindo sem resultado</small><em>{money(spendWithoutResults.reduce((sum,item) => sum + item.spend,0))} no período</em></span></NavLink>
                <NavLink className={lowBalanceCampaigns.length ? "warning" : "healthy"} to="/midia/hoje"><Activity/><span><b>{lowBalanceCampaigns.length}</b><small>com saldo para até 2 dias</small><em>{lowBalanceCampaigns.length ? "Planejar recarga ou ajuste" : "Saldos sem risco imediato"}</em></span></NavLink>
                <NavLink className={unassignedPortfolios ? "warning" : "healthy"} to="/midia/hoje"><UserRound/><span><b>{unassignedPortfolios}</b><small>portfólios sem responsável</small><em>{unassignedPortfolios ? "Definir dono da operação" : "Operação atribuída"}</em></span></NavLink>
              </div>
            </section>
            <section className="traffic-toolbar">
              <div>
                <h2>Clientes e portfólios</h2>
                <p>Selecione um cliente para consultar suas contas, campanhas, anúncios e criativos.</p>
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
                <div className="campaign-standard-filter">
                  <SearchableSelect
                    searchable={false}
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "ALL", label: "Todos os status" },
                      ...statuses.map((item) => ({ value: item, label: statusLabel[item] || item })),
                    ]}
                  />
                </div>
                <div className="campaign-standard-filter">
                  <SearchableSelect
                    searchable={false}
                    value={delivery}
                    onChange={setDelivery}
                    options={[
                      { value: "ALL", label: "Todas as entregas" },
                      { value: "WITH_DATA", label: "Com entrega" },
                      { value: "NO_DATA", label: "Sem entrega" },
                    ]}
                  />
                </div>
                <div className="campaign-standard-filter traffic-filter-boosted">
                  <SearchableSelect
                    searchable={false}
                    value={showBoosted ? "SHOW" : "HIDE"}
                    onChange={(value) => setShowBoosted(value === "SHOW")}
                    options={[
                      { value: "HIDE", label: "Ocultar impulsionamentos" },
                      { value: "SHOW", label: "Mostrar impulsionamentos" },
                    ]}
                  />
                </div>
              </div>
            </section>
            {loading && !data ? (
              <div className="media-table-placeholder" aria-hidden="true">{Array.from({ length: 5 }, (_, row) => <div key={row}><i/>{Array.from({ length: 7 }, (_, column) => <span key={column}/>)}</div>)}</div>
            ) : groups.length === 0 ? (
              <div className="panel inline-empty">
                <Megaphone />
                <h3>Nenhum cliente encontrado</h3>
                <p>Ajuste os filtros ou o período selecionado.</p>
              </div>
            ) : (
              <section className="traffic-client-list">
                {visibleGroups.map((group, index) => (
                  <ClientCampaignGroup
                    key={group.key}
                    group={group}
                    initialOpen={index === 0}
                    clients={clients}
                    users={users}
                    onAssign={saveAssignment}
                    platform={group.platform}
                    showPlatform={false}
                    canManage={canManageAssignments}
                    periodDays={periodDays}
                    onAnalyze={openCampaignAnalysis}
                    onVerify={markCampaignAnalyzed}
                  />
                ))}
              </section>
            )}
            {!!groups.length && <footer className="media-list-pagination"><span>Exibindo {(accountsSafePage - 1) * 20 + 1}–{Math.min(accountsSafePage * 20, groups.length)} de <b>{groups.length}</b></span><nav><button disabled={accountsSafePage === 1} onClick={() => setAccountsPage((value) => Math.max(1, value - 1))}>Anterior</button><em>Página {accountsSafePage} de {accountsTotalPages}</em><button disabled={accountsSafePage === accountsTotalPages} onClick={() => setAccountsPage((value) => Math.min(accountsTotalPages, value + 1))}>Próxima</button></nav></footer>}
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
                        allCampaigns.filter(
                          (item) => item.status === "WITH_ISSUES",
                        ).length
                          ? "warning"
                          : "ok"
                      }
                    >
                      <i />
                      {allCampaigns.filter(
                        (item) => item.status === "WITH_ISSUES",
                      ).length || "Nenhuma"}{" "}
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
        )}
      </>
      {portalAccess && createPortal(<ClientAccessModal {...portalAccess} onClose={() => setPortalAccess(null)} onReload={() => openClientAccess(portalAccess.client)} />, document.body)}
    </div>
  );
}

function campaignScore(item: Campaign) {
  if (!hasDelivery(item)) return -1;
  const ctr = item.impressions ? (item.clicks / item.impressions) * 100 : 0,
    conversionRate = item.clicks ? (item.leads / item.clicks) * 100 : 0,
    budgetUse = item.dailyBudget ? item.spend / (item.dailyBudget * 7) : 1;
  return Math.max(
    1,
    Math.min(
      100,
      Math.round(
        30 +
          Math.min(25, ctr * 5) +
          Math.min(30, conversionRate * 4) +
          Math.max(0, 15 - Math.abs(1 - budgetUse) * 15) -
          (item.status === "ACTIVE" ? 0 : 12),
      ),
    ),
  );
}

function campaignScoreBreakdown(item: Campaign) {
  if (!hasDelivery(item)) return {
    score: -1,
    summary: "Sem entrega suficiente para calcular o score.",
    factors: [] as Array<{ label: string; value: string; points: number; max: number; tone: "good" | "warning" | "bad" }>,
    strengths: [] as string[],
    improvements: ["Ative ou revise a veiculação para gerar dados avaliáveis."],
    dimensions: [] as Array<{ label: "Performance" | "Entrega" | "Operação"; value: number; tone: "good" | "warning" | "bad"; detail: string }>,
  };
  const ctr = item.impressions ? (item.clicks / item.impressions) * 100 : 0,
    conversionRate = item.clicks ? (item.leads / item.clicks) * 100 : 0,
    budgetUse = item.dailyBudget ? item.spend / (item.dailyBudget * 7) : 1,
    ctrPoints = Math.min(25, ctr * 5),
    conversionPoints = Math.min(30, conversionRate * 4),
    budgetPoints = Math.max(0, 15 - Math.abs(1 - budgetUse) * 15),
    statusPoints = item.status === "ACTIVE" ? 0 : -12,
    score = campaignScore(item),
    factors = [
      { label: "CTR", value: `${number(ctr, 2)}%`, points: ctrPoints, max: 25, tone: ctr >= 2 ? "good" as const : ctr >= 1 ? "warning" as const : "bad" as const },
      { label: "Conversão clique → lead", value: `${number(conversionRate, 2)}%`, points: conversionPoints, max: 30, tone: conversionRate >= 5 ? "good" as const : conversionRate >= 2 ? "warning" as const : "bad" as const },
      { label: "Ritmo do orçamento (7 dias)", value: `${number(budgetUse * 100, 0)}%`, points: budgetPoints, max: 15, tone: budgetUse >= .7 && budgetUse <= 1.3 ? "good" as const : budgetUse >= .4 && budgetUse <= 1.6 ? "warning" as const : "bad" as const },
      { label: "Status da campanha", value: statusLabel[item.status] || item.status, points: statusPoints, max: 0, tone: item.status === "ACTIVE" ? "good" as const : "bad" as const },
    ],
    dimensionTone = (value: number) => (value >= 80 ? "good" : value >= 60 ? "warning" : "bad") as "good" | "warning" | "bad",
    performanceScore = Math.round(((ctrPoints + conversionPoints) / 55) * 100),
    deliveryScore = Math.round((budgetPoints / 15) * 100),
    operationScore = item.status === "ACTIVE" ? 100 : 20,
    dimensions = [
      { label: "Performance" as const, value: performanceScore, tone: dimensionTone(performanceScore), detail: "CTR e conversão dos cliques" },
      { label: "Entrega" as const, value: deliveryScore, tone: dimensionTone(deliveryScore), detail: "Ritmo de uso do orçamento" },
      { label: "Operação" as const, value: operationScore, tone: dimensionTone(operationScore), detail: "Status e continuidade da campanha" },
    ], strengths = [] as string[], improvements = [] as string[];
  if (ctr >= 2) strengths.push(`CTR de ${number(ctr, 2)}% gera tráfego com boa aderência.`);
  else improvements.push("Melhorar criativo, mensagem ou público para elevar o CTR.");
  if (conversionRate >= 5) strengths.push(`Conversão de ${number(conversionRate, 2)}% aproveita bem os cliques.`);
  else improvements.push("Revisar oferta, formulário e landing page para converter mais cliques.");
  if (budgetUse >= .7 && budgetUse <= 1.3) strengths.push("O investimento está próximo do ritmo planejado.");
  else improvements.push(budgetUse < .7 ? "Investigar baixa entrega e ampliar o uso do orçamento disponível." : "Rever orçamento ou segmentação para controlar o ritmo de gasto.");
  if (item.status === "ACTIVE") strengths.push("A campanha está ativa, sem penalidade operacional.");
  else improvements.push("Regularizar o status da campanha; a inatividade retira 12 pontos.");
  return {
    score,
    summary: `A nota parte de 30 pontos e soma CTR (+${Math.round(ctrPoints)}), conversão (+${Math.round(conversionPoints)}) e ritmo do orçamento (+${Math.round(budgetPoints)})${statusPoints ? `, com ${statusPoints} pelo status` : ""}.`,
    factors, strengths, improvements, dimensions,
  };
}

function portfolioScoreBreakdown(campaigns: Campaign[]) {
  const evaluated = campaigns.filter(hasDelivery);
  if (!evaluated.length) return {
    score: -1, summary: "Nenhuma campanha teve entrega suficiente no período para compor a nota do portfólio.",
    factors: [] as Array<{ label: string; value: string; points: number; max: number; tone: "good" | "warning" | "bad" }>, strengths: [] as string[],
    improvements: ["Aguarde a entrega ou revise a veiculação das campanhas para gerar uma avaliação."], dimensions: [] as Array<{ label: "Performance" | "Entrega" | "Operação"; value: number; tone: "good" | "warning" | "bad"; detail: string }>,
  };
  const details = evaluated.map(campaignScoreBreakdown).filter((detail) => detail.score >= 0),
    average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    score = Math.round(average(details.map((detail) => detail.score))),
    factorLabels = [...new Set(details.flatMap((detail) => detail.factors.map((factor) => factor.label)))],
    factors = factorLabels.flatMap((label) => {
      const entries = details.flatMap((detail) => {
          const factor = detail.factors.find((candidate) => candidate.label === label);
          return factor ? [factor] : [];
        }),
        first = entries[0];
      if (!first) return [];
      const points = average(entries.map((entry) => entry.points)),
        ratio = first.max > 0 ? points / first.max : points < 0 ? 0 : 1;
      return [{ label: first.label, value: `média de ${Math.round(points)} pts`, points, max: first.max, tone: (ratio >= .7 ? "good" : ratio >= .4 ? "warning" : "bad") as "good" | "warning" | "bad" }];
    }),
    strongest = [...factors].filter((factor) => factor.max > 0).sort((a,b) => (b.points / b.max) - (a.points / a.max))[0],
    weakest = [...factors].filter((factor) => factor.max > 0).sort((a,b) => (a.points / a.max) - (b.points / b.max))[0],
    dimensionLabels = [...new Set(details.flatMap((detail) => detail.dimensions.map((dimension) => dimension.label)))],
    dimensions = dimensionLabels.flatMap((label) => {
      const entries = details.flatMap((detail) => {
          const dimension = detail.dimensions.find((candidate) => candidate.label === label);
          return dimension ? [dimension] : [];
        }),
        first = entries[0];
      if (!first) return [];
      const value = Math.round(average(entries.map((entry) => entry.value)));
      return [{ ...first, value, tone: (value >= 80 ? "good" : value >= 60 ? "warning" : "bad") as "good" | "warning" | "bad" }];
    });
  return { score, summary: `Média de ${evaluated.length} campanha${evaluated.length === 1 ? "" : "s"} com entrega no período. Cada nota usa a mesma base de CTR, conversão, orçamento e status.`, factors,
    strengths: strongest ? [`${strongest.label} é o fator que mais sustenta a média (${Math.round(strongest.points)}/${strongest.max} pts).`] : [],
    improvements: weakest ? [`${weakest.label} é o principal limitador da média (${Math.round(weakest.points)}/${weakest.max} pts).`] : [], dimensions };
}

type CompiledCampaign = Campaign & { groupName: string };
const comparisonChange = (current: number, previous: number) =>
  previous ? ((current - previous) / previous) * 100 : current ? 100 : 0;

function CompiledMetric({ current, previous, format, inverse = false, neutralTrend = false }: {
  current: number | null;
  previous: number | null;
  format: (value: number) => string;
  inverse?: boolean;
  neutralTrend?: boolean;
}) {
  if (current == null) return <span className="compiled-metric"><b>—</b><small>Não disponibilizado</small></span>;
  if (previous == null) return <span className="compiled-metric"><b>{format(current)}</b><small>Sem base anterior</small></span>;
  if (previous === 0 && current !== 0) return <span className="compiled-metric"><b>{format(current)}</b><small>Sem base percentual <em>anterior: {format(previous)}</em></small></span>;
  const change = comparisonChange(current, previous),
    improved = inverse ? change < 0 : change > 0,
    tone = neutralTrend || Math.abs(change) < .05 ? "neutral" : improved ? "good" : "bad";
  return <span className="compiled-metric"><b>{format(current)}</b><small className={tone}>{change > 0 ? "↑" : change < 0 ? "↓" : "—"} {number(Math.abs(change), 1)}% <em>anterior: {format(previous)}</em></small></span>;
}

type MediaAiInsight = { verdict: "HEALTHY" | "WATCH" | "CRITICAL"; headline: string; summary: string; evidence: Array<{ metric: string; finding: string }>; priorities: string[]; risks: string[]; experiments: string[]; generatedAt: string; model: string };
type MediaAiOverview = { campaignCount: number; spend: number; impressions: number; clicks: number; leads: number; cpl: number; ctr: number; previousSpend: number; previousImpressions: number; previousClicks: number; previousLeads: number; previousCpl: number; previousCtr: number };
class MediaAiBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Falha isolada na análise de mídia com IA", error, info); }
  render() { return this.state.failed ? null : this.props.children; }
}
function MediaAiInsights({ campaigns, since, until, context, scope = "CAMPAIGNS", overview }: { campaigns: Array<Campaign & { groupName?: string; score?: number }>; since: string; until: string; context: string; scope?: "OVERVIEW" | "CAMPAIGNS"; overview?: MediaAiOverview }) {
  const [insight,setInsight]=useState<MediaAiInsight|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[cacheNotice,setCacheNotice]=useState(""),[expandedView,setExpandedView]=useState(false);
  const signature=`${scope}:${JSON.stringify(overview || {})}:${campaigns.map(item=>`${item.platform}:${item.accountId}:${item.id}:${item.spend}:${item.leads}:${item.clicks}`).sort().join("|")}`;
  useEffect(()=>{setInsight(null);setError("");setCacheNotice("");setExpandedView(false)},[signature,since,until,context]);
  const generate=async(mode:"AUTO"|"DEEP"="DEEP")=>{if(!campaigns.length)return;setLoading(true);setError("");if(mode==="DEEP")setCacheNotice("");try{const response=await fetch("/api/media/ai-insights",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientName:context,cacheScope:`MEDIA_${scope}`,analysisScope:scope,overview,mode,since,until,campaigns:campaigns.map(item=>({name:`${item.groupName||"Portfólio"} · ${item.name}`,platform:item.platform,status:item.status,objective:item.objective,spend:item.spend,impressions:item.impressions,clicks:item.clicks,leads:item.leads,cpl:item.cpl,score:item.score??campaignScore(item)}))})}),payload=await response.json();if(!response.ok){setError(payload.message||"Não foi possível gerar a análise.");return}const raw=payload.insight||{},safeInsight:MediaAiInsight={verdict:["HEALTHY","WATCH","CRITICAL"].includes(raw.verdict)?raw.verdict:"WATCH",headline:typeof raw.headline==="string"?raw.headline:"Análise da operação concluída",summary:typeof raw.summary==="string"?raw.summary:"A análise foi concluída, mas não trouxe um resumo textual.",evidence:Array.isArray(raw.evidence)?raw.evidence:[],priorities:Array.isArray(raw.priorities)?raw.priorities:[],risks:Array.isArray(raw.risks)?raw.risks:[],experiments:Array.isArray(raw.experiments)?raw.experiments:[],generatedAt:raw.generatedAt||new Date().toISOString(),model:raw.model||"OpenAI"};setInsight(safeInsight);setCacheNotice(payload.cached?"Análise automática reutilizada, sem novo consumo.":mode==="AUTO"?"Análise automática atualizada. Próxima renovação em até 6 horas.":"Análise aprofundada gerada e salva no cache.")}catch{setError("Falha de conexão ao gerar os insights.")}finally{setLoading(false)}};
  useEffect(()=>{if(!campaigns.length)return;const timer=window.setTimeout(()=>void generate("AUTO"),900);return()=>window.clearTimeout(timer)},[signature,since,until]);
  useEffect(()=>{const open=()=>setExpandedView(true);window.addEventListener("pw:open-media-ai",open);return()=>window.removeEventListener("pw:open-media-ai",open)},[]);
  if(!campaigns.length)return null;
  return <section className={`media-ai-insights ${insight ? `expanded verdict-${insight.verdict.toLowerCase()}` : error ? "failed" : "loading"} ${expandedView ? "report-open" : "report-compact"}`}>
    <header>
      <span className="intelligence-mark" aria-hidden="true"><BrainCircuit /><i /><i /><i /></span>
      <div>
        <small>PW INTELLIGENCE <b>•</b> {scope === "OVERVIEW" ? "LEITURA DA VISÃO GERAL" : "ANÁLISE DE CAMPANHAS"}</small>
        <h3>{insight ? insight.headline : error ? "Análise automática indisponível" : "Lendo a operação…"}</h3>
        <p>{insight ? `${campaigns.length} campanhas analisadas · ${shortDate(since)} a ${shortDate(until)}` : error ? "Os dados numéricos continuam disponíveis abaixo." : "Cruzando investimento, entrega, conversões, CPL e score."}</p>
      </div>
      {insight && <em className="intelligence-verdict">{insight.verdict === "HEALTHY" ? "Saudável" : insight.verdict === "WATCH" ? "Atenção" : "Prioridade"}</em>}
      <div className="media-ai-actions">
        <button type="button" className="media-ai-toggle" onClick={() => setExpandedView((value) => !value)} aria-expanded={expandedView}><span className="media-ai-button-icon">{expandedView ? <X /> : <BrainCircuit />}</span>{expandedView ? "Fechar análise" : "Abrir análise IA"}</button>
        <button type="button" onClick={() => void generate("DEEP")} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />{loading ? "Analisando…" : error ? "Tentar novamente" : "Aprofundar análise"}</button>
      </div>
    </header>
    {error && <div className="media-ai-error"><AlertTriangle /><span><b>Insights indisponíveis</b><p>{error}</p></span>{error.includes("Configure") && <NavLink to="/configuracoes">Configurar OpenAI</NavLink>}</div>}
    {!insight && loading && <div className="media-ai-skeleton"><i /><i /><i /></div>}
    {insight && <>
      <div className="media-ai-conclusion"><div><small>LEITURA EXECUTIVA</small><p>{insight.summary}</p></div><aside>{insight.evidence.slice(0, expandedView ? undefined : 2).map(item => <span key={`${item.metric}:${item.finding}`}><b>{item.metric}</b><small>{item.finding}</small></span>)}</aside></div>
      {expandedView && <div className="media-ai-columns"><article className="priority"><header><Target /><span><b>Faça primeiro</b><small>Ações em ordem de impacto</small></span></header>{insight.priorities.map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span></p>)}</article><article className="risk"><header><AlertTriangle /><span><b>Não perca de vista</b><small>Riscos sustentados pelos dados</small></span></header>{insight.risks.map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span></p>)}</article><article className="experiment"><header><Activity /><span><b>Teste nesta rodada</b><small>Hipóteses específicas</small></span></header>{insight.experiments.map((item, index) => <p key={item}><i>{index + 1}</i><span>{item}</span></p>)}</article></div>}
      <footer><span><CheckCircle2 />{cacheNotice}</span><small>{insight.model} · recomendações devem ser validadas pela operação</small></footer>
    </>}
  </section>;
}

function ComparisonClientRows({ group, previousCampaigns, previousAvailable, search, onAnalyze }: { group: ClientGroup; previousCampaigns: Campaign[]; previousAvailable: boolean; search: string; onAnalyze: (campaign: Campaign) => void }) {
  const [open,setOpen] = useState(false);
  const name = group.client?.name || accountLabel(group.account);
  const current = group.campaigns;
  const accountKeys = new Set(group.accounts.map(account => `${account.platform || group.platform}:${account.id}`));
  const previous = previousAvailable ? previousCampaigns.filter(item => accountKeys.has(`${item.platform}:${item.accountId}`)) : [];
  const previousById = new Map(previous.map(item => [`${item.platform}:${item.accountId}:${item.id}`, item]));
  const averageScore = (items: Campaign[]) => { const values = items.map(campaignScore).filter(value => value >= 0); return values.length ? Math.round(values.reduce((sum,value)=>sum+value,0)/values.length) : null; };
  const campaignRows = current.filter(item => name.toLowerCase().includes(search.toLowerCase()) || item.name.toLowerCase().includes(search.toLowerCase())).slice().sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base",numeric:true}));
  const renderRow = (items: Campaign[], oldItems: Campaign[], currency: string, campaign?: Campaign) => {
    const total = portfolioMetrics(items)[0], old = portfolioMetrics(oldItems)[0];
    if (!total) return null;
    const networks = [...new Set(items.map(item=>item.platform || "META_ADS"))];
    const active = items.filter(item=>item.status === "ACTIVE").length;
    const urls = [...new Set(items.map(item=>item.landingPageUrl).filter((url): url is string => !!url))];
    const metric = (key: "dailyBudget"|"impressions"|"clicks"|"ctr"|"cpc"|"leads"|"spend"|"remainingBudget", format: (value:number)=>string, tone:string, inverse=false) => <td><span className={`simple-value ${tone}`}><CompiledMetric current={total[key]} previous={previousAvailable && old ? old[key] : null} format={format} inverse={inverse} neutralTrend={key === "spend" || key === "dailyBudget" || key === "remainingBudget"}/></span></td>;
    return <tr className={campaign ? "simple-campaign-row" : "simple-client-row"} key={campaign ? `${campaign.platform}:${campaign.id}` : currency} onClick={event=>{if(!campaign && !(event.target as HTMLElement).closest('button,a,[role="button"]') && !window.getSelection()?.toString())setOpen(value=>!value)}}>
      <td>{campaign ? <span className="simple-child-name"><span>↳</span><b>{campaign.name}</b></span> : <div className="simple-client-name"><button type="button" className="simple-expand" aria-expanded={open} aria-label={`Campanhas de ${name}`} onClick={()=>setOpen(value=>!value)}><ChevronDown/></button><span><b>{name}</b><small>{items.length} campanhas · {currency}</small></span></div>}</td>
      <td><span className="simple-campaign-type">{[...new Set(items.map(campaignTypeLabel))].join(" · ")}</span></td>
      <td><span className="simple-campaign-objective">{[...new Set(items.map(campaignObjectiveLabel))].join(" · ")}</span></td>
      <td><span className="portfolio-network-list">{networks.map(network=><span key={network} className="portfolio-network-icon" role="img" aria-label={network === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"}>{network === "GOOGLE_ADS" ? <GoogleAdsLogo/> : <MetaLogo/>}</span>)}</span></td>
      <td><span className={`simple-status ${active ? "active" : "inactive"}`}>{active===items.length ? "Ativa" : active ? "Misto" : "Inativa"}</span></td>
      <td>{urls.length ? urls.map(url=><LandingPageIcon key={url} url={url} status={items.some(item=>item.landingPageUrl===url && item.landingPageStatus==="INACTIVE") ? "INACTIVE" : items.filter(item=>item.landingPageUrl===url).every(item=>item.landingPageStatus==="ACTIVE") ? "ACTIVE" : "UNKNOWN"}/>) : <LandingPageIcon/>}</td>
      {metric("dailyBudget",value=>money(value,currency),"simple-money")}{metric("impressions",number,"simple-volume")}{metric("clicks",number,"simple-clicks")}{metric("ctr",value=>`${number(value,2)}%`,"simple-rate")}{metric("cpc",value=>money(value,currency),"simple-rate",true)}{metric("leads",number,"simple-rate")}{metric("spend",value=>money(value,currency),"simple-money")}{metric("remainingBudget",value=>money(value,currency),"simple-volume")}
      <td><CompiledMetric current={averageScore(items)} previous={old ? averageScore(oldItems) : null} format={value=>`${number(value)} / 100`}/></td>
      <td><span className="simple-responsible"><ResponsibleAvatar user={group.responsible}/><span>{group.responsible?.name || "Não atribuído"}</span></span></td>
      <td><button type="button" className="campaign-analyze" onClick={()=>campaign ? onAnalyze(campaign) : setOpen(value=>!value)}>{campaign ? "Analisar" : open ? "Recolher" : "Comparar"}</button></td>
    </tr>;
  };
  return <article className={`simple-client-table ${open ? "open" : ""}`}><div className="simple-table-scroll"><table><colgroup><col className="simple-name-column"/>{Array.from({length:16},(_,index)=><col key={index}/>)}</colgroup><thead><tr>{["Cliente / campanha","Tipo","Objetivo","Rede","Status","Landing page","Inv. diário","Impressões","Cliques","CTR","CPC","Conversões","Custo","Saldo","Score","Responsável","Análise"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{[...new Set(current.map(item=>item.currency))].map(currency=>renderRow(current.filter(item=>item.currency===currency),previous.filter(item=>item.currency===currency),currency))}{open && campaignRows.map(item=>{const old=previousById.get(`${item.platform}:${item.accountId}:${item.id}`);return renderRow([item],old && old.currency===item.currency ? [old] : [],item.currency,item)})}</tbody></table></div></article>;
}

function CompiledReport({ campaigns, groups, platform, since, until, onSinceChange, onUntilChange, onPlatformChange, onAnalyze }: {
  onAnalyze: (campaign: Campaign) => void;
  campaigns: CompiledCampaign[];
  groups: ClientGroup[];
  platform: MediaView;
  since: string;
  until: string;
  onSinceChange: (value: string) => void;
  onUntilChange: (value: string) => void;
  onPlatformChange: (value: MediaView) => void;
}) {
  const comparisonCache = useRef(new Map<string, { campaigns: Campaign[]; cachedAt: number }>());
  const periodLength = Math.max(1, Math.round((new Date(`${until}T12:00`).getTime() - new Date(`${since}T12:00`).getTime()) / 86400000) + 1),
    previousUntilDefault = iso(new Date(new Date(`${since}T12:00`).getTime() - 86400000)),
    previousSinceDefault = iso(new Date(new Date(`${since}T12:00`).getTime() - periodLength * 86400000));
  const [previousSince, setPreviousSince] = useState(previousSinceDefault),
    [previousUntil, setPreviousUntil] = useState(previousUntilDefault),
    [previousCampaigns, setPreviousCampaigns] = useState<Campaign[]>([]),
    [portfolioSearch, setPortfolioSearch] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState<20 | 40 | 60 | 80 | 100>(20),
    [loadingComparison, setLoadingComparison] = useState(false),
    [comparisonError, setComparisonError] = useState(""),
    [selectedPortfolio, setSelectedPortfolio] = useState("ALL");
  useEffect(() => {
    if (!groups.length) return;
    if (selectedPortfolio !== "ALL" && !groups.some((group) => group.key === selectedPortfolio)) setSelectedPortfolio("ALL");
  }, [groups, selectedPortfolio]);
  useEffect(() => { setPage(1); }, [search, platform, selectedPortfolio, since, until, previousSince, previousUntil, pageSize]);
  useEffect(() => {
    if (!campaigns.length) { setPreviousCampaigns([]); setLoadingComparison(false); return; }
    let cancelled = false;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(255_000)]);
    const cacheKey = `${platform}:${previousSince}:${previousUntil}`;
    const cached = comparisonCache.current.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < 60_000) {
      setPreviousCampaigns(cached.campaigns); setComparisonError(""); setLoadingComparison(false);
      return () => controller.abort();
    }
    const loadComparison = async () => {
      setLoadingComparison(true);
      setPreviousCampaigns([]);
      setComparisonError("");
      try {
        const providers = platform === "ALL" ? (["META_ADS", "GOOGLE_ADS"] as const) : ([platform] as ("META_ADS" | "GOOGLE_ADS")[]),
          results = await Promise.all(providers.map(async (source) => {
            let response = await fetch(`/api/media/history?platform=${source}&since=${previousSince}&until=${previousUntil}`, { signal }), payload = await response.json();
            if (response.status === 404) {
              const result = await requestMediaPeriod(`/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${previousSince}&until=${previousUntil}&comparison=1`, signal);
              response = result.response; payload = result.payload;
            }
            if (!response.ok) throw new Error(payload.message || `Não foi possível comparar ${source === "META_ADS" ? "Meta" : "Google"}.`);
            return (payload.campaigns || []).map((campaign: Campaign) => ({ ...campaign, platform: source }));
          }));
        if (!cancelled) {
          const campaigns = results.flat();
          comparisonCache.current.set(cacheKey, { campaigns, cachedAt: Date.now() });
          while (comparisonCache.current.size > 4) comparisonCache.current.delete(comparisonCache.current.keys().next().value!);
          setPreviousCampaigns(campaigns);
        }
      } catch (cause) {
        if (!cancelled) setComparisonError(cause instanceof Error ? cause.message : "Não foi possível carregar o período comparativo.");
      } finally { if (!cancelled) setLoadingComparison(false); }
    };
    void loadComparison();
    return () => { cancelled = true; controller.abort(); };
  }, [platform, previousSince, previousUntil, campaigns.length]);
  const comparisonGroups = groups.filter(group => (selectedPortfolio === "ALL" || group.key === selectedPortfolio) && `${group.client?.name || accountLabel(group.account)} ${group.campaigns.map(item => item.name).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => (a.client?.name || accountLabel(a.account)).localeCompare(b.client?.name || accountLabel(b.account), "pt-BR", { sensitivity: "base", numeric: true })),
    totalPages = Math.max(1, Math.ceil(comparisonGroups.length / pageSize)),
    safePage = Math.min(page,totalPages),
    paginatedGroups = comparisonGroups.slice((safePage - 1) * pageSize, safePage * pageSize);
  return <section className="compiled-report comparison-by-portfolio simple-comparison">
    <header className="compiled-heading"><div><small>COMPARAÇÃO POR PORTFÓLIO</small><h2>Performance entre períodos</h2><p>Escolha dois intervalos e consulte cada portfólio com a mesma lógica da Gestão de mídia.</p></div><span>{groups.length} portfólios</span></header>
    <MediaPlatformSwitch platform={platform} onPlatformChange={onPlatformChange} metaDetail="Comparar campanhas da Meta" googleDetail="Comparar campanhas do Google" />
    <section className="compiled-periods">
      <div><small>PERÍODO ATUAL</small><label><CalendarDays /><input type="date" value={since} max={until} onChange={(event) => onSinceChange(event.target.value)} /><span>até</span><input type="date" value={until} min={since} onChange={(event) => onUntilChange(event.target.value)} /></label></div>
      <i>comparar com</i>
      <div><small>PERÍODO ANTERIOR</small><label><CalendarDays /><input type="date" value={previousSince} max={previousUntil} onChange={(event) => setPreviousSince(event.target.value)} /><span>até</span><input type="date" value={previousUntil} min={previousSince} onChange={(event) => setPreviousUntil(event.target.value)} /></label></div>
    </section>
    <div className="comparison-simple-filters"><label><Building2/><select aria-label="Cliente para comparação" value={selectedPortfolio} onChange={event => setSelectedPortfolio(event.target.value)}><option value="ALL">Todos os clientes</option>{groups.map(group => <option key={group.key} value={group.key}>{group.client?.name || accountLabel(group.account)}</option>)}</select></label><label><Search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente ou campanha…"/></label><span role="status">{loadingComparison ? "Atualizando período anterior…" : "Atual · variação · anterior"}</span></div>
    {comparisonError && <div className="traffic-error"><AlertTriangle /><div><b>Comparação indisponível</b><p>{comparisonError}</p></div></div>}
    {paginatedGroups.map(group => <ComparisonClientRows key={group.key} group={group} previousCampaigns={previousCampaigns} previousAvailable={!loadingComparison && !comparisonError} search={search} onAnalyze={onAnalyze}/>)}
    {!comparisonGroups.length && <div className="panel inline-empty"><Search/><h3>Nenhum cliente encontrado</h3><p>Ajuste os filtros da comparação.</p></div>}
    <footer className="campaign-pagination compiled-pagination">
      <span>Exibindo {comparisonGroups.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, comparisonGroups.length)} de {comparisonGroups.length} clientes</span>
      <label>Por página<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value) as 20 | 40 | 60 | 80 | 100)}>{[20,40,60,80,100].map((size) => <option value={size} key={size}>{size}</option>)}</select></label>
      <nav aria-label="Paginação do compilado"><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página <b>{safePage}</b> de {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</button></nav>
    </footer>
  </section>;
}

function CampaignReport({
  campaigns,
  groups,
  clients,
  assignments,
  periodDays,
  since,
  until,
  allPlatforms,
  onClientReportSelected,
  reportsOnly = false,
  initialClientId = "",
  includeThirtyDaySummary = false,
  automaticPreview = null,
  onAutomaticPreviewDone,
  onAnalysisClosed,
}: {
  campaigns: Array<Campaign & { groupName: string }>;
  groups: ClientGroup[];
  clients: Client[];
  assignments: Assignment[];
  periodDays: number;
  since: string;
  until: string;
  allPlatforms: boolean;
  onClientReportSelected: () => void;
  reportsOnly?: boolean;
  initialClientId?: string;
  includeThirtyDaySummary?: boolean;
  automaticPreview?: { id: number; clientId: string; target: Window } | null;
  onAutomaticPreviewDone?: () => void;
  onAnalysisClosed?: () => void;
}) {
  const userId = useContext(MediaUserContext);
  const tableRef = useRef<HTMLDivElement>(null);
  const [previousCampaigns, setPreviousCampaigns] = useState<Campaign[]>([]);
  const persistedFilters = savedCampaignFilters(userId);
  const tablePreferences = savedCampaignTablePreferences(userId);
  const [search, setSearch] = useState(() => persistedFilters.search || ""),
    [objective, setObjective] = useState(() => persistedFilters.objective || "ALL"),
    [clientId, setClientId] = useState(() => initialClientId || new URLSearchParams(window.location.search).get("reportClient") || persistedFilters.clientId || "ALL"),
    [portfolio, setPortfolio] = useState(() => persistedFilters.portfolio || "ALL"),
    [scope, setScope] = useState<"ACTIVE" | "INACTIVE" | "ALL">(() => (persistedFilters.scope as "ACTIVE" | "INACTIVE" | "ALL") || "ACTIVE"),
    [health, setHealth] = useState<"ALL" | "NEEDS_ATTENTION" | "GOOD" | "WARNING" | "CRITICAL">(() => (persistedFilters.health as "ALL" | "NEEDS_ATTENTION" | "GOOD" | "WARNING" | "CRITICAL") || "ALL"),
    [review, setReview] = useState<"ALL" | "PENDING">(() => (persistedFilters.review as "ALL" | "PENDING") || "ALL"),
    [metricFocus, setMetricFocus] = useState<MediaMetricFocus>(() => (persistedFilters.metricFocus as MediaMetricFocus) || "ALL"),
    [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("campaign")),
    [showInsights, setShowInsights] = useState(false),
    [reportGenerating, setReportGenerating] = useState<"CLIENT" | "OPERATION" | null>(null),
    [reportAiNotice, setReportAiNotice] = useState(""),
    [compactTable, setCompactTable] = useState(tablePreferences.compact ?? false),
    [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]),
    [visibleMetrics, setVisibleMetrics] = useState({ balance: true, impressions: true, clicks: true, ctr: true, review: true }),
    [, setVerificationRevision] = useState(0),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState<20 | 40 | 60 | 80 | 100>(20),
    [sort, setSort] = useState<"spend" | "lowest_spend" | "leads" | "fewest_leads" | "score" | "worst_score" | "cpl" | "highest_cpl">(() => (persistedFilters.sort as "spend" | "lowest_spend" | "leads" | "fewest_leads" | "score" | "worst_score" | "cpl" | "highest_cpl") || "spend");
  useEffect(() => {
    if (reportsOnly) return;
    let cancelled = false;
    const days = Math.max(1, Math.round((new Date(`${until}T12:00`).getTime() - new Date(`${since}T12:00`).getTime()) / 86400000) + 1), previousEnd = new Date(`${since}T12:00`), previousStart = new Date(`${since}T12:00`);
    previousEnd.setDate(previousEnd.getDate() - 1); previousStart.setDate(previousStart.getDate() - days);
    const providers = [...new Set(campaigns.map((item) => item.platform || "META_ADS"))];
    void Promise.all(providers.map(async (source) => { const response = await fetch(`/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${iso(previousStart)}&until=${iso(previousEnd)}`), payload = await response.json(); return response.ok ? (payload.campaigns || []).map((item: Campaign) => ({ ...item, platform: source })) : []; })).then((result) => { if (!cancelled) setPreviousCampaigns(result.flat()); });
    return () => { cancelled = true; };
  }, [campaigns.length, since, until, reportsOnly]);
  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollLeft = 0;
    setPage(1);
  }, [search, objective, clientId, portfolio, scope, health, review, sort]);
  useEffect(() => {
    if (reportsOnly) return;
    try {
      localStorage.setItem(mediaPreferenceKey(userId, "pw-os-campaign-filters"), JSON.stringify({ search, objective, clientId, portfolio, scope, health, review, metricFocus, sort }));
    } catch {
      // A tela continua funcional mesmo sem persistência das preferências.
    }
  }, [search, objective, clientId, portfolio, scope, health, review, metricFocus, sort, reportsOnly]);
  useEffect(() => {
    if (reportsOnly) return;
    try {
      localStorage.setItem(mediaPreferenceKey(userId, "pw-os-campaign-table-preferences"), JSON.stringify({ compact: compactTable, visibleMetrics }));
    } catch {
      // A tela continua funcional mesmo sem persistência das preferências.
    }
  }, [compactTable, visibleMetrics, reportsOnly]);
  const enrichedCampaigns = campaigns
    .map((item) => {
      const group = groups.find((value) =>
        value.accounts.some((account) => account.id === item.accountId),
      ), exactAssignment = assignments.find((assignment) => assignment.platform === (item.platform || "META_ADS") && assignment.accountId === item.accountId),
        exactClient = clients.find((client) => client.id === exactAssignment?.clientId);
      return {
        ...item,
        score: campaignScore(item),
        clientId: exactClient?.id || group?.client?.id || "",
        clientName: exactClient?.name || group?.client?.name || "Cliente não vinculado",
        portfolioName: group ? accountLabel(group.account) : item.groupName,
        responsible: group?.responsible?.name || "Não atribuído",
        balance: item.remainingBudget != null ? Math.max(0, item.remainingBudget) : group?.account.remainingBudget != null ? Math.max(0, group.account.remainingBudget) : 0,
        balanceAvailable: item.remainingBudget != null || group?.account.remainingBudget != null,
        balanceSource: item.remainingBudget != null ? "CAMPAIGN" : group?.account.remainingBudget != null ? "ACCOUNT" : "NONE",
      };
    });
  const rows = enrichedCampaigns
    .filter(
      (item) =>
        (clientId === "ALL" || item.clientId === clientId) &&
        (scope === "ALL" || (scope === "ACTIVE" ? item.status === "ACTIVE" : item.status !== "ACTIVE")) &&
        (health === "ALL" ||
          (health === "NEEDS_ATTENTION" && item.score >= 0 && item.score < 90) ||
          (health === "GOOD" && item.score >= 90) ||
          (health === "WARNING" && item.score >= 70 && item.score < 90) ||
          (health === "CRITICAL" && item.score >= 0 && item.score < 70)) &&
        (portfolio === "ALL" || item.portfolioName === portfolio) &&
        (objective === "ALL" || item.objective === objective) &&
        (review === "ALL" || verificationDue(item)) &&
        matchesMediaMetric(metricFocus, item) &&
        `${item.name} ${item.groupName} ${item.responsible}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "leads"
        ? b.leads - a.leads
        : sort === "fewest_leads"
          ? a.leads - b.leads
        : sort === "score"
          ? b.score - a.score
          : sort === "worst_score"
            ? a.score - b.score
          : sort === "cpl"
            ? (a.cpl ?? Infinity) - (b.cpl ?? Infinity)
            : sort === "highest_cpl"
              ? (b.cpl ?? -Infinity) - (a.cpl ?? -Infinity)
              : sort === "lowest_spend"
                ? a.spend - b.spend
            : b.spend - a.spend,
    );
  const pendingReviewCount = enrichedCampaigns.filter((item) =>
      (clientId === "ALL" || item.clientId === clientId) &&
      (portfolio === "ALL" || item.portfolioName === portfolio) &&
      (scope === "ALL" || (scope === "ACTIVE" ? item.status === "ACTIVE" : item.status !== "ACTIVE")) &&
      verificationDue(item),
    ).length,
    advancedFilterCount = Number(scope !== "ACTIVE") + Number(health !== "ALL") + Number(objective !== "ALL") + Number(sort !== "spend"),
    clientOptions = clients.map((client) => [client.id, client.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    objectives = [...new Set(campaigns.map((item) => item.objective))],
    portfolios = [...new Set(enrichedCampaigns.filter((item) => clientId === "ALL" || item.clientId === clientId).map((item) => item.portfolioName))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    scoredRows = rows.filter((item) => item.score >= 0),
    averageScore = scoredRows.length
      ? Math.round(
          scoredRows.reduce((sum, item) => sum + item.score, 0) /
            scoredRows.length,
        )
      : -1,
    total = rows.reduce(
      (sum, item) => ({
        spend: sum.spend + item.spend,
        impressions: sum.impressions + item.impressions,
        clicks: sum.clicks + item.clicks,
        leads: sum.leads + item.leads,
        budget: sum.budget + (item.lifetimeBudget > 0 ? item.lifetimeBudget : item.dailyBudget * periodDays),
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0, budget: 0 },
    );
  const selected = enrichedCampaigns.find((item) => `${item.platform}:${item.accountId}:${item.id}` === selectedId) || null;
  const currentKeys = new Set(rows.map((item) => `${item.platform}:${item.accountId}:${item.id}`)), previousRows = previousCampaigns.filter((item) => currentKeys.has(`${item.platform}:${item.accountId}:${item.id}`)),
    previousTotal = previousRows.reduce((sum, item) => ({ spend: sum.spend + item.spend, leads: sum.leads + item.leads }), { spend: 0, leads: 0 }),
    percentChange = mediaPercentChange;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize)),
    safePage = Math.min(page, totalPages),
    paginatedRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const best = [...scoredRows].sort((a, b) => b.score - a.score).slice(0, 5),
    alerts = rows.filter(
      (item) =>
        (item.score >= 0 && item.score < 70) || item.status === "WITH_ISSUES",
    );
  const activeClientReportRows = enrichedCampaigns.filter((item) => item.clientId === clientId && item.status === "ACTIVE");
  const exportClientPdf = async (mode: "preview" | "download" = "download", previewTarget?: Window, audience: "CLIENT" | "OPERATION" = "CLIENT") => {
    const clientName = clientOptions.find(([id]) => id === clientId)?.[1];
    if (!clientName || !activeClientReportRows.length) return;
    let aiInsight: { summary: string; priorities: string[]; risks: string[]; experiments: string[]; generatedAt: string; model: string } | null = null;
    if (audience === "OPERATION") {
      setReportAiNotice("");
      try {
        const insightResponse = await fetch("/api/media/ai-insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientName, since, until, campaigns: activeClientReportRows.map((item) => ({ name: item.name, platform: item.platform, status: item.status, objective: item.objective, spend: item.spend, impressions: item.impressions, clicks: item.clicks, leads: item.leads, cpl: item.cpl, score: item.score })) }) }), insightPayload = await insightResponse.json();
        if (!insightResponse.ok) { setReportAiNotice(insightPayload.message || "Não foi possível gerar os insights da operação."); return; }
        aiInsight = insightPayload.insight;
        setReportAiNotice(insightPayload.cached ? "Insights reutilizados do cache — nenhum token adicional consumido." : "Insights gerados e armazenados para reutilização sem novo consumo.");
      } catch { setReportAiNotice("Falha de conexão com o serviço de IA. O PDF do cliente continua disponível."); return; }
    }
    const { jsPDF } = await import("jspdf"), doc = new jsPDF({ unit: "mm", format: "a4" }),
      portfolioNames = [...new Set(activeClientReportRows.map((item) => item.portfolioName))],
      totalSpend = activeClientReportRows.reduce((sum, item) => sum + item.spend, 0),
      totalImpressions = activeClientReportRows.reduce((sum, item) => sum + item.impressions, 0),
      totalClicks = activeClientReportRows.reduce((sum, item) => sum + item.clicks, 0),
      totalLeads = activeClientReportRows.reduce((sum, item) => sum + item.leads, 0),
      reportCpl = totalLeads ? totalSpend / totalLeads : 0;
    doc.setFillColor(250, 252, 254); doc.rect(0, 0, 210, 52, "F"); doc.setFillColor(9, 36, 58); doc.rect(0, 0, 210, 4, "F");
    try {
      const logoResponse = await fetch("/logo-pw-os.png"), logoBlob = await logoResponse.blob(), logoData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(logoBlob); });
      doc.addImage(logoData, "PNG", 15, 7, 26, 12);
    } catch { /* O título textual preserva a identificação caso o ativo não carregue. */ }
    doc.setTextColor(93, 112, 132); doc.setFontSize(7); doc.text("RELATÓRIO DE PERFORMANCE", 47, 14);
    doc.setTextColor(18, 39, 59); doc.setFontSize(20); doc.text(clientName.slice(0, 55), 15, 30);
    doc.setFontSize(8); doc.setTextColor(105, 122, 141); doc.text(`${shortDate(since)} a ${shortDate(until)}   ·   ${portfolioNames.length} portfólio(s)   ·   ${activeClientReportRows.length} campanha(s) ativas`, 15, 41);
    [["INVESTIMENTO", money(totalSpend)], ["IMPRESSÕES", number(totalImpressions)], ["CLIQUES", number(totalClicks)], ["CONVERSÕES", number(totalLeads)], ["CPL MÉDIO", reportCpl ? money(reportCpl) : "—"]].forEach(([label, value], index) => {
      const x = 14 + index * 37; doc.setDrawColor(224, 230, 236); if(index) doc.line(x - 3, 62, x - 3, 80);
      doc.setTextColor(112, 128, 146); doc.setFontSize(5.5); doc.text(label, x, 67); doc.setTextColor(18, 39, 59); doc.setFontSize(11); doc.text(value, x, 77);
    });
    const reportScores = activeClientReportRows.map((item) => item.score).filter((score) => score >= 0),
      reportScore = reportScores.length ? Math.round(reportScores.reduce((sum, score) => sum + score, 0) / reportScores.length) : -1,
      reportCtr = totalImpressions ? totalClicks / totalImpressions * 100 : 0,
      reportConversion = totalClicks ? totalLeads / totalClicks * 100 : 0,
      health = { good: reportScores.filter((score) => score >= 90).length, warning: reportScores.filter((score) => score >= 70 && score < 90).length, critical: reportScores.filter((score) => score < 70).length },
      portfolioData = portfolioNames.map((name) => {
        const items = activeClientReportRows.filter((item) => item.portfolioName === name), spend = items.reduce((sum, item) => sum + item.spend, 0), leads = items.reduce((sum, item) => sum + item.leads, 0), scores = items.map((item) => item.score).filter((score) => score >= 0);
        return { name, items, spend, leads, cpl: leads ? spend / leads : 0, score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : -1 };
      }).sort((a, b) => b.spend - a.spend);
    doc.setTextColor(24, 39, 57); doc.setFontSize(12); doc.text("Resultados do período", 14, 101);
    doc.setFontSize(8); doc.setTextColor(92, 108, 126); doc.text("Uma visão objetiva do alcance, interesse e resultados gerados pelas campanhas.", 14, 108);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 238); doc.roundedRect(14, 116, 56, 53, 2, 2, "FD");
    doc.setDrawColor(47,126,202); doc.setLineWidth(4); doc.circle(42, 139, 15, "S"); doc.setLineWidth(.2); doc.setTextColor(24,39,57); doc.setFontSize(18); doc.text(number(totalLeads), 42, 142, { align:"center" }); doc.setFontSize(7); doc.setTextColor(92,108,126); doc.text("CONVERSÕES", 42, 162, { align:"center" });
    doc.setFillColor(255,255,255); doc.setDrawColor(226,232,238); doc.roundedRect(76,116,120,53,2,2,"FD");
    [["CTR", reportCtr, Math.min(100, reportCtr / 3 * 100), [47,126,202]], ["Conversão clique → lead", reportConversion, Math.min(100, reportConversion / 12 * 100), [53,151,113]]].forEach(([label, raw, progress, color], index) => { const y = 127 + index * 20, rgb = color as number[]; doc.setTextColor(70,88,108); doc.setFontSize(7); doc.text(String(label),82,y); doc.setTextColor(24,39,57); doc.setFontSize(9); doc.text(`${number(Number(raw),2)}%`,190,y,{align:"right"}); doc.setFillColor(228,234,240); doc.roundedRect(82,y+4,108,5,2.5,2.5,"F"); doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.roundedRect(82,y+4,Math.max(2,108*Number(progress)/100),5,2.5,2.5,"F"); });
    doc.setTextColor(24,39,57); doc.setFontSize(11); doc.text("Panorama das campanhas",14,184);
    [["Destaques",health.good,[42,157,108]],["Em acompanhamento",health.warning,[47,126,202]],["Em otimização",health.critical,[104,122,143]]].forEach(([label,value,color],index)=>{const x=14+index*61.5,rgb=color as number[];doc.setDrawColor(226,232,238);if(index)doc.line(x-3,192,x-3,215);doc.setFillColor(rgb[0],rgb[1],rgb[2]);doc.circle(x+2,199,1.5,"F");doc.setTextColor(90,106,124);doc.setFontSize(7);doc.text(String(label),x+7,201);doc.setTextColor(24,39,57);doc.setFontSize(14);doc.text(String(value),x,213);});
    doc.setTextColor(24,39,57);doc.setFontSize(11);doc.text("Destaques e próximos passos",14,234);
    const executiveInsights = [totalLeads ? `As campanhas geraram ${number(totalLeads)} conversões, com CPL médio de ${money(reportCpl)}.` : `As campanhas alcançaram ${number(totalImpressions)} impressões e ${number(totalClicks)} cliques no período.`, `Os anúncios registraram CTR médio de ${number(reportCtr,2)}% e conversão de ${number(reportConversion,2)}%.`, health.critical ? `${health.critical} campanha(s) seguem em otimização para ampliar a eficiência nos próximos ciclos.` : "O conjunto de campanhas mantém evolução acompanhada continuamente pela equipe."];
    executiveInsights.forEach((text,index)=>{const y=244+index*13;doc.setFillColor(index===0?42:47,index===0?157:126,index===0?108:202);doc.circle(17,y-1,1.5,"F");doc.setTextColor(67,84,103);doc.setFontSize(8);doc.text(doc.splitTextToSize(text,172),22,y);});

    doc.addPage(); doc.setFillColor(9,36,58); doc.rect(0,0,210,38,"F"); doc.setTextColor(255,255,255); doc.setFontSize(17); doc.text("Performance por portfólio",14,19); doc.setFontSize(8);doc.setTextColor(190,209,223);doc.text("Investimento, conversões e eficiência organizados por frente de campanha.",14,28);
    let portfolioY=50, maxPortfolioSpend=Math.max(1,...portfolioData.map((item)=>item.spend));
    portfolioData.forEach((item,index)=>{if(portfolioY>270){doc.addPage();portfolioY=24;}const status=item.score>=90?"Destaque":item.score>=70?"Acompanhando":"Otimizando",tone=item.score>=90?[42,157,108]:item.score>=70?[47,126,202]:[104,122,143];doc.setDrawColor(226,232,238);doc.line(14,portfolioY+31,196,portfolioY+31);doc.setFillColor(tone[0],tone[1],tone[2]);doc.circle(17,portfolioY+7,1.5,"F");doc.setTextColor(24,39,57);doc.setFontSize(9);doc.text(`${index+1}. ${item.name.slice(0,60)}`,21,portfolioY+9);doc.setTextColor(103,119,137);doc.setFontSize(6.5);doc.text(`${item.items.length} campanha(s) ativa(s)`,21,portfolioY+16);doc.setFillColor(233,238,243);doc.roundedRect(21,portfolioY+22,75,3,1.5,1.5,"F");doc.setFillColor(48,126,202);doc.roundedRect(21,portfolioY+22,Math.max(2,75*item.spend/maxPortfolioSpend),3,1.5,1.5,"F");doc.setTextColor(94,110,128);doc.setFontSize(5.5);doc.text("INVESTIMENTO",105,portfolioY+9);doc.text("CONVERSÕES",137,portfolioY+9);doc.text("CPL",169,portfolioY+9,{align:"right"});doc.text("MOMENTO",190,portfolioY+9,{align:"right"});doc.setTextColor(24,39,57);doc.setFontSize(8.5);doc.text(money(item.spend),105,portfolioY+18);doc.text(number(item.leads),137,portfolioY+18);doc.text(item.cpl?money(item.cpl):"—",169,portfolioY+18,{align:"right"});doc.setTextColor(tone[0],tone[1],tone[2]);doc.setFontSize(6);doc.text(status,190,portfolioY+18,{align:"right"});portfolioY+=36;});

    doc.addPage(); doc.setFillColor(9,36,58); doc.rect(0,0,210,38,"F"); doc.setTextColor(255,255,255); doc.setFontSize(17); doc.text("Detalhamento das campanhas",14,19);doc.setFontSize(8);doc.setTextColor(190,209,223);doc.text("Somente campanhas ativas · valores referentes ao período selecionado",14,28);
    let y = 48;
    const header = () => { doc.setFillColor(235, 242, 248); doc.rect(14, y, 182, 9, "F"); doc.setTextColor(76, 94, 114); doc.setFontSize(5.5); doc.text("PORTFÓLIO / CAMPANHA", 17, y + 6); doc.text("PLATAFORMA", 98, y + 6); doc.text("INVESTIMENTO", 139, y + 6, { align:"right" }); doc.text("CLIQUES", 157, y + 6, { align:"right" }); doc.text("CONV.", 174, y + 6, { align:"right" }); doc.text("CPL", 194, y + 6, { align:"right" }); y += 9; };
    header();
    activeClientReportRows.forEach((item) => {
      if (y > 277) { doc.addPage(); y = 18; header(); }
      doc.setDrawColor(231, 236, 241); doc.line(14, y + 10, 196, y + 10); doc.setTextColor(31, 47, 65); doc.setFontSize(7);
      doc.text(item.portfolioName.slice(0, 43), 17, y + 4); doc.setTextColor(110, 125, 142); doc.setFontSize(6); doc.text(item.name.slice(0, 57), 17, y + 8);
      doc.setTextColor(55, 72, 91); doc.setFontSize(6.5); doc.text(item.platform === "META_ADS" ? "Meta" : "Google", 98, y + 6); doc.text(money(item.spend, item.currency), 139, y + 6, { align:"right" }); doc.text(number(item.clicks), 157, y + 6, { align:"right" }); doc.text(number(item.leads), 174, y + 6, { align:"right" }); doc.text(item.cpl == null ? "—" : money(item.cpl, item.currency), 194, y + 6, { align:"right" }); y += 11;
    });
    if (audience === "OPERATION" && aiInsight) {
      doc.addPage(); doc.setFillColor(247,250,252); doc.rect(0,0,210,297,"F"); doc.setFillColor(9,36,58); doc.rect(0,0,210,40,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(17); doc.text("Diagnóstico da operação",14,19); doc.setTextColor(190,209,223); doc.setFontSize(8); doc.text("Insights gerados por IA para uso interno · validar antes de executar",14,29);
      doc.setTextColor(24,39,57); doc.setFontSize(11); doc.text("Resumo executivo",14,54); doc.setFillColor(255,255,255); doc.setDrawColor(224,231,237); const summaryLines = doc.splitTextToSize(aiInsight.summary,170); const summaryHeight = Math.max(22, 12 + summaryLines.length * 4); doc.roundedRect(14,61,182,summaryHeight,3,3,"FD"); doc.setTextColor(67,84,103); doc.setFontSize(8); doc.text(summaryLines,20,70);
      let insightY = 61 + summaryHeight + 14;
      const renderInsightGroup = (title: string, items: string[], color: number[]) => { doc.setTextColor(24,39,57); doc.setFontSize(10); doc.text(title,14,insightY); insightY += 7; items.forEach((item,index) => { const lines = doc.splitTextToSize(item,164), height = Math.max(13, 7 + lines.length * 4); if (insightY + height > 274) { doc.addPage(); doc.setFillColor(247,250,252); doc.rect(0,0,210,297,"F"); insightY = 18; } doc.setFillColor(255,255,255); doc.setDrawColor(228,233,238); doc.roundedRect(14,insightY,182,height,2,2,"FD"); doc.setFillColor(color[0],color[1],color[2]); doc.circle(20,insightY+height/2,2,"F"); doc.setTextColor(61,78,97); doc.setFontSize(8); doc.text(lines,27,insightY+7); doc.setTextColor(128,142,156); doc.setFontSize(6); doc.text(String(index+1).padStart(2,"0"),190,insightY+7,{align:"right"}); insightY += height+5; }); insightY += 7; };
      renderInsightGroup("Prioridades recomendadas", aiInsight.priorities, [47,126,202]);
      renderInsightGroup("Riscos para acompanhar", aiInsight.risks, [210,105,57]);
      renderInsightGroup("Testes sugeridos", aiInsight.experiments, [45,151,108]);
      if (insightY < 278) { doc.setTextColor(126,140,154); doc.setFontSize(6.5); doc.text(`Modelo: ${aiInsight.model} · Gerado em ${new Date(aiInsight.generatedAt).toLocaleString("pt-BR")}`,14,283); }
    }
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) { doc.setPage(page); doc.setFontSize(6); doc.setTextColor(130, 143, 157); doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Página ${page} de ${pages}`, 105, 290, { align: "center" }); }
    const reportDate = shortDate(until).replaceAll("/", "-"),
      filename = `${audience === "OPERATION" ? "Relatório Ops" : "Relatório"} (${safePdfNamePart(clientName)}) - ${reportDate}`;
    try {
      if (audience === "CLIENT") await fetch("/api/client-report-artifacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, fileName: `${filename}.pdf`, dataUrl: doc.output("datauristring"), since, until, mode }) });
    } catch { /* O PDF continua disponível mesmo se o registro da versão falhar. */ }
    if (mode === "preview") {
      const pdfUrl = String(doc.output("bloburl"));
      if (previewTarget && !previewTarget.closed) previewTarget.location.href = pdfUrl;
      else window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
    else doc.save(`${filename}.pdf`);
  };
  useEffect(() => {
    if (!automaticPreview || !allPlatforms) return;
    if (clientId !== automaticPreview.clientId) {
      setClientId(automaticPreview.clientId);
      setPortfolio("ALL");
      return;
    }
    if (clientId !== "ALL" && activeClientReportRows.length) {
      void exportClientPdf("preview", automaticPreview.target).finally(() => onAutomaticPreviewDone?.());
      return;
    }
    const timeout = window.setTimeout(() => {
      if (!automaticPreview.target.closed) automaticPreview.target.document.body.innerHTML = '<main style="font:16px system-ui;padding:40px;color:#17324d"><b>Não foi possível gerar o relatório.</b><p style="color:#6b7f92">As campanhas ativas não ficaram disponíveis. Sincronize os dados e tente novamente.</p></main>';
      onAutomaticPreviewDone?.();
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [automaticPreview?.id, automaticPreview?.clientId, allPlatforms, clientId, activeClientReportRows.length]);
  const reportBuilder = <section className="client-report-builder">
    <div><span><FileBarChart /></span><div><small>GERADOR DE PDF</small><h3>Relatório consolidado por cliente</h3><p>Reúne somente campanhas ativas de todos os portfólios Meta e Google vinculados.</p></div></div>
    <div className="client-report-builder-actions">
      <SearchableSelect value={clientId} onChange={(value) => { setClientId(value); setPortfolio("ALL"); if (value !== "ALL" && !allPlatforms) onClientReportSelected(); }} options={[{ value: "ALL", label: "Escolha um cliente" }, ...clientOptions.map(([id, name]) => ({ value: id, label: name }))]} placeholder="Cliente do relatório" searchPlaceholder="Buscar cliente…" emptyMessage="Nenhum cliente com portfólio vinculado." />
      <button type="button" className="preview-report" disabled={clientId === "ALL" || !activeClientReportRows.length || !allPlatforms || reportGenerating !== null} onClick={() => void exportClientPdf("preview")}><Eye /> Visualizar cliente</button>
      <button type="button" disabled={clientId === "ALL" || !activeClientReportRows.length || !allPlatforms || reportGenerating !== null} onClick={() => { setReportGenerating("CLIENT"); void exportClientPdf("download").finally(() => setReportGenerating(null)); }}><Download /> {reportGenerating === "CLIENT" ? "Gerando…" : "PDF cliente"}</button>
      <button type="button" className="operation-report" disabled={clientId === "ALL" || !activeClientReportRows.length || !allPlatforms || reportGenerating !== null} onClick={() => { setReportGenerating("OPERATION"); void exportClientPdf("download", undefined, "OPERATION").finally(() => setReportGenerating(null)); }}><Activity /> {reportGenerating === "OPERATION" ? "Analisando…" : "PDF operação + IA"}</button>
    </div>
    {clientId !== "ALL" && <footer className={!activeClientReportRows.length ? "empty" : ""}>{activeClientReportRows.length ? <CheckCircle2 /> : <AlertTriangle />} {activeClientReportRows.length ? `Cliente: números e dados objetivos. Operação: mesma base mais diagnóstico e recomendações internas por IA. ${activeClientReportRows.length} campanha(s) ativa(s), de ${shortDate(since)} a ${shortDate(until)}.` : "Este cliente não possui campanhas ativas vinculadas. Vincule os portfólios na tela de Gestão antes de gerar o relatório."}</footer>}
    {reportAiNotice && <div className={`client-report-ai-notice ${reportAiNotice.includes("acabaram") || reportAiNotice.includes("Configure") ? "warning" : ""}`}><Activity /> {reportAiNotice}</div>}
  </section>;
  if (reportsOnly) return reportBuilder;
  const portfolioScores = groups
    .map((group) => {
      const scores = group.campaigns
        .map(campaignScore)
        .filter((score) => score >= 0);
      return {
        name: group.client?.name || accountLabel(group.account),
        score: scores.length
          ? Math.round(
              scores.reduce((sum, score) => sum + score, 0) / scores.length,
            )
          : -1,
        campaigns: scores.length,
        total: group.campaigns.length,
        campaignItems: group.campaigns,
      };
    })
    .sort((a, b) => b.score - a.score);
  const verifyCampaign = async (campaign: Campaign) => {
    const response = await fetch("/api/media/campaigns/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: campaign.platform, accountId: campaign.accountId, campaignId: campaign.id, verified: true, action: "REVIEW", score: campaignScore(campaign), spend: campaign.spend, leads: campaign.leads, cpl: campaign.cpl }),
    });
    if (response.ok) {
      const payload = await response.json();
      campaign.verified = true;
      campaign.verifiedAt = payload.verifiedAt || new Date().toISOString();
      campaign.verificationHistory = payload.history || campaign.verificationHistory;
      const source = campaigns.find((item) => item.id === campaign.id && item.accountId === campaign.accountId && item.platform === campaign.platform);
      if (source) Object.assign(source, { verified: true, verifiedAt: campaign.verifiedAt, verificationHistory: campaign.verificationHistory });
      setVerificationRevision((value) => value + 1);
    }
  };
  const analyzeCampaign = (campaign: Campaign, campaignKey: string) => {
    setSelectedId(campaignKey);
    void fetch("/api/media/campaigns/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: campaign.platform, accountId: campaign.accountId, campaignId: campaign.id, action: "ANALYSIS", score: campaignScore(campaign), spend: campaign.spend, leads: campaign.leads, cpl: campaign.cpl }),
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      campaign.verificationHistory = payload.history || campaign.verificationHistory;
      const source = campaigns.find((item) => item.id === campaign.id && item.accountId === campaign.accountId && item.platform === campaign.platform);
      if (source) source.verificationHistory = campaign.verificationHistory;
      setVerificationRevision((value) => value + 1);
    });
  };
  return (
    <section className="campaign-report">
      <header className="campaign-report-title">
        <div>
          <span>PAINEL DE PERFORMANCE</span>
          <h2>Campanhas em acompanhamento</h2>
          <p>Indicadores, saúde e oportunidades organizados para uma leitura rápida.</p>
        </div>
        <div className="campaign-report-count">
          <b>{rows.length}</b>
          <span>campanha{rows.length === 1 ? "" : "s"}<small>nos filtros atuais</small></span>
        </div>
      </header>
      <section className="portfolio-score-strip">
        <header><div><small>SAÚDE DOS PORTFÓLIOS</small><b>Visão rápida</b></div><span><i className="good" /> Bom <i className="warning" /> Atenção <i className="bad" /> Crítico</span></header>
        <div>
          {portfolioScores.slice(0, 6).map((item) => (
            <article key={item.name} className={item.score < 70 && item.score >= 0 ? "critical" : item.score < 90 && item.score >= 0 ? "warning" : "healthy"}>
              <span><b>{item.name}</b><small>{item.campaigns} de {item.total} avaliadas · confiança {item.total && item.campaigns / item.total >= .75 ? "alta" : item.total && item.campaigns / item.total >= .4 ? "média" : "baixa"}</small></span>
              <ScoreReasonPopover score={item.score} label={`Score do portfólio ${item.name}`} explanation={portfolioScoreBreakdown(item.campaignItems)}><strong>{item.score >= 0 ? item.score : "—"}<small>/100</small></strong></ScoreReasonPopover>
            </article>
          ))}
        </div>
      </section>
      <section className="campaign-report-kpis">
        <ReportMetric label="Valor gasto" value={money(total.spend)} trend={percentChange(total.spend, previousTotal.spend)} active={metricFocus === "SPEND"} onClick={() => { setMetricFocus(metricFocus === "SPEND" ? "ALL" : "SPEND"); setSort("spend"); }} />
        <ReportMetric label="Conversões" value={number(total.leads)} tone={scoreTone(averageScore)} trend={percentChange(total.leads, previousTotal.leads)} active={metricFocus === "LEADS"} onClick={() => { setMetricFocus(metricFocus === "LEADS" ? "ALL" : "LEADS"); setSort("leads"); }} />
        <ReportMetric
          label="CPL médio"
          value={total.leads ? money(total.spend / total.leads) : "—"}
          tone={total.leads ? scoreTone(averageScore) : "neutral"}
          trend={percentChange(total.leads ? total.spend / total.leads : 0, previousTotal.leads ? previousTotal.spend / previousTotal.leads : 0, true)}
          active={metricFocus === "CPL"}
          onClick={() => { setMetricFocus(metricFocus === "CPL" ? "ALL" : "CPL"); setSort("cpl"); }}
        />
        <AverageScoreGauge score={averageScore} />
      </section>
      <MediaTrendChart campaigns={rows} since={since} until={until} />
      <section className="campaign-report-toolbar">
        {metricFocus !== "ALL" && <button className="campaign-metric-chip" onClick={() => setMetricFocus("ALL")}>{metricFocus === "SPEND" ? "Com investimento" : metricFocus === "LEADS" ? "Com conversões" : "Com CPL calculado"}<X/></button>}
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar campanha, cliente ou responsável…"
          />
        </label>
        <div className="campaign-portfolio-filter">
          <SearchableSelect
            value={portfolio}
            onChange={setPortfolio}
            options={[
              { value: "ALL", label: clientId === "ALL" ? "Todos os portfólios" : "Todos os portfólios do cliente" },
              ...portfolios.map((item) => ({ value: item, label: item })),
            ]}
            placeholder="Portfólio ou cliente"
            searchPlaceholder="Digite o nome do cliente…"
            emptyMessage="Nenhum portfólio ou cliente encontrado."
          />
        </div>
        <div className="campaign-review-filter" role="group" aria-label="Situação da verificação"><button type="button" className={review === "ALL" ? "active" : ""} onClick={() => setReview("ALL")}>Todas</button><button type="button" className={review === "PENDING" ? "active pending" : ""} onClick={() => setReview("PENDING")}><Clock3/> Pendentes <b>{pendingReviewCount}</b></button></div>
        <details className="campaign-more-filters"><summary>Ajustar filtros {advancedFilterCount > 0 && <b>{advancedFilterCount}</b>}<ChevronDown/></summary><div className="campaign-more-filters-popover"><header><span><b>Filtros da tabela</b><small>Refine somente quando necessário.</small></span>{advancedFilterCount > 0 && <button type="button" onClick={() => { setScope("ACTIVE"); setHealth("ALL"); setObjective("ALL"); setSort("spend"); }}>Limpar</button>}</header><div className="campaign-standard-filter"><SearchableSelect searchable={false} value={scope} onChange={(value) => setScope(value as typeof scope)} options={[{ value: "ACTIVE", label: "Campanhas ativas" }, { value: "INACTIVE", label: "Campanhas inativas" }, { value: "ALL", label: "Todas as campanhas" }]} /></div><div className="campaign-standard-filter campaign-health-filter"><SearchableSelect searchable={false} value={health} onChange={(value) => setHealth(value as typeof health)} options={[{ value: "ALL", label: "Todas as avaliações" }, { value: "NEEDS_ATTENTION", label: "Precisam de atenção" }, { value: "GOOD", label: "Bom (90–100)" }, { value: "WARNING", label: "Atenção (70–89)" }, { value: "CRITICAL", label: "Crítico (0–69)" }]} /></div><div className="campaign-standard-filter"><SearchableSelect searchable={false} value={objective} onChange={setObjective} options={[{ value: "ALL", label: "Todos os objetivos" }, ...objectives.map((item) => ({ value: item, label: objectiveLabel(item) }))]} /></div><div className="campaign-standard-filter"><SearchableSelect searchable={false} value={sort} onChange={(value) => setSort(value as typeof sort)} options={[{ value: "spend", label: "Maior investimento" }, { value: "lowest_spend", label: "Menor investimento" }, { value: "leads", label: "Mais conversões" }, { value: "fewest_leads", label: "Menos conversões" }, { value: "score", label: "Maior score" }, { value: "worst_score", label: "Menor score" }, { value: "cpl", label: "Menor CPL" }, { value: "highest_cpl", label: "Maior CPL" }]} /></div><footer><button type="button" className={`campaign-density ${compactTable ? "active" : ""}`} onClick={() => setCompactTable((value) => !value)}><Gauge/> {compactTable ? "Tabela compacta" : "Tabela confortável"}</button><details className="campaign-columns"><summary><Eye/> Escolher colunas</summary><div className="campaign-columns-popover">{Object.entries({ balance: "Saldo", impressions: "Impressões", clicks: "Cliques", ctr: "CTR", review: "Revisão" }).map(([key,label]) => <label key={key}><input type="checkbox" checked={visibleMetrics[key as keyof typeof visibleMetrics]} onChange={(event) => setVisibleMetrics((current) => ({ ...current, [key]: event.target.checked }))}/><span>{label}</span></label>)}</div></details></footer></div></details>
      </section>
      {!!selectedCampaigns.length && <div className="campaign-bulk-bar"><b>{selectedCampaigns.length} selecionada(s)</b><button onClick={() => { const first = rows.find((item) => selectedCampaigns.includes(`${item.platform}:${item.accountId}:${item.id}`)); if (first) analyzeCampaign(first, `${first.platform}:${first.accountId}:${first.id}`); }}>Analisar primeira</button><button onClick={() => void Promise.all(rows.filter((item) => selectedCampaigns.includes(`${item.platform}:${item.accountId}:${item.id}`)).map(verifyCampaign)).then(() => setSelectedCampaigns([]))}>Marcar verificadas</button><button onClick={() => setSelectedCampaigns([])}>Limpar seleção</button></div>}
      <div className={`campaign-report-table ${compactTable ? "compact" : ""} ${!visibleMetrics.balance ? "hide-balance" : ""} ${!visibleMetrics.impressions ? "hide-impressions" : ""} ${!visibleMetrics.clicks ? "hide-clicks" : ""} ${!visibleMetrics.ctr ? "hide-ctr" : ""} ${!visibleMetrics.review ? "hide-review" : ""}`} ref={tableRef}>
        <table>
          <colgroup>
            <col className="campaign-column-name" />
            <col className="campaign-column-platform" />
            <col className="campaign-column-status" />
            <col className="campaign-column-money" />
            <col className="campaign-column-balance" />
            <col className="campaign-column-impressions" />
            <col className="campaign-column-clicks" />
            <col className="campaign-column-ctr" />
            <col className="campaign-column-conversions" />
            <col className="campaign-column-cpl" />
            <col className="campaign-column-score" />
            <col className="campaign-column-review" />
            <col className="campaign-column-actions" />
          </colgroup>
          <thead>
            <tr>
              <th><label className="campaign-row-select campaign-row-select-all"><input type="checkbox" aria-label="Selecionar campanhas desta página" checked={!!paginatedRows.length && paginatedRows.every((item) => selectedCampaigns.includes(`${item.platform}:${item.accountId}:${item.id}`))} onChange={(event) => { const pageKeys = paginatedRows.map((item) => `${item.platform}:${item.accountId}:${item.id}`); setSelectedCampaigns((current) => event.target.checked ? [...new Set([...current, ...pageKeys])] : current.filter((key) => !pageKeys.includes(key))); }}/><span>Cliente / campanha</span></label></th>
              <th>Plataforma</th>
              <th>Status</th>
              <th><button className="campaign-sort-head" onClick={() => setSort(sort === "spend" ? "lowest_spend" : "spend")}>Valor gasto <ChevronDown/></button></th>
              <th>Saldo restante</th>
              <th>Impressões</th>
              <th>Cliques</th>
              <th>CTR</th>
              <th><button className="campaign-sort-head" onClick={() => setSort(sort === "leads" ? "fewest_leads" : "leads")}>Conversões <ChevronDown/></button></th>
              <th><button className="campaign-sort-head" onClick={() => setSort(sort === "cpl" ? "highest_cpl" : "cpl")}>CPL <ChevronDown/></button></th>
              <th><button className="campaign-sort-head" onClick={() => setSort(sort === "score" ? "worst_score" : "score")}>Score <ChevronDown/></button></th>
              <th>Revisão</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((item) => {
              const ctr = item.impressions
                  ? (item.clicks / item.impressions) * 100
                  : 0,
                campaignKey = `${item.platform}:${item.accountId}:${item.id}`;
              return (
                <tr key={`${item.platform}-${item.accountId}-${item.id}`} className={`performance-row ${scoreTone(item.score)} ${selectedCampaigns.includes(campaignKey) ? "selected" : ""}`}>
                  <td>
                    <label className="campaign-row-select"><input type="checkbox" aria-label={`Selecionar ${item.groupName} — ${item.name}`} checked={selectedCampaigns.includes(campaignKey)} onChange={(event) => setSelectedCampaigns((current) => event.target.checked ? [...current, campaignKey] : current.filter((key) => key !== campaignKey))}/><span><b>{item.groupName}</b><small>{item.name}</small></span></label>
                  </td>
                  <td>
                    <PlatformMark platform={item.platform || "META_ADS"} />
                  </td>
                  <td>
                    <span
                      className={`campaign-state ${item.status.toLowerCase()}`}
                    >
                      {statusLabel[item.status] || item.status}
                    </span>
                  </td>
                  <td>{money(item.spend, item.currency)}</td>
                  <td><PerformanceValue value={item.balanceAvailable ? money(item.balance, item.currency) : "—"} tone={!item.balanceAvailable ? "neutral" : item.dailyBudget > 0 ? item.balance <= item.dailyBudget * 2 ? "bad" : item.balance <= item.dailyBudget * 4 ? "warning" : "good" : item.lifetimeBudget > 0 ? item.balance <= item.lifetimeBudget * .15 ? "bad" : item.balance <= item.lifetimeBudget * .3 ? "warning" : "good" : "neutral"} detail={item.balanceAvailable ? item.balanceSource === "ACCOUNT" ? "Saldo da conta informado pelo Google; compartilhado entre as campanhas" : item.platform === "GOOGLE_ADS" ? "Saldo calculado com o orçamento total e gasto acumulado informados pelo Google" : "Saldo atual informado diretamente pela plataforma" : "A plataforma não informa saldo próprio para esta campanha"} /></td>
                  <td>{number(item.impressions)}</td>
                  <td>{number(item.clicks)}</td>
                  <td><PerformanceValue value={`${number(ctr, 2)}%`} tone={ctr >= 2 ? "good" : ctr >= 1 ? "warning" : "bad"} detail="CTR: verde ≥ 2%, amarelo ≥ 1%, vermelho abaixo de 1%" /></td>
                  <td>
                    <PerformanceValue value={number(item.leads)} tone={scoreTone(item.score)} />
                  </td>
                  <td>
                    {item.cpl === null ? <PerformanceValue value="—" tone="neutral" /> : <PerformanceValue value={money(item.cpl, item.currency)} tone={!total.leads ? "neutral" : item.cpl <= (total.spend / total.leads) * .85 ? "good" : item.cpl <= (total.spend / total.leads) * 1.2 ? "warning" : "bad"} detail="CPL comparado à média das campanhas exibidas" />}
                  </td>
                  <td>
                    <ScoreGauge score={item.score} label="Campanha" compact campaign={item} />
                  </td>
                  <td><span className={`campaign-review-state ${verificationDue(item) ? "pending" : "current"}`}>{verificationDue(item) ? <Clock3 /> : <CheckCircle2 />}<span><b>{verificationDue(item) ? "Pendente" : "Em dia"}</b><small>{verificationDue(item) ? item.verifiedAt ? "Revisar novamente" : "Nunca revisada" : `até ${new Date(new Date(item.verifiedAt!).getTime() + 7 * 86400000).toLocaleDateString("pt-BR")}`}</small></span></span></td>
                  <td><div className="campaign-row-actions"><button type="button" className="campaign-analyze" onClick={() => analyzeCampaign(item, campaignKey)}><BarChart3 /> Analisar</button>{verificationDue(item) && <button type="button" className={`campaign-review ${item.score >= 0 && item.score < 70 ? "urgent" : ""}`} title="Abrir a campanha e realizar a revisão pendente" onClick={() => analyzeCampaign(item, campaignKey)}><CheckCircle2 /><span>Verificar</span></button>}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="campaign-pagination">
        <span>Exibindo {rows.length ? (safePage - 1) * pageSize + 1 : 0}–{Math.min(safePage * pageSize, rows.length)} de {rows.length} campanhas</span>
        <label>Por página<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as 20 | 40 | 60 | 80 | 100); setPage(1); }}>{[20,40,60,80,100].map((size) => <option value={size} key={size}>{size}</option>)}</select></label>
        <nav aria-label="Paginação das campanhas"><button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</button><span>Página <b>{safePage}</b> de {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Próxima</button></nav>
      </footer>
      <button type="button" className="campaign-insights-toggle" onClick={() => setShowInsights((value) => !value)} aria-expanded={showInsights}>
        <BarChart3 /> {showInsights ? "Ocultar análises complementares" : "Ver rankings, alertas e oportunidades"}<ChevronDown />
      </button>
      {showInsights && <section className="campaign-report-insights">
        <article>
          <h3>Score dos portfólios</h3>
          {portfolioScores.slice(0, 6).map((item, index) => (
            <p key={item.name}>
              <i>{index + 1}</i>
              <span>
                {item.name}
                <small>
                  {item.campaigns} de {item.total} campanhas com dados
                </small>
              </span>
              <b>{item.score >= 0 ? item.score : "—"}</b>
            </p>
          ))}
        </article>
        <article>
          <h3>Top 5 campanhas por score</h3>
          {best.map((item, index) => (
            <p key={item.id}>
              <i>{index + 1}</i>
              <span>
                {item.name}
                <small>{item.groupName}</small>
              </span>
              <b>{item.score}</b>
            </p>
          ))}
        </article>
        <article>
          <h3>Alertas e oportunidades</h3>
          {alerts.slice(0, 6).map((item) => (
            <p key={item.id}>
              <AlertTriangle />
              <span>
                {item.name}
                <small>
                  {!hasDelivery(item)
                    ? "Sem entrega no período"
                    : item.status === "WITH_ISSUES"
                      ? "Campanha com problemas"
                      : `Score abaixo da meta: ${item.score}`}
                </small>
              </span>
            </p>
          ))}
          {!alerts.length && (
            <p>
              <CheckCircle2 />
              <span>
                Operação saudável
                <small>Nenhuma campanha crítica nos filtros atuais.</small>
              </span>
            </p>
          )}
        </article>
      </section>}
      {selected && <CampaignAnalysisDrawer campaign={selected} periodDays={periodDays} onClose={() => { setSelectedId(null); onAnalysisClosed?.(); }} onVerified={(history, verifiedAt) => {
        const source = campaigns.find((item) => item.id === selected.id && item.accountId === selected.accountId && item.platform === selected.platform);
        if (source) Object.assign(source, { verified: true, verifiedAt, verificationHistory: history });
        setVerificationRevision((value) => value + 1);
      }} />}
    </section>
  );
}
function ReportMetric({ label, value, tone = "neutral", trend, active, onClick }: { label: string; value: string; tone?: PerformanceTone; trend?: number | null; active?: boolean; onClick?: () => void }) {
  return (
    <article className={`report-metric ${tone} ${onClick ? "clickable" : ""} ${active ? "active" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) onClick(); }}>
      <small>{label}</small>
      <b>{value}</b>
      {trend != null && <span className={`report-metric-trend ${trend > 0 ? "good" : trend < 0 ? "bad" : "neutral"}`}>{trend > 0 ? "↑" : trend < 0 ? "↓" : "—"} {number(Math.abs(trend), 1)}% <em>vs. período anterior</em></span>}
      {tone !== "neutral" && <em><i />{toneLabel[tone]}</em>}
    </article>
  );
}

function MediaTrendChart({ campaigns, since, until }: { campaigns: Array<Campaign>; since: string; until: string }) {
  const [granularity, setGranularity] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY"), [metric, setMetric] = useState<"spend" | "leads">("spend"), [points, setPoints] = useState<Array<{ label: string; spend: number; leads: number }>>([]), [loading, setLoading] = useState(false);
  const signature = campaigns.map((item) => `${item.platform}:${item.accountId}:${item.id}`).sort().join("|");
  useEffect(() => {
    let cancelled = false; const cacheKey = mediaTrendCacheKey(granularity, since, until, signature);
    try { const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); if (cached?.points && Date.now() - cached.savedAt < 10 * 60 * 1000) { setPoints(cached.points); setLoading(false); return; } } catch { /* cache inválido é ignorado */ }
    setLoading(true);
    const end = new Date(`${until}T12:00`), startLimit = new Date(`${since}T12:00`), ranges: Array<{ start: Date; end: Date; label: string }> = [];
    if (granularity === "MONTHLY") { for (let offset = 5; offset >= 0; offset--) { const start = new Date(end.getFullYear(), end.getMonth() - offset, 1), rangeEnd = new Date(end.getFullYear(), end.getMonth() - offset + 1, 0); ranges.push({ start, end: rangeEnd > end ? end : rangeEnd, label: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") }); } }
    else { const step = granularity === "DAILY" ? 1 : 7, max = granularity === "DAILY" ? 14 : 8; let cursor = new Date(end); while (cursor >= startLimit && ranges.length < max) { const rangeEnd = new Date(cursor), start = new Date(cursor); start.setDate(start.getDate() - step + 1); if (start < startLimit) start.setTime(startLimit.getTime()); ranges.unshift({ start, end: rangeEnd, label: granularity === "DAILY" ? start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` }); cursor = new Date(start); cursor.setDate(cursor.getDate() - 1); } }
    const providers = [...new Set(campaigns.map((item) => item.platform || "META_ADS"))], keys = new Set(campaigns.map((item) => `${item.platform || "META_ADS"}:${item.accountId}:${item.id}`));
    void Promise.all(ranges.map(async (range) => { const payloads = await Promise.all(providers.map(async (source) => { const response = await fetch(`/api/media/${source === "META_ADS" ? "meta" : "google"}/campaigns?since=${iso(range.start)}&until=${iso(range.end)}&comparison=1`), payload = await response.json(); return response.ok ? (payload.campaigns || []).filter((item: Campaign) => keys.has(`${source}:${item.accountId}:${item.id}`)) : []; })); const rows = payloads.flat() as Campaign[]; return { label: range.label, spend: rows.reduce((sum, item) => sum + item.spend, 0), leads: rows.reduce((sum, item) => sum + item.leads, 0) }; })).then((result) => { if (!cancelled) { setPoints(result); setLoading(false); try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), points: result })); } catch { /* storage cheio não impede o gráfico */ } } });
    return () => { cancelled = true; };
  }, [granularity, signature, since, until]);
  const max = Math.max(1, ...points.map((item) => item[metric]));
  return <section className="media-trend"><header><div><small>EVOLUÇÃO DO PERÍODO</small><h3>{metric === "spend" ? "Investimento" : "Conversões"} ao longo do tempo</h3></div><nav><button className={metric === "spend" ? "active" : ""} onClick={() => setMetric("spend")}>Investimento</button><button className={metric === "leads" ? "active" : ""} onClick={() => setMetric("leads")}>Conversões</button><i/>{(["DAILY","WEEKLY","MONTHLY"] as const).map((value) => <button className={granularity === value ? "active" : ""} onClick={() => setGranularity(value)} key={value}>{value === "DAILY" ? "Diário" : value === "WEEKLY" ? "Semanal" : "Mensal"}</button>)}</nav></header>{loading ? <div className="media-trend-loading">Atualizando comparação…</div> : points.length ? <div className={`media-trend-bars ${points.length === 1 ? "single-point" : ""}`}>{points.map((item) => <article key={item.label} title={metric === "spend" ? money(item.spend) : `${number(item.leads)} conversões`}><b>{metric === "spend" ? money(item.spend) : number(item.leads)}</b><i><u style={{ height: `${Math.max(3, item[metric] / max * 100)}%` }}/></i><small>{item.label}</small></article>)}</div> : <div className="media-trend-empty"><b>Sem dados neste período</b><span>Tente ampliar o intervalo ou alterar a visualização.</span></div>}</section>;
}

type AnalyzedCampaign = Campaign & {
  score: number;
  responsible: string;
  balance: number;
  balanceAvailable: boolean;
  groupName: string;
};

function CampaignAnalysisDrawer({ campaign, periodDays, onClose, onVerified }: {
  campaign: AnalyzedCampaign;
  periodDays: number;
  onClose: () => void;
  onVerified: (history: NonNullable<Campaign["verificationHistory"]>, verifiedAt: string) => void;
}) {
  const [geoLevel, setGeoLevel] = useState<"CITY" | "NEIGHBORHOOD">("CITY"),
    [analysisView, setAnalysisView] = useState<"ANALYSIS" | "REPORT">("ANALYSIS"),
    [reportNotice, setReportNotice] = useState(""),
    [reportAction, setReportAction] = useState<"EXPORT" | "SEND" | null>(null),
    [verifying, setVerifying] = useState(false),
    [campaignAi, setCampaignAi] = useState<MediaAiInsight | null>(null),
    [campaignAiLoading, setCampaignAiLoading] = useState(false),
    [campaignAiError, setCampaignAiError] = useState(""),
    [, setHistoryRevision] = useState(0);
  const ctr = campaign.impressions ? (campaign.clicks / campaign.impressions) * 100 : 0,
    campaignIsActive = campaign.status === "ACTIVE",
    conversionRate = campaign.clicks ? (campaign.leads / campaign.clicks) * 100 : 0,
    budget = campaign.lifetimeBudget > 0 ? campaign.lifetimeBudget : campaign.dailyBudget * periodDays,
    budgetUse = budget ? Math.min(100, (campaign.spend / budget) * 100) : 0,
    rawGeography = campaign.geography || [],
    selectedGeography = rawGeography.flatMap((item) => {
      if (geoLevel === "NEIGHBORHOOD")
        return item.level === "NEIGHBORHOOD" ? [item] : [];
      if (item.level === "CITY") return [item];
      if (item.level === "NEIGHBORHOOD" && item.name.includes(" · "))
        return [{ ...item, name: item.name.split(" · ").at(-1) || item.name, level: "CITY" as const }];
      return [];
    }),
    geographySource = selectedGeography.length
      ? selectedGeography
      : geoLevel === "CITY" && campaign.platform !== "META_ADS" ? rawGeography.filter((item) => item.level === "REGION") : [],
    geography = [...geographySource.reduce((locations, item) => {
      const key = `${geoLevel}:${item.name}`,
        current = locations.get(key);
      locations.set(key, current
        ? { ...current, leads: current.leads + item.leads, clicks: current.clicks + item.clicks, spend: current.spend + item.spend }
        : { ...item });
      return locations;
    }, new Map<string, NonNullable<Campaign["geography"]>[number]>()).values()].sort((a, b) => b.leads - a.leads),
    maxGeoLeads = Math.max(1, ...geography.map((item) => item.leads)),
    showGeography = campaign.platform === "GOOGLE_ADS" || rawGeography.some((item) => (item.level === "CITY" || item.level === "NEIGHBORHOOD") && item.leads > 0),
    opportunitySpend = campaign.score >= 90 ? 0 : campaign.spend * Math.max(.05, (90 - Math.max(0, campaign.score)) / 100),
    opportunityLeads = campaign.cpl && campaign.cpl > 0 ? Math.round(opportunitySpend / campaign.cpl) : 0;
  const scoreDetails = campaignScoreBreakdown(campaign);
  const exportPdf = async () => {
    if (!campaignIsActive) { setReportNotice("Relatórios só podem ser gerados para campanhas ativas."); return; }
    if (reportAction) return;
    setReportAction("EXPORT"); setReportNotice("");
    try {
    const { jsPDF } = await import("jspdf"), doc = new jsPDF({ unit: "mm", format: "a4" }), metrics = [
      ["Orçamento", money(budget, campaign.currency)], ["Investimento", money(campaign.spend, campaign.currency)],
      ["Saldo restante", campaign.balanceAvailable ? money(campaign.balance, campaign.currency) : "Não informado"], ["Impressões", number(campaign.impressions)],
      ["Cliques", number(campaign.clicks)], ["CTR", `${number(ctr, 2)}%`], ["Conversões", number(campaign.leads)],
      ["CPL", campaign.cpl == null ? "—" : money(campaign.cpl, campaign.currency)], ["Alcance", campaign.reach >= 0 ? number(campaign.reach) : "—"],
      ["Frequência", campaign.frequency >= 0 ? number(campaign.frequency, 2) : "—"], ["Conversão clique/lead", `${number(conversionRate, 2)}%`], ["Uso do orçamento", `${number(budgetUse, 1)}%`],
    ];
    doc.setFillColor(9, 36, 58); doc.roundedRect(14, 14, 182, 34, 4, 4, "F");
    doc.setTextColor(110, 183, 245); doc.setFontSize(8); doc.text("PW OS  |  RELATÓRIO DE PERFORMANCE", 21, 24);
    doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text(campaign.groupName.slice(0, 55), 21, 34);
    doc.setFontSize(9); doc.setTextColor(190, 209, 223); doc.text(`${campaign.name.slice(0, 75)}  |  Últimos ${periodDays} dias`, 21, 42);
    metrics.forEach(([label, value], index) => {
      const column = index % 3, row = Math.floor(index / 3), x = 14 + column * 61.5, y = 56 + row * 28;
      doc.setDrawColor(220, 228, 235); doc.setFillColor(249, 251, 252); doc.roundedRect(x, y, 58, 22, 2.5, 2.5, "FD");
      doc.setTextColor(105, 122, 142); doc.setFontSize(7); doc.text(label.toUpperCase(), x + 4, y + 7);
      doc.setTextColor(23, 38, 56); doc.setFontSize(12); doc.text(value, x + 4, y + 16);
    });
    doc.setTextColor(23, 38, 56); doc.setFontSize(11); doc.text("Leitura executiva", 14, 177);
    [["Saúde da campanha", Math.max(0, campaign.score), campaign.score >= 90 ? [45,166,111] : campaign.score >= 70 ? [224,158,31] : [210,69,78]], ["Uso do orçamento", budgetUse, [48,126,202]], ["Conversão clique → lead", Math.min(100, conversionRate * 5), [61,146,117]]].forEach(([label, rawValue, color], index) => {
      const y = 188 + index * 18, value = Number(rawValue), rgb = color as number[];
      doc.setFontSize(8); doc.setTextColor(77, 94, 114); doc.text(String(label), 14, y); doc.setTextColor(23, 38, 56); doc.text(`${number(index === 2 ? conversionRate : value, 1)}%`, 196, y, { align: "right" });
      doc.setFillColor(231, 236, 241); doc.roundedRect(14, y + 4, 182, 5, 2.5, 2.5, "F"); doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.roundedRect(14, y + 4, Math.max(2, 182 * Math.min(100, value) / 100), 5, 2.5, 2.5, "F");
    });
    doc.setDrawColor(220, 228, 235); doc.line(14, 252, 196, 252); doc.setFontSize(8); doc.setTextColor(105, 122, 142);
    doc.text(`Período analisado: ${periodDays} dias`, 14, 261); doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 267);
    doc.addPage(); doc.setFillColor(9, 36, 58); doc.rect(0, 0, 210, 36, "F"); doc.setTextColor(255,255,255); doc.setFontSize(16); doc.text("Detalhamento e oportunidades", 14, 19); doc.setFontSize(8); doc.setTextColor(190,209,223); doc.text(`${campaign.groupName} · ${campaign.name}`, 14, 27);
    doc.setTextColor(23,38,56); doc.setFontSize(11); doc.text("Funil de conversão", 14, 50);
    [["Impressões", campaign.impressions, 182], ["Cliques", campaign.clicks, 135], ["Conversões", campaign.leads, 88]].forEach(([label, value, width], index) => { const y = 58 + index * 15, w = Number(width); doc.setFillColor(49 + index * 18, 91, 193 - index * 18); doc.roundedRect(14 + (182-w)/2, y, w, 10, 2, 2, "F"); doc.setTextColor(255,255,255); doc.setFontSize(7); doc.text(String(label), 18 + (182-w)/2, y+6.5); doc.text(number(Number(value)), 192-(182-w)/2, y+6.5, { align:"right" }); });
    let detailY = 116; doc.setTextColor(23,38,56); doc.setFontSize(11); doc.text("Diagnóstico", 14, detailY); detailY += 10;
    const diagnostics = [campaign.score < 70 ? "Campanha abaixo do esperado: priorizar revisão de segmentação, criativos e conversão." : campaign.score < 90 ? "Campanha requer acompanhamento: há espaço para otimizar eficiência e escala." : "Campanha saudável: manter monitoramento e testar expansão controlada.", ctr < 1 ? "CTR abaixo de 1%: revisar mensagem, criativo e aderência do público." : `CTR de ${number(ctr,2)}% com boa capacidade de geração de tráfego.`, campaign.cpl == null ? "Ainda não há CPL calculável no período." : `CPL atual de ${money(campaign.cpl,campaign.currency)} para ${number(campaign.leads)} conversões.`];
    diagnostics.forEach((text, index) => { doc.setFillColor(247,249,251); doc.setDrawColor(224,230,236); doc.roundedRect(14, detailY, 182, 18, 2, 2, "FD"); doc.setFillColor(index === 0 && campaign.score < 70 ? 210 : 48, index === 0 && campaign.score < 70 ? 69 : 126, index === 0 && campaign.score < 70 ? 78 : 202); doc.circle(20, detailY+9, 2, "F"); doc.setTextColor(61,78,98); doc.setFontSize(8); doc.text(doc.splitTextToSize(text, 165), 26, detailY+7); detailY += 23; });
    doc.setTextColor(23,38,56); doc.setFontSize(11); doc.text("Dados complementares", 14, detailY + 5); doc.setFontSize(8); doc.setTextColor(90,106,124); doc.text(`Landing page: ${campaign.landingPageStatus === "ACTIVE" ? "Online" : campaign.landingPageStatus === "INACTIVE" ? "Offline" : "Validação inconclusiva"}`, 14, detailY + 16); doc.text(`Otimização: ${campaign.optimizationStatus || "Não disponibilizada"}`, 14, detailY + 24); doc.text(`Última revisão: ${campaign.verifiedAt ? new Date(campaign.verifiedAt).toLocaleString("pt-BR") : "Pendente"}`, 14, detailY + 32);
    doc.addPage();
    doc.setFillColor(247, 250, 252); doc.rect(0, 0, 210, 297, "F");
    doc.setFillColor(9, 36, 58); doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.text("Detalhamento da campanha", 14, 18);
    doc.setTextColor(183, 208, 224); doc.setFontSize(8); doc.text("Contexto, segmentação e evidências operacionais", 14, 26);
    const pdfSection = (title: string, y: number) => { doc.setTextColor(23,38,56); doc.setFontSize(10); doc.text(title, 14, y); doc.setDrawColor(218,226,233); doc.line(14, y + 4, 196, y + 4); };
    const pdfLabelValue = (label: string, value: string, x: number, y: number, width = 55) => { doc.setTextColor(112,128,145); doc.setFontSize(6.5); doc.text(label.toUpperCase(), x, y); doc.setTextColor(35,52,70); doc.setFontSize(8); doc.text(doc.splitTextToSize(value, width), x, y + 5); };
    pdfSection("Identificação e contexto", 45);
    pdfLabelValue("Plataforma", campaign.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads", 14, 55);
    pdfLabelValue("Status", statusLabel[campaign.status] || campaign.status, 60, 55);
    pdfLabelValue("Objetivo", objectiveLabel(campaign.objective), 106, 55);
    pdfLabelValue("Responsável", campaign.responsible || "Não atribuído", 152, 55, 42);
    pdfLabelValue("Campanha", campaign.name, 14, 71, 82);
    pdfLabelValue("Cliente / portfólio", campaign.groupName, 106, 71, 82);
    pdfSection("Desempenho geográfico", 92);
    const pdfGeography = [...rawGeography].sort((a, b) => b.leads - a.leads).slice(0, 7);
    if (pdfGeography.length) {
      doc.setFillColor(235,241,246); doc.roundedRect(14, 99, 182, 9, 2, 2, "F");
      doc.setTextColor(88,105,123); doc.setFontSize(6.5); doc.text("LOCALIZAÇÃO", 18, 105); doc.text("NÍVEL", 107, 105); doc.text("CLIQUES", 151, 105, { align: "right" }); doc.text("CONVERSÕES", 191, 105, { align: "right" });
      pdfGeography.forEach((item, index) => { const y = 114 + index * 8; if (index % 2) { doc.setFillColor(250,252,253); doc.rect(14, y - 5.5, 182, 8, "F"); } doc.setTextColor(48,65,83); doc.setFontSize(7.2); doc.text(item.name.slice(0, 48), 18, y); doc.setTextColor(104,120,137); doc.text(item.level === "NEIGHBORHOOD" ? "Bairro" : item.level === "CITY" ? "Cidade" : "Região", 107, y); doc.setTextColor(48,65,83); doc.text(number(item.clicks), 151, y, { align: "right" }); doc.text(number(item.leads), 191, y, { align: "right" }); });
    } else { doc.setTextColor(110,126,143); doc.setFontSize(8); doc.text("A plataforma não disponibilizou dados geográficos neste período.", 14, 104); }
    pdfSection("Termos de pesquisa com maior atividade", 178);
    const pdfTerms = (campaign.searchTerms || []).slice().sort((a, b) => b.clicks - a.clicks).slice(0, 6);
    if (pdfTerms.length) {
      doc.setFillColor(235,241,246); doc.roundedRect(14, 185, 182, 9, 2, 2, "F");
      doc.setTextColor(88,105,123); doc.setFontSize(6.5); doc.text("TERMO", 18, 191); doc.text("IMPRESSÕES", 137, 191, { align: "right" }); doc.text("CLIQUES", 164, 191, { align: "right" }); doc.text("CONVERSÕES", 191, 191, { align: "right" });
      pdfTerms.forEach((item, index) => { const y = 200 + index * 8; if (index % 2) { doc.setFillColor(250,252,253); doc.rect(14, y - 5.5, 182, 8, "F"); } doc.setTextColor(48,65,83); doc.setFontSize(7.2); doc.text(item.term.slice(0, 58), 18, y); doc.text(number(item.impressions), 137, y, { align: "right" }); doc.text(number(item.clicks), 164, y, { align: "right" }); doc.text(number(item.leads), 191, y, { align: "right" }); });
    } else { doc.setTextColor(110,126,143); doc.setFontSize(8); doc.text(campaign.platform === "GOOGLE_ADS" ? "Nenhum termo foi retornado para esta campanha." : "Termos de pesquisa são disponibilizados apenas para campanhas Google Ads.", 14, 190); }
    doc.setDrawColor(218,226,233); doc.line(14, 258, 196, 258); doc.setTextColor(104,120,137); doc.setFontSize(6.5);
    doc.text("NOTA METODOLÓGICA", 14, 266); doc.text(doc.splitTextToSize(`Indicadores calculados com os dados retornados pela plataforma para os últimos ${periodDays} dias. Valores podem sofrer ajustes após atribuição e consolidação da mídia.`, 182), 14, 272);
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) { doc.setPage(page); doc.setTextColor(130,145,160); doc.setFontSize(6.5); doc.text(`PW OS · ${campaign.groupName}`, 14, 289); doc.text(`${page} / ${pageCount}`, 196, 289, { align: "right" }); }
    const filename = `relatorio-${campaign.groupName}-${campaign.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    doc.save(`${filename || "campanha"}.pdf`);
    const recorded = await recordReportAction("REPORT_DOWNLOADED");
    if (!recorded) setReportNotice("PDF exportado, mas não foi possível registrar o download no histórico.");
    } catch {
      setReportNotice("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setReportAction(null);
    }
  };
  const recordReportAction = async (action: "REPORT_DOWNLOADED" | "REPORT_SENT") => {
    try {
      const response = await fetch("/api/media/campaigns/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: campaign.platform, accountId: campaign.accountId, campaignId: campaign.id, action, score: campaign.score, spend: campaign.spend, leads: campaign.leads, cpl: campaign.cpl, periodDays }) }), result = await response.json();
      if (!response.ok) { setReportNotice(result.message || "Não foi possível registrar esta ação."); return false; }
      campaign.verificationHistory = result.history || campaign.verificationHistory;
      setHistoryRevision((value) => value + 1);
      setReportNotice(action === "REPORT_SENT" ? result.reportSchedule ? `Envio confirmado. Próximo relatório em ${shortDate(result.reportSchedule.nextDueAt)}.` : "Envio confirmado no histórico. Este cliente ainda não possui uma rotina configurada." : "PDF exportado e download registrado no histórico.");
      return true;
    } catch {
      setReportNotice("Falha de conexão ao registrar a ação. Tente novamente.");
      return false;
    }
  };
  const confirmReportSent = async () => {
    if (!campaignIsActive) { setReportNotice("Campanhas inativas não podem ter relatório enviado."); return; }
    if (reportAction) return;
    if (!await systemConfirm({ title: "Confirmar envio do relatório?", message: "Confirme somente se o relatório foi realmente entregue ao cliente. A próxima entrega da rotina será atualizada.", confirmLabel: "Confirmar envio", tone: "primary" })) return;
    setReportAction("SEND"); setReportNotice("");
    try { await recordReportAction("REPORT_SENT"); }
    finally { setReportAction(null); }
  };
  const toggleVerified = async () => {
    setVerifying(true); setReportNotice("");
    const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/media/campaigns/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ platform: campaign.platform, accountId: campaign.accountId, campaignId: campaign.id, verified: true, action: "REVIEW", score: campaign.score, spend: campaign.spend, leads: campaign.leads, cpl: campaign.cpl }) }), result = await response.json();
      if (!response.ok) { setReportNotice(result.message || "Não foi possível concluir a revisão."); return; }
      campaign.verified = true;
      campaign.verifiedAt = result.verifiedAt;
      campaign.verificationHistory = result.history || campaign.verificationHistory;
      onVerified(result.history || [], result.verifiedAt);
      setReportNotice("Revisão concluída. A campanha ficará analisada pelos próximos 7 dias.");
    } catch (error) { setReportNotice(error instanceof DOMException && error.name === "AbortError" ? "A confirmação demorou mais que o esperado. Atualize a página para confirmar o resultado antes de tentar novamente." : "Falha de conexão ao concluir a revisão. Tente novamente."); }
    finally { window.clearTimeout(timeout); setVerifying(false); }
  };
  const generateCampaignAi = async () => {
    setCampaignAiLoading(true); setCampaignAiError("");
    const end = new Date(), start = new Date(); start.setDate(start.getDate() - Math.max(0, periodDays - 1));
    try {
      const response = await fetch("/api/media/ai-insights", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ clientName:`${campaign.groupName} · ${campaign.name}`, cacheScope:`CAMPAIGN_${campaign.platform}_${campaign.accountId}_${campaign.id}`, analysisScope:"CAMPAIGNS", mode:"DEEP", since:iso(start), until:iso(end), campaigns:[{ name:campaign.name, platform:campaign.platform, status:campaign.status, objective:campaign.objective, spend:campaign.spend, impressions:campaign.impressions, clicks:campaign.clicks, leads:campaign.leads, cpl:campaign.cpl, score:campaign.score }] }) }), payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível analisar esta campanha.");
      setCampaignAi(payload.insight);
    } catch (cause) { setCampaignAiError(cause instanceof Error ? cause.message : "Falha ao consultar a OpenAI."); }
    finally { setCampaignAiLoading(false); }
  };
  return <div className="campaign-analysis-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="campaign-analysis" role="dialog" aria-modal="true" aria-label={`Análise da campanha ${campaign.name}`}>
      <header>
        <div><span>ANÁLISE DA CAMPANHA</span><h2>{campaign.name}</h2><p>{campaign.groupName} · {objectiveLabel(campaign.objective)} · Responsável: {campaign.responsible}</p></div>
        <ScoreGauge score={campaign.score} label="Score da campanha" campaign={campaign} />
        <span className={`campaign-analysis-review-state ${verificationDue(campaign) ? "pending" : "current"}`}>{verificationDue(campaign) ? <Clock3 /> : <CheckCircle2 />}<span><b>{verificationDue(campaign) ? "Revisão pendente" : "Revisão em dia"}</b><small>{campaign.verifiedAt ? `Última em ${new Date(campaign.verifiedAt).toLocaleDateString("pt-BR")}` : "Ainda não verificada"}</small></span></span>
        <button type="button" onClick={onClose} aria-label="Fechar análise"><X /></button>
      </header>
      <nav className="campaign-analysis-tabs"><button type="button" className={analysisView === "ANALYSIS" ? "active" : ""} onClick={() => setAnalysisView("ANALYSIS")}>Análise interna</button><button type="button" className={analysisView === "REPORT" ? "active" : ""} onClick={() => setAnalysisView("REPORT")}>Relatório do cliente</button>{analysisView === "REPORT" && (campaignIsActive ? <><button type="button" className="report-sent" disabled={reportAction !== null} onClick={() => void confirmReportSent()}>{reportAction === "SEND" ? <RefreshCw className="spin" /> : <Send />} {reportAction === "SEND" ? "Confirmando…" : "Confirmar envio"}</button><button type="button" className="export" disabled={reportAction !== null} onClick={() => void exportPdf()}>{reportAction === "EXPORT" ? <RefreshCw className="spin" /> : <Download />} {reportAction === "EXPORT" ? "Gerando PDF…" : "Exportar PDF"}</button></> : <span className="inactive-report-lock"><AlertTriangle /> Campanha inativa: relatório indisponível</span>)}</nav>
      <main className={analysisView === "REPORT" ? "client-report-mode" : ""}>
        <section className="campaign-analysis-kpis">
          <ReportMetric label={campaign.lifetimeBudget > 0 ? "Orçamento total" : "Orçamento diário"} value={money(campaign.lifetimeBudget > 0 ? campaign.lifetimeBudget : campaign.dailyBudget, campaign.currency)} />
          <ReportMetric label="Investimento" value={money(campaign.spend, campaign.currency)} />
          <ReportMetric label="Saldo restante" value={campaign.balanceAvailable ? money(campaign.balance, campaign.currency) : "Não informado"} tone={!campaign.balanceAvailable ? "neutral" : campaign.dailyBudget > 0 ? campaign.balance <= campaign.dailyBudget * 2 ? "bad" : campaign.balance <= campaign.dailyBudget * 4 ? "warning" : "good" : campaign.lifetimeBudget > 0 ? campaign.balance <= campaign.lifetimeBudget * .15 ? "bad" : campaign.balance <= campaign.lifetimeBudget * .3 ? "warning" : "good" : "neutral"} />
          <ReportMetric label="Impressões" value={number(campaign.impressions)} />
          <ReportMetric label="Cliques" value={number(campaign.clicks)} />
          <ReportMetric label="CTR" value={`${number(ctr, 2)}%`} tone={ctr >= 2 ? "good" : ctr >= 1 ? "warning" : "bad"} />
          <ReportMetric label="Conversões" value={number(campaign.leads)} tone={scoreTone(campaign.score)} />
          <ReportMetric label="CPL" value={campaign.cpl == null ? "—" : money(campaign.cpl, campaign.currency)} tone={campaign.cpl == null ? "neutral" : scoreTone(campaign.score)} />
        </section>
        {analysisView === "ANALYSIS" && <section className={`campaign-ai-on-demand ${campaignAi ? `ready ${campaignAi.verdict.toLowerCase()}` : ""}`}><header><span><BrainCircuit/></span><div><small>ANÁLISE INDIVIDUAL COM OPENAI</small><h3>{campaignAi?.headline || "Diagnóstico estratégico desta campanha"}</h3><p>{campaignAi ? `Gerado agora com ${campaignAi.model}` : "A análise é produzida somente quando você solicitar."}</p></div><button type="button" onClick={() => void generateCampaignAi()} disabled={campaignAiLoading}>{campaignAiLoading ? <RefreshCw className="spin"/> : <BrainCircuit/>}{campaignAiLoading ? "Analisando…" : campaignAi ? "Analisar novamente" : "Analisar agora"}</button></header>{campaignAiError && <div className="campaign-ai-error"><AlertTriangle/>{campaignAiError}</div>}{campaignAi && <div className="campaign-ai-result"><p>{campaignAi.summary}</p><div><article><b>Prioridades</b>{campaignAi.priorities.map((item,index)=><span key={item}><i>{index+1}</i>{item}</span>)}</article><article><b>Riscos</b>{campaignAi.risks.map((item)=><span key={item}><AlertTriangle/>{item}</span>)}</article><article><b>Testes recomendados</b>{campaignAi.experiments.map((item)=><span key={item}><Activity/>{item}</span>)}</article></div></div>}</section>}
        {analysisView === "ANALYSIS" && (
          <section className={`campaign-score-explanation ${scoreTone(campaign.score)}`}>
            <header>
              <div><small>COMO A NOTA FOI CALCULADA</small><h3>Por que o score é {campaign.score}</h3><p>{scoreDetails.summary}</p></div>
              <strong>{campaign.score}<small>/100</small></strong>
            </header>
            <ScoreDimensions dimensions={scoreDetails.dimensions} />
            <div className="campaign-score-factors">
              <article><small>BASE</small><b>+30</b><span>Pontuação inicial com entrega</span></article>
              {scoreDetails.factors.map((factor) => (
                <article className={factor.tone} key={factor.label}><small>{factor.label}</small><b>{factor.points >= 0 ? "+" : ""}{Math.round(factor.points)}</b><span>{factor.value}{factor.max ? ` · máximo ${factor.max}` : ""}</span></article>
              ))}
            </div>
            <div className="campaign-score-guidance">
              <article className="strengths"><h4><CheckCircle2 /> Por que está bom</h4>{scoreDetails.strengths.length ? scoreDetails.strengths.map((reason) => <p key={reason}>{reason}</p>) : <p>Nenhum fator atingiu ainda a faixa saudável.</p>}</article>
              <article className="improvements"><h4><TrendingUp /> Como melhorar</h4>{scoreDetails.improvements.length ? scoreDetails.improvements.map((reason) => <p key={reason}>{reason}</p>) : <p>Mantenha a configuração e teste expansão de forma controlada.</p>}</article>
            </div>
          </section>
        )}
        <section className="campaign-visual-summary">
          <article style={{"--progress":`${Math.min(100,Math.max(0,campaign.score))}%`} as CSSProperties}><div><span><b>{campaign.score >= 0 ? campaign.score : "—"}</b><small>/100</small></span></div><h3>Saúde da campanha</h3><p>{campaign.score >= 90 ? "Operação saudável" : campaign.score >= 70 ? "Requer acompanhamento" : "Ação prioritária"}</p></article>
          <article style={{"--progress":`${Math.min(100,budgetUse)}%`} as CSSProperties}><div><span><b>{number(budgetUse,0)}%</b></span></div><h3>Uso do orçamento</h3><p>{campaign.balanceAvailable ? `${money(campaign.balance,campaign.currency)} de saldo restante` : "Saldo não informado pela plataforma"}</p></article>
          <article className="campaign-visual-bars"><h3>Eficiência de mídia</h3><p><span>CTR <b>{number(ctr,2)}%</b></span><i><u style={{width:`${Math.min(100,ctr/3*100)}%`}}/></i></p><p><span>Conversão <b>{number(conversionRate,2)}%</b></span><i><u style={{width:`${Math.min(100,conversionRate/10*100)}%`}}/></i></p><small>{number(campaign.clicks)} cliques geraram {number(campaign.leads)} conversões</small></article>
          <article className="campaign-visual-result"><Target/><span><small>RESULTADO PRINCIPAL</small><b>{number(campaign.leads)}</b><em>conversões no período</em></span><footer><b>{campaign.cpl == null ? "—" : money(campaign.cpl,campaign.currency)}</b><small>CPL atual</small></footer></article>
        </section>
        <section className="campaign-analysis-grid">
          <article className="campaign-budget-card"><header><h3>Ritmo e projeção</h3><b>{number(budgetUse, 1)}%</b></header><div><i style={{ width: `${budgetUse}%` }} /></div><dl><div><dt>Orçamento do período</dt><dd>{money(budget, campaign.currency)}</dd></div><div><dt>Conversão clique → lead</dt><dd>{number(conversionRate, 2)}%</dd></div><div><dt>Frequência</dt><dd>{campaign.frequency >= 0 ? number(campaign.frequency, 2) : "Indisponível"}</dd></div></dl></article>
          <article className="campaign-funnel-card"><h3>Funil de conversão</h3><div><span style={{ width: "100%" }}>Impressões <b>{number(campaign.impressions)}</b></span><span style={{ width: "72%" }}>Cliques <b>{number(campaign.clicks)}</b></span><span style={{ width: "44%" }}>Conversões <b>{number(campaign.leads)}</b></span></div></article>
          <article className="campaign-health-card"><h3>Saúde operacional</h3><p><span>Status</span><b>{statusLabel[campaign.status] || campaign.status}</b></p><p><span>Posição no leilão</span><b>{campaign.auctionPosition || "Não disponibilizado"}</b></p><p><span>Otimização</span><b>{campaign.optimizationStatus || "Não disponibilizado"}</b></p><p><span>Landing page</span><b className={`lp-text-${(campaign.landingPageStatus || "UNKNOWN").toLowerCase()}`}>{campaign.landingPageStatus === "ACTIVE" ? "Online" : campaign.landingPageStatus === "INACTIVE" ? "Offline" : "Validação inconclusiva"}</b></p><p><span>Última verificação</span><b>{campaign.verifiedAt ? new Date(campaign.verifiedAt).toLocaleDateString("pt-BR") : "Pendente"}</b></p></article>
        </section>
        <section className={`campaign-impact ${campaign.score < 70 ? "critical" : campaign.score < 90 ? "warning" : "good"}`}><AlertTriangle/><div><small>DIAGNÓSTICO EXPLICÁVEL</small><h3>{campaign.score < 70 ? "Eficiência abaixo da referência" : campaign.score < 90 ? "Existe margem de otimização" : "Campanha dentro da faixa saudável"}</h3><p>{campaign.score < 70 ? `O score baixo combina eficiência, entrega e conversão. Priorize criativo, público e landing page.` : campaign.score < 90 ? "A campanha entrega resultados, mas ainda pode melhorar a relação entre investimento e conversões." : "Mantenha o acompanhamento e teste expansão controlada sem alterar várias variáveis ao mesmo tempo."}</p></div><span><small>IMPACTO ESTIMADO</small><b>{opportunitySpend ? `${money(opportunitySpend, campaign.currency)} em eficiência` : "Baixo risco atual"}</b><em>{opportunityLeads ? `potencial equivalente a ~${opportunityLeads} conversão(ões) no CPL atual` : "sem perda material estimada"}</em></span></section>
        {showGeography && <section className="campaign-geo-card"><header><div><small>DESEMPENHO GEOGRÁFICO</small><h3>Conversões por localização</h3></div><div className="campaign-geo-switch" role="group" aria-label="Nível geográfico"><button type="button" className={geoLevel === "CITY" ? "active" : ""} onClick={() => setGeoLevel("CITY")}>Cidade</button><button type="button" className={geoLevel === "NEIGHBORHOOD" ? "active" : ""} onClick={() => setGeoLevel("NEIGHBORHOOD")}>Bairro</button></div></header>{geography.length ? <div className="campaign-geo-list">{geography.slice(0, 12).map((item) => <p key={`${geoLevel}:${item.name}`}><span><b>{item.name}</b><small>{item.level === "REGION" ? "Região" : geoLevel === "CITY" ? "Cidade" : "Bairro"}</small></span><i><u style={{ width: `${(item.leads / maxGeoLeads) * 100}%` }} /></i><strong>{number(item.leads)}<small> leads</small></strong></p>)}</div> : <div className="campaign-geo-empty"><Target /><b>Sem dados por {geoLevel === "CITY" ? "cidade" : "bairro"}</b><p>A plataforma não retornou granularidade suficiente para esta campanha e período.</p></div>}</section>}
        <section className="campaign-detail-extras">
          <article><header><Search /><h3>Termos de pesquisa</h3></header>{campaign.searchTerms?.length ? <div className="campaign-term-list">{campaign.searchTerms.slice(0, 8).map((item) => <p key={item.term}><b>{item.term}</b><span>{number(item.clicks)} cliques</span><strong>{number(item.leads)} conv.</strong></p>)}</div> : <div className="campaign-extra-empty">{campaign.platform === "GOOGLE_ADS" ? "Sem termos retornados para esta campanha e período." : "Termos de pesquisa são disponibilizados pelo Google Ads."}</div>}</article>
          <article><header><Globe2 /><h3>Landing page</h3></header><div className="campaign-landing-detail"><span className={`campaign-state lp-${(campaign.landingPageStatus || "UNKNOWN").toLowerCase()}`}>{campaign.landingPageStatus === "ACTIVE" ? "Online" : campaign.landingPageStatus === "INACTIVE" ? "Offline" : "Validação inconclusiva"}</span><b>{campaign.landingPageUrl || "URL não disponibilizada"}</b>{campaign.landingPageUrl && <a className="campaign-landing-button" href={campaign.landingPageUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir página</a>}</div></article>
          <article><header><TrendingUp /><h3>Histórico de otimização</h3></header>{campaign.optimizationHistory?.length ? <div className="campaign-history-list">{campaign.optimizationHistory.slice(-5).reverse().map((item) => <p key={`${item.capturedAt}:${item.value}`}><i /><span><b>{item.value}</b><small>{new Date(item.capturedAt).toLocaleDateString("pt-BR")}</small></span></p>)}</div> : <div className="campaign-extra-empty">O histórico começa a ser registrado na próxima sincronização.</div>}</article>
        </section>
        {reportNotice && <div className="campaign-report-notice"><CheckCircle2 />{reportNotice}</div>}
        <section className="campaign-review-history">
          <header>
            <div><small>HISTÓRICO AUDITÁVEL</small><h3>Revisões e análises</h3></div>
            <span>{campaign.verificationHistory?.length || 0} registro(s)</span>
          </header>
          {campaign.verificationHistory?.length ? (
            <div>
              {[...campaign.verificationHistory].reverse().map((entry, index) => (
                <article key={`${entry.createdAt}:${entry.action}:${index}`}>
                  <i className={entry.action.toLowerCase()}>{entry.action === "REVIEW" ? <CheckCircle2 /> : entry.action === "REPORT_DOWNLOADED" ? <Download /> : entry.action === "REPORT_SENT" ? <Send /> : <BarChart3 />}</i>
                  <span><b>{entry.action === "REVIEW" ? "Campanha revisada" : entry.action === "REPORT_DOWNLOADED" ? "Relatório baixado" : entry.action === "REPORT_SENT" ? "Relatório enviado ao cliente" : "Análise aberta"}</b><small>{entry.userName} · {new Date(entry.createdAt).toLocaleString("pt-BR")}{entry.periodDays ? ` · Período de ${entry.periodDays} dias` : ""}</small></span>
                  <dl><div><dt>Score</dt><dd>{entry.score != null && entry.score >= 0 ? entry.score : "—"}</dd></div><div><dt>Investimento</dt><dd>{entry.spend != null ? money(entry.spend, campaign.currency) : "—"}</dd></div><div><dt>Conversões</dt><dd>{entry.leads != null ? number(entry.leads) : "—"}</dd></div><div><dt>CPL</dt><dd>{entry.cpl != null ? money(entry.cpl, campaign.currency) : "—"}</dd></div></dl>
                </article>
              ))}
            </div>
          ) : <div className="campaign-extra-empty">O primeiro registro será criado ao abrir uma análise ou verificar esta campanha.</div>}
        </section>
        <section className="campaign-client-report"><header><div><small>RELATÓRIO DE PERFORMANCE</small><h2>{campaign.groupName}</h2><p>{campaign.name} · Últimos {periodDays} dias</p></div><span><CalendarDays /><b>{periodDays} dias</b><small>período analisado</small></span></header><div className="client-report-metrics"><ReportMetric label="Orçamento" value={money(budget, campaign.currency)} /><ReportMetric label="Investimento" value={money(campaign.spend, campaign.currency)} /><ReportMetric label="Saldo restante" value={campaign.balanceAvailable ? money(campaign.balance, campaign.currency) : "Não informado"} /><ReportMetric label="Impressões" value={number(campaign.impressions)} /><ReportMetric label="Cliques" value={number(campaign.clicks)} /><ReportMetric label="CTR" value={`${number(ctr, 2)}%`} /><ReportMetric label="Conversões" value={number(campaign.leads)} /><ReportMetric label="CPL" value={campaign.cpl == null ? "—" : money(campaign.cpl, campaign.currency)} /><ReportMetric label="Alcance" value={campaign.reach >= 0 ? number(campaign.reach) : "—"} /><ReportMetric label="Frequência" value={campaign.frequency >= 0 ? number(campaign.frequency, 2) : "—"} /><ReportMetric label="Conversão clique/lead" value={`${number(conversionRate, 2)}%`} /><ReportMetric label="Uso do orçamento" value={`${number(budgetUse, 1)}%`} /></div><div className="client-report-highlights"><article><span><Target /></span><div><small>RESULTADO DO PERÍODO</small><b>{number(campaign.leads)} conversões</b><p>{campaign.cpl == null ? "Custo por conversão ainda não calculável." : `Custo médio de ${money(campaign.cpl, campaign.currency)} por conversão.`}</p></div></article><article><span><TrendingUp /></span><div><small>LEITURA DE PERFORMANCE</small><b>{campaign.score >= 90 ? "Desempenho saudável" : campaign.score >= 70 ? "Boa entrega, com espaço para evoluir" : "Campanha em fase de otimização"}</b><p>{ctr >= 2 ? `CTR de ${number(ctr, 2)}% indica boa aderência do anúncio ao público.` : "Seguimos otimizando criativos e público para elevar a taxa de cliques."}</p></div></article></div><footer><span>PW OS</span><p>Relatório preparado automaticamente · Atualizado em {new Date().toLocaleDateString("pt-BR")}</p></footer></section>
      </main>
      <footer><span className="campaign-footer-copy"><b>Verificação operacional a cada 7 dias</b><small>{campaign.verifiedAt && !verificationDue(campaign) ? `Revisão concluída em ${new Date(campaign.verifiedAt).toLocaleString("pt-BR")}.` : "Entre na plataforma, confira os ajustes e conclua a revisão."}</small></span><div className="campaign-footer-actions">{campaign.landingPageUrl && <a className="campaign-landing-button compact" href={campaign.landingPageUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir landing page</a>}{verificationDue(campaign) ? <button type="button" className="campaign-verified" disabled={verifying} onClick={() => void toggleVerified()}>{verifying ? <RefreshCw className="spin"/> : <CheckCircle2 />} {verifying ? "Concluindo…" : "Concluir revisão"}</button> : <span className="campaign-review-complete"><CheckCircle2/><span><b>Revisão em dia</b><small>Volta em 7 dias</small></span></span>}</div></footer>
    </aside>
  </div>;
}

function AverageScoreGauge({ score }: { score: number }) {
  return (
    <article className="average-score-gauge">
      <ScoreGauge score={score} label="Score médio" />
    </article>
  );
}

function ScoreGauge({
  score,
  label,
  compact = false,
  campaign,
  portfolioCampaigns,
  coverage,
}: {
  score: number;
  label: string;
  compact?: boolean;
  campaign?: Campaign;
  portfolioCampaigns?: Campaign[];
  coverage?: { evaluated: number; total: number };
}) {
  const tone =
    score < 0 ? "empty" : score >= 90 ? "good" : score >= 70 ? "warn" : "bad";
  const explanation = campaign ? campaignScoreBreakdown(campaign) : portfolioCampaigns ? portfolioScoreBreakdown(portfolioCampaigns) : null,
    weakestFactor = explanation?.factors.filter((factor) => factor.max > 0).sort((a,b) => (a.points / a.max) - (b.points / b.max))[0],
    conciseReason = score < 0 ? "Sem dados" : campaign && weakestFactor && score < 90 ? `${weakestFactor.label} limita` : score >= 90 ? "Saudável" : score >= 70 ? "Atenção" : "Abaixo do esperado";
  return (
    <ScoreReasonPopover score={score} label={label} explanation={explanation}>
      <div className={`score-gauge score-${tone} ${compact ? "compact" : ""}`}>
        <small>{label}</small>
        <div className="score-gauge-number"><b>{score >= 0 ? score : "—"}</b><em>/ 100</em></div>
        <strong>{conciseReason}</strong>
        {coverage && <span className={`score-gauge-coverage ${coverage.total && coverage.evaluated / coverage.total >= .75 ? "high" : coverage.total && coverage.evaluated / coverage.total >= .4 ? "medium" : "low"}`}>{coverage.evaluated}/{coverage.total} avaliadas · confiança {coverage.total && coverage.evaluated / coverage.total >= .75 ? "alta" : coverage.total && coverage.evaluated / coverage.total >= .4 ? "média" : "baixa"}</span>}
      </div>
    </ScoreReasonPopover>
  );
}

type ScoreExplanation = ReturnType<typeof campaignScoreBreakdown>;
function ScoreReasonPopover({ score, label, explanation, children }: { score: number; label: string; explanation: ScoreExplanation | null; children: ReactNode }) {
  const [open,setOpen] = useState(false), [hovered,setHovered] = useState(false), [position,setPosition] = useState({ left: 12, top: 12, above: true });
  const closeTimer = useRef<number | null>(null), visible = open || hovered;
  const popoverRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!visible || !popoverRef.current || !anchorRef.current) return;
    const anchor = anchorRef.current, box = popoverRef.current.getBoundingClientRect();
    const below = anchor.bottom + 8;
    const top = Math.max(12, Math.min(below + box.height <= window.innerHeight - 12 ? below : anchor.top - box.height - 8, window.innerHeight - box.height - 12));
    const left = Math.max(12, Math.min(anchor.right - box.width, window.innerWidth - box.width - 12));
    setPosition({ left, top, above: false });
  }, [visible]);
  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!visible) return;
    const close = () => { setOpen(false); setHovered(false); };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("scroll", close, true); };
  }, [visible]);
  if (!explanation) return <>{children}</>;
  const tone = score < 0 ? "empty" : score >= 90 ? "good" : score >= 70 ? "warning" : "bad";
  const place = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect(); anchorRef.current = rect;
    if (!visible) setPosition({ left: Math.max(12, rect.right - Math.min(420, window.innerWidth - 24)), top: rect.bottom + 8, above: false });
  };
  const enter = (anchor?: HTMLElement) => { if (closeTimer.current) window.clearTimeout(closeTimer.current); if (anchor) place(anchor); setHovered(true); };
  const leave = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => { setHovered(false); setOpen(false); closeTimer.current = null; }, 120);
  };
  const popover = visible ? createPortal(<div ref={popoverRef} className={`score-reason-popover score-reason-floating ${tone}`} style={{ "--score-left": `${position.left}px`, "--score-top": `${position.top}px` } as CSSProperties} role="tooltip" onMouseEnter={() => enter()} onMouseLeave={leave} onClick={(event) => event.stopPropagation()}>
      <div className="score-reason-heading"><span><small>POR QUE ESTA NOTA?</small><b>{label}</b></span><strong>{score >= 0 ? score : "—"}<small>/100</small></strong></div>
      <p>{explanation.summary}</p>
      <ScoreDimensions dimensions={explanation.dimensions} compact />
      {!!explanation.factors.length && <div className="score-reason-factors">{explanation.factors.map((factor) => <div key={factor.label} className={factor.tone}><span><b>{factor.label}</b><small>{factor.value}</small></span><strong>{factor.points >= 0 ? "+" : ""}{Math.round(factor.points)}{factor.max > 0 ? `/${factor.max}` : ""}</strong></div>)}</div>}
      <div className="score-reason-conclusion"><b>{score >= 90 ? "O que mantém alto" : "Principal leitura"}</b><span>{score >= 90 ? explanation.strengths[0] : explanation.improvements[0] || explanation.strengths[0]}</span></div>
      <small className="score-reason-hint">Afaste o mouse ou pressione Esc para fechar</small>
    </div>, document.body) : null;
  return <><span className={`score-reason-trigger ${open ? "open" : ""}`} onMouseEnter={(event) => enter(event.currentTarget)} onMouseLeave={leave} onClick={(event) => { event.stopPropagation(); place(event.currentTarget); setOpen((value) => !value); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); place(event.currentTarget); setOpen((value) => !value); } if (event.key === "Escape") { setOpen(false); setHovered(false); } }} onBlur={() => { setOpen(false); setHovered(false); }} role="button" tabIndex={0} aria-expanded={visible} aria-label={`${label}: ${score >= 0 ? `${score} de 100` : "sem dados"}. Ver explicação`}>{children}</span>{popover}</>;
}

function ScoreDimensions({ dimensions, compact = false }: { dimensions: ScoreExplanation["dimensions"]; compact?: boolean }) {
  if (!dimensions.length) return null;
  const bottleneck = [...dimensions].sort((a,b) => a.value - b.value)[0];
  return <div className={`score-dimensions ${compact ? "compact" : ""}`}>
    {dimensions.map((dimension) => <article className={dimension.tone} key={dimension.label}><header><b>{dimension.label}</b><strong>{dimension.value}</strong></header><i><u style={{ width: `${dimension.value}%` }} /></i>{!compact && <small>{dimension.detail}</small>}</article>)}
    <p><AlertTriangle /> Gargalo atual: <b>{bottleneck.label}</b></p>
  </div>;
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
