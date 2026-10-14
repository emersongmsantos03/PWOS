import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  Loader2,
  RefreshCw,
  CircleDollarSign,
  Edit3,
  ExternalLink,
  FileBarChart,
  FolderKanban,
  Globe2,
  History,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { isValidDocument, maskDocument, maskPhone, maskPostalCode } from "./inputMasks";
import { SearchableSelect } from "./SearchableSelect";
import { branchLabel, type ClientBranch } from "./BranchSelect";
import { systemConfirm } from "./SystemDialog";
import "./ClientConnections.css";
import "./ClientRefinements.css";

type ClientStatus = "ACTIVE" | "ATTENTION" | "RISK" | "INACTIVE";
type Client = {
  id: string;
  name: string;
  legalName: string;
  document: string;
  status: ClientStatus;
  segment: string;
  website: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  owner: string;
  ownerId?: string;
  notes: string;
  address?: ClientAddress;
  branches?: ClientBranch[];
  createdAt: string;
  updatedAt: string;
};
type ClientAddress = { postalCode: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string };
// "Rua X, 123 - Sala 2 · Centro · Jaraguá do Sul/SC · 89251-000"
const formatAddress = (address?: ClientAddress) => {
  if (!address) return "";
  const street = [address.street, address.number].filter(Boolean).join(", ") + (address.complement ? ` - ${address.complement}` : "");
  return [street, address.neighborhood, [address.city, address.state].filter(Boolean).join("/"), address.postalCode].filter(Boolean).join(" · ");
};
const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
type TeamMember = { id: string; name: string; departmentName: string };
type CnpjData = { legalName: string; tradeName: string; segment: string; email: string; phone: string; status: string; openedAt: string; address: string; addressParts?: ClientAddress; phone2?: string; partners?: { name: string; role: string }[] };
type ReceitaContact = { key: string; name: string; role: string; phone: string };
type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  primary: boolean;
  createdAt: string;
  companyId?: string;
  companyName?: string;
};
type CompanyOption = { id: string; name: string; document: string; clientId: string };
type ContactOption = { id: string; name: string; role: string; email: string; phone: string; companyId: string; companyName: string; clientId: string };
type Service = {
  id: string;
  name: string;
  negotiatedValue: number;
  billingType: "RECURRING" | "ONE_TIME";
  startDate: string;
  managerUserId: string;
};
type ProjectStatus = "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
type ProjectTask = { id: string; title: string; status: "OPEN" | "DONE" };
type Project = {
  id: string;
  name: string;
  objective?: string;
  status: ProjectStatus;
  progress?: number;
  responsibleId?: string;
  startDate?: string;
  dueDate?: string;
  tasks?: ProjectTask[];
  createdAt?: string;
  updatedAt?: string;
};
type ProjectUser = { id: string; name: string };
const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNED: "Planejado",
  ACTIVE: "Em andamento",
  PAUSED: "Pausado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
const projectDate = (value?: string) =>
  value ? new Date(`${value}T12:00`).toLocaleDateString("pt-BR") : "";
const projectLate = (item: Project) =>
  !!item.dueDate &&
  ["PLANNED", "ACTIVE", "PAUSED"].includes(item.status) &&
  item.dueDate < new Date().toISOString().slice(0, 10);
type TimelineEvent = {
  id: string;
  description: string;
  actorName: string;
  createdAt: string;
  phase: "COMMERCIAL" | "CLIENT";
};
type ClientConnections = {
  mediaAccounts: {
    id: string;
    name: string;
    pageName?: string | null;
    platform: string;
    responsibleName: string;
    campaignCount: number;
  }[];
  mediaAssignmentCount: number;
  financeEntryCount: number;
  financeBalance: number | null;
  taskCount: number;
  eventCount: number;
};
type ClientPortalUser = { id: string; name: string; email: string; mustChangePassword: boolean };

const statusMeta: Record<ClientStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Ativo", className: "active" },
  ATTENTION: { label: "Em atenção", className: "attention" },
  RISK: { label: "Em risco", className: "risk" },
  INACTIVE: { label: "Inativo", className: "inactive" },
};

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const meta = statusMeta[status];
  return (
    <span className={`client-status-badge ${meta.className}`}>
      {status === "ACTIVE" ? <Check /> : <AlertTriangle />}
      {meta.label}
    </span>
  );
}

