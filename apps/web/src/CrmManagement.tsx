import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Contact,
  Download,
  Flame,
  GripVertical,
  History,
  KanbanSquare,
  ListTodo,
  Mail,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Thermometer,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { isValidDocument, maskCurrency, maskDocument, maskPhone, parseCurrency } from "./inputMasks";
import { DateTimePicker } from "./DateTimePicker";
import { SearchableSelect } from "./SearchableSelect";
import "./OpportunityWorkspaceRefinements.css";

type Stage = {
  id: string;
  name: string;
  color: string;
  probability: number;
  requiredFields?: string[];
  terminal?: "WON" | "LOST";
};
type Pipeline = {
  id: string;
  name: string;
  isCommercial?: boolean;
  departmentIds: string[];
  stages: Stage[];
};
type Activity = {
  id: string;
  type: string;
  description: string;
  actorName: string;
  createdAt: string;
  metadata?: Record<string, string>;
};
type Proposal = {
  id: string;
  title: string;
  value: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  validUntil: string;
  notes: string;
  publicToken?: string;
  services?: ProposalService[];
  customer?: { name: string; email: string; phone: string; document: string };
  signatureDataUrl?: string;
  signedAt?: string;
  createdAt: string;
};
type ProposalService = {
  id?: string;
  name: string;
  description: string;
  quantity: number;
  unitValue: number;
  billingType: "RECURRING" | "ONE_TIME";
};
type Opportunity = {
  id: string;
  name: string;
  company: string;
  companyId?: string;
  contactIds?: string[];
  email: string;
  phone: string;
  whatsapp: string;
  serviceInterest: string;
  potentialValue: number;
  temperature: "COLD" | "WARM" | "HOT" | "VERY_HOT";
  priority: "LOW" | "MEDIUM" | "HIGH";
  responsibleId: string;
  responsibleName: string;
  teamIds: string[];
  tags: string[];
  pipelineId: string;
  stageId: string;
  status: "OPEN" | "WON" | "LOST" | "CONVERTED";
  nextAction: string;
  nextActionAt: string;
  lossReason?: string;
  convertedClientId?: string;
  stageEnteredAt: string;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
  proposals: Proposal[];
};
type CrmContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  role: string;
  companyId: string;
  clientId: string;
  opportunityIds: string[];
  responsibleId: string;
  responsibleName: string;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
};
type CrmCompany = {
  id: string;
  name: string;
  legalName: string;
  document: string;
  website: string;
  phone: string;
  segment: string;
  clientId: string;
  responsibleId: string;
  responsibleName: string;
  createdAt: string;
  updatedAt: string;
  activities: Activity[];
};
type User = { id: string; name: string };
type Department = { id: string; name: string; active: boolean };
type Client = { id: string; name: string; document: string };
type WorkTask = {
  id: string;
  title: string;
  description: string;
  opportunityId: string;
  responsibleId: string;
  responsibleName: string;
  priority: string;
  status: string;
  dueAt: string;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
const elapsed = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "Hoje" : `${days}d nesta etapa`;
};
const priorityLabel = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
const temperatureLabel = {
  COLD: "Fria",
  WARM: "Morna",
  HOT: "Quente",
  VERY_HOT: "Muito quente",
} as const;
const activityTypeLabels: Record<string, string> = {
  CREATED: "Criação",
  UPDATED: "Atualização",
  DELETED: "Exclusão",
  NOTE: "Nota",
  COMMENT: "Comentário",
  EMAIL: "E-mail",
  CALL: "Ligação",
  MEETING: "Reunião",
  TASK: "Tarefa",
  STAGE_CHANGED: "Mudança de etapa",
  STATUS_CHANGED: "Mudança de status",
  ASSIGNED: "Atribuição",
};
const activityTypeLabel = (type: string) =>
  activityTypeLabels[type] ||
  type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

function SearchMultiSelect({
  name,
  label,
  options,
  defaultValue = [],
  value,
  onChange,
  placeholder = "Buscar e selecionar...",
  emptyText = "Nenhum resultado encontrado",
}: {
  name: string;
  label: string;
  options: { id: string; title: string; subtitle?: string }[];
  defaultValue?: string[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [internalSelected, setInternalSelected] = useState<string[]>(defaultValue),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState(false);
  const selected = value ?? internalSelected;
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);
  const available = options
    .filter(
      (option) =>
        !selected.includes(option.id) &&
        `${option.title} ${option.subtitle || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .slice(0, 8);
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((value) => value !== id)
      : [...selected, id];
    if (value === undefined) setInternalSelected(next);
    onChange?.(next);
    setQuery("");
    setOpen(true);
  };
  return (
    <div className="crm-smart-field" ref={rootRef}>
      <span className="crm-smart-label">{label}</span>
      <div className={`crm-smart-select ${open ? "open" : ""}`}>
        <div className="crm-smart-chips">
          {selected.map((id) => {
            const option = options.find((value) => value.id === id);
            return option ? (
              <span key={id}>
                <i>{option.title.slice(0, 2).toUpperCase()}</i>
                <b>{option.title}</b>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  aria-label={`Remover ${option.title}`}
                >
                  <X />
                </button>
                <input type="hidden" name={name} value={id} />
              </span>
            ) : null;
          })}
        </div>
        <div className="crm-smart-search">
          <Search />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder={selected.length ? "Adicionar outro..." : placeholder}
          />
          {open && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar busca"
            >
              <X />
            </button>
          )}
        </div>
        {open && (
          <div className="crm-smart-results">
            {available.length ? (
              available.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => toggle(option.id)}
                >
                  <i>{option.title.slice(0, 2).toUpperCase()}</i>
                  <span>
                    <b>{option.title}</b>
                    {option.subtitle && <small>{option.subtitle}</small>}
                  </span>
                  <Plus />
                </button>
              ))
            ) : (
              <p>{emptyText}</p>
            )}
          </div>
        )}
      </div>
      <small>
        {selected.length
          ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}. Clique no × para remover.`
          : "Digite para pesquisar e clique para adicionar."}
      </small>
    </div>
  );
}

