import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Link2, RefreshCw, ShieldCheck } from "lucide-react";

type Integration = {
  id: string;
  platform: "GOOGLE_ADS" | "META_ADS";
  name: string;
  status: string;
  demo?: boolean;
  accountCount: number;
  campaignCount: number;
  lastSyncAt: string | null;
};

const label = (platform: Integration["platform"]) => platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads";

export function Connections() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/integrations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setItems((data.integrations || []).filter((item: Integration) => !item.demo));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as conexões.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  return <div className="page">
    <div className="page-head"><div><span className="eyebrow">CONFIGURAÇÕES</span><h1>Central de Conexões</h1><p>Autorizações oficiais e somente leitura para plataformas de mídia.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</button></div>
    <div className="security-note"><ShieldCheck /><div><b>Sem dados simulados</b><p>O PW OS só exibirá contas e campanhas retornadas pelas APIs oficiais.</p></div></div>
    {error && <div className="form-error">{error}</div>}
    <section className="platform-grid connection-coming-grid">
      {(["GOOGLE_ADS", "META_ADS"] as const).map(platform => {
        const connected = items.find(item => item.platform === platform);
        return <article className="platform-card" key={platform}>
          <div className="platform-card-head"><span className={`platform-logo ${platform === "GOOGLE_ADS" ? "google" : "meta"}`}>{platform === "GOOGLE_ADS" ? "G" : "∞"}</span><div><h2>{label(platform)}</h2><p>Campanhas, contas e métricas oficiais</p></div><span className={`connection-status ${connected?.status === "CONNECTED" ? "connected" : ""}`}>{connected?.status === "CONNECTED" ? <><CheckCircle2 /> Conectada</> : <><Clock3 /> Em breve</>}</span></div>
          {connected ? <dl><div><dt>Nome</dt><dd>{connected.name}</dd></div><div><dt>Contas</dt><dd>{connected.accountCount || 0}</dd></div><div><dt>Campanhas</dt><dd>{connected.campaignCount || 0}</dd></div><div><dt>Última sincronização</dt><dd>{connected.lastSyncAt ? new Date(connected.lastSyncAt).toLocaleString("pt-BR") : "Pendente"}</dd></div></dl>
            : <div className="connection-coming"><Link2 /><h3>Integração oficial em breve</h3><p>Configure as credenciais OAuth da plataforma no servidor para habilitar a autorização. Nenhum botão decorativo ou conexão falsa foi disponibilizado.</p></div>}
        </article>;
      })}
    </section>
  </div>;
}