function ContactMultiPicker({ options, value, onChange }: { options: ContactOption[]; value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState(""), [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const filtered = options.filter((contact) =>
    `${contact.name} ${contact.email} ${contact.role} ${contact.companyName}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  return <div className={`client-contact-multi ${open ? "open" : ""}`} ref={root}>
    <button type="button" className="client-contact-multi-trigger" onClick={() => setOpen((current) => !current)}>
      <span>{value.length ? <><b>{value.length} contato{value.length > 1 ? "s" : ""} selecionado{value.length > 1 ? "s" : ""}</b><small>Clique para revisar a seleção</small></> : <><b>Escolher contatos</b><small>Pesquise e marque um ou vários</small></>}</span>
      <ChevronDown />
    </button>
    {open && <div className="client-contact-multi-popover">
      <div className="client-contact-multi-search"><Search/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, e-mail ou empresa..."/></div>
      <div className="client-contact-multi-options">
        {filtered.length ? filtered.map((contact) => {
          const selected = value.includes(contact.id);
          return <label className={selected ? "selected" : ""} key={contact.id}>
            <input type="checkbox" checked={selected} onChange={() => onChange(selected ? value.filter((id) => id !== contact.id) : [...value, contact.id])}/>
            <span><b>{contact.name}</b><small>{[contact.companyName, contact.role, contact.email].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}</small></span>
            {selected && <Check />}
          </label>;
        }) : <p>Nenhum contato encontrado.</p>}
      </div>
      <footer><small>{value.length} selecionado{value.length === 1 ? "" : "s"}</small><button type="button" onClick={() => setOpen(false)}>Concluir</button></footer>
    </div>}
  </div>;
}

export function ClientsManagement({ permissions = [], profile = "" }: { permissions?: string[]; profile?: string }) {
  const hasPermission = (permission: string) =>
    profile === "MASTER" || permissions.includes(permission);
  const canCreate = hasPermission("clients.create");
  const canEdit = hasPermission("clients.edit");
  const canDelete = hasPermission("clients.delete");
  const canCreateAccess = hasPermission("clients.create_access");
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ClientStatus>("ALL");
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const load = () =>
    fetch("/api/clients").then(async (response) => {
      const data = await response.json();
      if (response.ok) {
        const loadedClients = data.clients || [];
        setClients(loadedClients);
        setTeam(data.team || []);
        const requestedClient = new URLSearchParams(window.location.search).get("client");
        if (requestedClient) setViewing(loadedClients.find((item: Client) => item.id === requestedClient) || null);
      }
    });
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(
    () =>
      clients.filter((client) => {
        const term = search.toLowerCase();
        return (
          (status === "ALL" || client.status === status) &&
          (!term ||
            [
              client.name,
              client.legalName,
              client.segment,
              client.primaryContactName,
              client.primaryContactEmail,
              ...(client.branches || []).flatMap((branch) => [branch.name, branch.city]),
            ].some((value) => value?.toLowerCase().includes(term)))
        );
      }),
    [clients, search, status],
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const target = editing ? `/api/clients/${editing.id}` : "/api/clients";
    const response = await fetch(target, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setCreating(false);
    setEditing(null);
    await load();
  };
  const remove = async () => {
    if (!deleting) return;
    const response = await fetch(`/api/clients/${deleting.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (response.ok) {
      setDeleting(null);
      setViewing(null);
      await load();
    } else setDeleteError(data.message || "Não foi possível excluir este cliente.");
  };
  const counts = {
    active: clients.filter((c) => c.status === "ACTIVE").length,
    attention: clients.filter((c) => c.status === "ATTENTION").length,
    risk: clients.filter((c) => c.status === "RISK").length,
    inactive: clients.filter((c) => c.status === "INACTIVE").length,
  };
  return (
    <div className="page clients-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">CARTEIRA</span>
          <h1>Clientes</h1>
          <p>Cadastre, organize e acompanhe toda a carteira da PW Media.</p>
        </div>
        {canCreate && <button
          className="primary"
          onClick={() => {
            setCreating(true);
            setError("");
          }}
        >
          <Plus /> Novo cliente
        </button>}
      </div>
      <section className="client-summary-cards">
        <article>
          <span className="client-summary-icon">
            <Building2 />
          </span>
          <div>
            <small>Total de clientes</small>
            <strong>{clients.length}</strong>
          </div>
        </article>
        <article>
          <i className="active" />
          <div>
            <small>Ativos</small>
            <strong>{counts.active}</strong>
          </div>
        </article>
        <article>
          <i className="attention" />
          <div>
            <small>Em atenção</small>
            <strong>{counts.attention}</strong>
          </div>
        </article>
        <article>
          <i className="risk" />
          <div>
            <small>Em risco</small>
            <strong>{counts.risk}</strong>
          </div>
        </article>
        <article>
          <i className="inactive" />
          <div>
            <small>Inativos</small>
            <strong>{counts.inactive}</strong>
          </div>
        </article>
      </section>
      <section className="panel clients-panel">
        <div className="clients-toolbar">
          <div className="search clients-search">
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, segmento ou contato..."
            />
          </div>
          <label className="client-status-filter">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as typeof status)
              }
            >
              <option value="ALL">Todos</option>
              {Object.entries(statusMeta).map(([value, meta]) => (
                <option value={value} key={value}>
                  {meta.label}
                </option>
              ))}
            </select>
            <ChevronDown />
          </label>
        </div>
        {visible.length === 0 ? (
          <div className="clients-empty">
            <span>
              <BriefcaseBusiness />
            </span>
            <h2>
              {clients.length
                ? "Nenhum cliente encontrado"
                : "Sua carteira está vazia"}
            </h2>
            <p>
              {clients.length
                ? "Tente ajustar a busca ou o filtro de status."
                : "Cadastre o primeiro cliente para começar a organizar contas, campanhas e contatos."}
            </p>
            {!clients.length && canCreate && (
              <button className="primary" onClick={() => setCreating(true)}>
                <Plus /> Cadastrar primeiro cliente
              </button>
            )}
          </div>
        ) : (
          <div className="clients-table">
            <div className="clients-table-head">
              <span>Cliente</span>
              <span>Status</span>
              <span>Segmento</span>
              <span>Contato principal</span>
              <span>Responsável</span>
              <span />
            </div>
            {visible.map((client) => (
              <button
                className="client-row"
                key={client.id}
                onClick={() => setViewing(client)}
              >
                <span className="client-company-avatar">
                  {client.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="client-main-cell">
                  <b>{client.name}</b>
                  <small>
                    {client.legalName ||
                      client.document ||
                      "Cadastro empresarial"}
                  </small>
                </span>
                <ClientStatusBadge status={client.status} />
                <span>{client.segment || "Não informado"}</span>
                <span className="client-contact-cell">
                  <b>{client.primaryContactName || "Sem contato"}</b>
                  <small>{client.primaryContactEmail}</small>
                </span>
                <span>{client.owner || "Não atribuído"}</span>
                <MoreHorizontal />
              </button>
            ))}
          </div>
        )}
      </section>
      {((creating && canCreate) || (editing && canEdit)) && (
        <ClientForm
          client={editing}
          team={team}
          error={error}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setError("");
          }}
          onSave={save}
        />
      )}
      {viewing && (
        <ClientDetails
          client={viewing}
          canEdit={canEdit}
          canDelete={canDelete}
          canCreateAccess={canCreateAccess}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
            setError("");
          }}
          onDelete={() => {
            setDeleting(viewing);
            setViewing(null);
            setDeleteError("");
          }}
        />
      )}
      {deleting && (
        <DeleteClient
          client={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          error={deleteError}
        />
      )}
    </div>
  );
}

