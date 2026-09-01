import { FormEvent, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import "./ConnectionsToken.css";
import { systemConfirm } from "./SystemDialog";

type Platform = "GOOGLE_ADS" | "META_ADS";
type Integration = {
  id: string;
  platform: Platform;
  name: string;
  status: string;
  demo?: boolean;
  accountCount: number;
  campaignCount: number;
  lastSyncAt: string | null;
};
type TokenStatus = {
  configured: boolean;
  storedInSystem: boolean;
  refreshTokenConfigured?: boolean;
  developerTokenConfigured?: boolean;
  oauthClientConfigured?: boolean;
  updatedAt: string | null;
  canManage: boolean;
};
const label = (platform: Platform) =>
  platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

export function Connections() {
  const [items, setItems] = useState<Integration[]>([]);
  const [statuses, setStatuses] = useState<
    Partial<Record<Platform, TokenStatus>>
  >({});
  const [tokens, setTokens] = useState<Partial<Record<Platform, string>>>({});
  const [revealedTokens, setRevealedTokens] = useState<Partial<Record<Platform, string>>>({});
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState<Platform | null>(null),
    [revoking, setRevoking] = useState(false),
    [showMetaToken, setShowMetaToken] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [connectionsResponse, metaResponse, googleResponse] =
        await Promise.all([
          fetch("/api/integrations"),
          fetch("/api/media/meta/token"),
          fetch("/api/media/google/token"),
        ]);
      const [connections, metaData, googleData] = await Promise.all([
        connectionsResponse.json(),
        metaResponse.json(),
        googleResponse.json(),
      ]);
      if (!connectionsResponse.ok) throw new Error(connections.message);
      setItems(
        (connections.integrations || []).filter(
          (item: Integration) => !item.demo,
        ),
      );
      setStatuses((current) => ({
        ...current,
        ...(metaResponse.ok ? { META_ADS: metaData } : {}),
        ...(googleResponse.ok ? { GOOGLE_ADS: googleData } : {}),
      }));
      const visibleCredentials = await Promise.all(
        ([
          ["META_ADS", "meta", metaData],
          ["GOOGLE_ADS", "google", googleData],
        ] as const).map(async ([platform, provider, status]) => {
          if (!status?.canManage || !status?.configured) return null;
          const response = await fetch(`/api/media/${provider}/token/reveal`);
          if (!response.ok) return null;
          const payload = await response.json();
          return [platform, payload.token] as const;
        }),
      );
      setRevealedTokens(
        visibleCredentials.reduce<Partial<Record<Platform, string>>>(
          (current, item) => (item ? { ...current, [item[0]]: item[1] } : current),
          {},
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as conexões.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const revealToken = async (platform: Platform) => {
    setError("");
    setMessage("");
    try {
      const provider = platform === "META_ADS" ? "meta" : "google";
      const response = await fetch(`/api/media/${provider}/token/reveal`), payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Não foi possível carregar a credencial.");
      setRevealedTokens((current) => ({ ...current, [platform]: payload.token }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a credencial.");
    }
  };
  const copyToken = async (platform: Platform) => {
    const token = revealedTokens[platform];
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setMessage(`${label(platform)} copiado para a área de transferência.`);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  };
  const saveToken = async (event: FormEvent, platform: Platform) => {
    event.preventDefault();
    setSaving(platform);
    setError("");
    setMessage("");
    try {
      const provider = platform === "META_ADS" ? "meta" : "google",
        token = (tokens[platform] || "").replace(/\s/g, "");
      if (!token)
        throw new Error(
          platform === "GOOGLE_ADS"
            ? "Cole a chave da API do Google Ads antes de salvar."
            : "Cole o token de acesso antes de salvar.",
        );
      const response = await fetch(`/api/media/${provider}/token`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
        payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload.message || "Não foi possível salvar a credencial.",
        );
      setStatuses((current) => ({ ...current, [platform]: payload }));
      setTokens((current) => ({ ...current, [platform]: "" }));
      setMessage(payload.message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a credencial.",
      );
    } finally {
      setSaving(null);
    }
  };
  const revokeToken = async (platform: Platform) => {
    const isMeta = platform === "META_ADS";
    if (!await systemConfirm({ title: isMeta ? "Revogar conexão com a Meta?" : "Revogar conexão com o Google Ads?", message: isMeta ? "As campanhas deixarão de sincronizar até que um novo token seja cadastrado." : "A sincronização ficará indisponível até que uma nova chave seja cadastrada.", confirmLabel: "Revogar conexão", tone: "danger" })) return;
    setRevoking(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
          `/api/media/${isMeta ? "meta" : "google"}/token`,
          {
            method: "DELETE",
          },
        ),
        payload = await response.json();
      if (!response.ok)
        throw new Error(payload.message || "Não foi possível revogar o token.");
      setStatuses((current) => ({ ...current, [platform]: payload }));
      setTokens((current) => ({ ...current, [platform]: "" }));
      setMessage(payload.message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível revogar o token.",
      );
    } finally {
      setRevoking(false);
    }
  };
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">CONFIGURAÇÕES</span>
          <h1>Central de Conexões</h1>
          <p>
            Credenciais protegidas e integrações oficiais das plataformas de
            mídia.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "spin" : ""} /> Atualizar
        </button>
      </div>
      <div className="security-note">
        <ShieldCheck />
        <div>
          <b>Credenciais protegidas no servidor</b>
          <p>
            Tokens salvos nunca são devolvidos ao navegador nem exibidos para
            outros usuários.
          </p>
        </div>
      </div>
      {error && <div className="form-error">{error}</div>}
      {message && (
        <div className="form-success">
          <Check />
          {message}
        </div>
      )}
      <section className="platform-grid connection-coming-grid">
        {(["META_ADS", "GOOGLE_ADS"] as const).map((platform) => {
          const connected = items.find((item) => item.platform === platform),
            status = statuses[platform],
            isConnected =
              connected?.status === "CONNECTED" || status?.configured,
            token = tokens[platform] || "",
            isMeta = platform === "META_ADS";
          return (
            <article
              className={`platform-card connection-admin-card ${isConnected ? "is-connected" : ""}`}
              key={platform}
            >
              <div className="platform-card-head">
                <span className={`platform-logo ${isMeta ? "meta" : "google"}`}>
                  {isMeta ? "∞" : "G"}
                </span>
                <div>
                  <h2>{label(platform)}</h2>
                  <p>
                    {isMeta
                      ? "Anúncios, páginas, Instagram e conteúdo publicado"
                      : "Campanhas, contas e métricas oficiais"}
                  </p>
                </div>
                <span
                  className={`connection-status ${isConnected ? "connected" : ""}`}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 /> Ativa
                    </>
                  ) : (
                    <>
                      <Clock3 /> Não configurada
                    </>
                  )}
                </span>
              </div>
              <div className="meta-token-admin">
                <div className="token-status-row">
                  <KeyRound />
                  <div>
                    <b>
                      {status?.storedInSystem
                        ? isMeta
                          ? "API da Meta gerenciada pelo PW OS"
                          : "Chave da API do Google Ads gerenciada pelo PW OS"
                        : status?.configured
                          ? isMeta
                            ? "API carregada do ambiente"
                            : "Credenciais do Google Ads configuradas"
                          : isMeta
                            ? "Token de acesso necessário"
                            : "Chave da API necessária"}
                    </b>
                    <p>
                      {status?.updatedAt
                        ? `Atualizado em ${new Date(status.updatedAt).toLocaleString("pt-BR")}`
                        : isMeta
                          ? "Cole o token da API para ler anúncios, páginas e conteúdo do Instagram."
                          : !status?.refreshTokenConfigured
                            ? "O refresh token interno ainda não está configurado no servidor."
                            : !status?.oauthClientConfigured
                              ? "Chave da API recebida. Ainda faltam o OAuth Client ID e o OAuth Client Secret."
                              : "Refresh token e credenciais OAuth configurados. Informe ou substitua a chave da API."}
                    </p>
                  </div>
                  {status?.storedInSystem && (
                    <button
                      type="button"
                      className="secondary revoke-meta-token"
                      disabled={revoking || saving !== null}
                      onClick={() => void revokeToken(platform)}
                    >
                      <Unplug />{" "}
                      {revoking ? "Revogando…" : "Revogar token atual"}
                    </button>
                  )}
                </div>
                {status?.canManage ? (
                  <>
                    {status.configured && (
                      <div className="current-token-master">
                        <div>
                          <b>Credencial atual do Master</b>
                          {revealedTokens[platform] ? <code>{revealedTokens[platform]}</code> : <small>Exiba a credencial apenas quando precisar utilizá-la.</small>}
                        </div>
                        {revealedTokens[platform] ? <button type="button" className="secondary" onClick={() => void copyToken(platform)}><Copy /> Copiar</button> : <button type="button" className="secondary" onClick={() => void revealToken(platform)}><Eye /> Mostrar token</button>}
                      </div>
                    )}
                    <form onSubmit={(event) => saveToken(event, platform)}>
                    <label>
                      {status.configured
                        ? isMeta
                          ? "Substituir token de acesso"
                          : "Substituir chave da API"
                        : isMeta
                          ? "Token de acesso da API Meta"
                          : "Chave da API (Developer token)"}
                      <div>
                        <input
                          type={isMeta && showMetaToken ? "text" : "password"}
                          value={token}
                          onChange={(event) =>
                            setTokens((current) => ({
                              ...current,
                              [platform]: event.target.value,
                            }))
                          }
                          placeholder={
                            isMeta
                              ? "Cole aqui o novo token de acesso completo"
                              : "Cole aqui a chave da API do Google Ads"
                          }
                          autoComplete="new-password"
                          maxLength={4096}
                          required
                        />
                        {isMeta && (
                          <button
                            type="button"
                            onClick={() => setShowMetaToken((value) => !value)}
                            aria-label={
                              showMetaToken ? "Ocultar token" : "Mostrar token"
                            }
                          >
                            {showMetaToken ? <EyeOff /> : <Eye />}
                          </button>
                        )}
                      </div>
                      <small>
                        {isMeta
                          ? "Use um token de usuário ou de usuário do sistema com business_management, ads_read e ads_management."
                          : "No Google Ads, a chave da API é chamada de developer token. Ela será criptografada e ocultada após salvar."}
                      </small>
                    </label>
                    <button
                      className="primary"
                      disabled={saving !== null || revoking || !token.trim()}
                    >
                      {saving === platform
                        ? "Protegendo e salvando…"
                        : status.configured
                          ? isMeta
                            ? "Substituir token"
                            : "Substituir chave da API"
                          : isMeta
                            ? "Salvar e ativar"
                            : "Salvar chave da API"}
                    </button>
                    </form>
                  </>
                ) : (
                  <div className="token-master-only">
                    <ShieldCheck />
                    <span>
                      <b>Configuração restrita</b>
                      <small>
                        Somente o usuário Master pode visualizar esta opção.
                      </small>
                    </span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
