import { MetaLogo, GoogleAdsLogo } from "./PlatformLogos";
import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock3, LogIn, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import "./ConnectionsToken.css";
import { systemConfirm } from "./SystemDialog";

type Platform = "GOOGLE_ADS" | "META_ADS";
type Integration = { platform: Platform; accountCount: number | null; campaignCount: number | null; lastSyncAt: string | null };
type OAuthIdentity = { id: string; name: string; email?: string; connectedAt: string };
type ConnectionStatus = {
  configured: boolean;
  storedInSystem: boolean;
  oauthAvailable?: boolean;
  connectionMethod?: "OAUTH" | "LEGACY" | "NONE";
  identity?: OAuthIdentity | null;
  identities?: OAuthIdentity[];
  updatedAt: string | null;
  canManage: boolean;
  canRevoke: boolean;
};
const label = (platform: Platform) => platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform === "META_ADS") return <span className="oauth-platform-logo meta" aria-hidden="true"><MetaLogo /></span>;
  return <span className="oauth-platform-logo google" aria-hidden="true"><GoogleAdsLogo /></span>;
}

export function Connections() {
  const [items, setItems] = useState<Integration[]>([]);
  const [statuses, setStatuses] = useState<Partial<Record<Platform, ConnectionStatus>>>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [disconnecting, setDisconnecting] = useState<Platform | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const [connectionsResponse, metaResponse, googleResponse] = await Promise.all([fetch("/api/integrations"), fetch("/api/media/meta/token"), fetch("/api/media/google/token")]);
      const [connections, metaData, googleData] = await Promise.all([connectionsResponse.json(), metaResponse.json(), googleResponse.json()]);
      if (!connectionsResponse.ok) throw new Error(connections.message);
      setItems((connections.integrations || []).filter((item: Integration & { demo?: boolean }) => !item.demo));
      setStatuses({ ...(metaResponse.ok ? { META_ADS: metaData } : {}), ...(googleResponse.ok ? { GOOGLE_ADS: googleData } : {}) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conexões."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search), oauth = params.get("oauth");
    if (oauth) {
      const provider = oauth.startsWith("google") ? "Google Ads" : "Meta Ads";
      if (oauth.endsWith("connected")) setMessage(`${provider} conectado com sucesso.`);
      else {
        const reasons: Record<string, string> = {
          session: "A sessão não foi encontrada no retorno do Google. Entre no PW OS pelo mesmo endereço configurado para a conexão e tente novamente.",
          state: "A tentativa de conexão expirou ou o servidor foi reiniciado. Clique em Entrar com Google para começar novamente.",
          denied: "A autorização do Google foi cancelada ou recusada. Tente novamente e autorize o acesso ao Google Ads.",
          token: "O Google não liberou a autorização permanente. Inicie novamente a conexão e confirme as permissões.",
          accounts: "O Google autorizou o login, mas a API do Google Ads recusou o acesso. Verifique a habilitação da API, o token de desenvolvedor e o acesso dessa conta ao Google Ads.",
          error: "Não foi possível concluir a conexão com o Google. Tente novamente.",
        };
        setError(reasons[params.get("oauth_reason") || ""] || `Não foi possível concluir o login com ${provider}. Confira as permissões e tente novamente.`);
      }
      params.delete("oauth");
      params.delete("oauth_reason");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
    void load();
  }, []);
  const connect = async (platform: Platform) => {
    setConnecting(platform); setError(""); setMessage("");
    try {
      const provider = platform === "META_ADS" ? "meta" : "google", response = await fetch(`/api/media/${provider}/oauth/start`, { method: "POST" }), payload = await response.json();
      if (!response.ok || !payload.authUrl) throw new Error(payload.message || `Não foi possível iniciar o login com ${label(platform)}.`);
      window.location.assign(payload.authUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível abrir o login."); setConnecting(null); }
  };
  const disconnect = async (platform: Platform) => {
    const platformLabel = label(platform);
    if (!await systemConfirm({ title: `Desconectar ${platformLabel}?`, message: "A sincronização automática será interrompida, mas todo o histórico já salvo será preservado.", confirmLabel: "Desconectar", tone: "danger" })) return;
    setDisconnecting(platform); setError("");
    try {
      const provider = platform === "META_ADS" ? "meta" : "google", response = await fetch(`/api/media/${provider}/token`, { method: "DELETE" }), payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível desconectar.");
      setMessage(payload.message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível desconectar."); }
    finally { setDisconnecting(null); }
  };
  const disconnectMetaIdentity = async (identity: OAuthIdentity) => {
    if (!await systemConfirm({ title: `Desconectar ${identity.name}?`, message: "Somente este login do Facebook será removido. As outras contas conectadas continuarão ativas.", confirmLabel: "Desconectar conta", tone: "danger" })) return;
    setDisconnecting("META_ADS"); setError("");
    try {
      const response = await fetch(`/api/media/meta/connections/${encodeURIComponent(identity.id)}`, { method: "DELETE" }), payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível desconectar esta conta.");
      setMessage(payload.message); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível desconectar esta conta."); }
    finally { setDisconnecting(null); }
  };
  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">CONFIGURAÇÕES</span><h1>Central de Conexões</h1><p>Conecte as contas por login. Nenhum token precisa ser copiado ou colado.</p></div><button className="secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</button></div>
    <div className="security-note"><ShieldCheck /><div><b>Uma conexão para toda a equipe</b><p>O Master ou um perfil com a permissão Autorizar conecta Google e Meta. A equipe utiliza essa conexão conforme suas permissões, sem precisar conectar novamente. A sincronização inclui as contas de anúncios às quais o login conectado tem acesso; no Google, também as vinculadas à administradora. Cada cliente visualiza apenas suas próprias contas.</p></div></div>
    {error && <div className="form-error">{error}</div>}{message && <div className="form-success"><Check />{message}</div>}
    <section className="platform-grid connection-coming-grid">{(["META_ADS", "GOOGLE_ADS"] as const).map((platform) => {
      const status = statuses[platform], integration = items.find((item) => item.platform === platform), isConnected = !!status?.configured, isMeta = platform === "META_ADS", identity = status?.identity;
      return <article className={`platform-card connection-admin-card oauth-connection-card ${isConnected ? "is-connected" : ""}`} key={platform}>
        <div className="platform-card-head"><PlatformLogo platform={platform} /><div><h2>{label(platform)}</h2><p>{isMeta ? "Contas de anúncios, páginas e Instagram" : "Conta administradora e clientes vinculados"}</p></div><span className={`connection-status ${isConnected ? "connected" : ""}`}>{isConnected ? <><CheckCircle2 /> Conectada</> : <><Clock3 /> Desconectada</>}</span></div>
        <div className="oauth-connection-body"><div className={`oauth-identity ${!isMeta ? "google-account-identity" : ""}`}><span>{identity?.name?.slice(0, 1).toUpperCase() || (isMeta ? "M" : "G")}</span><div>{!isMeta && isConnected && <em>CONTA GOOGLE VINCULADA</em>}<b>{isMeta && status?.identities?.length ? `${status.identities.length} login(s) do Facebook` : identity?.name || (isConnected ? (isMeta ? "Conexão técnica atual" : "Conta Google conectada") : "Nenhuma conta conectada")}</b><small>{identity?.email || (isMeta ? "Adicione os logins que administram as contas dos clientes" : (isConnected ? "E-mail indisponível nesta autorização. Reconecte o Google para identificar a conta." : "Entre com o Google da conta administradora"))}</small>{identity?.connectedAt && !isMeta && <em>Conectada em {new Date(identity.connectedAt).toLocaleString("pt-BR")}</em>}</div></div><div className="oauth-connection-counts"><span><b>{isConnected ? integration?.accountCount ?? "—" : 0}</b><small>contas sincronizadas</small></span><span><b>{isConnected ? integration?.campaignCount ?? "—" : 0}</b><small>campanhas salvas</small></span></div></div>
        <p className="connection-sync-note">{!isConnected ? "Plataforma desconectada. Conecte para sincronizar contas e campanhas." : integration?.lastSyncAt ? `Dados salvos em ${new Date(integration.lastSyncAt).toLocaleString("pt-BR")}` : "Aguardando a primeira sincronização de contas e campanhas."}</p>
        {isMeta && !!status?.identities?.length && <div className="oauth-identities-list">{status.identities.map((item) => <div key={item.id}><span>{item.name.slice(0, 1).toUpperCase()}</span><p><b>{item.name}</b><small>Conectada em {new Date(item.connectedAt).toLocaleString("pt-BR")}</small></p>{status.canRevoke && <button type="button" className="secondary" disabled={disconnecting !== null || connecting !== null} onClick={() => void disconnectMetaIdentity(item)}><Unplug /> Remover</button>}</div>)}</div>}
        {status && (status.canManage || status.canRevoke) ? <div className="oauth-connection-actions">{status.canManage && <button className="primary oauth-login-button" disabled={!status.oauthAvailable || connecting !== null || disconnecting !== null} onClick={() => void connect(platform)}><LogIn />{connecting === platform ? "Abrindo login…" : isMeta && isConnected ? "Adicionar outra conta" : isConnected ? "Reconectar Google" : `Entrar com ${isMeta ? "Facebook" : "Google"}`}</button>}{status.canRevoke && isConnected && (!isMeta || !status.identities?.length) && <button className="secondary oauth-disconnect-button" disabled={disconnecting !== null || connecting !== null} onClick={() => void disconnect(platform)}><Unplug />{disconnecting === platform ? "Desconectando…" : "Desconectar"}</button>}{!status.oauthAvailable && <p className="oauth-backend-note"><ShieldCheck /> O aplicativo OAuth desta plataforma precisa ser habilitado uma única vez no backend.</p>}</div> : <div className="token-master-only"><ShieldCheck /><span><b>Configuração restrita</b><small>Seu perfil precisa da permissão Central de Conexões → Autorizar para conectar contas.</small></span></div>}
      </article>;
    })}</section>
  </div>;
}