function ClientForm({
  client,
  team,
  error,
  onClose,
  onSave,
}: {
  client: Client | null;
  team: TeamMember[];
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null), lastLookup = useRef("");
  // Cadastros antigos guardavam só o nome: reaproveita o usuário com o mesmo nome, se houver.
  const [ownerId, setOwnerId] = useState(() => client?.ownerId || team.find((member) => member.name === client?.owner)?.id || "");
  const [lookup, setLookup] = useState<{ state: "idle" | "loading" | "done" | "error"; message?: string; data?: CnpjData }>({ state: "idle" });
  const legacyOwner = !ownerId && client?.owner ? client.owner : "";
  const [receitaContacts, setReceitaContacts] = useState<ReceitaContact[]>([]), [pickedContacts, setPickedContacts] = useState<string[]>([]);
  // Busca o CNPJ na Receita e preenche só os campos ainda vazios, sem apagar o que foi digitado.
  const lookupCnpj = async (masked: string, force = false) => {
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 14 || !isValidDocument(masked) || (!force && lastLookup.current === digits)) return;
    lastLookup.current = digits;
    setLookup({ state: "loading" });
    try {
      const response = await fetch(`/api/clients/cnpj/${digits}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setLookup({ state: "error", message: payload.message || "Não foi possível consultar o CNPJ." });
      const data = payload as CnpjData, form = formRef.current;
      const fill = (name: string, value: string) => {
        const field = form?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
        if (field && value && !field.value.trim()) field.value = value;
      };
      fill("name", data.tradeName || data.legalName);
      fill("legalName", data.legalName);
      fill("segment", data.segment);
      // O sócio-administrador vira o contato principal; os demais sócios e o segundo telefone
      // aparecem para escolher quais entram em Contatos.
      const primaryField = form?.elements.namedItem("primaryContactName") as HTMLInputElement | null;
      const primaryName = primaryField?.value.trim() || data.partners?.[0]?.name || "";
      fill("primaryContactName", data.partners?.[0]?.name || "");
      fill("primaryContactEmail", data.email);
      fill("primaryContactPhone", maskPhone(data.phone));
      const candidates: ReceitaContact[] = [
        ...(data.partners || []).filter((partner) => partner.name.toLowerCase() !== primaryName.toLowerCase()).map((partner) => ({ key: `p:${partner.name}`, name: partner.name, role: partner.role || "Sócio", phone: "" })),
        ...(data.phone2 ? [{ key: "phone2", name: `${data.tradeName || data.legalName} (telefone 2)`, role: "Telefone da empresa (Receita)", phone: data.phone2 }] : []),
      ];
      setReceitaContacts(candidates);
      setPickedContacts(candidates.map((item) => item.key));
      const parts = data.addressParts;
      if (parts) {
        fill("addressPostalCode", parts.postalCode); fill("addressStreet", parts.street); fill("addressNumber", parts.number);
        fill("addressComplement", parts.complement); fill("addressNeighborhood", parts.neighborhood); fill("addressCity", parts.city); fill("addressState", parts.state);
      }
      setLookup({ state: "done", data });
    } catch {
      setLookup({ state: "error", message: "Não foi possível consultar o CNPJ agora. Preencha manualmente." });
    }
  };
  // CEP completo: busca rua, bairro, cidade e UF e preenche só o que ainda está vazio.
  const [postalLookup, setPostalLookup] = useState<{ state: "idle" | "loading" | "done" | "error"; message?: string }>({ state: "idle" }), lastPostal = useRef("");
  const lookupPostalCode = async (masked: string) => {
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8 || lastPostal.current === digits) return;
    lastPostal.current = digits;
    setPostalLookup({ state: "loading" });
    try {
      const response = await fetch(`/api/clients/cep/${digits}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setPostalLookup({ state: "error", message: payload.message || "CEP não encontrado." });
      const form = formRef.current;
      const fill = (name: string, value: string) => {
        const field = form?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
        if (field && value && !field.value.trim()) field.value = value;
      };
      fill("addressStreet", payload.street); fill("addressNeighborhood", payload.neighborhood); fill("addressCity", payload.city); fill("addressState", payload.state);
      setPostalLookup({ state: "done" });
      (form?.elements.namedItem(payload.street ? "addressNumber" : "addressStreet") as HTMLInputElement | null)?.focus();
    } catch {
      setPostalLookup({ state: "error", message: "Não foi possível consultar o CEP agora. Preencha manualmente." });
    }
  };
  const address = client?.address;
  return (
    <div className="modal-backdrop">
      <section className="client-form-modal" role="dialog" aria-modal="true">
        <header>
          <span>
            <Building2 />
          </span>
          <div>
            <h2>{client ? "Editar cliente" : "Novo cliente"}</h2>
            <p>
              {client
                ? "Atualize os dados cadastrais e operacionais."
                : "Adicione uma nova empresa à carteira da PW Media."}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form ref={formRef} onSubmit={onSave}>
          <div className="client-form-section">
            <div className="client-form-section-title">
              <b>Dados da empresa</b>
              <span>Informações principais do cadastro</span>
            </div>
            <div className="client-form-grid">
              <label>
                Nome de exibição *
                <input
                  name="name"
                  defaultValue={client?.name}
                  required
                  autoFocus
                  placeholder="Ex.: Solar Prime"
                />
              </label>
              <label>
                Razão social
                <input
                  name="legalName"
                  defaultValue={client?.legalName}
                  placeholder="Nome empresarial completo"
                />
              </label>
              <label>
                CPF / CNPJ
                <input
                  name="document"
                  defaultValue={maskDocument(client?.document || "")}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  inputMode="numeric"
                  onInput={(event) => {
                    const input = event.currentTarget;
                    input.value = maskDocument(input.value);
                    input.setCustomValidity(
                      input.value && !isValidDocument(input.value)
                        ? "Informe um CPF ou CNPJ válido."
                        : "",
                    );
                    void lookupCnpj(input.value);
                  }}
                />
                {lookup.state === "loading" ? <small className="client-cnpj-status"><Loader2 className="spin" />Buscando dados na Receita Federal…</small>
                  : lookup.state === "done" && lookup.data ? <small className={`client-cnpj-status ${lookup.data.status && lookup.data.status !== "ATIVA" ? "warn" : "ok"}`}><Check />Receita Federal: situação {lookup.data.status || "não informada"}{lookup.data.openedAt ? ` · aberta em ${lookup.data.openedAt.split("-").reverse().join("/")}` : ""}. Campos vazios preenchidos.</small>
                  : lookup.state === "error" ? <small className="client-cnpj-status warn"><AlertTriangle />{lookup.message} <button type="button" onClick={() => { const field = formRef.current?.elements.namedItem("document") as HTMLInputElement | null; if (field) void lookupCnpj(field.value, true); }}><RefreshCw />Tentar de novo</button></small>
                  : <small>Com um CNPJ válido, os dados da Receita Federal são preenchidos automaticamente.</small>}
              </label>
              <label>
                Segmento
                <input
                  name="segment"
                  defaultValue={client?.segment}
                  placeholder="Ex.: Energia solar"
                />
              </label>
              <label>
                Website
                <input
                  name="website"
                  defaultValue={client?.website}
                  type="url"
                  placeholder="https://empresa.com.br"
                />
              </label>
              <label>
                Status
                <select name="status" defaultValue={client?.status || "ACTIVE"}>
                  {Object.entries(statusMeta).map(([value, meta]) => (
                    <option value={value} key={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="client-form-section">
            <div className="client-form-section-title">
              <b>Endereço</b>
              <span>Digite o CEP para preencher rua, bairro e cidade</span>
            </div>
            <div className="client-form-grid client-address-grid">
              <label>
                CEP
                <input
                  name="addressPostalCode"
                  defaultValue={address?.postalCode}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  onInput={(event) => {
                    event.currentTarget.value = maskPostalCode(event.currentTarget.value);
                    void lookupPostalCode(event.currentTarget.value);
                  }}
                />
                {postalLookup.state === "loading" ? <small className="client-cnpj-status"><Loader2 className="spin" />Buscando o CEP…</small>
                  : postalLookup.state === "error" ? <small className="client-cnpj-status warn"><AlertTriangle />{postalLookup.message}</small>
                  : postalLookup.state === "done" ? <small className="client-cnpj-status ok"><Check />Endereço encontrado. Confira o número.</small> : null}
              </label>
              <label className="client-address-street">
                Rua / Avenida
                <input name="addressStreet" defaultValue={address?.street} autoComplete="address-line1" placeholder="Ex.: Rua Walter Marquardt" />
              </label>
              <label>
                Número
                <input name="addressNumber" defaultValue={address?.number} placeholder="Ex.: 1250" />
              </label>
              <label>
                Complemento
                <input name="addressComplement" defaultValue={address?.complement} autoComplete="address-line2" placeholder="Sala, loja, bloco…" />
              </label>
              <label>
                Bairro
                <input name="addressNeighborhood" defaultValue={address?.neighborhood} placeholder="Bairro" />
              </label>
              <label>
                Cidade
                <input name="addressCity" defaultValue={address?.city} autoComplete="address-level2" placeholder="Cidade" />
              </label>
              <label>
                UF
                <select name="addressState" defaultValue={address?.state || ""}>
                  <option value="">—</option>
                  {brazilianStates.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
            </div>
          </div>
          <BranchesEditor initial={client?.branches || []} />
          <div className="client-form-section">
            <div className="client-form-section-title">
              <b>Contato e atendimento</b>
              <span>
                Quem devemos procurar e quem é responsável internamente
              </span>
            </div>
            <div className="client-form-grid">
              <label>
                Contato principal
                <input
                  name="primaryContactName"
                  defaultValue={client?.primaryContactName}
                  placeholder="Nome do contato"
                />
              </label>
              <label>
                E-mail do contato
                <input
                  name="primaryContactEmail"
                  defaultValue={client?.primaryContactEmail}
                  type="email"
                  placeholder="contato@empresa.com"
                />
              </label>
              <label>
                Telefone
                <input
                  name="primaryContactPhone"
                  defaultValue={maskPhone(client?.primaryContactPhone || "")}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  onInput={(event) => {
                    event.currentTarget.value = maskPhone(
                      event.currentTarget.value,
                    );
                  }}
                />
              </label>
              <label>
                Responsável interno
                <input type="hidden" name="ownerId" value={ownerId} />
                <input type="hidden" name="owner" value={legacyOwner} />
                <SearchableSelect
                  value={ownerId}
                  onChange={setOwnerId}
                  placeholder={legacyOwner || "Selecione quem atende o cliente"}
                  searchPlaceholder="Buscar pessoa da equipe…"
                  options={[{ value: "", label: legacyOwner ? `${legacyOwner} (sem usuário vinculado)` : "Sem responsável" }, ...team.map((member) => ({ value: member.id, label: member.name, description: member.departmentName || undefined }))]}
                />
              </label>
              {receitaContacts.length > 0 && <div className="full-field client-receita-contacts">
                <input type="hidden" name="receitaContacts" value={JSON.stringify(receitaContacts.filter((item) => pickedContacts.includes(item.key)).map(({ name, role, phone }) => ({ name, role, phone })))} />
                <b>Contatos encontrados na Receita Federal</b>
                <small>Os marcados entram na aba Contatos do cliente ao salvar.</small>
                <div>{receitaContacts.map((item) => <label key={item.key} className="inline-check">
                  <input type="checkbox" checked={pickedContacts.includes(item.key)} onChange={(event) => setPickedContacts((current) => event.target.checked ? [...current, item.key] : current.filter((key) => key !== item.key))} />
                  <span><b>{item.name}</b><small>{item.role}{item.phone ? ` · ${maskPhone(item.phone)}` : ""}</small></span>
                </label>)}</div>
              </div>}
              <label className="full-field">
                Observações
                <textarea
                  name="notes"
                  defaultValue={client?.notes}
                  placeholder="Contexto, preferências e informações importantes..."
                />
              </label>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">
              {client ? "Salvar alterações" : "Criar cliente"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

type BranchDraft = ClientBranch & { key: string };
const newBranch = (): BranchDraft => ({ key: crypto.randomUUID(), id: "", name: "", document: "", city: "", state: "", contactName: "", contactPhone: "", active: true });
// Filiais do cliente, enviadas junto com o cadastro (campo `branches`, em JSON).
function BranchesEditor({ initial }: { initial: ClientBranch[] }) {
  const [branches, setBranches] = useState<BranchDraft[]>(() => initial.map((branch) => ({ ...branch, key: branch.id })));
  const update = (key: string, patch: Partial<ClientBranch>) => setBranches((current) => current.map((branch) => branch.key === key ? { ...branch, ...patch } : branch));
  return (
    <div className="client-form-section client-branches">
      <div className="client-form-section-title">
        <b>Filiais</b>
        <span>Lojas e unidades do cliente. Elas aparecem para escolha nos chamados, reuniões, tarefas, agenda, financeiro e mídia.</span>
      </div>
      <input type="hidden" name="branches" value={JSON.stringify(branches.map(({ key: _key, ...branch }) => branch))} />
      {branches.length ? <div className="client-branch-list">{branches.map((branch, index) => (
        <article key={branch.key} className={branch.active ? "" : "inactive"}>
          <header><b>Filial {index + 1}</b><label className="inline-check"><input type="checkbox" checked={branch.active} onChange={(event) => update(branch.key, { active: event.target.checked })} />Ativa</label><button type="button" onClick={() => setBranches((current) => current.filter((item) => item.key !== branch.key))} aria-label={`Remover ${branch.name || `filial ${index + 1}`}`}><Trash2 /></button></header>
          <div className="client-form-grid">
            <label>Nome da filial *<input value={branch.name} required maxLength={120} placeholder="Ex.: Loja Centro, Cambé - PR" onChange={(event) => update(branch.key, { name: event.target.value })} /></label>
            <label>CNPJ<input value={maskDocument(branch.document)} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={(event) => { const input = event.currentTarget; input.setCustomValidity(input.value && !isValidDocument(maskDocument(input.value)) ? "Informe um CNPJ válido." : ""); update(branch.key, { document: maskDocument(input.value) }); }} /></label>
            <label>Cidade<input value={branch.city} maxLength={80} placeholder="Cidade" onChange={(event) => update(branch.key, { city: event.target.value })} /></label>
            <label>UF<select value={branch.state} onChange={(event) => update(branch.key, { state: event.target.value })}><option value="">—</option>{brazilianStates.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
            <label>Contato da filial<input value={branch.contactName} maxLength={120} placeholder="Nome do contato" onChange={(event) => update(branch.key, { contactName: event.target.value })} /></label>
            <label>Telefone<input value={maskPhone(branch.contactPhone)} inputMode="tel" placeholder="(00) 00000-0000" onChange={(event) => update(branch.key, { contactPhone: maskPhone(event.target.value) })} /></label>
          </div>
        </article>
      ))}</div> : <p className="client-branch-empty">Nenhuma filial cadastrada. Clientes com uma única unidade não precisam de filiais.</p>}
      <button type="button" className="secondary client-branch-add" onClick={() => setBranches((current) => [...current, newBranch()])}><Plus /> Adicionar filial</button>
    </div>
  );
}

function ClientBranches({ branches, canEdit, onEdit }: { branches: ClientBranch[]; canEdit: boolean; onEdit: () => void }) {
  return (
    <section className="client-branches-tab">
      <div className="client-branches-heading"><div><h3><Building2 /> Filiais</h3><p>Lojas e unidades disponíveis para escolha nos demais módulos.</p></div>{canEdit && <button type="button" className="primary" onClick={onEdit}><Plus /> Adicionar ou editar filiais</button>}</div>
      {branches.length ? <div className="client-branches-grid">{branches.map((branch) => (
        <article key={branch.id} className={branch.active ? "" : "inactive"}>
          <header><b>{branch.name}</b><em>{branch.active ? "Ativa" : "Inativa"}</em></header>
          <dl>
            <div><dt>Local</dt><dd>{branch.city ? branchLabel(branch).split(" · ").slice(1).join(" · ") : "—"}</dd></div>
            <div><dt>CNPJ</dt><dd>{branch.document ? maskDocument(branch.document) : "—"}</dd></div>
            <div><dt>Contato</dt><dd>{branch.contactName || "—"}{branch.contactPhone ? ` · ${maskPhone(branch.contactPhone)}` : ""}</dd></div>
          </dl>
        </article>
      ))}</div> : <p className="client-branch-empty">Nenhuma filial cadastrada.{canEdit ? " Use o botão acima para adicionar." : ""}</p>}
    </section>
  );
}

function ClientDetails({
  client,
  canEdit,
  canDelete,
  canCreateAccess,
  onClose,
  onEdit,
  onDelete,
}: {
  client: Client;
  canEdit: boolean;
  canDelete: boolean;
  canCreateAccess: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<
      "OVERVIEW" | "ACCESS" | "CONTACTS" | "BRANCHES" | "SERVICES" | "PROJECTS" | "HISTORY"
    >("OVERVIEW"),
    [contacts, setContacts] = useState<Contact[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [projectUsers, setProjectUsers] = useState<ProjectUser[]>([]),
    [editingProject, setEditingProject] = useState<Project | "NEW" | null>(null),
    [timeline, setTimeline] = useState<TimelineEvent[]>([]),
    [connections, setConnections] = useState<ClientConnections>({
      mediaAccounts: [],
      mediaAssignmentCount: 0,
      financeEntryCount: 0,
      financeBalance: null,
      taskCount: 0,
      eventCount: 0,
    }),
    [adding, setAdding] = useState<null | "CONTACT" | "SERVICE">(
      null,
    ),
    [error, setError] = useState("");
  const [availableCompanies, setAvailableCompanies] = useState<CompanyOption[]>([]),
    [availableContacts, setAvailableContacts] = useState<ContactOption[]>([]),
    [linkedCompanies, setLinkedCompanies] = useState<CompanyOption[]>([]),
    [companyChoice, setCompanyChoice] = useState(""),
    [contactChoices, setContactChoices] = useState<string[]>([]);
  const [portalUsers, setPortalUsers] = useState<ClientPortalUser[]>([]), [addingAccess, setAddingAccess] = useState(false);
  const load = () =>
    Promise.all([fetch(`/api/clients/${client.id}`), fetch(`/api/clients/${client.id}/users`)]).then(async ([response, accessResponse]) => {
      const data = await response.json(), accessData = await accessResponse.json();
      if (response.ok) {
        setContacts(data.contacts || []);
        setServices(data.services || []);
        setProjects(data.projects || []);
        setProjectUsers(data.projectUsers || []);
        setTimeline(data.timeline || []);
        setAvailableCompanies(data.availableCompanies || []);
        setAvailableContacts(data.availableContacts || []);
        setLinkedCompanies(data.linkedCompanies || []);
        setConnections(
          data.connections || {
            mediaAccounts: [],
            mediaAssignmentCount: 0,
            financeEntryCount: 0,
            financeBalance: null,
            taskCount: 0,
            eventCount: 0,
          },
        );
      }
      if (accessResponse.ok) setPortalUsers(accessData.users || []);
    });
  useEffect(() => {
    void load();
  }, [client.id]);
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adding) return;
    const formData = new FormData(event.currentTarget),
      input = {
        ...Object.fromEntries(formData),
        teamIds: formData.getAll("teamIds").map(String),
      };
    const path = adding === "CONTACT" ? "contacts" : "services";
    const response = await fetch(`/api/clients/${client.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setAdding(null);
    setError("");
    await load();
  };
  const removeContact = async (id: string) => {
    if (!await systemConfirm({ title: "Desvincular este contato?", message: "O contato deixará de aparecer neste cliente, mas seu cadastro será preservado no CRM.", confirmLabel: "Desvincular contato", tone: "warning" })) return;
    const response = await fetch(`/api/clients/${client.id}/contacts/${id}`, {
      method: "DELETE",
    });
    if (response.ok) await load();
  };
  const linkContact = async () => {
    if (!contactChoices.length) return;
    const responses = await Promise.all(contactChoices.map((contactId) => fetch(`/api/clients/${client.id}/contact-links`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId }),
    })));
    const failed = responses.find((response) => !response.ok);
    if (failed) return setError((await failed.json()).message || "Não foi possível associar todos os contatos.");
    setContactChoices([]); setError(""); await load();
  };
  const linkCompany = async () => {
    if (!companyChoice) return;
    const response = await fetch(`/api/clients/${client.id}/company-link`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: companyChoice }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setCompanyChoice(""); setError(""); await load();
  };
  const monthly = services
    .filter((item) => item.billingType === "RECURRING")
    .reduce((sum, item) => sum + item.negotiatedValue, 0);
  const createAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const response = await fetch(`/api/clients/${client.id}/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const payload = await response.json();
    if (!response.ok) return setError(payload.message);
    setAddingAccess(false); await load();
  };
  return (
    <div className="modal-backdrop client-details-backdrop">
      <aside className="client-details client-details-wide">
        <header>
          <button onClick={onClose}>
            <X />
          </button>
          <span className="client-detail-logo">
            {client.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <ClientStatusBadge status={client.status} />
            <h2>{client.name}</h2>
            <p>{client.legalName || "Cliente PW Media"}</p>
          </div>
        </header>
        {canEdit || canDelete ? <div className="client-detail-actions">
          {canEdit && <button className="secondary client-edit-trigger" onClick={onEdit}>
            <Edit3 /> Editar dados
          </button>}
          {canEdit && <button type="button" className="primary client-save-trigger" onClick={onClose}>
            <Save /> Salvar e fechar
          </button>}
          {canDelete && <button type="button" className="client-delete-trigger" onClick={onDelete} title="Excluir cliente" aria-label={`Excluir ${client.name}`}>
            <Trash2 />
          </button>}
        </div> : <div className="client-readonly-banner"><ShieldCheck /><span><b>Modo de visualização</b><small>Você pode consultar os dados deste cliente.</small></span></div>}
        <section className="client-detail-kpis">
          <article><span className="client-kpi-icon revenue"><CircleDollarSign /></span><div><small>Receita mensal</small><b>{monthly.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b><em>Contratos recorrentes</em></div></article>
          <article><span className="client-kpi-icon projects"><FolderKanban /></span><div><small>Projetos ativos</small><b>{projects.filter((item) => ["PLANNED", "ACTIVE"].includes(item.status)).length}</b><em>Em andamento</em></div></article>
          <article><span className="client-kpi-icon contacts"><Users /></span><div><small>Contatos</small><b>{contacts.length}</b><em>Total cadastrado</em></div></article>
          <article><span className="client-kpi-icon demands"><History /></span><div><small>Demandas e eventos</small><b>{connections.taskCount + connections.eventCount}</b><em>Visão consolidada</em></div></article>
        </section>
        <nav className="client-detail-tabs">
          {[
            ["OVERVIEW", "Visão geral"],
            ["ACCESS", `Acessos (${portalUsers.length}/2)`],
            ["CONTACTS", `Contatos (${contacts.length})`],
            ["BRANCHES", `Filiais (${client.branches?.length || 0})`],
            ["SERVICES", `Serviços (${services.length})`],
            ["PROJECTS", `Projetos (${projects.length})`],
            ["HISTORY", "Histórico"],
          ].map(([key, label]) => (
            <button
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => setTab(key as typeof tab)}
            >
              {label}
            </button>
          ))}
        </nav>
        <main>
          {tab === "ACCESS" && <section className="client-access-section"><div className="client-access-heading"><div><h3><Users/> Portal do Cliente</h3><p>Até 2 usuários, com visualização somente das campanhas vinculadas.</p><small>Link de acesso: <b>/portal-cliente</b></small></div>{canCreateAccess && <button className="primary" disabled={portalUsers.length >= 2} onClick={() => setAddingAccess(true)}><Plus/> Criar acesso</button>}</div><div className="client-access-list">{portalUsers.map(user => <article key={user.id}><span className="client-company-avatar">{user.name.slice(0,2).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div><em>{user.mustChangePassword ? "Troca de senha pendente" : "Acesso ativo"}</em></article>)}{Array.from({ length: 2 - portalUsers.length }).map((_, index) => <article className="empty" key={index}><span><UserRound/></span><div><b>Acesso disponível</b><small>Cadastre outro usuário deste cliente</small></div></article>)}</div>{error && <div className="form-error">{error}</div>}</section>}
          {tab === "BRANCHES" && <ClientBranches branches={client.branches || []} canEdit={canEdit} onEdit={onEdit} />}
          {tab === "OVERVIEW" && (
            <>
              <section className="client-operational-summary client-summary-legacy">
                <article>
                  <Users />
                  <span>
                    <small>Contatos</small>
                    <b>{contacts.length}</b>
                  </span>
                </article>
                <article>
                  <CircleDollarSign />
                  <span>
                    <small>Receita mensal</small>
                    <b>
                      {monthly.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </b>
                  </span>
                </article>
                <article>
                  <FolderKanban />
                  <span>
                    <small>Projetos ativos</small>
                    <b>
                      {
                        projects.filter((item) =>
                          ["PLANNED", "ACTIVE"].includes(item.status),
                        ).length
                      }
                    </b>
                  </span>
                </article>
                <article>
                  <Globe2 />
                  <span>
                    <small>Contas de mídia</small>
                    <b>{connections.mediaAccounts.length}</b>
                  </span>
                </article>
                <article>
                  <History />
                  <span>
                    <small>Demandas e eventos</small>
                    <b>{connections.taskCount + connections.eventCount}</b>
                  </span>
                </article>
              </section>
              <section>
                <h3>Dados da empresa</h3>
                <dl>
                  <div>
                    <dt>Documento</dt>
                    <dd>{client.document || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Segmento</dt>
                    <dd>{client.segment || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Website</dt>
                    <dd>
                      {client.website ? (
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {client.website}
                          <ExternalLink />
                        </a>
                      ) : (
                        "Não informado"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Responsável interno</dt>
                    <dd>{client.owner || "Não atribuído"}</dd>
                  </div>
                  <div className="client-address-detail">
                    <dt>Endereço</dt>
                    <dd>{formatAddress(client.address) ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(client.address))}`} target="_blank" rel="noreferrer">{formatAddress(client.address)}<ExternalLink /></a> : "Não informado"}</dd>
                  </div>
                </dl>
              </section>
              <section className="client-system-connections">
                <div className="client-connections-heading">
                  <div>
                    <h3>Cliente conectado ao sistema</h3>
                    <p>
                      Tudo que usa este cliente passa a compor uma única visão.
                    </p>
                  </div>
                  <span>
                    <Check /> Dados persistidos
                  </span>
                </div>
                <div className="client-connection-grid">
                  <article className={connections.mediaAssignmentCount ? "connected" : ""}>
                    <Globe2 />
                    <span>
                      <small>Inteligência de campanha</small>
                      <b>{connections.mediaAssignmentCount} conta(s)</b>
                    </span>
                    <i />
                  </article>
                  <article className={connections.financeEntryCount ? "connected" : ""}>
                    <CircleDollarSign />
                    <span>
                      <small>Financeiro</small>
                      <b>{connections.financeEntryCount} lançamento(s)</b>
                      {connections.financeBalance !== null && (
                        <em>
                          Saldo {connections.financeBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </em>
                      )}
                    </span>
                    <i />
                  </article>
                  <article className={connections.taskCount ? "connected" : ""}>
                    <FolderKanban />
                    <span>
                      <small>Operação</small>
                      <b>{connections.taskCount} demanda(s)</b>
                    </span>
                    <i />
                  </article>
                  <article className={connections.eventCount ? "connected" : ""}>
                    <History />
                    <span>
                      <small>Agenda</small>
                      <b>{connections.eventCount} evento(s)</b>
                    </span>
                    <i />
                  </article>
                </div>
                <div className="client-media-heading">
                  <div>
                    <h3>Contas e campanhas</h3>
                    <p>Contas vinculadas a este cadastro na Mídia Paga.</p>
                  </div>
                  <nav>
                    <a href={`/midia/relatorios?reportClient=${encodeURIComponent(client.id)}`}><FileBarChart /> Gerar relatório</a>
                    {canEdit && <a href={`/midia/gestao?client=${encodeURIComponent(client.id)}`}><Globe2 /> Gerenciar vínculos</a>}
                  </nav>
                </div>
                {connections.mediaAccounts.length ? (
                  <div className="client-media-accounts">
                    {connections.mediaAccounts.map((account) => (
                      <article key={account.id}>
                        <span className="client-media-logo">∞</span>
                        <div>
                          <b>{account.pageName || account.name}</b>
                          <small>{account.platform === "GOOGLE_ADS" ? "Google Ads" : "Meta Ads"} · {account.campaignCount} campanha(s)</small>
                        </div>
                        <span>
                          <small>Responsável</small>
                          <b>{account.responsibleName}</b>
                        </span>
                        <i>
                          <Check /> Vinculada
                        </i>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="client-module-empty">
                    <Globe2 />
                    <p>Nenhuma conta de anúncios vinculada.</p>
                    {canEdit && <a href="/midia">Vincular na Mídia Paga</a>}
                  </div>
                )}
              </section>
              {client.notes && (
                <section>
                  <h3>Observações</h3>
                  <p className="client-notes">{client.notes}</p>
                </section>
              )}
            </>
          )}
          {tab === "CONTACTS" && (
            <ClientContacts
              contacts={contacts}
              companies={availableCompanies}
              contactOptions={availableContacts}
              linkedCompany={linkedCompanies[0]}
              companyChoice={companyChoice}
              contactChoices={contactChoices}
              onCompanyChoice={setCompanyChoice}
              onContactChoices={setContactChoices}
              onLinkCompany={linkCompany}
              onLinkContact={linkContact}
              canEdit={canEdit}
              onAdd={() => setAdding("CONTACT")}
              onRemove={removeContact}
            />
          )}{" "}
          {tab === "SERVICES" && (
            <ClientServices
              services={services}
              canEdit={canEdit}
              onAdd={() => setAdding("SERVICE")}
            />
          )}{" "}
          {tab === "PROJECTS" && (
            <ClientProjects
              projects={projects}
              users={projectUsers}
              canEdit={canEdit}
              onAdd={() => setEditingProject("NEW")}
              onOpen={setEditingProject}
            />
          )}{" "}
          {tab === "HISTORY" && <ClientTimeline timeline={timeline} />}
        </main>
        {adding && canEdit && createPortal(
          <ClientSubForm
            kind={adding}
            error={error}
            onClose={() => setAdding(null)}
            onSave={add}
          />
        , document.body)}
        {editingProject && createPortal(
          <ProjectEditor
            key={editingProject === "NEW" ? "new" : editingProject.id}
            clientId={client.id}
            project={editingProject === "NEW" ? null : editingProject}
            users={projectUsers}
            canEdit={canEdit}
            onClose={() => setEditingProject(null)}
            onSaved={async () => {
              setEditingProject(null);
              await load();
            }}
          />,
          document.body,
        )}
        {addingAccess && createPortal(<div className="modal-backdrop client-access-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddingAccess(false); }}><section className="client-access-modal" role="dialog" aria-modal="true" aria-labelledby="client-access-title"><header><span><Users/></span><div><small>NOVO USUÁRIO</small><h2 id="client-access-title">Criar acesso do cliente</h2><p>Este acesso será exclusivo para consulta de campanhas.</p></div><button type="button" onClick={() => setAddingAccess(false)} aria-label="Fechar"><X/></button></header><form onSubmit={createAccess}><div className="client-access-notice"><ShieldCheck/><div><b>Acesso protegido e somente leitura</b><p>O usuário poderá visualizar apenas os portfólios Meta e Google vinculados a {client.name}. Nenhuma edição será permitida.</p></div></div><div className="client-access-fields"><label>Nome completo <span>*</span><input name="name" required autoFocus placeholder="Ex.: João da Silva" autoComplete="name"/></label><label>E-mail de acesso <span>*</span><input name="email" type="email" required placeholder="joao@empresa.com.br" autoComplete="email"/></label><label className="client-password-field">Senha temporária <span>*</span><input name="password" type="password" minLength={6} required autoComplete="new-password" placeholder="Mínimo de 6 caracteres"/><small><LockKeyhole/> No primeiro login, o cliente será obrigado a criar uma nova senha.</small></label></div>{error && <div className="form-error"><AlertTriangle/>{error}</div>}<div className="client-portal-link"><ExternalLink/><span><small>LINK DE ACESSO</small><b>{window.location.origin}/portal-cliente</b></span></div><footer><button type="button" className="secondary" onClick={() => setAddingAccess(false)}>Cancelar</button><button className="primary"><UserRound/> Criar acesso</button></footer></form></section></div>, document.body)}
      </aside>
    </div>
  );
}

function ClientContacts({
  contacts,
  companies,
  contactOptions,
  linkedCompany,
  companyChoice,
  contactChoices,
  onCompanyChoice,
  onContactChoices,
  onLinkCompany,
  onLinkContact,
  canEdit,
  onAdd,
  onRemove,
}: {
  contacts: Contact[];
  companies: CompanyOption[];
  contactOptions: ContactOption[];
  linkedCompany?: CompanyOption;
  companyChoice: string;
  contactChoices: string[];
  onCompanyChoice: (value: string) => void;
  onContactChoices: (value: string[]) => void;
  onLinkCompany: () => void;
  onLinkContact: () => void;
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <div className="client-section-head">
        <div>
          <h3>Contatos do cliente</h3>
          <p>Decisores, financeiro e demais pontos de contato.</p>
        </div>
        {canEdit && <button className="primary" onClick={onAdd}>
          <Plus /> Criar novo contato
        </button>}
      </div>
      {canEdit && (
        <div className="client-association-panel">
          <div className="client-association-heading">
            <div>
              <b>Conectar cadastros existentes</b>
              <small>Escolha abaixo e confirme. O vínculo é salvo na hora.</small>
            </div>
            <span className="client-autosave-badge"><Check /> Salvamento automático</span>
          </div>
          <div className="client-association-grid">
            <div className="client-association-card">
              <header><i>1</i><span><b>Associar uma empresa</b><small>{linkedCompany ? `Empresa atual: ${linkedCompany.name}` : "Nenhuma empresa associada"}</small></span><Building2 /></header>
              <div className="client-association-control">
                <SearchableSelect
                  value={companyChoice}
                  onChange={onCompanyChoice}
                  placeholder={linkedCompany?.name || "Buscar empresa..."}
                  searchPlaceholder="Buscar por empresa ou documento..."
                  options={companies.map((company) => ({
                    value: company.id,
                    label: company.name,
                    description: company.document || (company.clientId ? "Já associada a um cliente" : "Empresa do CRM"),
                  }))}
                />
                <button className="primary" type="button" disabled={!companyChoice} onClick={onLinkCompany}>{linkedCompany ? "Trocar empresa" : "Associar empresa"}</button>
              </div>
              <p>Selecione a empresa deste cliente. Você poderá trocar depois.</p>
            </div>
            <div className="client-association-card">
              <header><i>2</i><span><b>Adicionar contato existente</b><small>Busque por nome, e-mail ou empresa</small></span><UserRound /></header>
              <div className="client-association-control">
                <ContactMultiPicker
                  value={contactChoices}
                  onChange={onContactChoices}
                  options={contactOptions.filter((contact) => !contacts.some((item) => item.id === contact.id))}
                />
                <button className="primary" type="button" disabled={!contactChoices.length} onClick={onLinkContact}>Adicionar {contactChoices.length || ""} contato{contactChoices.length === 1 ? "" : "s"}</button>
              </div>
              <p>O contato continuará disponível no CRM e será ligado a este cliente.</p>
            </div>
          </div>
        </div>
      )}
      <div className="client-record-list">
        {contacts.map((item) => (
          <article key={item.id}>
            <span className="record-icon">
              <UserRound />
            </span>
            <div>
              <b>
                {item.name}
                {item.primary && <small>Principal</small>}
              </b>
              <span>{item.role || "Cargo não informado"}</span>
              {item.companyName && <span className="client-contact-company"><Building2 /> {item.companyName}</span>}
              <span>
                {item.email} {item.phone && `· ${item.phone}`}
              </span>
            </div>
            {canEdit && <button type="button" className="client-unlink-contact" onClick={() => onRemove(item.id)} title="Desvincular contato" aria-label={`Desvincular ${item.name}`}>
              <X />
            </button>}
          </article>
        ))}
      </div>
    </section>
  );
}
function ClientServices({
  services,
  canEdit,
  onAdd,
}: {
  services: Service[];
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <section>
      <div className="client-section-head">
        <div>
          <h3>Serviços e contratos</h3>
          <p>Escopo contratado, cobrança e valor negociado.</p>
        </div>
        {canEdit && <button className="primary" onClick={onAdd}>
          <Plus /> Adicionar serviço
        </button>}
      </div>
      <div className="client-record-list">
        {services.map((item) => (
          <article key={item.id}>
            <span className="record-icon">
              <BriefcaseBusiness />
            </span>
            <div>
              <b>{item.name}</b>
              <span>
                {item.billingType === "RECURRING"
                  ? "Cobrança recorrente"
                  : "Cobrança pontual"}{" "}
                · início{" "}
                {new Date(`${item.startDate}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )}
              </span>
            </div>
            <strong>
              {item.negotiatedValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}
function ClientProjects({
  projects,
  users,
  canEdit,
  onAdd,
  onOpen,
}: {
  projects: Project[];
  users: ProjectUser[];
  canEdit: boolean;
  onAdd: () => void;
  onOpen: (project: Project) => void;
}) {
  return (
    <section>
      <div className="client-section-head">
        <div>
          <h3>Projetos</h3>
          <p>Entregas, objetivos e progresso deste cliente.</p>
        </div>
        {canEdit && <button className="primary" onClick={onAdd}>
          <Plus /> Novo projeto
        </button>}
      </div>
      <div className="client-record-list">
        {projects.map((item) => {
          const tasks = item.tasks || [],
            done = tasks.filter((task) => task.status === "DONE").length,
            responsible = users.find((user) => user.id === item.responsibleId)?.name;
          return (
            <button type="button" key={item.id} className="client-project-card" onClick={() => onOpen(item)}>
              <span className="record-icon">
                <FolderKanban />
              </span>
              <div>
                <b>
                  {item.name}
                  <em className={`project-status ${item.status.toLowerCase()}`}>{projectStatusLabels[item.status] || item.status}</em>
                  {projectLate(item) && <em className="project-status late">Atrasado</em>}
                </b>
                <span>{item.objective || "Sem objetivo descrito"}</span>
                <small>
                  {[
                    responsible && `Responsável: ${responsible}`,
                    item.dueDate && `Prazo ${projectDate(item.dueDate)}`,
                    tasks.length && `${done}/${tasks.length} entregas`,
                  ].filter(Boolean).join(" · ") || "Sem responsável ou prazo definido"}
                </small>
                <div className="project-progress">
                  <i style={{ width: `${item.progress || 0}%` }} />
                </div>
              </div>
              <strong>{item.progress || 0}%</strong>
            </button>
          );
        })}
        {!projects.length && (
          <div className="client-module-empty">
            <FolderKanban />
            <p>Nenhum projeto cadastrado para este cliente.</p>
          </div>
        )}
      </div>
    </section>
  );
}
// Abrir, editar e excluir um projeto. Com entregas cadastradas, o progresso é calculado
// pelas concluídas; sem entregas, é informado manualmente.
function ProjectEditor({
  clientId,
  project,
  users,
  canEdit,
  onClose,
  onSaved,
}: {
  clientId: string;
  project: Project | null;
  users: ProjectUser[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState({
      name: project?.name || "",
      objective: project?.objective || "",
      status: project?.status || ("PLANNED" as ProjectStatus),
      responsibleId: project?.responsibleId || "",
      startDate: project?.startDate || "",
      dueDate: project?.dueDate || "",
      progress: project?.progress || 0,
    }),
    [tasks, setTasks] = useState<ProjectTask[]>(project?.tasks || []),
    [newTask, setNewTask] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const progress = tasks.length
    ? Math.round((tasks.filter((task) => task.status === "DONE").length / tasks.length) * 100)
    : form.status === "COMPLETED" ? 100 : form.progress;
  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    setTasks((current) => [...current, { id: crypto.randomUUID(), title, status: "OPEN" }]);
    setNewTask("");
  };
  const request = async (method: "POST" | "PATCH" | "DELETE", payload?: unknown) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/clients/${clientId}/projects${project ? `/${project.id}` : ""}`,
        { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Não foi possível salvar o projeto.");
      await onSaved();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void request(project ? "PATCH" : "POST", { ...form, progress, tasks });
  };
  const remove = async () => {
    if (!project) return;
    if (!await systemConfirm({ title: `Excluir ${project.name}?`, message: "O projeto e suas entregas serão removidos. Tarefas e eventos ligados a ele continuam, sem o vínculo.", confirmLabel: "Excluir projeto", tone: "danger" })) return;
    await request("DELETE");
  };
  return (
    <div className="modal-backdrop client-subform-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="client-subform client-project-editor" role="dialog" aria-modal="true">
      <header>
        <div>
          <h3>{project ? (canEdit ? "Editar projeto" : project.name) : "Novo projeto"}</h3>
          <p>
            {project?.updatedAt
              ? `Atualizado em ${new Date(project.updatedAt).toLocaleString("pt-BR")}`
              : "Entregas, objetivo e progresso deste cliente."}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
      </header>
      <form onSubmit={save}>
        <fieldset disabled={!canEdit || busy}>
          <label>
            Nome do projeto *
            <input value={form.name} onChange={(event) => set("name", event.target.value)} required minLength={2} autoFocus={!project} />
          </label>
          <label>
            Objetivo
            <textarea value={form.objective} onChange={(event) => set("objective", event.target.value)} />
          </label>
          <div className="client-project-grid">
            <label>
              Status
              <select value={form.status} onChange={(event) => set("status", event.target.value as ProjectStatus)}>
                {Object.entries(projectStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Responsável
              <select value={form.responsibleId} onChange={(event) => set("responsibleId", event.target.value)}>
                <option value="">Sem responsável</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label>
              Data inicial
              <input type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
            </label>
            <label>
              Prazo
              <input type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} />
            </label>
          </div>
          <div className="client-project-tasks">
            <b>Entregas <small>{tasks.filter((task) => task.status === "DONE").length}/{tasks.length}</small></b>
            {tasks.map((task) => (
              <div key={task.id} className={task.status === "DONE" ? "done" : ""}>
                <label className="inline-check">
                  <input type="checkbox" checked={task.status === "DONE"} onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: event.target.checked ? "DONE" : "OPEN" } : item))} />
                  <span>{task.title}</span>
                </label>
                {canEdit && <button type="button" aria-label={`Remover ${task.title}`} onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}><X /></button>}
              </div>
            ))}
            {canEdit && <div className="client-project-task-add">
              <input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTask(); } }} placeholder="Nova entrega (ex.: Landing page publicada)" />
              <button type="button" className="secondary" onClick={addTask} disabled={!newTask.trim()}><Plus /> Adicionar</button>
            </div>}
          </div>
          <label>
            Progresso · {progress}%
            <input type="range" min={0} max={100} step={5} value={progress} disabled={!!tasks.length || form.status === "COMPLETED"} onChange={(event) => set("progress", Number(event.target.value))} />
            {(!!tasks.length || form.status === "COMPLETED") && <small className="client-project-hint">{tasks.length ? "Calculado pelas entregas concluídas." : "Projeto concluído conta como 100%."}</small>}
          </label>
        </fieldset>
        {error && <div className="form-error">{error}</div>}
        <footer>
          {project && canEdit && <button type="button" className="secondary danger" disabled={busy} onClick={() => void remove()}><Trash2 /> Excluir</button>}
          <button type="button" className="secondary" onClick={onClose}>
            {canEdit ? "Cancelar" : "Fechar"}
          </button>
          {canEdit && <button className="primary" disabled={busy}>{busy ? <Loader2 className="spin" /> : <Save />} Salvar</button>}
        </footer>
      </form>
    </section>
    </div>
  );
}
function ClientTimeline({ timeline }: { timeline: TimelineEvent[] }) {
  return (
    <section>
      <div className="client-section-head">
        <div>
          <h3>Timeline unificada</h3>
          <p>
            Histórico comercial antes da conversão e histórico do cliente depois
            dela.
          </p>
        </div>
      </div>
      <div className="client-timeline">
        {timeline.length ? (
          timeline.map((item) => (
            <article key={item.id}>
              <i />
              <div>
                <small>
                  {item.phase === "COMMERCIAL"
                    ? "HISTÓRICO COMERCIAL"
                    : "HISTÓRICO DO CLIENTE"}
                </small>
                <b>{item.description}</b>
                <span>
                  {item.actorName} ·{" "}
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
            </article>
          ))
        ) : (
          <div className="client-module-empty">
            <History />
            <p>Nenhum evento relacionado ainda.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function ClientSubForm({
  kind,
  error,
  onClose,
  onSave,
}: {
  kind: "CONTACT" | "SERVICE";
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop client-subform-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="client-subform" role="dialog" aria-modal="true">
      <header>
        <div>
          <h3>
            {kind === "CONTACT" ? "Novo contato" : "Novo serviço ou contrato"}
          </h3>
          <p>As informações ficarão vinculadas permanentemente ao cliente.</p>
        </div>
        <button type="button" onClick={onClose}>
          <X />
        </button>
      </header>
      <form onSubmit={onSave}>
        {kind === "CONTACT" ? (
          <>
            <label>
              Nome *<input name="name" required />
            </label>
            <label>
              Cargo / função
              <input name="role" />
            </label>
            <label>
              E-mail
              <input name="email" type="email" />
            </label>
            <label>
              Telefone
              <input
                name="phone"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                onInput={(event) => {
                  event.currentTarget.value = maskPhone(
                    event.currentTarget.value,
                  );
                }}
              />
            </label>
            <label>
              WhatsApp
              <input
                name="whatsapp"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                onInput={(event) => {
                  event.currentTarget.value = maskPhone(
                    event.currentTarget.value,
                  );
                }}
              />
            </label>
            <label className="inline-check">
              <input name="primary" type="checkbox" value="true" /> Contato
              principal
            </label>
          </>
        ) : (
          <>
            <label>
              Serviço contratado *<input name="name" required />
            </label>
            <label>
              Valor negociado
              <input name="negotiatedValue" inputMode="decimal" />
            </label>
            <label>
              Cobrança
              <select name="billingType">
                <option value="RECURRING">Recorrente</option>
                <option value="ONE_TIME">Pontual</option>
              </select>
            </label>
            <label>
              Data de início
              <input name="startDate" type="date" />
            </label>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary">Salvar</button>
        </footer>
      </form>
    </section>
    </div>
  );
}

function DeleteClient({
  client,
  onClose,
  onConfirm,
  error,
}: {
  client: Client;
  onClose: () => void;
  onConfirm: () => void;
  error: string;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="modal-backdrop client-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="delete-client-modal">
        <span>
          <Trash2 />
        </span>
        <h2>Excluir {client.name}?</h2>
        <p>
          O cliente será removido da carteira. Contas, campanhas e histórico
          vinculados deverão ser tratados antes da exclusão definitiva em
          produção.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />{" "}
          Entendo que esta ação remove o cadastro local.
        </label>
        {error && <div className="form-error"><AlertTriangle />{error}</div>}
        <div>
          <button className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="danger-button"
            disabled={!confirmed}
            onClick={onConfirm}
          >
            Excluir cliente
          </button>
        </div>
      </section>
    </div>
  );
}