export function CrmManagement({
  permissions = [],
  profile = "",
}: {
  permissions?: string[];
  profile?: string;
}) {
  const can = (permission: string) =>
    profile === "MASTER" || permissions.includes(permission);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]),
    [pipelineId, setPipelineId] = useState(""),
    [items, setItems] = useState<Opportunity[]>([]),
    [contacts, setContacts] = useState<CrmContact[]>([]),
    [companies, setCompanies] = useState<CrmCompany[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [departments, setDepartments] = useState<Department[]>([]),
    [clients, setClients] = useState<Client[]>([]),
    [canManage, setCanManage] = useState(false);
  const [entityView, setEntityView] = useState<
      "OPPORTUNITIES" | "CONTACTS" | "COMPANIES"
    >("OPPORTUNITIES"),
    [recordModal, setRecordModal] = useState<"CONTACT" | "COMPANY" | null>(
      null,
    ),
    [selectedRecord, setSelectedRecord] = useState<
      CrmContact | CrmCompany | null
    >(null);
  const [search, setSearch] = useState(""),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<Opportunity | null>(null),
    [managing, setManaging] = useState(false),
    [selected, setSelected] = useState<Opportunity | null>(null),
    [converting, setConverting] = useState<Opportunity | null>(null),
    [loss, setLoss] = useState<Opportunity | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const pipeline =
    pipelines.find((item) => item.id === pipelineId) || pipelines[0] || null;
  const load = async () => {
    setLoading(true);
    const [pr, or, ur, dr, cr, ctr, cor] = await Promise.all([
      fetch("/api/crm/pipelines"),
      fetch("/api/crm/opportunities"),
      fetch("/api/users"),
      fetch("/api/departments"),
      fetch("/api/clients"),
      fetch("/api/crm/contacts"),
      fetch("/api/crm/companies"),
    ]);
    const [pd, od, ud, dd, cd, ctd, cod] = await Promise.all([
      pr.json(),
      or.json(),
      ur.json(),
      dr.json(),
      cr.json(),
      ctr.json(),
      cor.json(),
    ]);
    if (pr.ok) {
      const next = pd.pipelines || [];
      setPipelines(next);
      setCanManage(!!pd.canManage);
      setPipelineId((current) =>
        next.some((item: Pipeline) => item.id === current)
          ? current
          : next[0]?.id || "",
      );
    }
    if (or.ok) setItems(od.opportunities || []);
    if (ur.ok) setUsers(ud.users || []);
    if (dr.ok) setDepartments(dd.departments || []);
    if (cr.ok) setClients(cd.clients || []);
    if (ctr.ok) setContacts(ctd.contacts || []);
    if (cor.ok) setCompanies(cod.companies || []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.pipelineId === pipeline?.id &&
          (!search ||
            [
              item.name,
              item.company,
              item.serviceInterest,
              item.responsibleName,
            ].some((v) => v.toLowerCase().includes(search.toLowerCase()))),
      ),
    [items, search, pipeline],
  );
  const move = async (item: Opportunity, stage: Stage) => {
    if (item.stageId === stage.id) return;
    if (stage.terminal === "WON" && pipeline?.isCommercial) {
      setConverting(item);
      return;
    }
    if (stage.terminal === "LOST") {
      setLoss(item);
      return;
    }
    const response = await fetch(`/api/crm/opportunities/${item.id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    await load();
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget),
      input = {
        ...Object.fromEntries(formData),
        potentialValue: parseCurrency(String(formData.get("potentialValue") || "")),
        teamIds: formData.getAll("teamIds").map(String),
        contactIds: formData.getAll("contactIds").map(String),
      };
    const response = await fetch(
      editing
        ? `/api/crm/opportunities/${editing.id}`
        : "/api/crm/opportunities",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setCreating(false);
    setEditing(null);
    setSelected(data.opportunity);
    await load();
  };
  const remove = async (item: Opportunity) => {
    const response = await fetch(`/api/crm/opportunities/${item.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setSelected(null);
    await load();
  };
  return (
    <div className="page crm-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">COMERCIAL</span>
          <h1>CRM's</h1>
          <p>
            Empresas, contatos e oportunidades conectados em um único histórico comercial.
          </p>
        </div>
        <div className="crm-head-actions">
          {canManage && (
            <button
              type="button"
              className="secondary crm-manage-trigger"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setError("");
                setManaging(true);
              }}
              aria-haspopup="dialog"
            >
              <Settings2 /> Gerenciar CRM's
            </button>
          )}
          {(entityView === "OPPORTUNITIES"
            ? can("opportunities.create")
            : can("crm.create")) && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (entityView === "OPPORTUNITIES") setCreating(true);
                else
                  setRecordModal(
                    entityView === "CONTACTS" ? "CONTACT" : "COMPANY",
                  );
                setError("");
              }}
            >
              <Plus />{" "}
              {entityView === "OPPORTUNITIES"
                ? "Nova oportunidade"
                : entityView === "CONTACTS"
                  ? "Novo contato"
                  : "Nova empresa"}
            </button>
          )}
        </div>
      </div>
      <nav className="crm-entity-tabs">
        <button
          className={entityView === "OPPORTUNITIES" ? "active" : ""}
          onClick={() => setEntityView("OPPORTUNITIES")}
        >
          <KanbanSquare /> Oportunidades <span>{items.length}</span>
        </button>
        <button
          className={entityView === "COMPANIES" ? "active" : ""}
          onClick={() => setEntityView("COMPANIES")}
        >
          <Building2 /> Empresas <span>{companies.length}</span>
        </button>
        <button
          className={entityView === "CONTACTS" ? "active" : ""}
          onClick={() => setEntityView("CONTACTS")}
        >
          <Contact /> Contatos <span>{contacts.length}</span>
        </button>
      </nav>
      {entityView === "OPPORTUNITIES" && (
        <>
          <section className="crm-summary">
            <article>
              <KanbanSquare />
              <span>
                <small>Oportunidades abertas</small>
                <b>{items.filter((i) => i.status === "OPEN").length}</b>
              </span>
            </article>
            <article>
              <CircleDollarSign />
              <span>
                <small>Receita potencial</small>
                <b>
                  {money(
                    items
                      .filter((i) => i.status === "OPEN")
                      .reduce((sum, i) => sum + i.potentialValue, 0),
                  )}
                </b>
              </span>
            </article>
            <article>
              <Check />
              <span>
                <small>Ganhos e convertidos</small>
                <b>
                  {
                    items.filter((i) => ["WON", "CONVERTED"].includes(i.status))
                      .length
                  }
                </b>
              </span>
            </article>
            <article>
              <CalendarClock />
              <span>
                <small>Próximas ações vencidas</small>
                <b>
                  {
                    items.filter(
                      (i) =>
                        i.nextActionAt &&
                        new Date(i.nextActionAt) < new Date() &&
                        i.status === "OPEN",
                    ).length
                  }
                </b>
              </span>
            </article>
          </section>
          <section className="panel crm-board-panel">
            <div className="crm-toolbar">
              <div className="search">
                <Search />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar lead, empresa, serviço ou responsável..."
                />
              </div>
              <label className="crm-pipeline-select">
                Pipeline
                <select
                  value={pipeline?.id || ""}
                  onChange={(e) => setPipelineId(e.target.value)}
                >
                  {pipelines.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <div className="form-error">
                <AlertTriangle />
                {error}
              </div>
            )}
            {loading ? (
              <div className="crm-loading">Carregando oportunidades...</div>
            ) : !pipeline ? (
              <div className="crm-empty">
                <KanbanSquare />
                <h2>Nenhum pipeline configurado</h2>
              </div>
            ) : (
              <div className="crm-kanban">
                {pipeline.stages.map((stage, stageIndex) => (
                  <section
                    className="crm-column"
                    key={stage.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const item = items.find(
                        (i) =>
                          i.id === e.dataTransfer.getData("text/opportunity"),
                      );
                      if (item) void move(item, stage);
                    }}
                  >
                    <header
                      style={
                        { "--stage-color": stage.color } as React.CSSProperties
                      }
                    >
                      <i />
                      <div>
                        <b>{stage.name}</b>
                        <small>{stage.probability}% de probabilidade</small>
                      </div>
                      <span>
                        {visible.filter((i) => i.stageId === stage.id).length}
                      </span>
                    </header>
                    <div>
                      {stageIndex === 0 && can("opportunities.create") && (
                        <button
                          type="button"
                          className="crm-column-add"
                          onClick={() => {
                            setError("");
                            setCreating(true);
                          }}
                        >
                          <Plus />
                          Nova oportunidade
                        </button>
                      )}
                      {visible
                        .filter((i) => i.stageId === stage.id)
                        .map((item) => (
                          <button
                            draggable={item.status === "OPEN"}
                            onDragStart={(e) =>
                              e.dataTransfer.setData(
                                "text/opportunity",
                                item.id,
                              )
                            }
                            className={`crm-card temperature-${item.temperature.toLowerCase().replace("_", "-")}`}
                            key={item.id}
                            onClick={() => setSelected(item)}
                          >
                            <div className="crm-card-top">
                              <span
                                className={`crm-temp ${item.temperature.toLowerCase()}`}
                              >
                                {item.temperature === "HOT" || item.temperature === "VERY_HOT" ? (
                                  <Flame />
                                ) : (
                                  <Thermometer />
                                )}
                                <b>{temperatureLabel[item.temperature]}</b>
                              </span>
                              <small>{elapsed(item.stageEnteredAt)}</small>
                            </div>
                            <h3>{item.name}</h3>
                            <p>
                              {item.company || "Sem empresa"} ·{" "}
                              {item.serviceInterest || "Serviço não informado"}
                            </p>
                            <strong>{money(item.potentialValue)}</strong>
                            <footer>
                              <span>
                                <UserRound />
                                {item.responsibleName || "Sem responsável"}
                              </span>
                              {item.nextActionAt && (
                                <time
                                  className={
                                    new Date(item.nextActionAt) < new Date()
                                      ? "late"
                                      : ""
                                  }
                                >
                                  <CalendarClock />
                                  {new Date(
                                    item.nextActionAt,
                                  ).toLocaleDateString("pt-BR")}
                                </time>
                              )}
                            </footer>
                          </button>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {entityView !== "OPPORTUNITIES" && (
        <CrmRecords
          kind={entityView === "CONTACTS" ? "CONTACT" : "COMPANY"}
          contacts={contacts}
          companies={companies}
          opportunities={items}
          clients={clients}
          search={search}
          onSearch={setSearch}
          onOpen={setSelectedRecord}
        />
      )}
      {(creating || editing) && (
        <OpportunityForm
          item={editing}
          pipeline={pipeline}
          users={users}
          companies={companies}
          contacts={contacts}
          error={error}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={save}
        />
      )}
      {selected && (
        <OpportunityWorkspace
          item={selected}
          pipeline={pipeline}
          users={users}
          companies={companies}
          contacts={contacts}
          clients={clients}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setError("");
          }}
          onDelete={() => setDeleteTarget(selected)}
          onChange={(item) => {
            setSelected(item);
            void load();
          }}
        />
      )}
      {converting && (
        <ConversionModal
          item={converting}
          users={users}
          clients={clients}
          pipelines={pipelines}
          onClose={() => setConverting(null)}
          onDone={async () => {
            setConverting(null);
            await load();
          }}
        />
      )}
      {loss && (
        <LossModal
          item={loss}
          pipeline={pipeline}
          onClose={() => setLoss(null)}
          onDone={async () => {
            setLoss(null);
            await load();
          }}
        />
      )}
      {managing && (
        <PipelineManager
          pipelines={pipelines}
          departments={departments}
          selectedId={pipeline?.id || ""}
          canCreate={can("crm.create")}
          canEdit={can("crm.edit")}
          canDelete={can("crm.delete")}
          canManageStages={can("crm.manage_pipelines")}
          onSelect={setPipelineId}
          onClose={() => setManaging(false)}
          onChange={load}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Excluir oportunidade?"
          description={`A oportunidade de ${deleteTarget.name} e seu histórico comercial serão removidos. Esta ação não poderá ser desfeita.`}
          confirmLabel="Excluir oportunidade"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void remove(deleteTarget)}
        />
      )}
      {recordModal && (
        <CrmRecordForm
          kind={recordModal}
          users={users}
          companies={companies}
          opportunities={items}
          clients={clients}
          onClose={() => setRecordModal(null)}
          onSaved={async () => {
            setRecordModal(null);
            await load();
          }}
        />
      )}
      {selectedRecord && (
        <CrmRecordDetail
          record={selectedRecord}
          kind={"email" in selectedRecord ? "CONTACT" : "COMPANY"}
          companies={companies}
          contacts={contacts}
          opportunities={items}
          clients={clients}
          onClose={() => setSelectedRecord(null)}
          onChange={async (record) => {
            setSelectedRecord(record);
            await load();
          }}
        />
      )}
    </div>
  );
}

function OpportunityWorkspace({
  item,
  pipeline,
  users,
  companies,
  contacts,
  clients,
  onClose,
  onEdit,
  onDelete,
  onChange,
}: {
  item: Opportunity;
  pipeline: Pipeline | null;
  users: User[];
  companies: CrmCompany[];
  contacts: CrmContact[];
  clients: Client[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (item: Opportunity) => void;
}) {
  const [activityType, setActivityType] = useState("NOTE"),
    [activityText, setActivityText] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [error, setError] = useState(""),
    [tasks, setTasks] = useState<WorkTask[]>([]),
    [taskOpen, setTaskOpen] = useState(false),
    [taskSaving, setTaskSaving] = useState(false),
    [proposalOpen, setProposalOpen] = useState(false),
    [proposalSaving, setProposalSaving] = useState(false),
    [generatedProposalLink, setGeneratedProposalLink] = useState(""),
    [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null),
    [proposalDeletePassword, setProposalDeletePassword] = useState(""),
    [proposalDeleting, setProposalDeleting] = useState(false),
    [serviceCatalog, setServiceCatalog] = useState<string[]>([]),
    [proposalServices, setProposalServices] = useState<ProposalService[]>([]),
    [temperatureSaving, setTemperatureSaving] = useState(false),
    [draftTemperature, setDraftTemperature] = useState<Opportunity["temperature"]>(item.temperature),
    [taskKind, setTaskKind] = useState("TASK"),
    [meetingMode, setMeetingMode] = useState("ONLINE");
  const stage = pipeline?.stages.find((value) => value.id === item.stageId),
    company = companies.find((value) => value.id === item.companyId),
    linkedContacts = contacts.filter((value) =>
      (item.contactIds || []).includes(value.id),
    ),
    client = clients.find((value) => value.id === item.convertedClientId);
  const activities = item.activities
    .slice()
    .reverse()
    .filter((value) => filter === "ALL" || value.type === filter);
  const loadTasks = () =>
    fetch("/api/tasks").then(async (response) => {
      const data = await response.json();
      if (response.ok)
        setTasks(
          (data.tasks || []).filter(
            (task: WorkTask) => task.opportunityId === item.id,
          ),
        );
    });
  useEffect(() => {
    void loadTasks();
  }, [item.id]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetch("/api/crm/opportunities").then(async (response) => {
        if (!response.ok) return;
        const data = await response.json(),
          fresh = (data.opportunities || []).find(
            (opportunity: Opportunity) => opportunity.id === item.id,
          );
        if (
          fresh &&
          JSON.stringify(fresh.proposals) !== JSON.stringify(item.proposals)
        )
          onChange(fresh);
      });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [item.id, item.proposals, onChange]);
  useEffect(() => setDraftTemperature(item.temperature), [item.id, item.temperature]);
  const hasPendingChanges = draftTemperature !== item.temperature;
  const saveWorkspaceChanges = async () => {
    if (!hasPendingChanges) return;
    setTemperatureSaving(true);
    setError("");
    const response = await fetch(`/api/crm/opportunities/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...item,
        companyId: item.companyId || "",
        contactIds: item.contactIds || [],
        teamIds: item.teamIds || [],
        temperature: draftTemperature,
      }),
    });
    const data = await response.json();
    setTemperatureSaving(false);
    if (!response.ok) return setError(data.message);
    onChange(data.opportunity);
  };
  const add = async () => {
    const response = await fetch(
        `/api/crm/opportunities/${item.id}/activities`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: activityType,
            description: activityText,
          }),
        },
      ),
      data = await response.json();
    if (!response.ok) return setError(data.message);
    setActivityText("");
    onChange(data.opportunity);
  };
  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTaskSaving(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget)),
      input = {
        ...raw,
        opportunityId: item.id,
        type: taskKind === "TASK" ? "OTHER" : taskKind,
        subtype: taskKind.toLowerCase(),
        details: {
          meetingMode: raw.meetingMode || "",
          meetingPlatform: raw.meetingPlatform || "",
          meetingLocation: raw.meetingLocation || "",
        },
      };
    const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
      data = await response.json();
    if (!response.ok) {
      setTaskSaving(false);
      return setError(data.message);
    }
    if (taskKind !== "TASK") {
      const activityResponse = await fetch(
          `/api/crm/opportunities/${item.id}/activities`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: taskKind,
              description: String(raw.title),
              metadata: { taskId: data.task.id, dueAt: String(raw.dueAt) },
            }),
          },
        ),
        activityData = await activityResponse.json();
      if (activityResponse.ok) onChange(activityData.opportunity);
    }
    setTaskSaving(false);
    setTaskOpen(false);
    await loadTasks();
  };
  const openTask = (kind = "TASK") => {
    setProposalOpen(false);
    setTaskKind(kind);
    setTaskOpen(true);
  };
  const createProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProposalSaving(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(
        `/api/crm/opportunities/${item.id}/proposals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: raw.title,
            validUntil: raw.validUntil,
            notes: raw.notes,
            status: "SENT",
            services: proposalServices,
          }),
        },
      ),
      data = await response.json();
    setProposalSaving(false);
    if (!response.ok) return setError(data.message);
    const link = `${window.location.origin}/proposta/${data.proposal.publicToken}`;
    setGeneratedProposalLink(link);
    void navigator.clipboard.writeText(link).catch(() => undefined);
    setProposalOpen(false);
    onChange(data.opportunity);
  };
  const openProposal = () => {
    setTaskOpen(false);
    setError("");
    setProposalServices([
      {
        name: item.serviceInterest || "",
        description: "",
        quantity: 1,
        unitValue: item.potentialValue || 0,
        billingType: "ONE_TIME",
      },
    ]);
    void fetch("/api/crm/service-catalog")
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setServiceCatalog(data.services || []);
      })
      .catch(() => setServiceCatalog([]));
    setProposalOpen(true);
  };
  const updateProposalService = (
    index: number,
    patch: Partial<ProposalService>,
  ) =>
    setProposalServices((current) =>
      current.map((service, serviceIndex) =>
        serviceIndex === index ? { ...service, ...patch } : service,
      ),
    );
  const proposalTotal = proposalServices.reduce(
    (total, service) => total + service.quantity * service.unitValue,
    0,
  );
  const copyProposalLink = async (token: string) => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/proposta/${token}`,
    );
  };
  const deleteProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proposalToDelete) return;
    setProposalDeleting(true);
    setError("");
    const response = await fetch(
        `/api/crm/opportunities/${item.id}/proposals/${proposalToDelete.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: proposalDeletePassword }),
        },
      ),
      data = await response.json();
    setProposalDeleting(false);
    if (!response.ok) return setError(data.message);
    setProposalToDelete(null);
    setProposalDeletePassword("");
    onChange(data.opportunity);
  };
  const action = (value: string) => {
    if (value === "NOTE") {
      setActivityType(value);
      return;
    }
    openTask(value);
  };
  const openTasks = tasks.filter(
    (value) => !["DONE", "CANCELLED"].includes(value.status),
  );
  return (
    <div className="crm-workspace-backdrop">
      <section className="crm-workspace">
        <header>
          <button className="crm-workspace-back" onClick={onClose}>
            <ArrowLeft /> Voltar ao CRM
          </button>
          <div className="crm-workspace-title">
            <span className="crm-workspace-icon">
              <BriefcaseBusiness />
            </span>
            <span>
              <small>
                OPORTUNIDADE <i /> {pipeline?.name || "CRM"} <i />{" "}
                {stage?.name || "Sem etapa"}
              </small>
              <h2>{item.name}</h2>
              <p>
                {company?.name || item.company || "Sem empresa associada"} <i />{" "}
                {money(item.potentialValue)}
              </p>
            </span>
          </div>
          <div className="crm-workspace-header-actions">
            <button
              className="secondary crm-workspace-save"
              onClick={() => void saveWorkspaceChanges()}
              disabled={!hasPendingChanges || temperatureSaving || item.status === "CONVERTED"}
              title={hasPendingChanges ? "Salvar alterações pendentes" : "Nenhuma alteração pendente"}
            >
              <Save /> {temperatureSaving ? "Salvando…" : "Salvar alterações"}
            </button>
            <button className="secondary crm-generate-proposal" onClick={openProposal}>
              <CircleDollarSign /> Gerar proposta
            </button>
            <button className="primary" onClick={() => openTask()}>
              <ListTodo /> Criar tarefa
            </button>
            <button className="secondary" onClick={onEdit}>
              <Pencil /> Editar
            </button>
            <button
              className="danger-icon"
              onClick={onDelete}
              aria-label="Excluir oportunidade"
            >
              <Trash2 />
            </button>
            <button
              className="crm-workspace-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X />
            </button>
          </div>
        </header>
        <div className="crm-workspace-insights">
          <article>
            <small>VALOR</small>
            <b>{money(item.potentialValue)}</b>
          </article>
          <article>
            <small>PROBABILIDADE</small>
            <b>{stage?.probability || 0}%</b>
            <i>
              <span style={{ width: `${stage?.probability || 0}%` }} />
            </i>
          </article>
          <article>
            <small>TEMPO NA ETAPA</small>
            <b>{elapsed(item.stageEnteredAt)}</b>
          </article>
          <article>
            <small>PRÓXIMA ATIVIDADE</small>
            <b>{item.nextAction || "Não definida"}</b>
            <span>
              {item.nextActionAt
                ? new Date(item.nextActionAt).toLocaleString("pt-BR")
                : "Sem data"}
            </span>
          </article>
          <article>
            <small>TAREFAS ABERTAS</small>
            <b>{openTasks.length}</b>
          </article>
        </div>
        <div className="crm-workspace-grid">
          <aside className="crm-workspace-summary">
            <section>
              <div className="crm-workspace-section-title">
                <span>
                  <BriefcaseBusiness />
                </span>
                <div>
                  <h3>Propriedades</h3>
                  <p>Informações da oportunidade</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Responsável</dt>
                  <dd>
                    <span className="crm-mini-avatar">
                      {(item.responsibleName || "?").slice(0, 2)}
                    </span>
                    {item.responsibleName || "Não definido"}
                  </dd>
                </div>
                <div>
                  <dt>Etapa</dt>
                  <dd>
                    <i style={{ background: stage?.color }} />
                    {stage?.name}
                  </dd>
                </div>
                <div>
                  <dt>Serviço</dt>
                  <dd>{item.serviceInterest || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Prioridade</dt>
                  <dd>
                    <span
                      className={`crm-priority ${item.priority.toLowerCase()}`}
                    >
                      {priorityLabel[item.priority]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Temperatura</dt>
                  <dd>
                    <label className={`crm-temperature-quick ${draftTemperature.toLowerCase().replace("_", "-")} ${hasPendingChanges ? "pending" : ""}`}>
                      {draftTemperature === "HOT" || draftTemperature === "VERY_HOT" ? <Flame /> : <Thermometer />}
                      <select
                        aria-label="Alterar temperatura da oportunidade"
                        value={draftTemperature}
                        disabled={temperatureSaving || item.status === "CONVERTED"}
                        onChange={(event) => setDraftTemperature(event.target.value as Opportunity["temperature"])}
                      >
                        {(["COLD", "WARM", "HOT", "VERY_HOT"] as const).map((temperature) => (
                          <option value={temperature} key={temperature}>{temperatureLabel[temperature]}</option>
                        ))}
                      </select>
                    </label>
                  </dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{item.email || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{maskPhone(item.phone) || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Criada em</dt>
                  <dd>{new Date(item.createdAt).toLocaleString("pt-BR")}</dd>
                </div>
              </dl>
              <button className="crm-inline-edit" onClick={onEdit}>
                <Pencil /> Editar propriedades
              </button>
            </section>
            <section>
              <div className="crm-workspace-section-title">
                <span>
                  <Users />
                </span>
                <div>
                  <h3>Equipe envolvida</h3>
                  <p>{item.teamIds?.length || 0} participante(s)</p>
                </div>
              </div>
              <div className="crm-workspace-people">
                {item.teamIds?.map((id) => {
                  const user = users.find((value) => value.id === id);
                  return (
                    <span key={id}>
                      <i>{user?.name.slice(0, 2)}</i>
                      <b>{user?.name}</b>
                    </span>
                  );
                })}
                {!item.teamIds?.length && (
                  <p>Nenhum participante adicionado.</p>
                )}
              </div>
            </section>
          </aside>
          <main className="crm-workspace-activity">
            <div className="crm-workspace-tabs">
              <div>
                <h3>Central da oportunidade</h3>
                <p>Registre interações e mantenha o próximo passo visível</p>
              </div>
              <span>
                {item.activities.length}{" "}
                {item.activities.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <div className="crm-quick-actions" aria-label="Tipos de atividade">
              {[
                ["NOTE", "Nota"],
                ["EMAIL", "E-mail"],
                ["CALL", "Ligação"],
                ["TASK", "Tarefa"],
                ["MEETING", "Reunião"],
              ].map(([value, label]) => (
                <button
                  className={
                    activityType === value && value !== "TASK" ? "active" : ""
                  }
                  onClick={() => action(value)}
                  key={value}
                  aria-pressed={activityType === value && value !== "TASK"}
                >
                  <span>
                    {value === "EMAIL" ? (
                      <Mail />
                    ) : value === "CALL" ? (
                      <Phone />
                    ) : value === "TASK" ? (
                      <ListTodo />
                    ) : value === "MEETING" ? (
                      <CalendarClock />
                    ) : (
                      <MessageSquareText />
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </div>
            <div className="crm-activity-composer">
              <div className="crm-composer-heading">
                <MessageSquareText />
                <span>
                  <b>
                    Registrar{" "}
                    {activityType === "NOTE"
                      ? "nota"
                      : activityType === "EMAIL"
                        ? "e-mail"
                        : activityType === "CALL"
                          ? "ligação"
                          : "reunião"}
                  </b>
                  <small>
                    Inclua decisões, contexto e o próximo passo combinado.
                  </small>
                </span>
              </div>
              <textarea
                value={activityText}
                onChange={(event) => setActivityText(event.target.value)}
                placeholder="O que aconteceu nesta interação?"
              />
              <footer>
                <small>O registro incluirá autor, data e horário.</small>
                <button
                  className="primary"
                  disabled={!activityText.trim()}
                  onClick={add}
                >
                  Registrar atividade
                </button>
              </footer>
            </div>
            {error && !taskOpen && <div className="form-error">{error}</div>}
            <section className="crm-related-tasks">
              <header>
                <div>
                  <h3>Próximas tarefas</h3>
                  <p>Ações vinculadas a esta oportunidade</p>
                </div>
                <button onClick={() => setTaskOpen(true)}>
                  <Plus /> Nova tarefa
                </button>
              </header>
              {openTasks.length ? (
                <div>
                  {openTasks.slice(0, 4).map((task) => (
                    <article key={task.id}>
                      <span
                        className={`crm-task-check ${task.priority.toLowerCase()}`}
                      />
                      <div>
                        <b>{task.title}</b>
                        <small>
                          {task.responsibleName || "Sem responsável"}
                        </small>
                      </div>
                      <time
                        className={
                          task.dueAt && new Date(task.dueAt) < new Date()
                            ? "late"
                            : ""
                        }
                      >
                        {task.dueAt
                          ? new Date(task.dueAt).toLocaleString("pt-BR")
                          : "Sem prazo"}
                      </time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="crm-compact-empty">
                  <CheckCircle2 />
                  <span>
                    <b>Nenhuma tarefa pendente</b>
                    <small>
                      Crie o próximo passo para manter o negócio em movimento.
                    </small>
                  </span>
                </div>
              )}
            </section>
            <div className="crm-activity-toolbar">
              <h3>Linha do tempo</h3>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="ALL">Todas as atividades</option>
                <option value="NOTE">Notas</option>
                <option value="EMAIL">E-mails</option>
                <option value="CALL">Ligações</option>
                <option value="MEETING">Reuniões</option>
                <option value="STAGE_CHANGED">Mudanças de etapa</option>
              </select>
            </div>
            <div className="crm-activity-feed">
              {activities.map((activity) => (
                <article key={activity.id}>
                  <span>{activityTypeLabel(activity.type).slice(0, 1)}</span>
                  <div>
                    <header>
                      <b>{activity.description}</b>
                      <time>
                        {new Date(activity.createdAt).toLocaleString("pt-BR")}
                      </time>
                    </header>
                    <small>
                      {activity.actorName} · {activityTypeLabel(activity.type)}
                    </small>
                  </div>
                </article>
              ))}
              {!activities.length && (
                <div className="crm-record-empty">
                  <History />
                  <b>Nenhuma atividade neste filtro</b>
                </div>
              )}
            </div>
          </main>
          <aside className="crm-workspace-associations">
            <AssociationSection
              icon={<Building2 />}
              title="Empresa"
              count={company ? 1 : 0}
            >
              {company ? (
                <article>
                  <b>{company.name}</b>
                  <span>
                    {company.website || company.segment || "Sem detalhes"}
                  </span>
                  <small>{company.phone}</small>
                </article>
              ) : (
                <p>Nenhuma empresa associada.</p>
              )}
            </AssociationSection>
            <AssociationSection
              icon={<Contact />}
              title="Contatos"
              count={linkedContacts.length}
            >
              {linkedContacts.map((value) => (
                <article key={value.id}>
                  <b>{value.name}</b>
                  <span>{value.role || "Contato"}</span>
                  <small>{value.email || value.phone}</small>
                </article>
              ))}
              {!linkedContacts.length && <p>Nenhum contato associado.</p>}
            </AssociationSection>
            <AssociationSection
              icon={<Users />}
              title="Cliente"
              count={client ? 1 : 0}
            >
              {client ? (
                <article>
                  <b>{client.name}</b>
                  <span>Cliente convertido</span>
                </article>
              ) : (
                <p>A oportunidade ainda não foi convertida.</p>
              )}
            </AssociationSection>
            <AssociationSection
              icon={<CircleDollarSign />}
              title="Propostas"
              count={item.proposals.length}
            >
              {item.proposals.map((value) => (
                <article key={value.id}>
                  <b>{value.title}</b>
                  <span>{money(value.value)}</span>
                  <small>
                    {value.signedAt
                      ? `Assinada por ${value.customer?.name || "cliente"} em ${new Date(value.signedAt).toLocaleString("pt-BR")}`
                      : value.status === "SENT"
                        ? "Aguardando assinatura"
                        : value.status}
                  </small>
                  {value.signatureDataUrl && (
                    <img
                      className="crm-proposal-signature"
                      src={value.signatureDataUrl}
                      alt={`Assinatura de ${value.customer?.name || "cliente"}`}
                    />
                  )}
                  {value.publicToken && (
                    <div className="crm-proposal-actions">
                      <button
                        type="button"
                        className="crm-proposal-copy"
                        onClick={() => void copyProposalLink(value.publicToken!)}
                      >
                        Copiar link
                      </button>
                      <button
                        type="button"
                        className="crm-proposal-copy"
                        onClick={() => window.open(`/proposta/${value.publicToken}`, "_blank")}
                      >
                        <Download /> Abrir / PDF
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className="crm-proposal-delete"
                    onClick={() => {
                      setError("");
                      setProposalDeletePassword("");
                      setProposalToDelete(value);
                    }}
                  >
                    <Trash2 /> Excluir proposta
                  </button>
                </article>
              ))}
              {!item.proposals.length && <p>Nenhuma proposta registrada.</p>}
            </AssociationSection>
          </aside>
        </div>
        {generatedProposalLink && (
          <div className="crm-proposal-link-backdrop">
            <section className="crm-proposal-link-modal">
              <CheckCircle2 />
              <h2>Link da proposta gerado</h2>
              <p>Envie este endereço ao cliente para ele preencher os dados e assinar.</p>
              <div>
                <input value={generatedProposalLink} readOnly />
                <button
                  className="primary"
                  onClick={() => void navigator.clipboard.writeText(generatedProposalLink)}
                >
                  Copiar link
                </button>
              </div>
              <button className="secondary" onClick={() => setGeneratedProposalLink("")}>
                Concluir
              </button>
            </section>
          </div>
        )}
        {proposalToDelete && (
          <div
            className="crm-proposal-link-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !proposalDeleting)
                setProposalToDelete(null);
            }}
          >
            <form className="crm-proposal-delete-modal" onSubmit={deleteProposal}>
              <span><Trash2 /></span>
              <h2>Excluir proposta?</h2>
              <p>
                A proposta <b>“{proposalToDelete.title}”</b> e seu link público serão
                removidos permanentemente. O registro da exclusão continuará na
                linha do tempo.
              </p>
              {proposalToDelete.signedAt && (
                <div className="crm-proposal-delete-warning">
                  Esta proposta já foi assinada pelo cliente.
                </div>
              )}
              <label>
                Digite sua senha para confirmar
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={proposalDeletePassword}
                  onChange={(event) => setProposalDeletePassword(event.target.value)}
                  placeholder="Sua senha atual"
                />
              </label>
              {error && <div className="form-error"><AlertTriangle />{error}</div>}
              <footer>
                <button
                  type="button"
                  className="secondary"
                  disabled={proposalDeleting}
                  onClick={() => setProposalToDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  className="danger-confirm"
                  disabled={!proposalDeletePassword || proposalDeleting}
                >
                  {proposalDeleting ? "Excluindo…" : "Confirmar exclusão"}
                </button>
              </footer>
            </form>
          </div>
        )}
        {proposalOpen && (
          <div
            className="crm-task-drawer-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setProposalOpen(false);
            }}
          >
            <form className="crm-task-drawer crm-proposal-drawer" onSubmit={createProposal}>
              <header>
                <div>
                  <span>
                    <CircleDollarSign />
                  </span>
                  <div>
                    <h2>Gerar proposta</h2>
                    <p>Vinculada à oportunidade “{item.name}”.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setProposalOpen(false)}>
                  <X />
                </button>
              </header>
              <div className="crm-task-form">
                <label className="full">
                  Título da proposta *
                  <input
                    name="title"
                    required
                    minLength={2}
                    autoFocus
                    placeholder="Ex.: Proposta comercial"
                  />
                </label>
                <label className="full">
                  Validade
                  <input name="validUntil" type="date" />
                </label>
                <fieldset className="crm-proposal-services full">
                  <legend>Serviços da proposta *</legend>
                  <datalist id="crm-proposal-service-catalog">
                    {serviceCatalog.map((service) => (
                      <option value={service} key={service} />
                    ))}
                  </datalist>
                  {proposalServices.map((service, index) => (
                    <div className="crm-proposal-service-row" key={index}>
                      <label>
                        Serviço
                        <input
                          required
                          list="crm-proposal-service-catalog"
                          value={service.name}
                          onChange={(event) =>
                            updateProposalService(index, { name: event.target.value })
                          }
                          placeholder="Selecione ou digite um serviço"
                        />
                      </label>
                      <label>
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          value={service.quantity}
                          onChange={(event) =>
                            updateProposalService(index, {
                              quantity: Math.max(1, Number(event.target.value)),
                            })
                          }
                        />
                      </label>
                      <label>
                        Valor unitário
                        <input
                          required
                          inputMode="decimal"
                          value={maskCurrency(service.unitValue)}
                          onChange={(event) =>
                            updateProposalService(index, {
                              unitValue:
                                Number(event.target.value.replace(/\D/g, "")) / 100,
                            })
                          }
                        />
                      </label>
                      <label>
                        Cobrança
                        <select
                          value={service.billingType}
                          onChange={(event) =>
                            updateProposalService(index, {
                              billingType: event.target.value as ProposalService["billingType"],
                            })
                          }
                        >
                          <option value="ONE_TIME">Única</option>
                          <option value="RECURRING">Recorrente</option>
                        </select>
                      </label>
                      <label className="full">
                        Descrição do serviço
                        <textarea
                          value={service.description}
                          onChange={(event) =>
                            updateProposalService(index, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Escopo, entregáveis e condições..."
                        />
                      </label>
                      {proposalServices.length > 1 && (
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() =>
                            setProposalServices((current) =>
                              current.filter((_, serviceIndex) => serviceIndex !== index),
                            )
                          }
                        >
                          Remover serviço
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="secondary crm-add-proposal-service"
                    onClick={() =>
                      setProposalServices((current) => [
                        ...current,
                        {
                          name: "",
                          description: "",
                          quantity: 1,
                          unitValue: 0,
                          billingType: "ONE_TIME",
                        },
                      ])
                    }
                  >
                    <Plus /> Adicionar serviço
                  </button>
                  <strong className="crm-proposal-total">
                    Total da proposta <span>{money(proposalTotal)}</span>
                  </strong>
                </fieldset>
                <label className="full">
                  Observações
                  <textarea
                    name="notes"
                    placeholder="Condições, escopo e informações importantes..."
                  />
                </label>
                {error && (
                  <div className="form-error full">
                    <AlertTriangle />
                    {error}
                  </div>
                )}
              </div>
              <footer>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setProposalOpen(false)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={proposalSaving}>
                  {proposalSaving ? "Gerando…" : "Gerar link da proposta"}
                </button>
              </footer>
            </form>
          </div>
        )}
        {taskOpen && (
          <div
            className="crm-task-drawer-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setTaskOpen(false);
            }}
          >
            <form className="crm-task-drawer" onSubmit={createTask}>
              <header>
                <div>
                  <span>
                    <ListTodo />
                  </span>
                  <div>
                    <h2>Nova tarefa</h2>
                    <p>Vinculada à oportunidade “{item.name}”.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setTaskOpen(false)}>
                  <X />
                </button>
              </header>
              <div className="crm-task-form">
                <label className="full">
                  Tipo de tarefa *
                  <select value={taskKind} onChange={(event) => setTaskKind(event.target.value)}>
                    <option value="TASK">Tarefa geral</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="CALL">Ligação</option>
                    <option value="MEETING">Reunião</option>
                  </select>
                </label>
                <label className="full">
                  Título da tarefa *
                  <input
                    name="title"
                    required
                    minLength={3}
                    autoFocus
                    placeholder="Ex.: Enviar proposta revisada"
                  />
                </label>
                <label>
                  Responsável
                  <SearchableSelect
                    name="responsibleId"
                    defaultValue={item.responsibleId}
                    placeholder="Selecionar responsável"
                    searchPlaceholder="Buscar responsável..."
                    options={users.map((user) => ({
                      value: user.id,
                      label: user.name,
                    }))}
                  />
                </label>
                <label>
                  Prazo
                  <DateTimePicker
                    name="dueAt"
                    required
                    placeholder="Definir data e horário"
                  />
                </label>
                <label>
                  Prioridade
                  <select name="priority" defaultValue="MEDIUM">
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status" defaultValue="TODO">
                    <option value="TODO">A fazer</option>
                    <option value="IN_PROGRESS">Em andamento</option>
                    <option value="WAITING_CLIENT">Aguardando cliente</option>
                  </select>
                </label>
                {taskKind === "MEETING" && <>
                  <label>
                    Modalidade
                    <select name="meetingMode" value={meetingMode} onChange={(event) => setMeetingMode(event.target.value)}>
                      <option value="IN_PERSON">Presencial</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </label>
                  {meetingMode === "ONLINE" && <label>
                    Plataforma
                    <select name="meetingPlatform" defaultValue="GOOGLE_MEET">
                      <option value="GOOGLE_MEET">Google Meet</option>
                      <option value="ZOOM">Zoom</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="FACETIME">FaceTime</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </label>}
                  <label className="full">
                    {meetingMode === "ONLINE" ? "Link ou instruções de acesso" : "Local da reunião"}
                    <input name="meetingLocation" placeholder={meetingMode === "ONLINE" ? "Cole o link ou descreva como acessar" : "Endereço, sala ou ponto de encontro"}/>
                  </label>
                </>}
                <label className="full">
                  Descrição
                  <textarea
                    name="description"
                    placeholder="Contexto, objetivo e resultado esperado..."
                  />
                </label>
                <label className="full">
                  Tags
                  <input
                    name="tags"
                    defaultValue={item.tags.join(", ")}
                    placeholder="Ex.: comercial, proposta"
                  />
                </label>
                {error && (
                  <div className="form-error">
                    <AlertTriangle />
                    {error}
                  </div>
                )}
              </div>
              <footer>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setTaskOpen(false)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={taskSaving}>
                  {taskSaving ? "Criando…" : "Criar tarefa"}
                </button>
              </footer>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

function AssociationSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="crm-association-section">
      <header>
        <span>
          {icon}
          <b>{title}</b>
          <small>{count}</small>
        </span>
      </header>
      <div>{children}</div>
    </section>
  );
}

function CrmRecords({
  kind,
  contacts,
  companies,
  opportunities,
  clients,
  search,
  onSearch,
  onOpen,
}: {
  kind: "CONTACT" | "COMPANY";
  contacts: CrmContact[];
  companies: CrmCompany[];
  opportunities: Opportunity[];
  clients: Client[];
  search: string;
  onSearch: (value: string) => void;
  onOpen: (record: CrmContact | CrmCompany) => void;
}) {
  const records = (kind === "CONTACT" ? contacts : companies).filter((record) =>
    JSON.stringify(record).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel crm-records">
      <header>
        <div className="search">
          <Search />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={`Buscar ${kind === "CONTACT" ? "contato" : "empresa"}...`}
          />
        </div>
        <span>{records.length} registros</span>
      </header>
      <div className="crm-record-table">
        <div className="crm-record-table-head">
          <span>{kind === "CONTACT" ? "Contato" : "Empresa"}</span>
          <span>{kind === "CONTACT" ? "Empresa" : "Cliente vinculado"}</span>
          <span>Responsável</span>
          <span>Vínculos</span>
          <span>Atualização</span>
        </div>
        {records.map((record) => {
          const contact = kind === "CONTACT" ? (record as CrmContact) : null,
            company = kind === "COMPANY" ? (record as CrmCompany) : null;
          return (
            <button key={record.id} onClick={() => onOpen(record)}>
              <span className="crm-record-name">
                <i>{kind === "CONTACT" ? <Contact /> : <Building2 />}</i>
                <b>{record.name}</b>
                <small>
                  {contact?.email ||
                    company?.website ||
                    "Sem informação adicional"}
                </small>
              </span>
              <span>
                {contact
                  ? companies.find((value) => value.id === contact.companyId)
                      ?.name || "Sem empresa"
                  : clients.find((value) => value.id === company?.clientId)
                      ?.name || "Sem cliente"}
              </span>
              <span>{record.responsibleName || "Sem responsável"}</span>
              <span>
                {contact
                  ? `${contact.opportunityIds.length} oportunidades`
                  : `${contacts.filter((value) => value.companyId === company?.id).length} contatos · ${opportunities.filter((value) => value.companyId === company?.id).length} oportunidades`}
              </span>
              <time>
                {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
              </time>
            </button>
          );
        })}
        {!records.length && (
          <div className="crm-record-empty">
            {kind === "CONTACT" ? <Contact /> : <Building2 />}
            <b>Nenhum registro encontrado</b>
            <span>Use o botão no topo para cadastrar.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function CrmRecordForm({
  kind,
  users,
  companies,
  opportunities,
  clients,
  onClose,
  onSaved,
}: {
  kind: "CONTACT" | "COMPANY";
  users: User[];
  companies: CrmCompany[];
  opportunities: Opportunity[];
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget),
      input = {
        ...Object.fromEntries(form),
        opportunityIds: form.getAll("opportunityIds").map(String),
      };
    const response = await fetch(
        `/api/crm/${kind === "CONTACT" ? "contacts" : "companies"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
      data = await response.json();
    setSaving(false);
    if (!response.ok) return setError(data.message);
    onSaved();
  };
  return (
    <div className="modal-backdrop">
      <section className="crm-modal crm-record-modal">
        <header>
          <span>{kind === "CONTACT" ? <Contact /> : <Building2 />}</span>
          <div>
            <h2>{kind === "CONTACT" ? "Novo contato" : "Nova empresa"}</h2>
            <p>
              O registro poderá ser associado a clientes e oportunidades sem
              perder histórico.
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={save}>
          <div className="crm-form-grid">
            <label>
              {kind === "CONTACT" ? "Nome completo" : "Nome da empresa"} *
              <input name="name" required autoFocus />
            </label>
            {kind === "CONTACT" ? (
              <>
                <label>
                  Cargo
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
                <label>
                  Empresa
                  <select name="companyId">
                    <option value="">Sem empresa</option>
                    {companies.map((value) => (
                      <option value={value.id} key={value.id}>
                        {value.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="full">
                  <SearchMultiSelect
                    name="opportunityIds"
                    label="Oportunidades associadas"
                    options={opportunities.map((value) => ({
                      id: value.id,
                      title: value.name,
                      subtitle: value.company || value.responsibleName,
                    }))}
                    placeholder="Buscar oportunidade..."
                  />
                </div>
              </>
            ) : (
              <>
                <label>
                  Razão social
                  <input name="legalName" />
                </label>
                <label>
                  CPF/CNPJ
                  <input
                    name="document"
                    inputMode="numeric"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
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
                  <small>Validação automática do documento.</small>
                </label>
                <label>
                  Segmento
                  <input name="segment" />
                </label>
                <label>
                  Site
                  <input
                    name="website"
                    type="url"
                    placeholder="https://empresa.com.br"
                  />
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
              </>
            )}
            <label>
              Cliente vinculado
              <select name="clientId">
                <option value="">Ainda não é cliente</option>
                {clients.map((value) => (
                  <option value={value.id} key={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsável
              <select name="responsibleId">
                <option value="">Sem responsável</option>
                {users.map((value) => (
                  <option value={value.id} key={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={saving}>
              {saving ? "Salvando…" : "Criar registro"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CrmRecordDetail({
  record,
  kind,
  companies,
  contacts,
  opportunities,
  clients,
  onClose,
  onChange,
}: {
  record: CrmContact | CrmCompany;
  kind: "CONTACT" | "COMPANY";
  companies: CrmCompany[];
  contacts: CrmContact[];
  opportunities: Opportunity[];
  clients: Client[];
  onClose: () => void;
  onChange: (record: CrmContact | CrmCompany) => void;
}) {
  const [text, setText] = useState(""),
    [type, setType] = useState("NOTE"),
    [error, setError] = useState("");
  const contact = kind === "CONTACT" ? (record as CrmContact) : null,
    company = kind === "COMPANY" ? (record as CrmCompany) : null;
  const linkedOpportunities = contact
    ? opportunities.filter((value) => contact.opportunityIds.includes(value.id))
    : opportunities.filter((value) => value.companyId === company?.id);
  const linkedContacts = company
    ? contacts.filter((value) => value.companyId === company.id)
    : [];
  const add = async () => {
    const response = await fetch(
        `/api/crm/${kind === "CONTACT" ? "contacts" : "companies"}/${record.id}/activities`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, description: text }),
        },
      ),
      data = await response.json();
    if (!response.ok) return setError(data.message);
    setText("");
    onChange(kind === "CONTACT" ? data.contact : data.company);
  };
  return (
    <div className="modal-backdrop crm-detail-backdrop">
      <aside className="crm-detail crm-record-detail">
        <header>
          <button onClick={onClose}>
            <X />
          </button>
          <small>{kind === "CONTACT" ? "CONTATO" : "EMPRESA"}</small>
          <h2>{record.name}</h2>
          <p>{contact?.role || company?.segment || "Registro do CRM"}</p>
        </header>
        <main>
          <section className="crm-detail-values">
            {contact && (
              <>
                <div>
                  <small>E-mail</small>
                  <b>{contact.email || "Não informado"}</b>
                </div>
                <div>
                  <small>Telefone</small>
                  <b>{contact.phone || "Não informado"}</b>
                </div>
              </>
            )}
            {company && (
              <>
                <div>
                  <small>Documento</small>
                  <b>{company.document || "Não informado"}</b>
                </div>
                <div>
                  <small>Site</small>
                  <b>{company.website || "Não informado"}</b>
                </div>
              </>
            )}
            <div>
              <small>Responsável</small>
              <b>{record.responsibleName || "Não definido"}</b>
            </div>
            <div>
              <small>Cliente</small>
              <b>
                {clients.find((value) => value.id === record.clientId)?.name ||
                  "Ainda não convertido"}
              </b>
            </div>
          </section>
          {contact?.companyId && (
            <section>
              <h3>
                <Building2 /> Empresa
              </h3>
              <div className="crm-association-card">
                <b>
                  {
                    companies.find((value) => value.id === contact.companyId)
                      ?.name
                  }
                </b>
              </div>
            </section>
          )}
          {linkedContacts.length > 0 && (
            <section>
              <h3>
                <Contact /> Contatos ({linkedContacts.length})
              </h3>
              <div className="crm-association-list">
                {linkedContacts.map((value) => (
                  <span key={value.id}>
                    {value.name}
                    <small>{value.role}</small>
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <h3>
              <BriefcaseBusiness /> Oportunidades ({linkedOpportunities.length})
            </h3>
            <div className="crm-association-list">
              {linkedOpportunities.map((value) => (
                <span key={value.id}>
                  {value.name}
                  <small>
                    {money(value.potentialValue)} · {value.status}
                  </small>
                </span>
              ))}
              {!linkedOpportunities.length && (
                <p>Nenhuma oportunidade associada.</p>
              )}
            </div>
          </section>
          <section>
            <h3>
              <History /> Histórico completo
            </h3>
            <div className="activity-composer">
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="NOTE">Nota</option>
                <option value="CALL">Ligação</option>
                <option value="MESSAGE">Mensagem</option>
                <option value="EMAIL">E-mail</option>
                <option value="MEETING">Reunião</option>
              </select>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Registrar atividade, interação ou observação..."
              />
              <button className="primary" disabled={!text.trim()} onClick={add}>
                Registrar
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="crm-timeline">
              {record.activities
                .slice()
                .reverse()
                .map((activity) => (
                  <article key={activity.id}>
                    <i />
                    <div>
                      <b>{activity.description}</b>
                      <small>
                        {activity.actorName} ·{" "}
                        {new Date(activity.createdAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </main>
      </aside>
    </div>
  );
}

function PipelineManager({
  pipelines,
  departments,
  selectedId,
  canCreate,
  canEdit,
  canDelete,
  canManageStages,
  onSelect,
  onClose,
  onChange,
}: {
  pipelines: Pipeline[];
  departments: Department[];
  selectedId: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageStages: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const [activeId, setActiveId] = useState(
      selectedId || pipelines[0]?.id || "",
    ),
    [editing, setEditing] = useState<Stage | null>(null),
    [stageEditorOpen, setStageEditorOpen] = useState(false),
    [creatingPipeline, setCreatingPipeline] = useState(false),
    [draggingId, setDraggingId] = useState(""),
    [pendingDelete, setPendingDelete] = useState<{
      type: "pipeline" | "stage";
      stage?: Stage;
    } | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const active = pipelines.find((item) => item.id === activeId) || pipelines[0];
  const request = async (
    url: string,
    method: string,
    input?: Record<string, unknown>,
    success?: string,
  ) => {
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: input ? JSON.stringify(input) : undefined,
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.message);
      return null;
    }
    if (success) setMessage(success);
    await onChange();
    return data;
  };
  const createPipeline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      formData = new FormData(form);
    const data = await request(
      "/api/crm/pipelines",
      "POST",
      {
        name: String(formData.get("name") || ""),
        departmentIds: formData.getAll("departmentIds").map(String),
      },
      "CRM criado com sucesso.",
    );
    if (data) {
      form.reset();
      setActiveId(data.pipeline.id);
      onSelect(data.pipeline.id);
      setCreatingPipeline(false);
    }
  };
  const renamePipeline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active) return;
    const formData = new FormData(event.currentTarget);
    await request(
      `/api/crm/pipelines/${active.id}`,
      "PATCH",
      {
        name: String(formData.get("name") || ""),
        departmentIds: formData.getAll("departmentIds").map(String),
      },
      "Alterações salvas.",
    );
  };
  const removePipeline = async (targetPipelineId: string) => {
    if (!active) return;
    const data = await request(
      `/api/crm/pipelines/${active.id}`,
      "DELETE",
      { targetPipelineId },
      "CRM excluído e oportunidades transferidas com segurança.",
    );
    if (data) {
      setActiveId(targetPipelineId);
      onSelect(targetPipelineId);
      setPendingDelete(null);
    }
  };
  const saveStage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active) return;
    const formData = new FormData(event.currentTarget),
      input = {
        ...Object.fromEntries(formData),
        requiredFields: formData.getAll("requiredFields").map(String),
      };
    const data = await request(
      editing
        ? `/api/crm/pipelines/${active.id}/stages/${editing.id}`
        : `/api/crm/pipelines/${active.id}/stages`,
      editing ? "PATCH" : "POST",
      input,
      editing ? "Etapa atualizada." : "Etapa criada.",
    );
    if (data) {
      setEditing(null);
      setStageEditorOpen(false);
    }
  };
  const removeStage = async (stage: Stage) => {
    if (!active) return;
    const data = await request(
      `/api/crm/pipelines/${active.id}/stages/${stage.id}`,
      "DELETE",
      undefined,
      "Etapa excluída.",
    );
    if (data) setPendingDelete(null);
  };
  const reorder = async (stage: Stage, direction: -1 | 1) => {
    if (!active) return;
    const index = active.stages.findIndex((item) => item.id === stage.id),
      target = index + direction;
    if (target < 0 || target >= active.stages.length) return;
    const ids = active.stages.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await request(`/api/crm/pipelines/${active.id}/stages/reorder`, "POST", {
      stageIds: ids,
    });
  };
  const reorderTo = async (sourceId: string, targetId: string) => {
    if (!active || sourceId === targetId) return;
    const ids = active.stages.map((stage) => stage.id),
      source = ids.indexOf(sourceId),
      target = ids.indexOf(targetId);
    if (source < 0 || target < 0) return;
    const [moved] = ids.splice(source, 1);
    ids.splice(target, 0, moved);
    setDraggingId("");
    await request(
      `/api/crm/pipelines/${active.id}/stages/reorder`,
      "POST",
      { stageIds: ids },
      "Ordem das etapas atualizada.",
    );
  };
  return (
    <div className="modal-backdrop">
      <section className="pipeline-manager">
        <header>
          <div>
            <Settings2 />
            <span>
              <h2>Funis e etapas</h2>
              <p>Configure seus CRM's de forma simples e organizada.</p>
            </span>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {message && (
          <div className="crm-manager-success">
            <CheckCircle2 />
            {message}
          </div>
        )}
        <div className="pipeline-manager-layout">
          <aside>
            <div className="pipeline-sidebar-heading">
              <span>SEUS CRM'S</span>
              <small>{pipelines.length} configurados</small>
            </div>
            {canCreate && (
              <button
                className="new-pipeline-button"
                onClick={() => {
                  setCreatingPipeline(true);
                  setError("");
                  setMessage("");
                }}
              >
                <Plus />
                <span>
                  <b>Novo CRM</b>
                  <small>Criar outro funil de vendas</small>
                </span>
              </button>
            )}
            <div className="pipeline-list">
              {pipelines.map((item) => (
                <button
                  key={item.id}
                  className={item.id === active?.id ? "active" : ""}
                  onClick={() => {
                    setActiveId(item.id);
                    onSelect(item.id);
                    setEditing(null);
                    setMessage("");
                    setError("");
                  }}
                >
                  <KanbanSquare />
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.stages.length} etapas ·{" "}
                      {item.departmentIds.length
                        ? `${item.departmentIds.length} setores`
                        : "Acesso geral"}
                    </small>
                  </span>
                  <ArrowRight />
                </button>
              ))}
            </div>
          </aside>
          <main>
            {active && (
              <>
                <section className="pipeline-settings-card">
                  <div className="pipeline-settings-heading">
                    <div>
                      <span>CONFIGURAÇÕES DO FUNIL</span>
                      <h3>{active.name}</h3>
                      <p>Identificação e visibilidade deste CRM.</p>
                    </div>
                    <button
                      className="danger-icon"
                      onClick={() => setPendingDelete({ type: "pipeline" })}
                      title="Excluir CRM"
                    >
                      <Trash2 />
                    </button>
                  </div>
                  <form onSubmit={renamePipeline} key={active.id}>
                    <div className="pipeline-settings-fields">
                      <label>
                        Nome do CRM
                        <input
                          name="name"
                          defaultValue={active.name}
                          required
                        />
                      </label>
                      <label className="pipeline-commercial-field">
                        Tipo do funil
                        <span className="pipeline-commercial-check">
                          <input name="isCommercial" type="checkbox" value="true" defaultChecked={!!active.isCommercial} />
                          <span>
                            <b>Funil comercial</b>
                            <small>Permite propostas e gera receita no ganho</small>
                          </span>
                        </span>
                      </label>
                      <DepartmentChecks
                        departments={departments}
                        selected={active.departmentIds}
                      />
                    </div>
                    <footer>
                      <small>As alterações afetam somente este CRM.</small>
                      <button className="primary" disabled={busy}>
                        {busy ? "Salvando…" : "Salvar alterações"}
                      </button>
                    </footer>
                  </form>
                </section>
                <div className="pipeline-stage-heading">
                  <div>
                    <span>FLUXO COMERCIAL</span>
                    <h3>Etapas do funil</h3>
                    <p>A ordem abaixo é a mesma exibida no Kanban.</p>
                  </div>
                  <div>
                    <span>{active.stages.length} etapas</span>
                    <button
                      className="primary"
                      onClick={() => {
                        setEditing(null);
                        setStageEditorOpen(true);
                      }}
                    >
                      <Plus /> Nova etapa
                    </button>
                  </div>
                </div>
                <div className="pipeline-stage-table">
                  <header>
                    <span>Etapa</span>
                    <span>Status</span>
                    <span>Probabilidade</span>
                    <span>Campos obrigatórios</span>
                    <span>Ações</span>
                  </header>
                  <div className="pipeline-stage-list">
                    {active.stages.map((stage, index) => (
                      <article
                        draggable={!busy}
                        onDragStart={(event) => {
                          setDraggingId(stage.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggingId("")}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => void reorderTo(draggingId, stage.id)}
                        className={draggingId === stage.id ? "dragging" : ""}
                        key={stage.id}
                      >
                        <button
                          type="button"
                          className="stage-drag-handle"
                          title="Arraste para reordenar"
                        >
                          <GripVertical />
                        </button>
                        <i style={{ background: stage.color }} />
                        <div className="stage-content">
                          <div className="stage-identity">
                            <b>{stage.name}</b>
                            <small>
                              {stage.terminal === "WON"
                                ? "Converte a oportunidade em cliente"
                                : stage.terminal === "LOST"
                                  ? "Encerra e exige o motivo da perda"
                                  : `Etapa ${index + 1} do processo`}
                            </small>
                          </div>
                          <div className="stage-metadata">
                            <span className={`stage-kind ${stage.terminal?.toLowerCase() || ""}`}>
                              {stage.terminal === "WON" ? "Fechado ganho" : stage.terminal === "LOST" ? "Fechado perdido" : "Aberta"}
                            </span>
                            <span className="stage-probability">
                              <b>{stage.probability}%</b>
                              <i><em style={{ width: `${stage.probability}%` }} /></i>
                            </span>
                            <span className="stage-required-count">
                              {stage.requiredFields?.length ? <><b>{stage.requiredFields.length}</b> campos obrigatórios</> : "Sem campos obrigatórios"}
                            </span>
                          </div>
                        </div>
                        <div className="stage-actions">
                          <button
                            type="button"
                            className="stage-edit-button"
                            onClick={() => {
                              setEditing(stage);
                              setStageEditorOpen(true);
                            }}
                          >
                            <Pencil /> Editar
                          </button>
                          <button
                            type="button"
                            disabled={index === 0 || busy}
                            onClick={() => reorder(stage, -1)}
                            title="Mover para cima"
                          >
                            <ArrowUp />
                          </button>
                          <button
                            type="button"
                            disabled={
                              index === active.stages.length - 1 || busy
                            }
                            onClick={() => reorder(stage, 1)}
                            title="Mover para baixo"
                          >
                            <ArrowDown />
                          </button>
                          {!stage.terminal && (
                            <button
                              type="button"
                              className="stage-delete-button"
                              onClick={() =>
                                setPendingDelete({ type: "stage", stage })
                              }
                              title="Excluir etapa"
                            >
                              <Trash2 />
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            )}
            {error && (
              <div className="form-error">
                <AlertTriangle />
                {error}
              </div>
            )}
          </main>
        </div>
      </section>
      {stageEditorOpen && active && (
        <StageEditor
          stage={editing}
          pipelineName={active.name}
          busy={busy}
          error={error}
          onClose={() => {
            setStageEditorOpen(false);
            setEditing(null);
            setError("");
          }}
          onSave={saveStage}
        />
      )}
      {creatingPipeline && (
        <NewPipelineDialog
          departments={departments}
          busy={busy}
          error={error}
          onClose={() => {
            setCreatingPipeline(false);
            setError("");
          }}
          onSave={createPipeline}
        />
      )}
      {pendingDelete?.type === "pipeline" && active && (
        <PipelineDeleteDialog
          pipeline={active}
          alternatives={pipelines.filter((item) => item.id !== active.id)}
          busy={busy}
          error={error}
          onCancel={() => {
            setPendingDelete(null);
            setError("");
          }}
          onConfirm={(targetPipelineId) =>
            void removePipeline(targetPipelineId)
          }
        />
      )}
      {pendingDelete?.type === "stage" && pendingDelete.stage && (
        <ConfirmDialog
          title="Excluir esta etapa?"
          description={`A etapa “${pendingDelete.stage.name}” será removida. A exclusão será bloqueada se houver oportunidades nela.`}
          confirmLabel="Excluir etapa"
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void removeStage(pendingDelete.stage!)}
        />
      )}
    </div>
  );
}

function NewPipelineDialog({
  departments,
  busy,
  error,
  onClose,
  onSave,
}: {
  departments: Department[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="stage-editor-backdrop">
      <section className="stage-editor-modal new-pipeline-modal">
        <header>
          <div>
            <span className="stage-editor-icon" />
            <div>
              <small>NOVO CRM</small>
              <h2>Criar funil de vendas</h2>
              <p>
                Crie um Kanban independente para outro processo, serviço ou
                equipe.
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={onSave}>
          <section className="stage-editor-main">
            <label>
              Nome do CRM *
              <input
                name="name"
                required
                autoFocus
                maxLength={80}
                placeholder="Ex.: Vendas de tráfego pago"
              />
            </label>
            <DepartmentChecks departments={departments} />
            <div className="new-pipeline-info">
              <KanbanSquare />
              <span>
                <b>Estrutura inicial pronta</b>
                <small>
                  O novo CRM será criado com as etapas Novo lead, Fechado —
                  ganho e Fechado — perdido. Depois você poderá adicionar e
                  ordenar as demais etapas.
                </small>
              </span>
            </div>
          </section>
          {error && (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Criando…" : "Criar CRM"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function StageEditor({
  stage,
  pipelineName,
  busy,
  error,
  onClose,
  onSave,
}: {
  stage: Stage | null;
  pipelineName: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="stage-editor-backdrop">
      <section className="stage-editor-modal">
        <header>
          <div>
            <span
              className="stage-editor-icon"
              style={{ background: stage?.color || "#4f8df7" }}
            />
            <div>
              <small>{pipelineName}</small>
              <h2>{stage ? "Editar etapa" : "Nova etapa"}</h2>
              <p>
                Defina como esta fase funciona dentro do seu processo comercial.
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={onSave}>
          <section className="stage-editor-main">
            <label>
              Nome da etapa *
              <input
                name="name"
                required
                autoFocus
                defaultValue={stage?.name}
                placeholder="Ex.: Reunião de diagnóstico"
              />
            </label>
            <div className="stage-editor-row">
              <label>
                Cor de identificação
                <div className="stage-color-field">
                  <input
                    name="color"
                    type="color"
                    defaultValue={stage?.color || "#4f8df7"}
                  />
                  <span>Aparece no Kanban e nos indicadores</span>
                </div>
              </label>
              <label>
                Probabilidade de fechamento
                <div className="probability-field">
                  <input
                    name="probability"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={stage?.probability ?? 30}
                    required
                  />
                  <span>%</span>
                </div>
                <small>Estimativa usada nas projeções comerciais.</small>
              </label>
            </div>
            {!stage && (
              <label>
                Tipo da etapa
                <select name="terminal" defaultValue="">
                  <option value="">Etapa normal do processo</option>
                  <option value="WON">Etapa final — ganho e conversão</option>
                  <option value="LOST">Etapa final — perda</option>
                </select>
                <small>
                  Normalmente use “Etapa normal”. Ganho e perda já vêm
                  configurados.
                </small>
              </label>
            )}
          </section>
          <section className="stage-editor-required">
            <div>
              <h3>Dados obrigatórios</h3>
              <p>
                Escolha o que deve estar preenchido antes de mover uma
                oportunidade para esta etapa.
              </p>
            </div>
            <RequiredFieldChecks selected={stage?.requiredFields} />
          </section>
          {error && (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? "Salvando…" : stage ? "Salvar etapa" : "Criar etapa"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function DepartmentChecks({
  departments,
  selected = [],
}: {
  departments: Department[];
  selected?: string[];
}) {
  return (
    <fieldset className="department-checks">
      <legend>Setores com acesso</legend>
      <small>Nenhum selecionado libera para todos os setores.</small>
      <div>
        {departments
          .filter((item) => item.active)
          .map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                name="departmentIds"
                value={item.id}
                defaultChecked={selected.includes(item.id)}
              />
              {item.name}
            </label>
          ))}
      </div>
    </fieldset>
  );
}

function RequiredFieldChecks({ selected = [] }: { selected?: string[] }) {
  const fields = [
    ["company", "Empresa"],
    ["email", "E-mail"],
    ["phone", "Telefone"],
    ["serviceInterest", "Serviço"],
    ["potentialValue", "Valor potencial"],
    ["responsibleId", "Responsável"],
    ["nextAction", "Próxima ação"],
    ["nextActionAt", "Data da próxima ação"],
  ];
  return (
    <fieldset className="required-field-checks">
      <legend>Obrigatórios para entrar na etapa</legend>
      {fields.map(([value, label]) => (
        <label key={value}>
          <input
            type="checkbox"
            name="requiredFields"
            value={value}
            defaultChecked={selected.includes(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="crm-confirm-backdrop" role="presentation">
      <section
        className="crm-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="crm-confirm-title"
      >
        <button
          className="crm-confirm-close"
          onClick={onCancel}
          aria-label="Fechar"
        >
          <X />
        </button>
        <span className="crm-confirm-icon">
          <ShieldAlert />
        </span>
        <h2 id="crm-confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="crm-confirm-note">
          <AlertTriangle />
          <span>
            <b>Ação permanente</b>Revise antes de continuar.
          </span>
        </div>
        <footer>
          <button className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="danger-button" onClick={onConfirm} disabled={busy}>
            {busy ? "Excluindo…" : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function PipelineDeleteDialog({
  pipeline,
  alternatives,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pipeline: Pipeline;
  alternatives: Pipeline[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (targetPipelineId: string) => void;
}) {
  const [targetPipelineId, setTargetPipelineId] = useState(
    alternatives[0]?.id || "",
  );
  const blocked = !alternatives.length;
  return (
    <div className="crm-confirm-backdrop" role="presentation">
      <section
        className="crm-confirm-dialog pipeline-delete-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pipeline-delete-title"
      >
        <button
          className="crm-confirm-close"
          onClick={onCancel}
          aria-label="Fechar"
        >
          <X />
        </button>
        <span className="crm-confirm-icon">
          <Trash2 />
        </span>
        <h2 id="pipeline-delete-title">Excluir o CRM “{pipeline.name}”?</h2>
        {blocked ? (
          <>
            <p>
              Este é o único CRM existente. Crie outro CRM antes de excluir este
              funil.
            </p>
            <div className="crm-confirm-note">
              <ShieldAlert />
              <span>
                <b>Funil obrigatório</b>O sistema precisa manter pelo menos um
                CRM ativo.
              </span>
            </div>
          </>
        ) : (
          <>
            <p>
              As oportunidades existentes não serão apagadas. Escolha para qual
              CRM elas devem ser transferidas.
            </p>
            <label className="pipeline-delete-target">
              CRM de destino
              <select
                value={targetPipelineId}
                onChange={(event) => setTargetPipelineId(event.target.value)}
              >
                {alternatives.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <small>
                As oportunidades serão colocadas na primeira etapa aberta do CRM
                selecionado e a transferência ficará registrada no histórico.
              </small>
            </label>
            <div className="crm-confirm-note">
              <AlertTriangle />
              <span>
                <b>Exclusão permanente</b>O funil e suas etapas serão removidos
                após a transferência.
              </span>
            </div>
          </>
        )}
        {error && (
          <div className="form-error">
            <AlertTriangle />
            {error}
          </div>
        )}
        <footer>
          <button className="secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className="danger-button"
            onClick={() => onConfirm(targetPipelineId)}
            disabled={busy || blocked || !targetPipelineId}
          >
            {busy ? "Transferindo e excluindo…" : "Transferir e excluir CRM"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function OpportunityForm({
  item,
  pipeline,
  users,
  companies,
  contacts,
  error,
  onClose,
  onSave,
}: {
  item: Opportunity | null;
  pipeline: Pipeline | null;
  users: User[];
  companies: CrmCompany[];
  contacts: CrmContact[];
  error: string;
  onClose: () => void;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(item?.companyId || "");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    item?.contactIds || [],
  );
  const contactOptions = contacts.map((value) => ({
    id: value.id,
    title: value.name,
    subtitle: [
      value.role,
      value.email,
      companies.find((company) => company.id === value.companyId)?.name,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const userOptions = users.map((value) => ({
    id: value.id,
    title: value.name,
    subtitle: "Colaborador",
  }));
  return (
    <div className="modal-backdrop crm-opportunity-form-backdrop">
      <section className="crm-modal crm-opportunity-form">
        <header>
          <span>
            <BriefcaseBusiness />
          </span>
          <div>
            <h2>{item ? "Editar oportunidade" : "Nova oportunidade"}</h2>
            <p>
              {item
                ? "Atualize dados, participantes e vínculos comerciais."
                : "Cadastre a oportunidade e conecte todas as pessoas envolvidas."}
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={onSave}>
          <input type="hidden" name="pipelineId" value={pipeline?.id || ""} />
          <section className="crm-form-section">
            <div className="crm-form-section-title">
              <span>1</span>
              <div>
                <b>Informações principais</b>
                <small>Identificação e contexto comercial</small>
              </div>
            </div>
            <div className="crm-form-grid">
              <label>
                Nome da oportunidade *
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={item?.name}
                  placeholder="Ex.: Gestão de tráfego — Empresa"
                />
              </label>
              <label>
                Empresa associada
                <select
                  name="companyId"
                  value={selectedCompanyId}
                  onChange={(event) => {
                    const companyId = event.target.value;
                    setSelectedCompanyId(companyId);
                    if (companyId) {
                      const companyContactIds = contacts
                        .filter((contact) => contact.companyId === companyId)
                        .map((contact) => contact.id);
                      setSelectedContactIds((current) => [
                        ...new Set([...current, ...companyContactIds]),
                      ]);
                    }
                  }}
                >
                  <option value="">Sem empresa associada</option>
                  {companies.map((value) => (
                    <option value={value.id} key={value.id}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                E-mail de referência
                <span className="crm-input-icon">
                  <Mail />
                  <input
                    name="email"
                    type="email"
                    defaultValue={item?.email}
                    placeholder="contato@empresa.com"
                  />
                </span>
              </label>
              <label>
                Telefone / WhatsApp
                <span className="crm-input-icon">
                  <Phone />
                  <input
                    name="phone"
                    inputMode="tel"
                    defaultValue={maskPhone(item?.phone || "")}
                    placeholder="(00) 00000-0000"
                    onInput={(event) => {
                      event.currentTarget.value = maskPhone(
                        event.currentTarget.value,
                      );
                    }}
                  />
                </span>
              </label>
              <label>
                Serviço de interesse
                <input
                  name="serviceInterest"
                  defaultValue={item?.serviceInterest}
                  placeholder="Ex.: Gestão de Meta Ads"
                />
              </label>
              <label>
                Valor potencial
                <input
                  name="potentialValue"
                  inputMode="decimal"
                  defaultValue={item?.potentialValue == null ? "" : maskCurrency(item.potentialValue)}
                  placeholder="R$ 0,00"
                  onBlur={(event) => {
                    if (event.currentTarget.value)
                      event.currentTarget.value = maskCurrency(event.currentTarget.value);
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <fieldset className="crm-temperature-field full">
                <legend>Temperatura da oportunidade</legend>
                <small>Indique o nível de interesse e potencial de fechamento.</small>
                <div className="crm-temperature-options">
                  {(["COLD", "WARM", "HOT", "VERY_HOT"] as const).map((temperature) => (
                    <label className={temperature.toLowerCase().replace("_", "-")} key={temperature}>
                      <input type="radio" name="temperature" value={temperature} defaultChecked={(item?.temperature || "WARM") === temperature} />
                      <span>{temperature === "HOT" || temperature === "VERY_HOT" ? <Flame /> : <Thermometer />}</span>
                      <b>{temperatureLabel[temperature]}</b>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
          <section className="crm-form-section">
            <div className="crm-form-section-title">
              <span>2</span>
              <div>
                <b>Vínculos e responsáveis</b>
                <small>Encontre pessoas digitando nome, e-mail ou função</small>
              </div>
            </div>
            <div className="crm-form-grid">
              <div className="full">
                <SearchMultiSelect
                  name="contactIds"
                  label="Contatos associados"
                  options={contactOptions}
                  value={selectedContactIds}
                  onChange={(next) => {
                    if (!selectedCompanyId) {
                      const linkedCompany = next
                        .map((id) => contacts.find((contact) => contact.id === id))
                        .find((contact) => contact?.companyId)?.companyId;
                      if (linkedCompany) {
                        setSelectedCompanyId(linkedCompany);
                        setSelectedContactIds([
                          ...new Set([
                            ...next,
                            ...contacts
                              .filter((contact) => contact.companyId === linkedCompany)
                              .map((contact) => contact.id),
                          ]),
                        ]);
                        return;
                      }
                    }
                    setSelectedContactIds(next);
                  }}
                  placeholder="Buscar contato por nome, e-mail ou empresa..."
                />
              </div>
              <label>
                Responsável principal
                <select name="responsibleId" defaultValue={item?.responsibleId}>
                  <option value="">Selecione um responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              {!item && (
                <label>
                  Etapa inicial
                  <select name="stageId">
                    {pipeline?.stages
                      .filter((s) => !s.terminal)
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="full">
                <SearchMultiSelect
                  name="teamIds"
                  label="Equipe participante"
                  options={userOptions}
                  defaultValue={item?.teamIds || []}
                  placeholder="Buscar colaborador..."
                />
              </div>
            </div>
          </section>
          <section className="crm-form-section">
            <div className="crm-form-section-title">
              <span>3</span>
              <div>
                <b>Qualificação e acompanhamento</b>
                <small>Prioridade, etiquetas e próximo passo</small>
              </div>
            </div>
            <div className="crm-form-grid">
              <label>
                Prioridade
                <select
                  name="priority"
                  defaultValue={item?.priority || "MEDIUM"}
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label className="full">
                Tags
                <input
                  name="tags"
                  defaultValue={item?.tags?.join(", ")}
                  placeholder="Ex.: indicação, urgente, branding"
                />
              </label>
              <label>
                Próxima ação
                <input
                  name="nextAction"
                  defaultValue={item?.nextAction}
                  placeholder="Ex.: Retornar proposta"
                />
              </label>
              <label>
                Data da próxima ação
                <input
                  name="nextActionAt"
                  type="datetime-local"
                  defaultValue={item?.nextActionAt?.slice(0, 16)}
                />
              </label>
            </div>
          </section>
          {error && (
            <div className="form-error">
              <AlertTriangle />
              {error}
            </div>
          )}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="primary">
              {item ? "Salvar alterações" : "Criar oportunidade"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function OpportunityDetail({
  item,
  pipeline,
  users,
  companies,
  contacts,
  clients,
  onClose,
  onEdit,
  onDelete,
  onChange,
}: {
  item: Opportunity;
  pipeline: Pipeline | null;
  users: User[];
  companies: CrmCompany[];
  contacts: CrmContact[];
  clients: Client[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (item: Opportunity) => void;
}) {
  const stage = pipeline?.stages.find((s) => s.id === item.stageId);
  const [activityType, setActivityType] = useState("NOTE"),
    [activityText, setActivityText] = useState(""),
    [proposal, setProposal] = useState(false),
    [reverseOpen, setReverseOpen] = useState(false),
    [error, setError] = useState("");
  const addActivity = async () => {
    const response = await fetch(
      `/api/crm/opportunities/${item.id}/activities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activityType, description: activityText }),
      },
    );
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setActivityText("");
    onChange(data.opportunity);
  };
  const addProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch(
      `/api/crm/opportunities/${item.id}/proposals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(new FormData(event.currentTarget)),
        ),
      },
    );
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setProposal(false);
    onChange(data.opportunity);
  };
  const reverse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") || "",
    );
    const response = await fetch(
      `/api/crm/opportunities/${item.id}/reverse-conversion`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    setReverseOpen(false);
    onChange(data.opportunity);
  };
  const associatedCompany = companies.find(
      (value) => value.id === item.companyId,
    ),
    associatedContacts = contacts.filter((value) =>
      (item.contactIds || []).includes(value.id),
    );
  return (
    <div className="modal-backdrop crm-detail-backdrop">
      <aside className="crm-detail">
        <header>
          <button onClick={onClose}>
            <X />
          </button>
          <small>{stage?.name}</small>
          <h2>{item.name}</h2>
          <p>{associatedCompany?.name || item.company || "Sem empresa"}</p>
          {item.tags?.length > 0 && (
            <div className="crm-tags">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </header>
        <div className="crm-detail-actions">
          {item.status !== "CONVERTED" ? (
            <button className="secondary" onClick={onEdit}>
              Editar oportunidade
            </button>
          ) : (
            <button className="secondary" onClick={() => setReverseOpen(true)}>
              Reverter conversão
            </button>
          )}
          <button
            className="danger-icon"
            onClick={onDelete}
            disabled={item.status === "CONVERTED"}
            title={
              item.status === "CONVERTED"
                ? "O histórico convertido não pode ser excluído"
                : "Excluir oportunidade"
            }
          >
            <Trash2 />
          </button>
        </div>
        <main>
          <section className="crm-detail-values">
            <div>
              <small>Valor potencial</small>
              <b>{money(item.potentialValue)}</b>
            </div>
            <div>
              <small>Responsável</small>
              <b>{item.responsibleName || "Não definido"}</b>
            </div>
            <div>
              <small>Serviço</small>
              <b>{item.serviceInterest || "Não informado"}</b>
            </div>
            <div>
              <small>Cliente convertido</small>
              <b>
                {clients.find((value) => value.id === item.convertedClientId)
                  ?.name || "Ainda não convertido"}
              </b>
            </div>
          </section>
          {associatedCompany && (
            <section>
              <h3>
                <Building2 /> Empresa associada
              </h3>
              <div className="crm-association-card">
                <b>{associatedCompany.name}</b>
                <small>
                  {associatedCompany.segment || associatedCompany.website}
                </small>
              </div>
            </section>
          )}
          {associatedContacts.length > 0 && (
            <section>
              <h3>
                <Contact /> Contatos associados
              </h3>
              <div className="crm-association-list">
                {associatedContacts.map((value) => (
                  <span key={value.id}>
                    {value.name}
                    <small>{value.role || value.email}</small>
                  </span>
                ))}
              </div>
            </section>
          )}
          {item.teamIds?.length > 0 && (
            <section>
              <h3>
                <UserRound /> Equipe envolvida
              </h3>
              <div className="crm-team">
                {item.teamIds.map((id) => (
                  <span key={id}>
                    {users.find((user) => user.id === id)?.name || "Usuário"}
                  </span>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="crm-section-head">
              <h3>
                <CircleDollarSign /> Propostas
              </h3>
              <button onClick={() => setProposal((value) => !value)}>
                <Plus /> Adicionar
              </button>
            </div>
            {proposal && (
              <form className="proposal-form" onSubmit={addProposal}>
                <input name="title" required placeholder="Título da proposta" />
                <input
                  name="value"
                  required
                  inputMode="decimal"
                  placeholder="Valor"
                />
                <select name="status">
                  <option value="DRAFT">Rascunho</option>
                  <option value="SENT">Enviada</option>
                  <option value="ACCEPTED">Aceita</option>
                  <option value="REJECTED">Recusada</option>
                </select>
                <input name="validUntil" type="date" />
                <textarea name="notes" placeholder="Observações" />
                <button className="primary">Salvar proposta</button>
              </form>
            )}
            <div className="proposal-list">
              {(item.proposals || []).map((value) => (
                <article key={value.id}>
                  <div>
                    <b>{value.title}</b>
                    <small>
                      {new Date(value.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                      {value.status}
                    </small>
                  </div>
                  <strong>{money(value.value)}</strong>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3>
              <History /> Histórico comercial
            </h3>
            <div className="activity-composer">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
              >
                <option value="NOTE">Nota</option>
                <option value="CALL">Ligação</option>
                <option value="MESSAGE">Mensagem</option>
                <option value="EMAIL">E-mail</option>
                <option value="MEETING">Reunião</option>
                <option value="COMMENT">Comentário</option>
              </select>
              <textarea
                value={activityText}
                onChange={(e) => setActivityText(e.target.value)}
                placeholder="Registre detalhes da interação comercial..."
              />
              <button
                className="primary"
                disabled={!activityText.trim()}
                onClick={addActivity}
              >
                Registrar atividade
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="crm-timeline">
              {item.activities
                .slice()
                .reverse()
                .map((activity) => (
                  <article key={activity.id}>
                    <i />
                    <div>
                      <b>{activity.description}</b>
                      <small>
                        {activity.actorName} ·{" "}
                        {new Date(activity.createdAt).toLocaleString("pt-BR")}
                      </small>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </main>
      </aside>
      {reverseOpen && (
        <div className="crm-confirm-backdrop">
          <form
            className="crm-confirm-dialog crm-reversal-dialog"
            onSubmit={reverse}
          >
            <button
              type="button"
              className="crm-confirm-close"
              onClick={() => setReverseOpen(false)}
            >
              <X />
            </button>
            <span className="crm-confirm-icon">
              <History />
            </span>
            <h2>Reverter conversão?</h2>
            <p>
              O histórico será preservado. Informe uma justificativa para
              auditoria.
            </p>
            <label>
              Justificativa *
              <textarea
                name="reason"
                minLength={10}
                required
                autoFocus
                placeholder="Explique por que esta conversão precisa ser revertida..."
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <footer>
              <button
                type="button"
                className="secondary"
                onClick={() => setReverseOpen(false)}
              >
                Cancelar
              </button>
              <button className="danger-button">Confirmar reversão</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

function ConversionModal({
  item,
  users,
  clients,
  pipelines,
  onClose,
  onDone,
}: {
  item: Opportunity;
  users: User[];
  clients: Client[];
  pipelines: Pipeline[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState(""),
    [billingType, setBillingType] = useState<"ONE_TIME" | "RECURRING" | "BOTH">("RECURRING"),
    [duplicates, setDuplicates] = useState<
      { id: string; name: string; reason: string }[]
    >([]),
    [allowDuplicate, setAllowDuplicate] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const input = Object.fromEntries(new FormData(e.currentTarget));
    const response = await fetch(`/api/crm/opportunities/${item.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, allowDuplicate }),
    });
    const data = await response.json();
    if (response.status === 409 && data.duplicates) {
      setDuplicates(data.duplicates);
      return;
    }
    if (!response.ok) return setError(data.message);
    onDone();
  };
  return (
    <div className="modal-backdrop">
      <section className="crm-modal conversion-modal">
        <header>
          <span>
            <Check />
          </span>
          <div>
            <h2>Converter em cliente</h2>
            <p>
              Revise os dados. O histórico comercial será preservado
              integralmente.
            </p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="conversion-banner">
            <div>
              <small>Lead</small>
              <b>{item.name}</b>
            </div>
            <ArrowRight />
            <div>
              <small>Cliente</small>
              <b>{item.company || item.name}</b>
            </div>
          </div>
          <div className="crm-form-grid">
            <label className="full">
              Vincular a cliente existente
              <select name="existingClientId">
                <option value="">Criar um novo cliente</option>
                {clients.map((client) => (
                  <option value={client.id} key={client.id}>
                    {client.name}
                    {client.document ? ` — ${client.document}` : ""}
                  </option>
                ))}
              </select>
              <small>
                Selecione somente quando a empresa já estiver cadastrada.
              </small>
            </label>
            <label>
              Nome comercial *
              <input
                name="clientName"
                defaultValue={item.company || item.name}
                required
              />
            </label>
            <label>
              CPF ou CNPJ
              <input
                name="document"
                inputMode="numeric"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
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
            </label>
            <label>
              E-mail
              <input name="email" type="email" defaultValue={item.email} />
            </label>
            <label>
              Telefone
              <input
                name="phone"
                inputMode="tel"
                defaultValue={maskPhone(item.phone)}
                placeholder="(00) 00000-0000"
                onInput={(event) => {
                  event.currentTarget.value = maskPhone(
                    event.currentTarget.value,
                  );
                }}
              />
            </label>
            <label>
              Serviço contratado *
              <input
                name="serviceName"
                defaultValue={item.serviceInterest}
                required
              />
            </label>
            <label>
              Forma de cobrança
              <select name="billingType" value={billingType} onChange={(event) => setBillingType(event.target.value as typeof billingType)}>
                <option value="ONE_TIME">Pontual</option>
                <option value="RECURRING">Recorrente</option>
                <option value="BOTH">Pontual + recorrente</option>
              </select>
            </label>
            {(billingType === "ONE_TIME" || billingType === "BOTH") && <label>
              Valor pontual {billingType === "BOTH" ? "(implantação/onboarding)" : ""} *
              <input name="oneTimeValue" inputMode="decimal" defaultValue={billingType === "ONE_TIME" ? item.potentialValue : ""} required />
            </label>}
            {(billingType === "RECURRING" || billingType === "BOTH") && <label>
              Valor recorrente mensal *
              <input name="recurringValue" inputMode="decimal" defaultValue={billingType === "RECURRING" ? item.potentialValue : ""} required />
            </label>}
            <label>
              Data de início
              <input name="startDate" type="date" required />
            </label>
            <label className="full">
              Responsável
              <select name="managerUserId">
                <option value="">Selecione...</option>
                {users.map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Encaminhar o cliente para outro funil após o ganho
              <select name="targetPipelineId" defaultValue="">
                <option value="">Não encaminhar para outro funil</option>
                {pipelines.filter((pipeline) => pipeline.id !== item.pipelineId).map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.name}</option>)}
              </select>
              <small>Uma nova oportunidade será criada na primeira etapa do funil escolhido.</small>
            </label>
          </div>
          {duplicates.length > 0 && (
            <div className="duplicate-warning">
              <AlertTriangle />
              <div>
                <b>Encontramos possíveis clientes duplicados</b>
                {duplicates.map((d) => (
                  <p key={d.id}>
                    {d.name} — {d.reason}
                  </p>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                  />{" "}
                  Confirmo que desejo criar um novo cliente mesmo assim.
                </label>
              </div>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={duplicates.length > 0 && !allowDuplicate}
            >
              Confirmar conversão
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function LossModal({
  item,
  pipeline,
  onClose,
  onDone,
}: {
  item: Opportunity;
  pipeline: Pipeline | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [error, setError] = useState("");
  const stage = pipeline?.stages.find((s) => s.terminal === "LOST");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.currentTarget));
    const response = await fetch(`/api/crm/opportunities/${item.id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, stageId: stage?.id }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message);
    onDone();
  };
  return (
    <div className="modal-backdrop">
      <section className="crm-modal small">
        <header>
          <span>
            <AlertTriangle />
          </span>
          <div>
            <h2>Marcar como perdido</h2>
            <p>O motivo é obrigatório e ficará registrado no histórico.</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            Motivo da perda *
            <select name="lossReason" required>
              <option value="">Selecione...</option>
              <option>Preço</option>
              <option>Sem retorno</option>
              <option>Escolheu concorrente</option>
              <option>Sem orçamento</option>
              <option>Momento inadequado</option>
              <option>Outro</option>
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="primary">Confirmar perda</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
