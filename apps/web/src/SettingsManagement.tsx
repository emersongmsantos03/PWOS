import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Database,
  DoorOpen,
  Globe2,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  Mail,
  Moon,
  Plug,
  Plus,
  Save,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import "./OpenAiSettings.css";

type Theme = "light" | "dark";
type Preferences = {
  density: "comfortable" | "compact";
  startPage: string;
  language: string;
  timezone: string;
  emailNotifications: boolean;
  browserNotifications: boolean;
  weeklyDigest: boolean;
  sound: boolean;
};
const defaults: Preferences = {
  density: "comfortable",
  startPage: "/",
  language: "pt-BR",
  timezone: "America/Sao_Paulo",
  emailNotifications: true,
  browserNotifications: true,
  weeklyDigest: true,
  sound: false,
};

export function SettingsManagement({
  theme,
  onTheme,
  onOpenProfile,
  onOpenSecurity,
}: {
  theme: Theme;
  onTheme: (theme: Theme) => void;
  onOpenProfile: () => void;
  onOpenSecurity: () => void;
}) {
  const [tab, setTab] = useState("general"),
    [saved, setSaved] = useState(false),
    [permission, setPermission] = useState<
      NotificationPermission | "unsupported"
    >(() =>
      "Notification" in window ? Notification.permission : "unsupported",
    ),
    [prefs, setPrefs] = useState<Preferences>(() => {
      try {
        return {
          ...defaults,
          ...JSON.parse(localStorage.getItem("pw-os-preferences") || "{}"),
        };
      } catch {
        return defaults;
      }
    });
  useEffect(() => {
    document.documentElement.dataset.density = prefs.density;
  }, [prefs.density]);
  const update = <K extends keyof Preferences>(
    key: K,
    value: Preferences[K],
  ) => {
    setPrefs((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  const save = () => {
    localStorage.setItem("pw-os-preferences", JSON.stringify(prefs));
    document.documentElement.dataset.density = prefs.density;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    update("browserNotifications", result === "granted");
  };
  const tabs = [
    ["general", Settings, "Geral"],
    ["appearance", Sun, "Aparência"],
    ["notifications", Bell, "Notificações"],
    ["email", Mail, "E-mail e SMTP"],
    ["openai", Sparkles, "OpenAI e insights"],
    ["rooms", DoorOpen, "Salas de reunião"],
    ["security", ShieldCheck, "Conta e segurança"],
    ["data", Database, "Dados e integrações"],
  ] as const;
  return (
    <div className="page settings-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">PREFERÊNCIAS DO SISTEMA</span>
          <h1>Configurações</h1>
          <p>
            Personalize sua experiência, privacidade e comunicação no PW OS.
          </p>
        </div>
        <button className="primary" onClick={save}>
          <Save />
          {saved ? "Preferências salvas" : "Salvar alterações"}
        </button>
      </div>
      <div className="settings-shell">
        <aside>
          {tabs.map(([key, Icon, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon />
              <span>{label}</span>
              <ChevronRight />
            </button>
          ))}
        </aside>
        <section className="settings-content">
          +{" "}
          {tab === "general" && (
            <>
              <SettingsHeader
                icon={SlidersHorizontal}
                title="Preferências gerais"
                text="Defina como o PW OS deve funcionar neste navegador."
              />
              <div className="settings-form-grid">
                <label>
                  Página inicial
                  <select
                    value={prefs.startPage}
                    onChange={(e) => update("startPage", e.target.value)}
                  >
                    <option value="/">Visão geral</option>
                    <option value="/crm">CRM's</option>
                    <option value="/tarefas">Creative Ops</option>
                    <option value="/financeiro">Financeiro</option>
                  </select>
                  <small>A primeira área sugerida ao iniciar sua rotina.</small>
                </label>
                <label>
                  Idioma
                  <select
                    value={prefs.language}
                    onChange={(e) => update("language", e.target.value)}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es">Español</option>
                  </select>
                  <small>Formatos de texto, data e moeda.</small>
                </label>
                <label className="full">
                  Fuso horário
                  <select
                    value={prefs.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                  >
                    <option value="America/Sao_Paulo">Brasília — GMT-3</option>
                    <option value="America/Manaus">Manaus — GMT-4</option>
                    <option value="America/Rio_Branco">
                      Rio Branco — GMT-5
                    </option>
                    <option value="UTC">UTC</option>
                  </select>
                  <small>
                    Usado em prazos, agenda, relatórios e auditoria.
                  </small>
                </label>
              </div>
            </>
          )}
          {tab === "appearance" && (
            <>
              <SettingsHeader
                icon={theme === "light" ? Sun : Moon}
                title="Aparência"
                text="Escolha um ambiente confortável para sua rotina."
              />
              <div className="theme-choice">
                <button
                  className={theme === "light" ? "active" : ""}
                  onClick={() => onTheme("light")}
                >
                  <span className="theme-preview light">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>
                    <Sun /> Tema claro
                  </b>
                  <small>Mais luminoso e neutro</small>
                  {theme === "light" && <Check />}
                </button>
                <button
                  className={theme === "dark" ? "active" : ""}
                  onClick={() => onTheme("dark")}
                >
                  <span className="theme-preview dark">
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>
                    <Moon /> Tema escuro
                  </b>
                  <small>Confortável em baixa luz</small>
                  {theme === "dark" && <Check />}
                </button>
              </div>
              <div className="settings-section">
                <h3>Densidade da interface</h3>
                <div className="density-choice">
                  <button
                    className={prefs.density === "comfortable" ? "active" : ""}
                    onClick={() => update("density", "comfortable")}
                  >
                    <LayoutGrid />
                    <span>
                      <b>Confortável</b>
                      <small>Mais espaço entre informações</small>
                    </span>
                  </button>
                  <button
                    className={prefs.density === "compact" ? "active" : ""}
                    onClick={() => update("density", "compact")}
                  >
                    <SlidersHorizontal />
                    <span>
                      <b>Compacta</b>
                      <small>Mais conteúdo visível por tela</small>
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <SettingsHeader
                icon={Bell}
                title="Notificações"
                text="Controle como e quando o PW OS pode chamar sua atenção."
              />
              <div className="settings-toggles">
                <Toggle
                  label="Notificações no navegador"
                  text="Alertas de tarefas, aprovações e menções."
                  checked={prefs.browserNotifications}
                  onChange={(value) =>
                    value && permission !== "granted"
                      ? void requestNotifications()
                      : update("browserNotifications", value)
                  }
                  badge={
                    permission === "denied"
                      ? "Bloqueado no navegador"
                      : undefined
                  }
                />
                <Toggle
                  label="Notificações por e-mail"
                  text="Atualizações relevantes da sua operação."
                  checked={prefs.emailNotifications}
                  onChange={(value) => update("emailNotifications", value)}
                />
                <Toggle
                  label="Resumo semanal"
                  text="Indicadores e pendências importantes toda semana."
                  checked={prefs.weeklyDigest}
                  onChange={(value) => update("weeklyDigest", value)}
                />
                <Toggle
                  label="Sons da interface"
                  text="Confirmações sonoras em ações importantes."
                  checked={prefs.sound}
                  onChange={(value) => update("sound", value)}
                />
              </div>
            </>
          )}
          {tab === "email" && <UserEmailSettings />}
          {tab === "openai" && <OpenAiSettings />}
          {tab === "security" && (
            <>
              <SettingsHeader
                icon={ShieldCheck}
                title="Conta e segurança"
                text="Gerencie seus dados pessoais e proteja seu acesso."
              />
              <div className="settings-action-list">
                <button onClick={onOpenProfile}>
                  <span>
                    <UserRound />
                  </span>
                  <div>
                    <b>Meu perfil</b>
                    <small>Nome, telefone, cargo e foto de perfil</small>
                  </div>
                  <ChevronRight />
                </button>
                <button onClick={onOpenSecurity}>
                  <span>
                    <LockKeyhole />
                  </span>
                  <div>
                    <b>Senha e segurança</b>
                    <small>Altere sua senha com validação de força</small>
                  </div>
                  <ChevronRight />
                </button>
                <article>
                  <span>
                    <ShieldCheck />
                  </span>
                  <div>
                    <b>Sessão protegida</b>
                    <small>
                      Cookies HttpOnly, validação local e controle de permissões
                    </small>
                  </div>
                  <em>Ativo</em>
                </article>
              </div>
            </>
          )}
          {tab === "data" && (
            <>
              <SettingsHeader
                icon={Database}
                title="Dados e integrações"
                text="Acesse conexões e informações técnicas do ambiente."
              />
              <div className="settings-action-list">
                <NavLink to="/configuracoes/integracoes">
                  <span>
                    <Plug />
                  </span>
                  <div>
                    <b>Central de conexões</b>
                    <small>APIs, plataformas e credenciais integradas</small>
                  </div>
                  <ChevronRight />
                </NavLink>
                <article>
                  <span>
                    <Globe2 />
                  </span>
                  <div>
                    <b>Armazenamento local</b>
                    <small>
                      Tema e preferências ficam somente neste navegador
                    </small>
                  </div>
                  <em>Protegido</em>
                </article>
                <button
                  className="danger-row"
                  onClick={() => {
                    localStorage.removeItem("pw-os-preferences");
                    setPrefs(defaults);
                  }}
                >
                  <span>
                    <Database />
                  </span>
                  <div>
                    <b>Restaurar preferências</b>
                    <small>
                      Voltar às configurações padrão deste navegador
                    </small>
                  </div>
                  <ChevronRight />
                </button>
              </div>
            </>
          )}
          {tab === "rooms" && <MeetingRoomsSettings />}
        </section>
      </div>
    </div>
  );
}
type OpenAiConnection = { configured:boolean;source:"SETTINGS"|"ENVIRONMENT"|"NONE";lastFour:string;model:string;verifiedAt:string|null;updatedByName:string|null };
function OpenAiSettings(){
  const [connection,setConnection]=useState<OpenAiConnection|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[showKey,setShowKey]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const load=async()=>{try{const response=await fetch("/api/openai-settings"),payload=await response.json();if(response.ok)setConnection(payload);else setError(payload.message||"Não foi possível carregar a configuração.")}catch{setError("Falha de conexão ao carregar a integração.")}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const saveKey=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError("");setMessage("");const form=event.currentTarget,data=Object.fromEntries(new FormData(form));try{const response=await fetch("/api/openai-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}),payload=await response.json();if(!response.ok){setError(payload.message||"Não foi possível salvar a chave.");return}setConnection(payload);setMessage("Chave validada, criptografada e conectada com sucesso.");form.reset();setShowKey(false)}catch{setError("Falha de conexão durante a validação.")}finally{setSaving(false)}};
  const test=async()=>{setSaving(true);setError("");setMessage("");try{const response=await fetch("/api/openai-settings/test",{method:"POST"}),payload=await response.json();response.ok?setMessage(`Conexão confirmada com o modelo ${payload.model}.`):setError(payload.message||"Falha ao testar a conexão.")}catch{setError("Falha de conexão ao testar a OpenAI.")}finally{setSaving(false)}};
  const remove=async()=>{if(!window.confirm("Remover a chave salva nas configurações?"))return;setSaving(true);setError("");const response=await fetch("/api/openai-settings",{method:"DELETE"}),payload=await response.json();setSaving(false);if(!response.ok)return setError(payload.message||"Não foi possível remover a chave.");setMessage(payload.fallbackToEnvironment?"Chave visual removida. O servidor voltou a usar a variável de ambiente.":"Chave removida. Os insights por IA ficaram desativados.");void load()};
  if(loading)return <p>Carregando configuração da OpenAI…</p>;
  return <><SettingsHeader icon={Sparkles} title="OpenAI e insights" text="Conecte uma chave de projeto para gerar diagnósticos nos relatórios operacionais."/>
    <section className={`openai-connection-card ${connection?.configured?"connected":"empty"}`}><span>{connection?.configured?<Check/>:<KeyRound/>}</span><div><small>STATUS DA INTEGRAÇÃO</small><b>{connection?.configured?"OpenAI conectada":"Chave ainda não configurada"}</b><p>{connection?.configured?`Chave ••••••••${connection.lastFour} · ${connection.model}${connection.verifiedAt?` · validada em ${new Date(connection.verifiedAt).toLocaleString("pt-BR")}`:""}`:"Cadastre uma chave para habilitar o PDF da operação com insights."}</p></div>{connection?.configured&&<em>{connection.source==="SETTINGS"?"Configurações":"Ambiente"}</em>}</section>
    <form className="openai-settings-form" onSubmit={saveKey}><header><div><small>CREDENCIAL DO SERVIDOR</small><h3>{connection?.configured?"Substituir chave":"Conectar chave da OpenAI"}</h3><p>A nova chave só substitui a atual depois de ser validada pela OpenAI.</p></div><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Criar nova chave</a></header><label className="openai-key-field">Chave secreta<div><input name="apiKey" type={showKey?"text":"password"} required autoComplete="new-password" placeholder="sk-proj-••••••••••••••••"/><button type="button" onClick={()=>setShowKey(value=>!value)} aria-label={showKey?"Ocultar chave":"Mostrar chave"}>{showKey?<EyeOff/>:<Eye/>}</button></div><small>A chave é enviada diretamente ao backend, criptografada e nunca exibida novamente.</small></label><label>Modelo dos insights<select name="model" defaultValue={connection?.model||"gpt-5.5"}><option value="gpt-5.5">GPT-5.5 — maior qualidade</option><option value="gpt-5.4">GPT-5.4 — equilíbrio</option><option value="gpt-5.4-mini">GPT-5.4 mini — menor custo</option></select><small>É possível trocar o modelo sem alterar o fluxo dos relatórios.</small></label><footer>{connection?.configured&&<><button type="button" className="secondary" disabled={saving} onClick={()=>void test()}><Plug/> Testar conexão</button>{connection.source==="SETTINGS"&&<button type="button" className="danger-row" disabled={saving} onClick={()=>void remove()}><Trash2/> Remover</button>}</>}<button className="primary" disabled={saving}><Save/>{saving?"Validando…":connection?.configured?"Validar e substituir":"Validar e conectar"}</button></footer></form>
    <div className="openai-safety-note"><ShieldCheck/><div><b>Proteção da credencial</b><p>O frontend recebe apenas o status, o modelo e os quatro últimos caracteres. A chave completa permanece criptografada no servidor.</p></div></div>
    {message&&<div className="settings-email-message success"><Check/>{message}</div>}{error&&<div className="settings-email-message error"><LockKeyhole/>{error}</div>}
  </>;
}
type EmailConnection = { method:"SMTP"|"GOOGLE";email:string;senderName:string;verifiedAt:string;configured:boolean };
function UserEmailSettings(){
  const [connection,setConnection]=useState<EmailConnection|null>(null),[googleAvailable,setGoogleAvailable]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const load=async()=>{const response=await fetch("/api/email-connection"),payload=await response.json();if(response.ok){setConnection(payload.connection||null);setGoogleAvailable(!!payload.googleOAuthAvailable)}setLoading(false)};
  useEffect(()=>{void load();const status=new URLSearchParams(window.location.search).get("email");if(status==="connected")setMessage("Conta Google conectada com sucesso.");if(status==="error")setError("Não foi possível concluir a conexão com o Google.")},[]);
  const saveSmtp=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError("");setMessage("");const response=await fetch("/api/email-connection",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))}),payload=await response.json();setSaving(false);if(!response.ok)return setError(payload.message||"Falha ao conectar.");setConnection(payload.connection);setMessage("Gmail conectado e validado.");event.currentTarget.reset()};
  const test=async()=>{setSaving(true);setError("");const response=await fetch("/api/email-connection/test",{method:"POST"}),payload=await response.json();setSaving(false);response.ok?setMessage("E-mail de teste enviado para sua conta."):setError(payload.message||"Falha no teste.")};
  const connectGoogle=async()=>{setError("");const response=await fetch("/api/email-connection/google/start",{method:"POST"}),payload=await response.json();if(!response.ok)return setError(payload.message);window.location.href=payload.authUrl};
  const disconnect=async()=>{await fetch("/api/email-connection",{method:"DELETE"});setConnection(null);setMessage("Conexão removida.")};
  if(loading)return <p>Carregando configuração de e-mail…</p>;
  return <><SettingsHeader icon={Mail} title="E-mail e SMTP" text="Envie acessos do portal e relatórios usando sua própria conta Gmail."/>
    {connection&&<div className="email-connection-status"><span><Check/></span><div><b>{connection.email}</b><small>{connection.method==="GOOGLE"?"Conectado com Google":"Gmail SMTP"} · validado em {new Date(connection.verifiedAt).toLocaleString("pt-BR")}</small></div><button onClick={()=>void test()} disabled={saving}><Send/> Enviar teste</button><button className="danger-row" onClick={()=>void disconnect()}>Desconectar</button></div>}
    <div className="gmail-connect-choice"><button className="google-connect" disabled={!googleAvailable} onClick={()=>void connectGoogle()}><b>G</b><span><strong>Entrar com Google</strong><small>{googleAvailable?"Autorize o envio sem informar senha de app.":"OAuth Google ainda não configurado no servidor."}</small></span></button><i>ou</i></div>
    <form className="smtp-settings-form" onSubmit={saveSmtp}><label>Nome do remetente<input name="senderName" required defaultValue={connection?.senderName||""} placeholder="Seu nome ou nome da agência"/></label><label>E-mail Gmail / Workspace<input name="email" type="email" required defaultValue={connection?.email||""} placeholder="voce@seudominio.com.br"/></label><label className="full">Senha de app do Google<input name="appPassword" type="password" minLength={16} required placeholder="16 caracteres"/><small>Use uma senha de app; nunca informe a senha normal do Gmail.</small></label><div className="smtp-fixed-data"><span>Servidor <b>smtp.gmail.com</b></span><span>Segurança <b>SSL</b></span><span>Porta <b>465</b></span></div><button className="primary" disabled={saving}><Plug/>{saving?"Testando e salvando…":"Testar e conectar SMTP"}</button></form>
    {message&&<div className="settings-email-message success"><Check/>{message}</div>}{error&&<div className="settings-email-message error"><LockKeyhole/>{error}</div>}
  </>;
}
type MeetingRoom={id:string;name:string;location:string;capacity:number};
function MeetingRoomsSettings(){
  const [rooms,setRooms]=useState<MeetingRoom[]>(()=>{try{return JSON.parse(localStorage.getItem("pw-os-meeting-rooms")||"[]")}catch{return[]}});
  const persist=(next:MeetingRoom[])=>{setRooms(next);localStorage.setItem("pw-os-meeting-rooms",JSON.stringify(next))};
  const create=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget),name=String(data.get("name")||"").trim();if(!name)return;persist([...rooms,{id:crypto.randomUUID(),name,location:String(data.get("location")||"").trim(),capacity:Number(data.get("capacity")||0)}]);event.currentTarget.reset()};
  return <><SettingsHeader icon={DoorOpen} title="Salas de reunião" text="Cadastre os espaços físicos disponíveis para reuniões internas e com clientes."/><form className="meeting-room-create" onSubmit={create}><label>Nome da sala<input name="name" required placeholder="Ex.: Sala Horizonte"/></label><label>Localização<input name="location" placeholder="Ex.: 2º andar"/></label><label>Capacidade<input name="capacity" type="number" min="1" placeholder="8"/></label><button className="primary"><Plus/> Adicionar sala</button></form><div className="meeting-room-list">{rooms.map(room=><article key={room.id}><span><DoorOpen/></span><div><b>{room.name}</b><small>{room.location||"Local não informado"} · {room.capacity?`${room.capacity} pessoas`:"Capacidade não informada"}</small></div><button onClick={()=>persist(rooms.filter(item=>item.id!==room.id))} aria-label={`Excluir ${room.name}`}><Trash2/></button></article>)}{!rooms.length&&<p>Nenhuma sala cadastrada.</p>}</div></>
}

function SettingsHeader({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Settings;
  title: string;
  text: string;
}) {
  return (
    <header className="settings-content-head">
      <span>
        <Icon />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}
function Toggle({
  label,
  text,
  checked,
  onChange,
  badge,
}: {
  label: string;
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  badge?: string;
}) {
  return (
    <label>
      <span>
        <b>{label}</b>
        <small>{text}</small>
        {badge && <em>{badge}</em>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}
