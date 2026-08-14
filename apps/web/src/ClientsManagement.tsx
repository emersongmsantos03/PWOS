import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  ExternalLink,
  FolderKanban,
  Globe2,
  History,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { isValidDocument, maskDocument, maskPhone } from "./inputMasks";
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
  notes: string;
  createdAt: string;
  updatedAt: string;
};
type Contact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  primary: boolean;
  createdAt: string;
};
type Service = {
  id: string;
  name: string;
  negotiatedValue: number;
  billingType: "RECURRING" | "ONE_TIME";
  startDate: string;
  managerUserId: string;
};
type Project = {
  id: string;
  name: string;
  objective?: string;
  status: string;
  progress?: number;
  startDate?: string;
  dueDate?: string;
};
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

export function ClientsManagement({ permissions = [], profile = "" }: { permissions?: string[]; profile?: string }) {
  const hasPermission = (permission: string) =>
    profile === "MASTER" || permissions.includes(permission);
  const canCreate = hasPermission("clients.create");
  const canEdit = hasPermission("clients.edit");
  const canDelete = hasPermission("clients.delete");
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | ClientStatus>("ALL");
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    fetch("/api/clients").then(async (response) => {
      const data = await response.json();
      if (response.ok) setClients(data.clients || []);
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
    if (response.ok) {
      setDeleting(null);
      setViewing(null);
      await load();
    }
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
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
            setError("");
          }}
          onDelete={() => setDeleting(viewing)}
        />
      )}
      {deleting && (
        <DeleteClient
          client={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

function ClientForm({
  client,
  error,
  onClose,
  onSave,
}: {
  client: Client | null;
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
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
        <form onSubmit={onSave}>
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
                  }}
                />
                <small>O dígito verificador é validado automaticamente.</small>
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
                <input
                  name="owner"
                  defaultValue={client?.owner}
                  placeholder="Ex.: Emerson Santos"
                />
              </label>
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

function ClientDetails({
  client,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  client: Client;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<
      "OVERVIEW" | "ACCESS" | "CONTACTS" | "SERVICES" | "PROJECTS" | "HISTORY"
    >("OVERVIEW"),
    [contacts, setContacts] = useState<Contact[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [timeline, setTimeline] = useState<TimelineEvent[]>([]),
    [connections, setConnections] = useState<ClientConnections>({
      mediaAccounts: [],
      mediaAssignmentCount: 0,
      financeEntryCount: 0,
      financeBalance: null,
      taskCount: 0,
      eventCount: 0,
    }),
    [adding, setAdding] = useState<null | "CONTACT" | "SERVICE" | "PROJECT">(
      null,
    ),
    [error, setError] = useState("");
  const [portalUsers, setPortalUsers] = useState<ClientPortalUser[]>([]), [addingAccess, setAddingAccess] = useState(false);
  const load = () =>
    Promise.all([fetch(`/api/clients/${client.id}`), fetch(`/api/clients/${client.id}/users`)]).then(async ([response, accessResponse]) => {
      const data = await response.json(), accessData = await accessResponse.json();
      if (response.ok) {
        setContacts(data.contacts || []);
        setServices(data.services || []);
        setProjects(data.projects || []);
        setTimeline(data.timeline || []);
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
    const path =
      adding === "CONTACT"
        ? "contacts"
        : adding === "SERVICE"
          ? "services"
          : "projects";
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
    if (!confirm("Remover este contato?")) return;
    const response = await fetch(`/api/clients/${client.id}/contacts/${id}`, {
      method: "DELETE",
    });
    if (response.ok) await load();
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
          {canEdit && <button className="primary" onClick={onEdit}>
            <Edit3 /> Editar cliente
          </button>}
          {canDelete && <button className="secondary" onClick={onDelete}>
            <Trash2 /> Excluir
          </button>}
        </div> : <div className="client-readonly-banner"><ShieldCheck /><span><b>Modo de visualização</b><small>Você pode consultar os dados deste cliente.</small></span></div>}
        <nav className="client-detail-tabs">
          {[
            ["OVERVIEW", "Visão geral"],
            ["ACCESS", `Acessos (${portalUsers.length}/2)`],
            ["CONTACTS", `Contatos (${contacts.length})`],
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
          {tab === "ACCESS" && <section className="client-access-section"><div className="client-access-heading"><div><h3><Users/> Portal do Cliente</h3><p>Até 2 usuários, com visualização somente das campanhas vinculadas.</p><small>Link de acesso: <b>/portal-cliente</b></small></div>{canEdit && <button className="primary" disabled={portalUsers.length >= 2} onClick={() => setAddingAccess(true)}><Plus/> Criar acesso</button>}</div><div className="client-access-list">{portalUsers.map(user => <article key={user.id}><span className="client-company-avatar">{user.name.slice(0,2).toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div><em>{user.mustChangePassword ? "Troca de senha pendente" : "Acesso ativo"}</em></article>)}{Array.from({ length: 2 - portalUsers.length }).map((_, index) => <article className="empty" key={index}><span><UserRound/></span><div><b>Acesso disponível</b><small>Cadastre outro usuário deste cliente</small></div></article>)}</div>{error && <div className="form-error">{error}</div>}</section>}
          {tab === "OVERVIEW" && (
            <>
              <section className="client-operational-summary">
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
                      <small>Mídia paga</small>
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
                  {canEdit && <a href="/midia">Gerenciar vínculos</a>}
                </div>
                {connections.mediaAccounts.length ? (
                  <div className="client-media-accounts">
                    {connections.mediaAccounts.map((account) => (
                      <article key={account.id}>
                        <span className="client-media-logo">∞</span>
                        <div>
                          <b>{account.pageName || account.name}</b>
                          <small>Meta Ads · {account.campaignCount} campanha(s)</small>
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
              canEdit={canEdit}
              onAdd={() => setAdding("PROJECT")}
            />
          )}{" "}
          {tab === "HISTORY" && <ClientTimeline timeline={timeline} />}
        </main>
        {adding && canEdit && (
          <ClientSubForm
            kind={adding}
            error={error}
            onClose={() => setAdding(null)}
            onSave={add}
          />
        )}
        {addingAccess && createPortal(<div className="modal-backdrop client-access-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddingAccess(false); }}><section className="client-access-modal" role="dialog" aria-modal="true" aria-labelledby="client-access-title"><header><span><Users/></span><div><small>NOVO USUÁRIO</small><h2 id="client-access-title">Criar acesso do cliente</h2><p>Este acesso será exclusivo para consulta de campanhas.</p></div><button type="button" onClick={() => setAddingAccess(false)} aria-label="Fechar"><X/></button></header><form onSubmit={createAccess}><div className="client-access-notice"><ShieldCheck/><div><b>Acesso protegido e somente leitura</b><p>O usuário poderá visualizar apenas os portfólios Meta e Google vinculados a {client.name}. Nenhuma edição será permitida.</p></div></div><div className="client-access-fields"><label>Nome completo <span>*</span><input name="name" required autoFocus placeholder="Ex.: João da Silva" autoComplete="name"/></label><label>E-mail de acesso <span>*</span><input name="email" type="email" required placeholder="joao@empresa.com.br" autoComplete="email"/></label><label className="client-password-field">Senha temporária <span>*</span><input name="password" type="password" minLength={6} required autoComplete="new-password" placeholder="Mínimo de 6 caracteres"/><small><LockKeyhole/> No primeiro login, o cliente será obrigado a criar uma nova senha.</small></label></div>{error && <div className="form-error"><AlertTriangle/>{error}</div>}<div className="client-portal-link"><ExternalLink/><span><small>LINK DE ACESSO</small><b>{window.location.origin}/portal-cliente</b></span></div><footer><button type="button" className="secondary" onClick={() => setAddingAccess(false)}>Cancelar</button><button className="primary"><UserRound/> Criar acesso</button></footer></form></section></div>, document.body)}
      </aside>
    </div>
  );
}

function ClientContacts({
  contacts,
  canEdit,
  onAdd,
  onRemove,
}: {
  contacts: Contact[];
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
          <Plus /> Adicionar contato
        </button>}
      </div>
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
              <span>
                {item.email} {item.phone && `· ${item.phone}`}
              </span>
            </div>
            {canEdit && <button onClick={() => onRemove(item.id)}>
              <Trash2 />
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
  canEdit,
  onAdd,
}: {
  projects: Project[];
  canEdit: boolean;
  onAdd: () => void;
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
        {projects.map((item) => (
          <article key={item.id}>
            <span className="record-icon">
              <FolderKanban />
            </span>
            <div>
              <b>{item.name}</b>
              <span>
                {item.objective || "Sem objetivo descrito"} · {item.status}
              </span>
              <div className="project-progress">
                <i style={{ width: `${item.progress || 0}%` }} />
              </div>
            </div>
            <strong>{item.progress || 0}%</strong>
          </article>
        ))}
      </div>
    </section>
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
  kind: "CONTACT" | "SERVICE" | "PROJECT";
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="client-subform">
      <header>
        <div>
          <h3>
            {kind === "CONTACT"
              ? "Novo contato"
              : kind === "SERVICE"
                ? "Novo serviço ou contrato"
                : "Novo projeto"}
          </h3>
          <p>As informações ficarão vinculadas permanentemente ao cliente.</p>
        </div>
        <button onClick={onClose}>
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
        ) : kind === "SERVICE" ? (
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
        ) : (
          <>
            <label>
              Nome do projeto *<input name="name" required />
            </label>
            <label>
              Objetivo
              <textarea name="objective" />
            </label>
            <label>
              Status
              <select name="status">
                <option value="PLANNED">Planejado</option>
                <option value="ACTIVE">Ativo</option>
                <option value="PAUSED">Pausado</option>
                <option value="COMPLETED">Concluído</option>
              </select>
            </label>
            <label>
              Data inicial
              <input name="startDate" type="date" />
            </label>
            <label>
              Prazo
              <input name="dueDate" type="date" />
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
    </div>
  );
}

function DeleteClient({
  client,
  onClose,
  onConfirm,
}: {
  client: Client;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="modal-backdrop">
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
