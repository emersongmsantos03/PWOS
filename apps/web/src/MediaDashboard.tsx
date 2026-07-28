import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, ExternalLink, Link2, Megaphone, RefreshCw, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";

type Platform = "GOOGLE_ADS" | "META_ADS";
type Integration = {
  id: string;
  platform: Platform;
  name: string;
  status: string;
  accountCount: number;
  campaignCount: number;
  responsible: string;
  lastSyncAt: string | null;
};

const platformName = (platform: Platform) => platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

function NetworkMark({ platform }: { platform: Platform }) {
  return platform === "GOOGLE_ADS"
    ? <span className="network-logo google-ads-mark" aria-label="Google Ads"><i /><i /><i /></span>
    : <span className="network-logo meta-ads-mark" aria-label="Meta Ads">∞</span>;
}

export function MediaDashboard() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [network, setNetwork] = useState<"ALL" | Platform>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível consultar as integrações.");
      setIntegrations((data.integrations || []).filter((item: Integration) => !("demo" in item) || !(item as Integration & { demo: boolean }).demo));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível consultar as integrações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => integrations.filter(item => network === "ALL" || item.platform === network), [integrations, network]);
  const connected = visible.filter(item => item.status === "CONNECTED");
  const totalAccounts = connected.reduce((sum, item) => sum + Number(item.accountCount || 0), 0);
  const totalCampaigns = connected.reduce((sum, item) => sum + Number(item.campaignCount || 0), 0);

  return <div className="page media-analytics-page">
    <div className="page-head">
      <div><span className="eyebrow">MÍDIA PAGA</span><h1>Contas de anúncios</h1><p>Dados reais de Meta Ads e Google Ads aparecem somente após uma conexão autorizada.</p></div>
      <button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</button>
    </div>

    <nav className="media-network-switch" aria-label="Selecionar rede de anúncios">
      {([
        ["ALL", "Todas"],
        ["GOOGLE_ADS", "Google Ads"],
        ["META_ADS", "Meta Ads"]
      ] as const).map(([value, label]) => {
        const count = integrations.filter(item => value === "ALL" || item.platform === value).length;
        return <button key={value} className={network === value ? "active" : ""} onClick={() => setNetwork(value)}>
          {value === "ALL" ? <span className="network-all"><BarChart3 /><Megaphone /></span> : <NetworkMark platform={value} />}
          <span><b>{label}</b><small>{count} {count === 1 ? "conexão" : "conexões"}</small></span>
          {network === value && <CheckCircle2 />}
        </button>;
      })}
    </nav>

    <section className="operations-kpis">
      <article><Link2 /><span><small>Conexões ativas</small><b>{connected.length}</b></span></article>
      <article><ShieldCheck /><span><small>Contas autorizadas</small><b>{totalAccounts}</b></span></article>
      <article><BarChart3 /><span><small>Campanhas sincronizadas</small><b>{totalCampaigns}</b></span></article>
      <article><Clock3 /><span><small>Origem dos dados</small><b>API</b></span></article>
    </section>

    {error && <div className="form-error">{error}</div>}
    <section className="panel media-real-panel">
      <header><div><h2>Integrações de mídia</h2><p>Nenhum resultado é estimado ou preenchido artificialmente.</p></div></header>
      {loading ? <div className="inline-empty"><RefreshCw className="spin" /><h3>Consultando conexões</h3><p>Aguarde enquanto verificamos as contas autorizadas.</p></div>
        : visible.length === 0 ? <div className="inline-empty"><Megaphone /><h3>Nenhuma conta conectada</h3><p>Conecte uma conta oficial para importar campanhas e métricas reais.</p><NavLink className="primary" to="/configuracoes/integracoes"><Link2 /> Abrir Central de Conexões</NavLink></div>
        : <div className="integration-status-list">{visible.map(item => <article key={item.id}>
          <NetworkMark platform={item.platform} />
          <div><b>{item.name || platformName(item.platform)}</b><small>{platformName(item.platform)} · responsável: {item.responsible || "Não informado"}</small></div>
          <span className={`connection-state ${item.status.toLowerCase()}`}>{item.status === "CONNECTED" ? "Conectada" : item.status}</span>
          <dl><div><dt>Contas</dt><dd>{item.accountCount || 0}</dd></div><div><dt>Campanhas</dt><dd>{item.campaignCount || 0}</dd></div><div><dt>Última sincronização</dt><dd>{item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleString("pt-BR") : "Ainda não sincronizada"}</dd></div></dl>
          <NavLink to="/configuracoes/integracoes">Gerenciar <ExternalLink /></NavLink>
        </article>)}</div>}
    </section>
  </div>;
}
