import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { spawn } from "node:child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { once } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { extractMetaLeads, type MetaAction } from "./metaInsights";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import {
  allPermissions,
  permissionCatalog,
  sanitizePermissions,
} from "./packages/permissions/src/catalog";

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarDataUrl?: string;
  profile: string;
  role: string;
  roleId?: string;
  departmentId?: string;
  departmentName?: string;
  permissionOverrides?: Record<string, "ALLOW" | "DENY">;
  mustChangePassword: boolean;
  salt: string;
  passwordHash: string;
  clientId?: string;
};
type Role = {
  id: string;
  name: string;
  description: string;
  level: number;
  system: boolean;
  assignable?: boolean;
  permissions: string[];
};
type Integration = {
  id: string;
  platform: "GOOGLE_ADS" | "META_ADS";
  name: string;
  status: string;
  demo: boolean;
  managerName: string;
  accountCount: number;
  campaignCount: number;
  responsible: string;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  frequency: string;
};
type MetaInsight = {
  campaign_id?: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  frequency?: string;
  ctr?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
};
type MetaCampaignPayload = {
  id: string;
  name: string;
  objective?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  promoted_object?: { page_id?: string; instagram_actor_id?: string };
};
type MetaAccountPayload = {
  id: string;
  name?: string;
  business_name?: string;
  businessPortfolioId?: string;
  currency?: string;
  amount_spent?: string;
  spend_cap?: string;
  pageName?: string;
  profilePictureUrl?: string;
  business?: { id: string; name?: string; profile_picture_uri?: string };
  owner_business?: { id: string; name?: string; profile_picture_uri?: string };
};
type MediaAssignment = {
  accountId: string;
  platform: "META_ADS" | "GOOGLE_ADS";
  clientId: string;
  responsibleId: string;
  identitySource?: "CLIENT" | "META_PORTFOLIO" | "UNLINKED";
  updatedAt: string;
  updatedBy: string;
};
type OperationalAlert = {
  id: string;
  type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  accountId: string;
  campaignId?: string;
  campaignName?: string;
  clientName: string;
  responsibleId: string;
  responsibleName: string;
  createdAt: string;
  read: boolean;
  targetUrl?: string;
};
type Client = {
  id: string;
  name: string;
  legalName: string;
  document: string;
  status: "ACTIVE" | "ATTENTION" | "RISK" | "INACTIVE";
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
type Department = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  managerUserId?: string;
  managerName?: string;
  createdAt: string;
};
type TicketComment = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  mentions: string[];
  createdAt: string;
};
type Ticket = {
  id: string;
  code: string;
  title: string;
  description: string;
  departmentId: string;
  requesterId: string;
  requesterName: string;
  assigneeId: string;
  assigneeName: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
  dueAt: string;
  participantIds: string[];
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
};
type CrmStage = {
  id: string;
  name: string;
  color: string;
  probability: number;
  requiredFields?: string[];
  terminal?: "WON" | "LOST";
};
type CrmPipeline = {
  id: string;
  name: string;
  departmentIds: string[];
  stages: CrmStage[];
  createdAt: string;
};
type CrmActivity = {
  id: string;
  type: string;
  description: string;
  actorId: string;
  actorName: string;
  createdAt: string;
  metadata?: Record<string, string>;
};
type CrmProposal = {
  id: string;
  title: string;
  value: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  validUntil: string;
  notes: string;
  createdBy: string;
  createdAt: string;
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
  temperature: "COLD" | "WARM" | "HOT";
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
  convertedAt?: string;
  convertedBy?: string;
  stageEnteredAt: string;
  createdAt: string;
  updatedAt: string;
  activities: CrmActivity[];
  proposals: CrmProposal[];
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
  activities: CrmActivity[];
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
  activities: CrmActivity[];
};
type ClientService = {
  id: string;
  clientId: string;
  opportunityId: string;
  name: string;
  negotiatedValue: number;
  billingType: "RECURRING" | "ONE_TIME";
  startDate: string;
  managerUserId: string;
  createdAt: string;
};
type ClientContact = {
  id: string;
  clientId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  primary: boolean;
  createdAt: string;
};
type OnboardingProject = {
  id: string;
  clientId: string;
  serviceId: string;
  name: string;
  objective?: string;
  responsibleId?: string;
  teamIds?: string[];
  startDate?: string;
  dueDate?: string;
  progress?: number;
  status: "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  tasks: { id: string; title: string; status: string }[];
};
type WorkTask = {
  id: string;
  title: string;
  description: string;
  clientId: string;
  projectId: string;
  opportunityId: string;
  responsibleId: string;
  responsibleName: string;
  participantIds: string[];
  type:
    | "CONTENT"
    | "DESIGN"
    | "VIDEO"
    | "WEB"
    | "PAID_MEDIA"
    | "EMAIL"
    | "OTHER";
  subtype: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status:
    | "TODO"
    | "IN_PROGRESS"
    | "REVIEW"
    | "WAITING_APPROVAL"
    | "CHANGES_REQUESTED"
    | "APPROVED"
    | "SCHEDULED"
    | "PUBLISHED"
    | "DONE"
    | "CANCELLED";
  approvalStatus:
    | "NOT_REQUIRED"
    | "PENDING"
    | "APPROVED"
    | "CHANGES_REQUESTED"
    | "REJECTED";
  approvalHistory: {
    id: string;
    action: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
    actorId: string;
    actorName: string;
    comment: string;
    createdAt: string;
  }[];
  startAt: string;
  dueAt: string;
  plannedAt: string;
  publishedAt: string;
  completedAt: string;
  estimateMinutes: number;
  trackedMinutes: number;
  tags: string[];
  details: Record<string, string>;
  checklist: {
    id: string;
    title: string;
    done: boolean;
    completedBy?: string;
    completedAt?: string;
    position: number;
  }[];
  comments: (TicketComment & { visibility?: "INTERNAL" | "CLIENT_VISIBLE" })[];
  attachments: {
    id: string;
    name: string;
    contentType: string;
    sizeBytes: number;
    dataUrl?: string;
    storagePath?: string;
    url?: string;
    expiresAt?: string;
    uploadedById: string;
    uploadedByName: string;
    createdAt: string;
  }[];
  activity: {
    id: string;
    actorId: string;
    actorName: string;
    action: string;
    createdAt: string;
  }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
};
type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  participantIds: string[];
  startAt: string;
  endAt: string;
  location: string;
  category: string;
  clientId: string;
  projectId: string;
  opportunityId: string;
  taskId: string;
  recurrence: string;
  reminderMinutes: number;
  createdAt: string;
  updatedAt: string;
};
type FinancialAccount = {
  id: string;
  name: string;
  institution: string;
  type: "CHECKING" | "SAVINGS" | "CASH" | "CARD";
  openingBalance: number;
  active: boolean;
  createdAt: string;
};
type FinancialCategory = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
  active: boolean;
  createdAt: string;
};
type FinancialEntry = {
  id: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  dueDate: string;
  paidAt: string;
  status: "OPEN" | "PAID" | "CANCELLED";
  categoryId: string;
  accountId: string;
  clientId: string;
  supplier: string;
  costCenter: string;
  documentNumber: string;
  paymentMethod: string;
  recurrence: "NONE" | "MONTHLY" | "YEARLY";
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};
type FinancialSupplier = {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  createdAt: string;
};
type FinancialCostCenter = {
  id: string;
  name: string;
  code: string;
  description: string;
  active: boolean;
  createdAt: string;
};
type FinancialAudit = {
  id: string;
  entryId: string;
  action: string;
  reason: string;
  userId: string;
  userName: string;
  createdAt: string;
};
const sessions = new Map<string, string>();
const clientSessions = new Map<string, string>();
const users = new Map<string, User>();
const roles = new Map<string, Role>();
const integrations = new Map<string, Integration>();
const mediaAssignments = new Map<string, MediaAssignment>();
const notificationReads = new Map<string, string>();
const metaAccountPictures = new Map<string, string>();
const clients = new Map<string, Client>();
const departments = new Map<string, Department>();
const tickets = new Map<string, Ticket>();
const pipelines = new Map<string, CrmPipeline>();
const opportunities = new Map<string, Opportunity>();
const crmContacts = new Map<string, CrmContact>();
const crmCompanies = new Map<string, CrmCompany>();
const clientServices = new Map<string, ClientService>();
const onboardingProjects = new Map<string, OnboardingProject>();
const clientContacts = new Map<string, ClientContact>();
const workTasks = new Map<string, WorkTask>();
const calendarEvents = new Map<string, CalendarEvent>();
const financialAccounts = new Map<string, FinancialAccount>();
const financialCategories = new Map<string, FinancialCategory>();
const financialEntries = new Map<string, FinancialEntry>();
const financialSuppliers = new Map<string, FinancialSupplier>();
const financialCostCenters = new Map<string, FinancialCostCenter>();
const financialAudits: FinancialAudit[] = [];
const hash = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");
const onlyDigits = (value: string) => value.replace(/\D/g, "");
const repeatedDigits = (value: string) => /^(\d)\1+$/.test(value);
const validCPF = (value: string) => {
  const raw = onlyDigits(value);
  if (raw.length !== 11 || repeatedDigits(raw)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(raw[i]) * (length + 1 - i);
    const mod = (sum * 10) % 11;
    return (mod === 10 ? 0 : mod) === Number(raw[length]);
  };
  return check(9) && check(10);
};
const validCNPJ = (value: string) => {
  const raw = onlyDigits(value);
  if (raw.length !== 14 || repeatedDigits(raw)) return false;
  const calc = (base: string) => {
    let factor = base.length - 7,
      sum = 0;
    for (const digit of base) {
      sum += Number(digit) * factor--;
      if (factor === 1) factor = 9;
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return (
    calc(raw.slice(0, 12)) === Number(raw[12]) &&
    calc(raw.slice(0, 13)) === Number(raw[13])
  );
};
const validDocument = (value: string) => {
  const raw = onlyDigits(value);
  return raw.length === 11
    ? validCPF(raw)
    : raw.length === 14
      ? validCNPJ(raw)
      : false;
};
const validPhone = (value: string) => {
  const raw = onlyDigits(value);
  return !value || raw.length === 10 || raw.length === 11;
};
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const hasPermission = (user: User, permission: string) => {
  if (user.profile === "MASTER") return true;
  const override = user.permissionOverrides?.[permission];
  if (override) return override === "ALLOW";
  return (
    !!user.roleId && !!roles.get(user.roleId)?.permissions.includes(permission)
  );
};
const publicUser = (user: User) => {
  const permissions =
    user.profile === "MASTER"
      ? [...allPermissions]
      : allPermissions.filter((permission) => hasPermission(user, permission));
  const { passwordHash: _, salt: __, ...safeUser } = user;
  return { ...safeUser, permissions };
};
const clientUsers = (clientId: string) =>
  [...users.values()].filter(
    (user) => user.profile === "CLIENT" && user.clientId === clientId,
  );
const cookies = (request: IncomingMessage) =>
  Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((value) => value.trim().split("=")),
  );
const body = async (request: IncomingMessage) => {
  let value = "";
  for await (const chunk of request) value += chunk;
  return JSON.parse(value || "{}") as Record<string, any>;
};
const json = (response: ServerResponse, status: number, value: unknown) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
};

function localApi(
  masterEmail: string,
  masterPassword: string,
  metaAccessToken: string,
  metaGraphVersion: string,
  googleClientId: string,
  googleClientSecret: string,
  googleDeveloperToken: string,
  googleRefreshToken: string,
): Plugin {
  const localMetaTokenPath = "data/meta-token.local.json";
  const localGoogleDeveloperTokenPath =
    "data/google-developer-token.local.json";
  const localIntegrationKeyPath = "data/integration.local.key";
  let runtimeMetaAccessToken = metaAccessToken;
  let runtimeGoogleClientId = googleClientId;
  let runtimeGoogleClientSecret = googleClientSecret;
  let runtimeGoogleDeveloperToken = googleDeveloperToken;
  let runtimeGoogleRefreshToken = googleRefreshToken;
  const integrationKey = () => {
    mkdirSync("data", { recursive: true });
    if (!existsSync(localIntegrationKeyPath))
      writeFileSync(localIntegrationKeyPath, randomBytes(32), { mode: 0o600 });
    return readFileSync(localIntegrationKeyPath);
  };
  const encryptIntegrationToken = (token: string) => {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", integrationKey(), iv),
      encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return {
      version: 1,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: encrypted.toString("base64"),
      updatedAt: new Date().toISOString(),
    };
  };
  const decryptIntegrationToken = (payload: {
    iv: string;
    tag: string;
    ciphertext: string;
  }) => {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      integrationKey(),
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  };
  if (existsSync(localMetaTokenPath)) {
    try {
      runtimeMetaAccessToken = decryptIntegrationToken(
        JSON.parse(readFileSync(localMetaTokenPath, "utf8")),
      );
    } catch {
      runtimeMetaAccessToken = metaAccessToken;
    }
  }
  if (existsSync(localGoogleDeveloperTokenPath)) {
    try {
      runtimeGoogleDeveloperToken = decryptIntegrationToken(
        JSON.parse(readFileSync(localGoogleDeveloperTokenPath, "utf8")),
      );
    } catch {
      runtimeGoogleDeveloperToken = googleDeveloperToken;
    }
  }
  const localUsersPath = "data/users.local.json";
  const localRolesPath = "data/roles.local.json";
  const localIntegrationsPath = "data/integrations.local.json";
  const localClientsPath = "data/clients.local.json";
  const localMediaAssignmentsPath = "data/media-assignments.local.json";
  const localNotificationReadsPath = "data/notification-reads.local.json";
  const localMetaDashboardCachePath = "data/meta-dashboard-cache.local.json";
  const localGoogleDashboardCachePath = "data/google-dashboard-cache.local.json";
  const localMasterProfilePath = "data/master-profile.local.json";
  const localMasterUserPath = "data/master-user.local.json";
  const localDepartmentsPath = "data/departments.local.json";
  const localTicketsPath = "data/tickets.local.json";
  const localPipelinesPath = "data/crm-pipelines.local.json";
  const localOpportunitiesPath = "data/crm-opportunities.local.json";
  const localCrmContactsPath = "data/crm-contacts.local.json";
  const localCrmCompaniesPath = "data/crm-companies.local.json";
  const localClientServicesPath = "data/client-services.local.json";
  const localProjectsPath = "data/projects.local.json";
  const localClientContactsPath = "data/client-contacts.local.json";
  const localTasksPath = "data/tasks.local.json";
  const localTaskAttachmentsPath = "data/task-attachments";
  const localCalendarPath = "data/calendar.local.json";
  const localFinancialAccountsPath = "data/financial-accounts.local.json";
  const localFinancialCategoriesPath = "data/financial-categories.local.json";
  const localFinancialEntriesPath = "data/financial-entries.local.json";
  const localFinancialSuppliersPath = "data/financial-suppliers.local.json";
  const localFinancialCostCentersPath =
    "data/financial-cost-centers.local.json";
  const localFinancialAuditsPath = "data/financial-audits.local.json";
  let databaseMirrorTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleDatabaseMirror = () => {
    clearTimeout(databaseMirrorTimer);
    databaseMirrorTimer = setTimeout(() => {
      const child = spawn(
        process.execPath,
        ["scripts/migrate-local-data-to-postgres.mjs"],
        {
          cwd: process.cwd(),
          stdio: "ignore",
          detached: true,
        },
      );
      child.unref();
    }, 1200);
  };
  const developerRole: Role = {
    id: "developer-system-role",
    name: "Desenvolvedor",
    description:
      "Acesso técnico total e protegido para desenvolvimento e manutenção do PW OS.",
    level: 100,
    system: true,
    assignable: false,
    permissions: [...allPermissions],
  };
  const ceoRole: Role = {
    id: "owner-system-role",
    name: "CEO",
    description:
      "Acesso executivo total e protegido para a direção da empresa.",
    level: 99,
    system: true,
    assignable: true,
    permissions: [...allPermissions],
  };
  roles.set(developerRole.id, developerRole);
  roles.set(ceoRole.id, ceoRole);
  if (existsSync(localRolesPath)) {
    const storedRoles = JSON.parse(
      readFileSync(localRolesPath, "utf8"),
    ) as Role[];
    storedRoles.forEach((role) => roles.set(role.id, role));
  }
  roles.set(developerRole.id, developerRole);
  roles.set(ceoRole.id, ceoRole);
  const salt = randomBytes(16).toString("hex");
  const master: User = {
    id: randomUUID(),
    name: "Emerson Santos",
    email: masterEmail.toLowerCase(),
    profile: "MASTER",
    role: developerRole.name,
    roleId: developerRole.id,
    permissionOverrides: {},
    mustChangePassword: false,
    salt,
    passwordHash: hash(masterPassword, salt),
  };
  if (existsSync(localMasterUserPath)) {
    Object.assign(
      master,
      JSON.parse(readFileSync(localMasterUserPath, "utf8")),
      {
        email: masterEmail.toLowerCase(),
        profile: "MASTER",
        role: developerRole.name,
        roleId: developerRole.id,
      },
    );
  } else if (existsSync(localMasterProfilePath)) {
    Object.assign(
      master,
      JSON.parse(readFileSync(localMasterProfilePath, "utf8")),
    );
  }
  users.set(master.id, master);
  if (existsSync(localUsersPath)) {
    const storedUsers = JSON.parse(
      readFileSync(localUsersPath, "utf8"),
    ) as User[];
    storedUsers.forEach((user) =>
      users.set(user.id, {
        ...user,
        mustChangePassword: user.mustChangePassword ?? true,
      }),
    );
  }
  const persistUsers = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localUsersPath,
      JSON.stringify(
        [...users.values()].filter((user) => user.profile !== "MASTER"),
        null,
        2,
      ),
      { mode: 0o600 },
    );
  };
  const persistUser = (user: User) => {
    if (user.profile === "MASTER") {
      mkdirSync("data", { recursive: true });
      writeFileSync(localMasterUserPath, JSON.stringify(user, null, 2), {
        mode: 0o600,
      });
    } else persistUsers();
  };
  const persistRoles = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localRolesPath,
      JSON.stringify(
        [...roles.values()].filter((role) => !role.system),
        null,
        2,
      ),
      { mode: 0o600 },
    );
  };
  if (existsSync(localIntegrationsPath)) {
    const storedIntegrations = JSON.parse(
      readFileSync(localIntegrationsPath, "utf8"),
    ) as Integration[];
    storedIntegrations.forEach((integration) =>
      integrations.set(integration.id, integration),
    );
  }
  const persistIntegrations = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localIntegrationsPath,
      JSON.stringify([...integrations.values()], null, 2),
      { mode: 0o600 },
    );
  };
  if (existsSync(localMediaAssignmentsPath))
    (
      JSON.parse(
        readFileSync(localMediaAssignmentsPath, "utf8"),
      ) as MediaAssignment[]
    ).forEach((item) =>
      mediaAssignments.set(`${item.platform}:${item.accountId}`, item),
    );
  const persistMediaAssignments = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localMediaAssignmentsPath,
      JSON.stringify([...mediaAssignments.values()], null, 2),
      { mode: 0o600 },
    );
    scheduleDatabaseMirror();
  };
  if (existsSync(localNotificationReadsPath))
    Object.entries(
      JSON.parse(readFileSync(localNotificationReadsPath, "utf8")) as Record<
        string,
        string
      >,
    ).forEach(([key, value]) => notificationReads.set(key, value));
  const persistNotificationReads = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localNotificationReadsPath,
      JSON.stringify(Object.fromEntries(notificationReads), null, 2),
      { mode: 0o600 },
    );
  };
  if (existsSync(localClientsPath)) {
    const storedClients = JSON.parse(
      readFileSync(localClientsPath, "utf8"),
    ) as Client[];
    storedClients.forEach((client) => clients.set(client.id, client));
  }
  const persistClients = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localClientsPath,
      JSON.stringify([...clients.values()], null, 2),
      { mode: 0o600 },
    );
    scheduleDatabaseMirror();
  };
  if (existsSync(localDepartmentsPath))
    (
      JSON.parse(readFileSync(localDepartmentsPath, "utf8")) as Department[]
    ).forEach((item) => departments.set(item.id, item));
  if (existsSync(localTicketsPath))
    (JSON.parse(readFileSync(localTicketsPath, "utf8")) as Ticket[]).forEach(
      (item) => tickets.set(item.id, item),
    );
  const persistDepartments = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localDepartmentsPath,
      JSON.stringify([...departments.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistTickets = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localTicketsPath,
      JSON.stringify([...tickets.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const defaultPipeline: CrmPipeline = {
    id: "sales-default",
    name: "Pipeline comercial",
    departmentIds: [],
    createdAt: new Date().toISOString(),
    stages: [
      { id: "new-lead", name: "Novo lead", color: "#4f8df7", probability: 10 },
      {
        id: "first-contact",
        name: "Primeiro contato",
        color: "#21a4a6",
        probability: 20,
      },
      {
        id: "qualification",
        name: "Qualificação",
        color: "#8b5cf6",
        probability: 35,
      },
      {
        id: "diagnosis",
        name: "Diagnóstico",
        color: "#d97706",
        probability: 45,
      },
      {
        id: "proposal-draft",
        name: "Proposta em elaboração",
        color: "#f59e0b",
        probability: 55,
      },
      {
        id: "proposal-sent",
        name: "Proposta enviada",
        color: "#ec6b33",
        probability: 65,
      },
      {
        id: "negotiation",
        name: "Negociação",
        color: "#e34a3b",
        probability: 80,
      },
      {
        id: "won",
        name: "Fechado — ganho",
        color: "#239667",
        probability: 100,
        terminal: "WON",
      },
      {
        id: "lost",
        name: "Fechado — perdido",
        color: "#8a96a8",
        probability: 0,
        terminal: "LOST",
      },
    ],
  };
  if (existsSync(localPipelinesPath))
    (
      JSON.parse(readFileSync(localPipelinesPath, "utf8")) as CrmPipeline[]
    ).forEach((item) =>
      pipelines.set(item.id, {
        ...item,
        departmentIds: item.departmentIds || [],
      }),
    );
  else pipelines.set(defaultPipeline.id, defaultPipeline);
  if (existsSync(localOpportunitiesPath))
    (
      JSON.parse(readFileSync(localOpportunitiesPath, "utf8")) as Opportunity[]
    ).forEach((item) =>
      opportunities.set(item.id, {
        ...item,
        contactIds: item.contactIds || [],
        teamIds: item.teamIds || [],
        tags: item.tags || [],
        activities: item.activities || [],
        proposals: item.proposals || [],
      }),
    );
  if (existsSync(localCrmContactsPath))
    (
      JSON.parse(readFileSync(localCrmContactsPath, "utf8")) as CrmContact[]
    ).forEach((item) =>
      crmContacts.set(item.id, {
        ...item,
        opportunityIds: item.opportunityIds || [],
        activities: item.activities || [],
      }),
    );
  if (existsSync(localCrmCompaniesPath))
    (
      JSON.parse(readFileSync(localCrmCompaniesPath, "utf8")) as CrmCompany[]
    ).forEach((item) =>
      crmCompanies.set(item.id, { ...item, activities: item.activities || [] }),
    );
  if (existsSync(localClientServicesPath))
    (
      JSON.parse(
        readFileSync(localClientServicesPath, "utf8"),
      ) as ClientService[]
    ).forEach((item) => clientServices.set(item.id, item));
  if (existsSync(localProjectsPath))
    (
      JSON.parse(readFileSync(localProjectsPath, "utf8")) as OnboardingProject[]
    ).forEach((item) => onboardingProjects.set(item.id, item));
  if (existsSync(localClientContactsPath))
    (
      JSON.parse(
        readFileSync(localClientContactsPath, "utf8"),
      ) as ClientContact[]
    ).forEach((item) => clientContacts.set(item.id, item));
  if (existsSync(localTasksPath))
    (JSON.parse(readFileSync(localTasksPath, "utf8")) as WorkTask[]).forEach(
      (item) => {
        const legacyStatus = String(item.status);
        workTasks.set(item.id, {
          ...item,
          type: item.type || "OTHER",
          subtype: item.subtype || "custom",
          status:
            legacyStatus === "BACKLOG"
              ? "TODO"
              : legacyStatus === "WAITING_CLIENT"
                ? "WAITING_APPROVAL"
                : item.status,
          approvalStatus: item.approvalStatus || "NOT_REQUIRED",
          plannedAt: item.plannedAt || "",
          publishedAt: item.publishedAt || "",
          completedAt: item.completedAt || "",
          details: item.details || {},
          checklist: (item.checklist || []).map((entry, index) => ({
            ...entry,
            position: entry.position ?? index,
          })),
          comments: item.comments || [],
          attachments: item.attachments || [],
          approvalHistory: item.approvalHistory || [],
          activity: item.activity || [],
          archivedAt: item.archivedAt || "",
        });
      },
    );
  if (existsSync(localCalendarPath))
    (
      JSON.parse(readFileSync(localCalendarPath, "utf8")) as CalendarEvent[]
    ).forEach((item) => calendarEvents.set(item.id, item));
  if (existsSync(localFinancialAccountsPath))
    (
      JSON.parse(
        readFileSync(localFinancialAccountsPath, "utf8"),
      ) as FinancialAccount[]
    ).forEach((item) => financialAccounts.set(item.id, item));
  if (existsSync(localFinancialCategoriesPath))
    (
      JSON.parse(
        readFileSync(localFinancialCategoriesPath, "utf8"),
      ) as FinancialCategory[]
    ).forEach((item) => financialCategories.set(item.id, item));
  if (existsSync(localFinancialEntriesPath))
    (
      JSON.parse(
        readFileSync(localFinancialEntriesPath, "utf8"),
      ) as FinancialEntry[]
    ).forEach((item) => financialEntries.set(item.id, item));
  if (existsSync(localFinancialSuppliersPath))
    (
      JSON.parse(
        readFileSync(localFinancialSuppliersPath, "utf8"),
      ) as FinancialSupplier[]
    ).forEach((item) => financialSuppliers.set(item.id, item));
  if (existsSync(localFinancialCostCentersPath))
    (
      JSON.parse(
        readFileSync(localFinancialCostCentersPath, "utf8"),
      ) as FinancialCostCenter[]
    ).forEach((item) => financialCostCenters.set(item.id, item));
  if (existsSync(localFinancialAuditsPath))
    financialAudits.push(
      ...(JSON.parse(
        readFileSync(localFinancialAuditsPath, "utf8"),
      ) as FinancialAudit[]),
    );
  const persistPipelines = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localPipelinesPath,
      JSON.stringify([...pipelines.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistOpportunities = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localOpportunitiesPath,
      JSON.stringify([...opportunities.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistCrmContacts = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localCrmContactsPath,
      JSON.stringify([...crmContacts.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistCrmCompanies = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localCrmCompaniesPath,
      JSON.stringify([...crmCompanies.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistClientServices = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localClientServicesPath,
      JSON.stringify([...clientServices.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistProjects = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localProjectsPath,
      JSON.stringify([...onboardingProjects.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistClientContacts = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localClientContactsPath,
      JSON.stringify([...clientContacts.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistWorkTasks = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localTasksPath,
      JSON.stringify([...workTasks.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const removeTaskAttachmentFile = (attachment: WorkTask["attachments"][number]) => {
    if (
      attachment.storagePath &&
      attachment.storagePath.startsWith(`${localTaskAttachmentsPath}/`) &&
      existsSync(attachment.storagePath)
    )
      unlinkSync(attachment.storagePath);
  };
  const cleanupExpiredTaskAttachments = () => {
    const now = Date.now();
    let changed = false;
    workTasks.forEach((task) => {
      const attachments = task.attachments || [];
      const active = attachments.filter((attachment) => {
        const expiresAt = attachment.expiresAt
          ? new Date(attachment.expiresAt).getTime()
          : new Date(attachment.createdAt).getTime() + 30 * 86400000;
        if (expiresAt > now) return true;
        removeTaskAttachmentFile(attachment);
        changed = true;
        return false;
      });
      if (active.length !== attachments.length) task.attachments = active;
    });
    if (changed) persistWorkTasks();
  };
  const persistCalendarEvents = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localCalendarPath,
      JSON.stringify([...calendarEvents.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialAccounts = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialAccountsPath,
      JSON.stringify([...financialAccounts.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialCategories = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialCategoriesPath,
      JSON.stringify([...financialCategories.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialEntries = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialEntriesPath,
      JSON.stringify([...financialEntries.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialSuppliers = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialSuppliersPath,
      JSON.stringify([...financialSuppliers.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialCostCenters = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialCostCentersPath,
      JSON.stringify([...financialCostCenters.values()], null, 2),
      { mode: 0o600 },
    );
  };
  const persistFinancialAudits = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(
      localFinancialAuditsPath,
      JSON.stringify(financialAudits, null, 2),
      { mode: 0o600 },
    );
  };
  let metaBackgroundSyncRunning = false;
  const refreshMetaDashboardCache = async () => {
    if (
      metaBackgroundSyncRunning ||
      !runtimeMetaAccessToken ||
      !existsSync(localMetaDashboardCachePath)
    )
      return;
    metaBackgroundSyncRunning = true;
    try {
      const stored = JSON.parse(
        readFileSync(localMetaDashboardCachePath, "utf8"),
      ) as { since: string; until: string };
      const { since, until } = stored;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(since) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(until)
      )
        return;
      const graph = async <T>(path: string) => {
        const separator = path.includes("?") ? "&" : "?",
          result = await fetch(
            path.startsWith("http")
              ? path
              : `https://graph.facebook.com/${metaGraphVersion}/${path}${separator}access_token=${encodeURIComponent(runtimeMetaAccessToken)}`,
          ),
          payload = (await result.json()) as T & {
            error?: { message?: string };
          };
        if (!result.ok || payload.error)
          throw new Error(
            payload.error?.message || "Falha na sincronização Meta",
          );
        return payload;
      };
      const listAll = async <T>(path: string) => {
        const rows: T[] = [];
        let next: string | undefined = path;
        while (next) {
          const page: { data?: T[]; paging?: { next?: string } } = await graph<{
            data?: T[];
            paging?: { next?: string };
          }>(next);
          rows.push(...(page.data || []));
          next = page.paging?.next;
        }
        return rows;
      };
      type Page = {
        id: string;
        name?: string;
        picture?: { data?: { url?: string } };
        instagram_business_account?: {
          id: string;
          username?: string;
          profile_picture_url?: string;
        };
      };
      const accountRefs = await listAll<{ id: string }>(
          "me/adaccounts?fields=id&limit=100",
        ),
        managedPages = await listAll<Page>(
          "me/accounts?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}&limit=100",
        ).catch(() => []),
        normalize = (value: string | undefined) =>
          (value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase(),
        accounts: MetaAccountPayload[] = [],
        campaigns: any[] = [];
      for (const ref of accountRefs) {
        const detail = await graph<MetaAccountPayload>(
            `${ref.id}?fields=id,name,currency,amount_spent,spend_cap`,
          ),
          campaignRows = await listAll<MetaCampaignPayload>(
            `${ref.id}/campaigns?fields=id,name,objective,effective_status,daily_budget,lifetime_budget,promoted_object&limit=500`,
          ),
          pageIds = new Map<string, number>(),
          instagramIds = new Map<string, number>();
        campaignRows.forEach((row) => {
          const pageId = row.promoted_object?.page_id,
            instagramId = row.promoted_object?.instagram_actor_id;
          if (pageId) pageIds.set(pageId, (pageIds.get(pageId) || 0) + 1);
          if (instagramId)
            instagramIds.set(
              instagramId,
              (instagramIds.get(instagramId) || 0) + 1,
            );
        });
        const pageId = [...pageIds].sort((a, b) => b[1] - a[1])[0]?.[0],
          instagramId = [...instagramIds].sort((a, b) => b[1] - a[1])[0]?.[0];
        let page: Page | undefined,
          instagram:
            | { id: string; username?: string; profile_picture_url?: string }
            | undefined;
        if (pageId)
          try {
            page = await graph<Page>(
              `${pageId}?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}`,
            );
          } catch {}
        if (instagramId)
          try {
            instagram = await graph(
              `${instagramId}?fields=id,username,profile_picture_url`,
            );
          } catch {}
        if (!page) {
          const promoted = await listAll<Page>(
              `${ref.id}/promote_pages?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}&limit=25`,
            ).catch(() => []),
            accountName = normalize(detail.name);
          page =
            promoted.find((candidate) => {
              const name = normalize(candidate.name);
              return (
                name.length > 3 &&
                (accountName.includes(name) || name.includes(accountName))
              );
            }) ||
            promoted[0] ||
            managedPages.find((candidate) => {
              const name = normalize(candidate.name);
              return (
                name.length > 3 &&
                (accountName.includes(name) || name.includes(accountName))
              );
            });
        }
        const picture =
          instagram?.profile_picture_url ||
          page?.instagram_business_account?.profile_picture_url ||
          page?.picture?.data?.url;
        if (picture) metaAccountPictures.set(detail.id, picture);
        accounts.push({
          ...detail,
          pageName:
            page?.name ||
            (instagram?.username ? `@${instagram.username}` : undefined),
          profilePictureUrl: picture
            ? `/api/media/meta/accounts/${encodeURIComponent(detail.id)}/picture`
            : undefined,
        });
        const insights = await listAll<MetaInsight>(
            `${ref.id}/insights?fields=campaign_id,spend,reach,impressions,clicks,ctr,frequency,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&action_report_time=conversion&use_account_attribution_setting=true&limit=500`,
          ),
          byCampaign = new Map(
            insights
              .filter((row) => row.campaign_id)
              .map((row) => [row.campaign_id!, row]),
          );
        for (const row of campaignRows) {
          const insight = byCampaign.get(row.id) || {},
            action = (names: string[]) =>
              Number(
                insight.actions?.find((item) =>
                  names.includes(item.action_type || ""),
                )?.value || 0,
              ),
            leadResult = extractMetaLeads(insight.actions),
            leads = leadResult.leads,
            conversations = action([
              "onsite_conversion.messaging_conversation_started_7d",
              "messaging_conversation_started_7d",
            ]),
            spend = Number(insight.spend || 0);
          if (process.env.PW_META_ACTION_DEBUG === "1" && spend > 0)
            console.info("[Meta insights]", {
              account: { id: detail.id, name: detail.name || detail.id },
              campaign: { id: row.id, name: row.name },
              actions: insight.actions || [],
              cost_per_action_type: insight.cost_per_action_type || [],
              selectedLeadActionType: leadResult.actionType,
              leads,
              spend,
              cpl: leads ? spend / leads : null,
              warning:
                leads === 0
                  ? "Gasto sem action type de lead suportado"
                  : undefined,
            });
          campaigns.push({
            id: row.id,
            accountId: detail.id,
            client: detail.name || detail.id,
            currency: detail.currency || "BRL",
            name: row.name,
            objective: row.objective || "OUTRO",
            status: row.effective_status || "UNKNOWN",
            dailyBudget: Number(row.daily_budget || 0) / 100,
            lifetimeBudget: Number(row.lifetime_budget || 0) / 100,
            spend,
            reach: Number(insight.reach || 0),
            impressions: Number(insight.impressions || 0),
            clicks: Number(insight.clicks || 0),
            leads,
            conversations,
            cpl: leads ? spend / leads : null,
            frequency: Number(insight.frequency || 0),
          });
        }
      }
      const syncedAt = new Date().toISOString(),
        payload = {
          schemaVersion: 6,
          since,
          until,
          syncedAt,
          accounts: accounts.map((account) => ({
            id: account.id,
            name: account.name || account.id,
            pageName: account.pageName || null,
            profilePictureUrl: account.profilePictureUrl || null,
            currency: account.currency || "BRL",
            amountSpent: Number(account.amount_spent || 0) / 100,
            spendCap: Number(account.spend_cap || 0) / 100,
          })),
          campaigns,
        };
      writeFileSync(
        localMetaDashboardCachePath,
        JSON.stringify(
          {
            schemaVersion: 6,
            since,
            until,
            cachedAt: syncedAt,
            payload,
            pictures: Object.fromEntries(metaAccountPictures),
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    } catch (cause) {
      console.warn(
        "[Meta Ads] Sincronização automática falhou:",
        cause instanceof Error ? cause.message : cause,
      );
    } finally {
      metaBackgroundSyncRunning = false;
    }
  };
  const canAccessPipeline = (user: User, pipeline: CrmPipeline) =>
    user.profile === "MASTER" ||
    hasPermission(user, "crm.manage_pipelines") ||
    pipeline.departmentIds.length === 0 ||
    (!!user.departmentId && pipeline.departmentIds.includes(user.departmentId));
  if (!existsSync(localPipelinesPath)) persistPipelines();
  return {
    name: "pw-os-local-api",
    configureServer(server) {
      cleanupExpiredTaskAttachments();
      const attachmentCleanupTimer = setInterval(
        cleanupExpiredTaskAttachments,
        60 * 60 * 1000,
      );
      attachmentCleanupTimer.unref();
      server.httpServer?.once("close", () =>
        clearInterval(attachmentCleanupTimer),
      );
      const metaInternalSyncToken = randomBytes(24).toString("hex");
      const runScheduledMetaSync = async () => {
        if (!runtimeMetaAccessToken || !existsSync(localMetaDashboardCachePath))
          return;
        try {
          const cached = JSON.parse(
              readFileSync(localMetaDashboardCachePath, "utf8"),
            ) as { since: string; until: string },
            address = server.httpServer?.address();
          if (!address || typeof address === "string") return;
          await fetch(
            `http://127.0.0.1:${address.port}/api/media/meta/campaigns?since=${encodeURIComponent(cached.since)}&until=${encodeURIComponent(cached.until)}&refresh=1`,
            { headers: { "x-pw-meta-background": metaInternalSyncToken } },
          );
        } catch (cause) {
          console.warn(
            "[Meta Ads] Agendamento de sincronização falhou:",
            cause instanceof Error ? cause.message : cause,
          );
        }
      };
      const scheduledMetaTimer = setInterval(
        () => void runScheduledMetaSync(),
        10 * 60 * 1000,
      );
      scheduledMetaTimer.unref();
      server.httpServer?.once("listening", () =>
        setTimeout(() => void runScheduledMetaSync(), 2_000).unref(),
      );
      server.middlewares.use("/api", async (request, response) => {
        const url = request.url || "/";
        const sessionId = cookies(request).pw_os_session;
        const clientSessionId = cookies(request).pw_client_session;
        const isClientAuthRoute = url.startsWith("/client-auth/") || url === "/client-portal/data";
        const userId = isClientAuthRoute
          ? clientSessionId && clientSessions.get(clientSessionId)
          : sessionId && sessions.get(sessionId);
        const currentUser = userId && users.get(userId);
        if ((url === "/auth/login" || url === "/client-auth/login") && request.method === "POST") {
          const input = await body(request);
          const user = [...users.values()].find(
            (item) => item.email === input.email?.toLowerCase(),
          );
          if (
            !user ||
            !safeEqual(user.passwordHash, hash(input.password || "", user.salt))
          )
            return json(response, 401, {
              message: "E-mail ou senha inválidos.",
            });
          const portal = url === "/client-auth/login";
          if (portal !== (user.profile === "CLIENT"))
            return json(response, 403, {
              message: portal
                ? "Este acesso é exclusivo para usuários de clientes."
                : "Use o Portal do Cliente para entrar com esta conta.",
            });
          const token = randomBytes(32).toString("hex");
          (portal ? clientSessions : sessions).set(token, user.id);
          response.setHeader(
            "Set-Cookie",
            `${portal ? "pw_client_session" : "pw_os_session"}=${token}; HttpOnly; SameSite=Strict; Path=/`,
          );
          return json(response, 200, { user: publicUser(user) });
        }
        if ((url === "/auth/session" || url === "/client-auth/session") && request.method === "GET")
          return currentUser
            ? json(response, 200, { user: publicUser(currentUser) })
            : json(response, 401, { message: "Sessão necessária." });
        if ((url === "/auth/logout" || url === "/client-auth/logout") && request.method === "POST") {
          const portal = url === "/client-auth/logout";
          if (portal && clientSessionId) clientSessions.delete(clientSessionId);
          if (!portal && sessionId) sessions.delete(sessionId);
          response.setHeader(
            "Set-Cookie",
            `${portal ? "pw_client_session" : "pw_os_session"}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
          );
          return json(response, 200, { ok: true });
        }
        if (!currentUser)
          return json(response, 401, { message: "Sessão necessária." });
        if ((url === "/auth/change-password" || url === "/client-auth/change-password") && request.method === "POST") {
          const input = await body(request);
          const currentPassword = String(input.currentPassword || "");
          const password = String(input.password || "");
          const confirmation = String(input.confirmation || "");
          if (
            !currentUser.mustChangePassword &&
            !safeEqual(
              currentUser.passwordHash,
              hash(currentPassword, currentUser.salt),
            )
          )
            return json(response, 400, {
              message: "A senha atual está incorreta.",
            });
          const localPart = currentUser.email.split("@")[0].toLowerCase();
          const commonPasswords = [
            "password",
            "senha123",
            "12345678",
            "qwerty",
            "admin123",
            "welcome",
          ];
          const strong = currentUser.profile === "CLIENT"
            ? password.length >= 8 && !/\s/.test(password)
            : password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) && !/\s/.test(password);
          if (password !== confirmation)
            return json(response, 400, {
              message: "A confirmação não corresponde à nova senha.",
            });
          if (!strong)
            return json(response, 400, {
              message:
                "A senha precisa atender a todos os requisitos de segurança.",
            });
          if (
            commonPasswords.some((value) =>
              password.toLowerCase().includes(value),
            ) ||
            password.toLowerCase().includes(localPart) ||
            currentUser.name
              .toLowerCase()
              .split(/\s+/)
              .some(
                (part: string) =>
                  part.length >= 4 && password.toLowerCase().includes(part),
              )
          )
            return json(response, 400, {
              message:
                "A senha não pode conter seu nome, e-mail ou sequências comuns.",
            });
          if (
            safeEqual(
              currentUser.passwordHash,
              hash(password, currentUser.salt),
            )
          )
            return json(response, 400, {
              message: "A nova senha deve ser diferente da senha inicial.",
            });
          currentUser.salt = randomBytes(16).toString("hex");
          currentUser.passwordHash = hash(password, currentUser.salt);
          currentUser.mustChangePassword = false;
          users.set(currentUser.id, currentUser);
          persistUser(currentUser);
          return json(response, 200, { user: publicUser(currentUser) });
        }
        if (currentUser.mustChangePassword)
          return json(response, 403, {
            message: "Troque sua senha antes de continuar.",
            code: "PASSWORD_CHANGE_REQUIRED",
          });
        if (url === "/client-portal/data" && request.method === "GET") {
          if (currentUser.profile !== "CLIENT" || !currentUser.clientId)
            return json(response, 403, { message: "Acesso exclusivo para clientes." });
          const client = clients.get(currentUser.clientId);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const assignments = [...mediaAssignments.values()].filter(
            (item) => item.clientId === client.id,
          );
          const accountIds = new Set(assignments.map((item) => item.accountId));
          let meta: Record<string, unknown> = { accounts: [], campaigns: [] };
          if (existsSync(localMetaDashboardCachePath)) {
            try {
              const cached = JSON.parse(readFileSync(localMetaDashboardCachePath, "utf8"));
              const payload = cached.payload || {};
              meta = {
                since: payload.since || cached.since,
                until: payload.until || cached.until,
                syncedAt: payload.syncedAt || cached.cachedAt,
                accounts: (payload.accounts || []).filter((item: any) => accountIds.has(item.id)),
                campaigns: (payload.campaigns || []).filter((item: any) => accountIds.has(item.accountId)),
              };
            } catch {}
          }
          let google: Record<string, unknown> = { accounts: [], campaigns: [] };
          if (existsSync(localGoogleDashboardCachePath)) {
            try {
              const payload = JSON.parse(readFileSync(localGoogleDashboardCachePath, "utf8"));
              google = {
                since: payload.since, until: payload.until, syncedAt: payload.syncedAt,
                accounts: (payload.accounts || []).filter((item: any) => accountIds.has(item.id)),
                campaigns: (payload.campaigns || []).filter((item: any) => accountIds.has(item.accountId)),
              };
            } catch {}
          }
          return json(response, 200, {
            client: { id: client.id, name: client.name },
            assignments,
            meta,
            google,
          });
        }
        if (currentUser.profile === "CLIENT")
          return json(response, 403, {
            message: "Usuários de clientes possuem acesso somente ao Portal do Cliente.",
          });
        if (url === "/finance" && request.method === "GET") {
          if (!hasPermission(currentUser, "finance.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao financeiro.",
            });
          return json(response, 200, {
            entries: [...financialEntries.values()].sort((a, b) =>
              a.dueDate.localeCompare(b.dueDate),
            ),
            accounts: [...financialAccounts.values()],
            categories: [...financialCategories.values()],
            suppliers: [...financialSuppliers.values()],
            costCenters: [...financialCostCenters.values()],
            audits: financialAudits.slice(-250).reverse(),
            canManage: hasPermission(currentUser, "finance.manage_settings"),
            canViewValues: hasPermission(currentUser, "finance.view_values"),
            canExport: hasPermission(currentUser, "finance.export"),
          });
        }
        if (url === "/finance/entries" && request.method === "POST") {
          if (!hasPermission(currentUser, "finance.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar lançamentos.",
            });
          const input = await body(request),
            description = String(input.description || "").trim(),
            amount = Number(
              String(input.amount || "0")
                .replace(/\./g, "")
                .replace(",", "."),
            ),
            dueDate = String(input.dueDate || "");
          if (
            description.length < 3 ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !dueDate
          )
            return json(response, 400, {
              message: "Informe descrição, valor e vencimento válidos.",
            });
          if (
            input.categoryId &&
            !financialCategories.has(String(input.categoryId))
          )
            return json(response, 400, { message: "Categoria inválida." });
          if (
            input.accountId &&
            !financialAccounts.has(String(input.accountId))
          )
            return json(response, 400, { message: "Conta inválida." });
          if (input.clientId && !clients.has(String(input.clientId)))
            return json(response, 400, { message: "Cliente inválido." });
          const now = new Date().toISOString(),
            installments = Math.max(
              1,
              Math.min(120, Number(input.installments) || 1),
            ),
            created: FinancialEntry[] = [];
          for (let index = 0; index < installments; index++) {
            const date = new Date(`${dueDate}T12:00:00`);
            date.setMonth(date.getMonth() + index);
            const entry: FinancialEntry = {
              id: randomUUID(),
              type: input.type === "EXPENSE" ? "EXPENSE" : "INCOME",
              description:
                installments > 1
                  ? `${description} (${index + 1}/${installments})`
                  : description,
              amount: Math.round((amount / installments) * 100) / 100,
              dueDate: date.toISOString().slice(0, 10),
              paidAt: "",
              status: "OPEN",
              categoryId: String(input.categoryId || ""),
              accountId: String(input.accountId || ""),
              clientId: String(input.clientId || ""),
              supplier: String(input.supplier || "").trim(),
              costCenter: String(input.costCenter || "").trim(),
              documentNumber: String(input.documentNumber || "").trim(),
              paymentMethod: String(input.paymentMethod || "").trim(),
              recurrence: ["MONTHLY", "YEARLY"].includes(input.recurrence)
                ? input.recurrence
                : "NONE",
              notes: String(input.notes || "").trim(),
              createdBy: currentUser.id,
              createdByName: currentUser.name,
              createdAt: now,
              updatedAt: now,
            };
            financialEntries.set(entry.id, entry);
            created.push(entry);
          }
          persistFinancialEntries();
          return json(response, 201, { entry: created[0], entries: created });
        }
        const financeEntryMatch = url.match(/^\/finance\/entries\/([^/]+)$/);
        if (financeEntryMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "finance.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar lançamentos.",
            });
          const entry = financialEntries.get(financeEntryMatch[1]);
          if (!entry)
            return json(response, 404, {
              message: "Lançamento não encontrado.",
            });
          const input = await body(request);
          if (input.settle === true) {
            if (!hasPermission(currentUser, "finance.settle"))
              return json(response, 403, {
                message: "Você não possui permissão para realizar baixas.",
              });
            entry.status = "PAID";
            entry.paidAt = String(
              input.paidAt || new Date().toISOString().slice(0, 10),
            );
            if (
              input.accountId &&
              financialAccounts.has(String(input.accountId))
            )
              entry.accountId = String(input.accountId);
            financialAudits.push({
              id: randomUUID(),
              entryId: entry.id,
              action: "SETTLED",
              reason: "Baixa financeira",
              userId: currentUser.id,
              userName: currentUser.name,
              createdAt: new Date().toISOString(),
            });
            persistFinancialAudits();
          } else if (input.reverse === true) {
            if (!hasPermission(currentUser, "finance.settle"))
              return json(response, 403, {
                message: "Você não possui permissão para estornar baixas.",
              });
            const reason = String(input.reason || "").trim();
            if (reason.length < 5)
              return json(response, 400, {
                message: "Informe o motivo do estorno.",
              });
            entry.status = "OPEN";
            entry.paidAt = "";
            financialAudits.push({
              id: randomUUID(),
              entryId: entry.id,
              action: "REVERSED",
              reason,
              userId: currentUser.id,
              userName: currentUser.name,
              createdAt: new Date().toISOString(),
            });
            persistFinancialAudits();
          } else {
            if (input.description !== undefined)
              entry.description = String(input.description).trim();
            if (input.amount !== undefined) {
              const amount = Number(
                String(input.amount).replace(/\./g, "").replace(",", "."),
              );
              if (!Number.isFinite(amount) || amount <= 0)
                return json(response, 400, {
                  message: "Informe um valor válido.",
                });
              entry.amount = amount;
            }
            if (input.dueDate !== undefined)
              entry.dueDate = String(input.dueDate);
            if (["INCOME", "EXPENSE"].includes(input.type))
              entry.type = input.type;
            if (input.categoryId !== undefined)
              entry.categoryId = String(input.categoryId);
            if (input.accountId !== undefined)
              entry.accountId = String(input.accountId);
            if (input.clientId !== undefined)
              entry.clientId = String(input.clientId);
            if (input.supplier !== undefined)
              entry.supplier = String(input.supplier).trim();
            if (input.costCenter !== undefined)
              entry.costCenter = String(input.costCenter).trim();
            if (input.documentNumber !== undefined)
              entry.documentNumber = String(input.documentNumber).trim();
            if (input.paymentMethod !== undefined)
              entry.paymentMethod = String(input.paymentMethod).trim();
            if (["NONE", "MONTHLY", "YEARLY"].includes(input.recurrence))
              entry.recurrence = input.recurrence;
            if (input.notes !== undefined)
              entry.notes = String(input.notes).trim();
            if (input.status === "CANCELLED") entry.status = "CANCELLED";
          }
          entry.updatedAt = new Date().toISOString();
          financialEntries.set(entry.id, entry);
          persistFinancialEntries();
          return json(response, 200, { entry });
        }
        if (financeEntryMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "finance.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir lançamentos.",
            });
          const entry = financialEntries.get(financeEntryMatch[1]);
          if (!entry)
            return json(response, 404, {
              message: "Lançamento não encontrado.",
            });
          if (entry.status === "PAID")
            return json(response, 409, {
              message:
                "Lançamentos baixados não podem ser excluídos. Cancele ou estorne a baixa primeiro.",
            });
          financialEntries.delete(entry.id);
          persistFinancialEntries();
          return json(response, 200, { ok: true });
        }
        if (url === "/finance/accounts" && request.method === "POST") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, {
              message: "Sem permissão para gerenciar contas.",
            });
          const input = await body(request),
            name = String(input.name || "").trim();
          if (name.length < 2)
            return json(response, 400, { message: "Informe o nome da conta." });
          const account: FinancialAccount = {
            id: randomUUID(),
            name,
            institution: String(input.institution || "").trim(),
            type: ["SAVINGS", "CASH", "CARD"].includes(input.type)
              ? input.type
              : "CHECKING",
            openingBalance:
              Number(
                String(input.openingBalance || "0")
                  .replace(/\./g, "")
                  .replace(",", "."),
              ) || 0,
            active: true,
            createdAt: new Date().toISOString(),
          };
          financialAccounts.set(account.id, account);
          persistFinancialAccounts();
          return json(response, 201, { account });
        }
        if (url === "/finance/categories" && request.method === "POST") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, {
              message: "Sem permissão para gerenciar categorias.",
            });
          const input = await body(request),
            name = String(input.name || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome da categoria.",
            });
          const category: FinancialCategory = {
            id: randomUUID(),
            name,
            type: input.type === "EXPENSE" ? "EXPENSE" : "INCOME",
            color: String(input.color || "#3b82f6"),
            active: true,
            createdAt: new Date().toISOString(),
          };
          financialCategories.set(category.id, category);
          persistFinancialCategories();
          return json(response, 201, { category });
        }
        const financeAccountMatch = url.match(/^\/finance\/accounts\/([^/]+)$/),
          financeCategoryMatch = url.match(/^\/finance\/categories\/([^/]+)$/);
        if (financeAccountMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const account = financialAccounts.get(financeAccountMatch[1]);
          if (!account)
            return json(response, 404, { message: "Conta não encontrada." });
          const input = await body(request);
          if (input.name !== undefined && String(input.name).trim().length >= 2)
            account.name = String(input.name).trim();
          if (input.institution !== undefined)
            account.institution = String(input.institution).trim();
          if (["CHECKING", "SAVINGS", "CASH", "CARD"].includes(input.type))
            account.type = input.type;
          if (input.openingBalance !== undefined)
            account.openingBalance =
              Number(
                String(input.openingBalance)
                  .replace(/\./g, "")
                  .replace(",", "."),
              ) || 0;
          financialAccounts.set(account.id, account);
          persistFinancialAccounts();
          return json(response, 200, { account });
        }
        if (financeCategoryMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const category = financialCategories.get(financeCategoryMatch[1]);
          if (!category)
            return json(response, 404, {
              message: "Categoria não encontrada.",
            });
          const input = await body(request);
          if (input.name !== undefined && String(input.name).trim().length >= 2)
            category.name = String(input.name).trim();
          if (["INCOME", "EXPENSE"].includes(input.type))
            category.type = input.type;
          if (input.color !== undefined) category.color = String(input.color);
          financialCategories.set(category.id, category);
          persistFinancialCategories();
          return json(response, 200, { category });
        }
        if (financeAccountMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          if (
            [...financialEntries.values()].some(
              (item) => item.accountId === financeAccountMatch[1],
            )
          )
            return json(response, 409, {
              message: "Esta conta possui lançamentos e não pode ser excluída.",
            });
          financialAccounts.delete(financeAccountMatch[1]);
          persistFinancialAccounts();
          return json(response, 200, { ok: true });
        }
        if (financeCategoryMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          if (
            [...financialEntries.values()].some(
              (item) => item.categoryId === financeCategoryMatch[1],
            )
          )
            return json(response, 409, {
              message:
                "Esta categoria possui lançamentos e não pode ser excluída.",
            });
          financialCategories.delete(financeCategoryMatch[1]);
          persistFinancialCategories();
          return json(response, 200, { ok: true });
        }
        if (url === "/finance/transfers" && request.method === "POST") {
          if (
            !hasPermission(currentUser, "finance.create") ||
            !hasPermission(currentUser, "finance.settle")
          )
            return json(response, 403, {
              message: "Sem permissão para transferir.",
            });
          const input = await body(request),
            from = String(input.fromAccountId || ""),
            to = String(input.toAccountId || ""),
            amount = Number(
              String(input.amount || "0")
                .replace(/\./g, "")
                .replace(",", "."),
            ),
            date = String(input.date || new Date().toISOString().slice(0, 10));
          if (
            from === to ||
            !financialAccounts.has(from) ||
            !financialAccounts.has(to) ||
            !Number.isFinite(amount) ||
            amount <= 0
          )
            return json(response, 400, {
              message: "Informe contas diferentes e um valor válido.",
            });
          const now = new Date().toISOString(),
            group = randomUUID(),
            base = {
              amount,
              dueDate: date,
              paidAt: date,
              status: "PAID" as const,
              categoryId: "",
              clientId: "",
              supplier: "",
              costCenter: "Transferências",
              documentNumber: group,
              paymentMethod: "Transferência",
              recurrence: "NONE" as const,
              notes: String(input.notes || ""),
              createdBy: currentUser.id,
              createdByName: currentUser.name,
              createdAt: now,
              updatedAt: now,
            };
          const debit: FinancialEntry = {
              ...base,
              id: randomUUID(),
              type: "EXPENSE",
              description: `Transferência para ${financialAccounts.get(to)!.name}`,
              accountId: from,
            },
            credit: FinancialEntry = {
              ...base,
              id: randomUUID(),
              type: "INCOME",
              description: `Transferência de ${financialAccounts.get(from)!.name}`,
              accountId: to,
            };
          financialEntries.set(debit.id, debit);
          financialEntries.set(credit.id, credit);
          financialAudits.push({
            id: randomUUID(),
            entryId: group,
            action: "TRANSFER",
            reason: `${from} → ${to}`,
            userId: currentUser.id,
            userName: currentUser.name,
            createdAt: now,
          });
          persistFinancialEntries();
          persistFinancialAudits();
          return json(response, 201, { debit, credit });
        }
        const financeSupplierMatch = url.match(
            /^\/finance\/suppliers\/([^/]+)$/,
          ),
          financeCostCenterMatch = url.match(
            /^\/finance\/cost-centers\/([^/]+)$/,
          );
        if (url === "/finance/suppliers" && request.method === "POST") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const input = await body(request),
            name = String(input.name || "").trim(),
            document = String(input.document || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome do fornecedor.",
            });
          if (document && !validDocument(document))
            return json(response, 400, { message: "CPF ou CNPJ inválido." });
          const item: FinancialSupplier = {
            id: randomUUID(),
            name,
            document,
            email: String(input.email || "").trim(),
            phone: String(input.phone || "").trim(),
            notes: String(input.notes || "").trim(),
            active: true,
            createdAt: new Date().toISOString(),
          };
          financialSuppliers.set(item.id, item);
          persistFinancialSuppliers();
          return json(response, 201, { supplier: item });
        }
        if (financeSupplierMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const item = financialSuppliers.get(financeSupplierMatch[1]);
          if (!item)
            return json(response, 404, {
              message: "Fornecedor não encontrado.",
            });
          const input = await body(request);
          Object.assign(item, {
            name: String(input.name ?? item.name).trim(),
            document: String(input.document ?? item.document).trim(),
            email: String(input.email ?? item.email).trim(),
            phone: String(input.phone ?? item.phone).trim(),
            notes: String(input.notes ?? item.notes).trim(),
          });
          if (item.document && !validDocument(item.document))
            return json(response, 400, { message: "CPF ou CNPJ inválido." });
          persistFinancialSuppliers();
          return json(response, 200, { supplier: item });
        }
        if (financeSupplierMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const item = financialSuppliers.get(financeSupplierMatch[1]);
          if (!item)
            return json(response, 404, {
              message: "Fornecedor não encontrado.",
            });
          if (
            [...financialEntries.values()].some(
              (entry) => entry.supplier === item.name,
            )
          )
            return json(response, 409, {
              message:
                "Fornecedor vinculado a lançamentos; desative ou renomeie em vez de excluir.",
            });
          financialSuppliers.delete(item.id);
          persistFinancialSuppliers();
          return json(response, 200, { ok: true });
        }
        if (url === "/finance/cost-centers" && request.method === "POST") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const input = await body(request),
            name = String(input.name || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome do centro de custo.",
            });
          const item: FinancialCostCenter = {
            id: randomUUID(),
            name,
            code: String(input.code || "").trim(),
            description: String(input.description || "").trim(),
            active: true,
            createdAt: new Date().toISOString(),
          };
          financialCostCenters.set(item.id, item);
          persistFinancialCostCenters();
          return json(response, 201, { costCenter: item });
        }
        if (financeCostCenterMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const item = financialCostCenters.get(financeCostCenterMatch[1]);
          if (!item)
            return json(response, 404, {
              message: "Centro de custo não encontrado.",
            });
          const input = await body(request);
          Object.assign(item, {
            name: String(input.name ?? item.name).trim(),
            code: String(input.code ?? item.code).trim(),
            description: String(input.description ?? item.description).trim(),
          });
          persistFinancialCostCenters();
          return json(response, 200, { costCenter: item });
        }
        if (financeCostCenterMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "finance.manage_settings"))
            return json(response, 403, { message: "Sem permissão." });
          const item = financialCostCenters.get(financeCostCenterMatch[1]);
          if (!item)
            return json(response, 404, {
              message: "Centro de custo não encontrado.",
            });
          if (
            [...financialEntries.values()].some(
              (entry) => entry.costCenter === item.name,
            )
          )
            return json(response, 409, {
              message: "Centro de custo vinculado a lançamentos.",
            });
          financialCostCenters.delete(item.id);
          persistFinancialCostCenters();
          return json(response, 200, { ok: true });
        }
        if (url === "/profile" && request.method === "PATCH") {
          const input = await body(request);
          const name = String(input.name || "").trim();
          const phone = String(input.phone || "").trim();
          const avatarDataUrl = String(input.avatarDataUrl || "");
          if (name.length < 2 || name.length > 100)
            return json(response, 400, { message: "Informe um nome válido." });
          if (!validPhone(phone))
            return json(response, 400, {
              message: "Informe um telefone válido com DDD.",
            });
          if (
            avatarDataUrl &&
            (!/^data:image\/(png|jpeg|webp);base64,/.test(avatarDataUrl) ||
              avatarDataUrl.length > 1_600_000)
          )
            return json(response, 400, {
              message: "Use uma imagem PNG, JPG ou WebP de até 1 MB.",
            });
          currentUser.name = name;
          currentUser.phone = phone;
          currentUser.avatarDataUrl = avatarDataUrl;
          users.set(currentUser.id, currentUser);
          persistUser(currentUser);
          return json(response, 200, { user: publicUser(currentUser) });
        }
        if (url === "/departments" && request.method === "GET")
          return json(response, 200, {
            departments: [...departments.values()].sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR"),
            ),
          });
        if (url === "/departments" && request.method === "POST") {
          if (!hasPermission(currentUser, "tickets.manage_departments"))
            return json(response, 403, {
              message: "Você não possui permissão para gerenciar setores.",
            });
          const input = await body(request);
          const name = String(input.name || "").trim();
          if (name.length < 2)
            return json(response, 400, { message: "Informe o nome do setor." });
          if (
            [...departments.values()].some(
              (item) => item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, { message: "Este setor já existe." });
          const manager = input.managerUserId
            ? users.get(String(input.managerUserId))
            : undefined;
          if (input.managerUserId && (!manager || manager.profile === "CLIENT"))
            return json(response, 400, {
              message: "Selecione um responsável válido.",
            });
          const department: Department = {
            id: randomUUID(),
            name,
            description: String(input.description || "").trim(),
            active: true,
            managerUserId: manager?.id,
            managerName: manager?.name,
            createdAt: new Date().toISOString(),
          };
          departments.set(department.id, department);
          persistDepartments();
          return json(response, 201, { department });
        }
        const departmentMatch = url.match(/^\/departments\/([^/]+)$/);
        if (departmentMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "tickets.manage_departments"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const department = departments.get(departmentMatch[1]);
          if (!department)
            return json(response, 404, { message: "Setor não encontrado." });
          const input = await body(request);
          const managerSpecified = Object.prototype.hasOwnProperty.call(
            input,
            "managerUserId",
          );
          const manager = input.managerUserId
            ? users.get(String(input.managerUserId))
            : undefined;
          if (input.managerUserId && (!manager || manager.profile === "CLIENT"))
            return json(response, 400, {
              message: "Selecione um responsável válido.",
            });
          department.name = String(input.name || department.name).trim();
          department.description = String(
            input.description ?? department.description,
          ).trim();
          department.active = input.active !== false;
          if (managerSpecified) {
            department.managerUserId = manager?.id;
            department.managerName = manager?.name;
          }
          departments.set(department.id, department);
          persistDepartments();
          return json(response, 200, { department });
        }
        if (departmentMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "tickets.manage_departments"))
            return json(response, 403, { message: "Permissão insuficiente." });
          if (
            [...tickets.values()].some(
              (ticket) => ticket.departmentId === departmentMatch[1],
            )
          )
            return json(response, 409, {
              message: "Este setor possui chamados e não pode ser excluído.",
            });
          if (
            [...users.values()].some(
              (user) => user.departmentId === departmentMatch[1],
            )
          )
            return json(response, 409, {
              message:
                "Este setor possui colaboradores vinculados. Reatribua-os antes de excluir.",
            });
          departments.delete(departmentMatch[1]);
          persistDepartments();
          return json(response, 200, { ok: true });
        }
        const canSeeTicket = (ticket: Ticket) =>
          hasPermission(currentUser, "tickets.view_all") ||
          ticket.requesterId === currentUser.id ||
          ticket.assigneeId === currentUser.id ||
          ticket.participantIds.includes(currentUser.id);
        if (url === "/tickets" && request.method === "GET") {
          if (!hasPermission(currentUser, "tickets.view"))
            return json(response, 403, {
              message: "Você não possui acesso aos chamados.",
            });
          return json(response, 200, {
            tickets: [...tickets.values()]
              .filter(canSeeTicket)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            canViewAll: hasPermission(currentUser, "tickets.view_all"),
            canManageDepartments: hasPermission(
              currentUser,
              "tickets.manage_departments",
            ),
          });
        }
        if (url === "/tickets" && request.method === "POST") {
          if (!hasPermission(currentUser, "tickets.create"))
            return json(response, 403, {
              message: "Você não possui permissão para abrir chamados.",
            });
          const input = await body(request);
          const title = String(input.title || "").trim();
          const assignee = users.get(String(input.assigneeId || ""));
          if (
            title.length < 4 ||
            !departments.has(String(input.departmentId || ""))
          )
            return json(response, 400, {
              message: "Informe título e setor válidos.",
            });
          if (!assignee)
            return json(response, 400, {
              message: "Selecione um responsável válido.",
            });
          const now = new Date().toISOString();
          const sequence = String(tickets.size + 1).padStart(4, "0");
          const ticket: Ticket = {
            id: randomUUID(),
            code: `CH-${new Date().getFullYear()}-${sequence}`,
            title,
            description: String(input.description || "").trim(),
            departmentId: String(input.departmentId),
            requesterId: currentUser.id,
            requesterName: currentUser.name,
            assigneeId: assignee.id,
            assigneeName: assignee.name,
            priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(
              input.priority,
            )
              ? input.priority
              : "MEDIUM",
            status: "OPEN",
            dueAt: String(input.dueAt || ""),
            participantIds: [currentUser.id, assignee.id],
            comments: [],
            createdAt: now,
            updatedAt: now,
          };
          tickets.set(ticket.id, ticket);
          persistTickets();
          return json(response, 201, { ticket });
        }
        const ticketCommentMatch = url.match(/^\/tickets\/([^/]+)\/comments$/);
        if (ticketCommentMatch && request.method === "POST") {
          const ticket = tickets.get(ticketCommentMatch[1]);
          if (!ticket || !canSeeTicket(ticket))
            return json(response, 404, { message: "Chamado não encontrado." });
          if (!hasPermission(currentUser, "tickets.comment"))
            return json(response, 403, {
              message: "Você não possui permissão para comentar.",
            });
          const input = await body(request);
          const message = String(input.message || "").trim();
          if (!message)
            return json(response, 400, { message: "Escreva uma atualização." });
          const mentioned = [...users.values()].filter((user) =>
            message.toLowerCase().includes(`@${user.name.toLowerCase()}`),
          );
          const comment: TicketComment = {
            id: randomUUID(),
            authorId: currentUser.id,
            authorName: currentUser.name,
            message,
            mentions: mentioned.map((user) => user.id),
            createdAt: new Date().toISOString(),
          };
          ticket.comments.push(comment);
          ticket.participantIds = [
            ...new Set([...ticket.participantIds, ...comment.mentions]),
          ];
          ticket.updatedAt = comment.createdAt;
          tickets.set(ticket.id, ticket);
          persistTickets();
          return json(response, 201, { comment, ticket });
        }
        const ticketMatch = url.match(/^\/tickets\/([^/]+)$/);
        if (ticketMatch && request.method === "GET") {
          const ticket = tickets.get(ticketMatch[1]);
          return ticket && canSeeTicket(ticket)
            ? json(response, 200, { ticket })
            : json(response, 404, { message: "Chamado não encontrado." });
        }
        if (ticketMatch && request.method === "PATCH") {
          const ticket = tickets.get(ticketMatch[1]);
          if (!ticket || !canSeeTicket(ticket))
            return json(response, 404, { message: "Chamado não encontrado." });
          if (!hasPermission(currentUser, "tickets.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar chamados.",
            });
          const input = await body(request);
          const assignee =
            input.assigneeId && users.get(String(input.assigneeId));
          if (input.title) ticket.title = String(input.title).trim();
          if (input.description !== undefined)
            ticket.description = String(input.description).trim();
          if (input.departmentId && departments.has(String(input.departmentId)))
            ticket.departmentId = String(input.departmentId);
          if (assignee) {
            ticket.assigneeId = assignee.id;
            ticket.assigneeName = assignee.name;
            ticket.participantIds = [
              ...new Set([...ticket.participantIds, assignee.id]),
            ];
          }
          if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(input.priority))
            ticket.priority = input.priority;
          if (
            ["OPEN", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"].includes(
              input.status,
            )
          )
            ticket.status = input.status;
          if (input.dueAt !== undefined) ticket.dueAt = String(input.dueAt);
          ticket.updatedAt = new Date().toISOString();
          tickets.set(ticket.id, ticket);
          persistTickets();
          return json(response, 200, { ticket });
        }
        if (ticketMatch && request.method === "DELETE") {
          const ticket = tickets.get(ticketMatch[1]);
          if (!ticket || !canSeeTicket(ticket))
            return json(response, 404, { message: "Chamado não encontrado." });
          if (!hasPermission(currentUser, "tickets.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir chamados.",
            });
          tickets.delete(ticket.id);
          persistTickets();
          return json(response, 200, { ok: true });
        }
        const canSeeTask = (task: WorkTask) =>
          hasPermission(currentUser, "tasks.view_all") ||
          (hasPermission(currentUser, "tasks.review") &&
            task.approvalStatus !== "NOT_REQUIRED") ||
          task.createdBy === currentUser.id ||
          task.responsibleId === currentUser.id ||
          task.participantIds.includes(currentUser.id);
        if (url === "/tasks" && request.method === "GET") {
          if (!hasPermission(currentUser, "tasks.view"))
            return json(response, 403, {
              message: "Você não possui acesso às tarefas.",
            });
          return json(response, 200, {
            tasks: [...workTasks.values()]
              .filter((task) => !task.archivedAt && canSeeTask(task))
              .sort((a, b) =>
                (a.dueAt || "9999").localeCompare(b.dueAt || "9999"),
              ),
            canViewAll: hasPermission(currentUser, "tasks.view_all"),
            canEditAll: hasPermission(currentUser, "tasks.edit_all"),
            canReview: hasPermission(currentUser, "tasks.review"),
          });
        }
        if (url === "/tasks" && request.method === "POST") {
          if (!hasPermission(currentUser, "tasks.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar tarefas.",
            });
          const input = await body(request),
            title = String(input.title || "").trim(),
            responsible = users.get(String(input.responsibleId || "")),
            dueAt = String(input.dueAt || "");
          if (title.length < 3)
            return json(response, 400, {
              message: "Informe um título de tarefa válido.",
            });
          if (!dueAt || Number.isNaN(new Date(dueAt).getTime()))
            return json(response, 400, {
              message:
                "Informe quando a demanda precisa ficar pronta para vinculá-la à agenda.",
            });
          if (input.clientId && !clients.has(String(input.clientId)))
            return json(response, 400, { message: "Cliente inválido." });
          if (
            input.projectId &&
            !onboardingProjects.has(String(input.projectId))
          )
            return json(response, 400, { message: "Projeto inválido." });
          const taskTypes = [
              "CONTENT",
              "DESIGN",
              "VIDEO",
              "WEB",
              "PAID_MEDIA",
              "EMAIL",
              "OTHER",
            ],
            taskStatuses = [
              "TODO",
              "IN_PROGRESS",
              "REVIEW",
              "WAITING_APPROVAL",
              "CHANGES_REQUESTED",
              "APPROVED",
              "SCHEDULED",
              "PUBLISHED",
              "DONE",
              "CANCELLED",
            ];
          const now = new Date().toISOString(),
            task: WorkTask = {
              id: randomUUID(),
              title,
              description: String(input.description || "").trim(),
              clientId: String(input.clientId || ""),
              projectId: String(input.projectId || ""),
              opportunityId: String(input.opportunityId || ""),
              responsibleId: responsible?.id || currentUser.id,
              responsibleName: responsible?.name || currentUser.name,
              participantIds: Array.isArray(input.participantIds)
                ? input.participantIds.map(String).filter((id) => users.has(id))
                : [],
              type: taskTypes.includes(input.type) ? input.type : "OTHER",
              subtype: String(input.subtype || "custom"),
              priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(
                input.priority,
              )
                ? input.priority
                : "MEDIUM",
              status: taskStatuses.includes(input.status)
                ? input.status
                : "TODO",
              approvalStatus: input.approvalRequired
                ? "PENDING"
                : "NOT_REQUIRED",
              startAt: String(input.startAt || ""),
              dueAt: String(input.dueAt || ""),
              plannedAt: String(input.plannedAt || ""),
              publishedAt: "",
              completedAt: "",
              estimateMinutes: Number(input.estimateMinutes || 0),
              trackedMinutes: 0,
              tags: String(input.tags || "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              details:
                typeof input.details === "object" && input.details
                  ? Object.fromEntries(
                      Object.entries(input.details).map(([key, value]) => [
                        key,
                        String(value || ""),
                      ]),
                    )
                  : {},
              checklist: [],
              comments: [],
              attachments: [],
              approvalHistory: [],
              activity: [
                {
                  id: randomUUID(),
                  actorId: currentUser.id,
                  actorName: currentUser.name,
                  action: "criou esta demanda",
                  createdAt: now,
                },
              ],
              createdBy: currentUser.id,
              createdAt: now,
              updatedAt: now,
              archivedAt: "",
            };
          workTasks.set(task.id, task);
          persistWorkTasks();
          return json(response, 201, { task });
        }
        if (url === "/tasks/reviews" && request.method === "GET") {
          if (!hasPermission(currentUser, "tasks.review"))
            return json(response, 403, {
              message: "Você não possui permissão para revisar demandas.",
            });
          return json(response, 200, {
            tasks: [...workTasks.values()]
              .filter(
                (task) =>
                  !task.archivedAt && task.approvalStatus !== "NOT_REQUIRED",
              )
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          });
        }
        const taskReviewSubmitMatch = url.match(
          /^\/tasks\/([^/]+)\/review\/submit$/,
        );
        if (taskReviewSubmitMatch && request.method === "POST") {
          const task = workTasks.get(taskReviewSubmitMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          if (
            task.responsibleId !== currentUser.id &&
            task.createdBy !== currentUser.id &&
            !hasPermission(currentUser, "tasks.edit_all")
          )
            return json(response, 403, {
              message: "Somente quem executa a demanda pode enviá-la para revisão.",
            });
          if (["DONE", "PUBLISHED", "CANCELLED"].includes(task.status))
            return json(response, 409, {
              message: "Esta demanda não pode mais ser enviada para revisão.",
            });
          const input = await body(request),
            comment = String(input.comment || "").trim(),
            now = new Date().toISOString(),
            entry = {
              id: randomUUID(),
              action: "SUBMITTED" as const,
              actorId: currentUser.id,
              actorName: currentUser.name,
              comment,
              createdAt: now,
            };
          task.approvalHistory ||= [];
          task.approvalHistory.push(entry);
          task.approvalStatus = "PENDING";
          task.status = "WAITING_APPROVAL";
          task.updatedAt = now;
          task.activity.push({
            id: randomUUID(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: "enviou a demanda para revisão",
            createdAt: now,
          });
          persistWorkTasks();
          return json(response, 200, { task });
        }
        const taskReviewDecisionMatch = url.match(
          /^\/tasks\/([^/]+)\/review\/decision$/,
        );
        if (taskReviewDecisionMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "tasks.review"))
            return json(response, 403, {
              message: "Você não possui permissão para revisar demandas.",
            });
          const task = workTasks.get(taskReviewDecisionMatch[1]);
          if (!task || task.archivedAt)
            return json(response, 404, { message: "Tarefa não encontrada." });
          if (task.approvalStatus !== "PENDING")
            return json(response, 409, {
              message: "Esta demanda não está aguardando uma decisão.",
            });
          const input = await body(request),
            decision = String(input.decision || ""),
            comment = String(input.comment || "").trim();
          if (!["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(decision))
            return json(response, 400, { message: "Decisão inválida." });
          if (decision !== "APPROVED" && comment.length < 3)
            return json(response, 400, {
              message: "Explique o ajuste ou o motivo da recusa.",
            });
          const now = new Date().toISOString(),
            label =
              decision === "APPROVED"
                ? "aprovou a demanda"
                : decision === "CHANGES_REQUESTED"
                  ? "solicitou ajustes"
                  : "recusou definitivamente a demanda";
          task.approvalHistory ||= [];
          task.approvalHistory.push({
            id: randomUUID(),
            action: decision as "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
            actorId: currentUser.id,
            actorName: currentUser.name,
            comment,
            createdAt: now,
          });
          task.approvalStatus = decision as
            | "APPROVED"
            | "CHANGES_REQUESTED"
            | "REJECTED";
          task.status =
            decision === "APPROVED"
              ? "APPROVED"
              : decision === "CHANGES_REQUESTED"
                ? "CHANGES_REQUESTED"
                : "CANCELLED";
          task.participantIds = [
            ...new Set([...task.participantIds, currentUser.id]),
          ];
          task.updatedAt = now;
          task.activity.push({
            id: randomUUID(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: label,
            createdAt: now,
          });
          if (comment)
            task.comments.push({
              id: randomUUID(),
              authorId: currentUser.id,
              authorName: currentUser.name,
              message: comment,
              mentions: [],
              visibility: "INTERNAL",
              createdAt: now,
            });
          persistWorkTasks();
          return json(response, 200, { task });
        }
        const taskChecklistMatch = url.match(/^\/tasks\/([^/]+)\/checklist$/);
        if (taskChecklistMatch && request.method === "POST") {
          const task = workTasks.get(taskChecklistMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const input = await body(request),
            title = String(input.title || "").trim();
          if (!title)
            return json(response, 400, { message: "Informe a etapa." });
          const now = new Date().toISOString(),
            item = {
              id: randomUUID(),
              title,
              done: false,
              position: task.checklist.length,
            };
          task.checklist.push(item);
          task.updatedAt = now;
          task.activity.push({
            id: randomUUID(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: `adicionou a etapa “${title}”`,
            createdAt: now,
          });
          persistWorkTasks();
          return json(response, 201, { task });
        }
        const checklistItemMatch = url.match(
          /^\/tasks\/([^/]+)\/checklist\/([^/]+)$/,
        );
        if (checklistItemMatch && request.method === "PATCH") {
          const task = workTasks.get(checklistItemMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const item = task.checklist.find(
            (entry) => entry.id === checklistItemMatch[2],
          );
          if (!item)
            return json(response, 404, { message: "Etapa não encontrada." });
          const input = await body(request);
          item.done = Boolean(input.done);
          item.completedBy = item.done ? currentUser.id : undefined;
          item.completedAt = item.done ? new Date().toISOString() : undefined;
          task.updatedAt = new Date().toISOString();
          persistWorkTasks();
          return json(response, 200, { task });
        }
        const taskCommentMatch = url.match(/^\/tasks\/([^/]+)\/comments$/);
        if (taskCommentMatch && request.method === "POST") {
          const task = workTasks.get(taskCommentMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const input = await body(request),
            message = String(input.message || "").trim();
          if (!message)
            return json(response, 400, { message: "Escreva um comentário." });
          const mentioned = [...users.values()].filter((user) =>
              message.toLowerCase().includes(`@${user.name.toLowerCase()}`),
            ),
            comment: TicketComment & {
              visibility: "INTERNAL" | "CLIENT_VISIBLE";
            } = {
              id: randomUUID(),
              authorId: currentUser.id,
              authorName: currentUser.name,
              message,
              mentions: mentioned.map((user) => user.id),
              createdAt: new Date().toISOString(),
              visibility:
                input.visibility === "CLIENT_VISIBLE"
                  ? "CLIENT_VISIBLE"
                  : "INTERNAL",
            };
          task.comments.push(comment);
          task.participantIds = [
            ...new Set([...task.participantIds, ...comment.mentions]),
          ];
          task.updatedAt = comment.createdAt;
          task.activity.push({
            id: randomUUID(),
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: "adicionou um comentário",
            createdAt: comment.createdAt,
          });
          workTasks.set(task.id, task);
          persistWorkTasks();
          return json(response, 201, { task });
        }
        const taskAttachmentMatch = url.match(/^\/tasks\/([^/]+)\/attachments$/);
        if (taskAttachmentMatch && request.method === "POST") {
          const task = workTasks.get(taskAttachmentMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const name = decodeURIComponent(
              String(request.headers["x-file-name"] || "").trim(),
            ),
            contentType = String(
              request.headers["content-type"] || "application/octet-stream",
            ).split(";")[0],
            declaredSize = Number(request.headers["content-length"] || 0),
            allowed = [
              "image/png",
              "image/jpeg",
              "image/webp",
              "image/gif",
              "video/mp4",
              "video/webm",
              "video/quicktime",
              "application/pdf",
            ],
            maxSize = contentType.startsWith("video/")
              ? 250_000_000
              : 25_000_000;
          if (!name || name.length > 180)
            return json(response, 400, { message: "Nome de arquivo inválido." });
          if (declaredSize <= 0 || declaredSize > maxSize)
            return json(response, 400, {
              message: contentType.startsWith("video/")
                ? "Cada vídeo deve ter no máximo 250 MB."
                : "Cada imagem ou documento deve ter no máximo 25 MB.",
            });
          if (!allowed.includes(contentType))
            return json(response, 400, {
              message: "Envie imagens, vídeos MP4/WebM/MOV ou PDF.",
            });
          task.attachments ||= [];
          if (task.attachments.length >= 12)
            return json(response, 409, { message: "Limite de 12 anexos por tarefa atingido." });
          mkdirSync(localTaskAttachmentsPath, { recursive: true });
          const id = randomUUID(),
            storagePath = `${localTaskAttachmentsPath}/${id}`,
            writer = createWriteStream(storagePath, { mode: 0o600 });
          let sizeBytes = 0;
          try {
            for await (const chunk of request) {
              sizeBytes += chunk.length;
              if (sizeBytes > maxSize) throw new Error("FILE_TOO_LARGE");
              if (!writer.write(chunk)) await once(writer, "drain");
            }
            writer.end();
            await once(writer, "finish");
          } catch {
            writer.destroy();
            if (existsSync(storagePath)) unlinkSync(storagePath);
            return json(response, 400, { message: "Arquivo inválido ou muito grande." });
          }
          const createdAt = new Date(),
            attachment = {
              id,
              name,
              contentType,
              sizeBytes,
              storagePath,
              url: `/api/tasks/${task.id}/attachments/${id}/content`,
              expiresAt: new Date(createdAt.getTime() + 30 * 86400000).toISOString(),
              uploadedById: currentUser.id,
              uploadedByName: currentUser.name,
              createdAt: createdAt.toISOString(),
            };
          task.attachments.push(attachment); task.updatedAt = attachment.createdAt;
          task.activity.push({ id: randomUUID(), actorId: currentUser.id, actorName: currentUser.name,
            action: `anexou “${name}”`, createdAt: attachment.createdAt });
          persistWorkTasks();
          return json(response, 201, { attachment, task });
        }
        const taskAttachmentContentMatch = url.match(
          /^\/tasks\/([^/]+)\/attachments\/([^/]+)\/content$/,
        );
        if (taskAttachmentContentMatch && request.method === "GET") {
          const task = workTasks.get(taskAttachmentContentMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const attachment = (task.attachments || []).find(
            (item) => item.id === taskAttachmentContentMatch[2],
          );
          if (!attachment)
            return json(response, 404, { message: "Anexo não encontrado." });
          const expiresAt = attachment.expiresAt
            ? new Date(attachment.expiresAt).getTime()
            : new Date(attachment.createdAt).getTime() + 30 * 86400000;
          if (expiresAt <= Date.now()) {
            removeTaskAttachmentFile(attachment);
            task.attachments = task.attachments.filter(
              (item) => item.id !== attachment.id,
            );
            persistWorkTasks();
            return json(response, 410, { message: "Este anexo expirou." });
          }
          if (attachment.dataUrl) {
            const encoded = attachment.dataUrl.split(",")[1] || "";
            response.statusCode = 200;
            response.setHeader("Content-Type", attachment.contentType);
            response.setHeader("Cache-Control", "private, max-age=3600");
            return response.end(Buffer.from(encoded, "base64"));
          }
          if (!attachment.storagePath || !existsSync(attachment.storagePath))
            return json(response, 404, { message: "Arquivo não encontrado." });
          const fileSize = statSync(attachment.storagePath).size,
            range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
          if (range) {
            const start = Number(range[1]),
              end = range[2]
                ? Math.min(Number(range[2]), fileSize - 1)
                : fileSize - 1;
            if (start >= fileSize || end < start) {
              response.statusCode = 416;
              response.setHeader("Content-Range", `bytes */${fileSize}`);
              return response.end();
            }
            response.statusCode = 206;
            response.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
            response.setHeader("Content-Length", end - start + 1);
            response.setHeader("Accept-Ranges", "bytes");
            response.setHeader("Content-Type", attachment.contentType);
            response.setHeader("Cache-Control", "private, max-age=3600");
            return createReadStream(attachment.storagePath, { start, end }).pipe(
              response,
            );
          }
          response.statusCode = 200;
          response.setHeader("Content-Type", attachment.contentType);
          response.setHeader("Content-Length", fileSize);
          response.setHeader("Accept-Ranges", "bytes");
          response.setHeader("Cache-Control", "private, max-age=3600");
          response.setHeader(
            "Content-Disposition",
            `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
          );
          return createReadStream(attachment.storagePath).pipe(response);
        }
        const taskAttachmentItemMatch = url.match(/^\/tasks\/([^/]+)\/attachments\/([^/]+)$/);
        if (taskAttachmentItemMatch && request.method === "DELETE") {
          const task = workTasks.get(taskAttachmentItemMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          const attachment = (task.attachments || []).find(item => item.id === taskAttachmentItemMatch[2]);
          if (!attachment) return json(response, 404, { message: "Anexo não encontrado." });
          removeTaskAttachmentFile(attachment);
          task.attachments = task.attachments.filter(item => item.id !== attachment.id);
          task.updatedAt = new Date().toISOString(); persistWorkTasks();
          return json(response, 200, { ok: true });
        }
        const taskMatch = url.match(/^\/tasks\/([^/]+)$/);
        if (taskMatch && request.method === "PATCH") {
          const task = workTasks.get(taskMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          if (
            !hasPermission(currentUser, "tasks.edit") ||
            (task.responsibleId !== currentUser.id &&
              task.createdBy !== currentUser.id &&
              !hasPermission(currentUser, "tasks.edit_all"))
          )
            return json(response, 403, {
              message: "Você só pode editar suas próprias tarefas.",
            });
          const input = await body(request),
            responsible = input.responsibleId
              ? users.get(String(input.responsibleId))
              : undefined;
          if (
            task.approvalStatus === "REJECTED" &&
            input.status !== undefined &&
            input.status !== task.status
          )
            return json(response, 409, {
              message: "Uma demanda recusada está encerrada definitivamente.",
            });
          if (
            ["WAITING_APPROVAL", "CHANGES_REQUESTED", "APPROVED"].includes(
              input.status,
            )
          )
            return json(response, 400, {
              message:
                "Use o fluxo de revisão para enviar, aprovar ou solicitar ajustes.",
            });
          if (
            input.title !== undefined &&
            String(input.title).trim().length < 3
          )
            return json(response, 400, {
              message: "Informe um título válido.",
            });
          const previousStatus = task.status,
            nextStatus = [
              "TODO",
              "IN_PROGRESS",
              "REVIEW",
              "WAITING_APPROVAL",
              "CHANGES_REQUESTED",
              "APPROVED",
              "SCHEDULED",
              "PUBLISHED",
              "DONE",
              "CANCELLED",
            ].includes(input.status)
              ? input.status
              : task.status,
            now = new Date().toISOString();
          Object.assign(task, {
            title:
              input.title !== undefined
                ? String(input.title).trim()
                : task.title,
            description:
              input.description !== undefined
                ? String(input.description).trim()
                : task.description,
            status: nextStatus,
            priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(
              input.priority,
            )
              ? input.priority
              : task.priority,
            dueAt: input.dueAt !== undefined ? String(input.dueAt) : task.dueAt,
            trackedMinutes:
              input.trackedMinutes !== undefined
                ? Number(input.trackedMinutes)
                : task.trackedMinutes,
            responsibleId: responsible?.id || task.responsibleId,
            responsibleName: responsible?.name || task.responsibleName,
            approvalStatus:
              nextStatus === "APPROVED"
                ? "APPROVED"
                : nextStatus === "CHANGES_REQUESTED"
                  ? "CHANGES_REQUESTED"
                  : nextStatus === "WAITING_APPROVAL"
                    ? "PENDING"
                    : task.approvalStatus,
            completedAt: nextStatus === "DONE" ? now : task.completedAt,
            publishedAt: nextStatus === "PUBLISHED" ? now : task.publishedAt,
            details:
              typeof input.details === "object" && input.details
                ? { ...task.details, ...input.details }
                : task.details,
            updatedAt: now,
          });
          if (previousStatus !== nextStatus)
            task.activity.push({
              id: randomUUID(),
              actorId: currentUser.id,
              actorName: currentUser.name,
              action: `alterou o status para ${nextStatus}`,
              createdAt: now,
            });
          workTasks.set(task.id, task);
          persistWorkTasks();
          return json(response, 200, { task });
        }
        if (taskMatch && request.method === "DELETE") {
          const task = workTasks.get(taskMatch[1]);
          if (!task || !canSeeTask(task))
            return json(response, 404, { message: "Tarefa não encontrada." });
          if (!hasPermission(currentUser, "tasks.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir tarefas.",
            });
          task.archivedAt = new Date().toISOString();
          task.updatedAt = task.archivedAt;
          persistWorkTasks();
          return json(response, 200, { ok: true });
        }
        const canSeeEvent = (event: CalendarEvent) =>
          hasPermission(currentUser, "calendar.view_team") ||
          event.ownerId === currentUser.id ||
          event.participantIds.includes(currentUser.id);
        if (url === "/calendar/events" && request.method === "GET") {
          if (!hasPermission(currentUser, "calendar.view"))
            return json(response, 403, {
              message: "Você não possui acesso à agenda.",
            });
          return json(response, 200, {
            events: [...calendarEvents.values()]
              .filter(canSeeEvent)
              .sort((a, b) => a.startAt.localeCompare(b.startAt)),
            canViewTeam: hasPermission(currentUser, "calendar.view_team"),
            canEditAll: hasPermission(currentUser, "calendar.edit_all"),
          });
        }
        if (url === "/calendar/events" && request.method === "POST") {
          if (!hasPermission(currentUser, "calendar.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar eventos.",
            });
          const input = await body(request),
            title = String(input.title || "").trim(),
            startAt = String(input.startAt || ""),
            endAt = String(input.endAt || "");
          if (
            title.length < 3 ||
            !startAt ||
            !endAt ||
            new Date(endAt) <= new Date(startAt)
          )
            return json(response, 400, {
              message: "Informe título e período válidos.",
            });
          const now = new Date().toISOString(),
            event: CalendarEvent = {
              id: randomUUID(),
              title,
              description: String(input.description || "").trim(),
              ownerId: currentUser.id,
              ownerName: currentUser.name,
              participantIds: Array.isArray(input.participantIds)
                ? input.participantIds.map(String).filter((id) => users.has(id))
                : [],
              startAt,
              endAt,
              location: String(input.location || "").trim(),
              category: String(input.category || "WORK"),
              clientId: String(input.clientId || ""),
              projectId: String(input.projectId || ""),
              opportunityId: String(input.opportunityId || ""),
              taskId: String(input.taskId || ""),
              recurrence: String(input.recurrence || "NONE"),
              reminderMinutes: Number(input.reminderMinutes || 15),
              createdAt: now,
              updatedAt: now,
            };
          calendarEvents.set(event.id, event);
          persistCalendarEvents();
          return json(response, 201, { event });
        }
        const calendarMatch = url.match(/^\/calendar\/events\/([^/]+)$/);
        if (calendarMatch && request.method === "PATCH") {
          const event = calendarEvents.get(calendarMatch[1]);
          if (!event || !canSeeEvent(event))
            return json(response, 404, { message: "Evento não encontrado." });
          if (
            !hasPermission(currentUser, "calendar.edit") ||
            (event.ownerId !== currentUser.id &&
              !hasPermission(currentUser, "calendar.edit_all"))
          )
            return json(response, 403, {
              message: "Você só pode editar seus próprios eventos.",
            });
          const input = await body(request);
          Object.assign(event, {
            title:
              input.title !== undefined
                ? String(input.title).trim()
                : event.title,
            description:
              input.description !== undefined
                ? String(input.description).trim()
                : event.description,
            startAt:
              input.startAt !== undefined
                ? String(input.startAt)
                : event.startAt,
            endAt:
              input.endAt !== undefined ? String(input.endAt) : event.endAt,
            location:
              input.location !== undefined
                ? String(input.location)
                : event.location,
            updatedAt: new Date().toISOString(),
          });
          calendarEvents.set(event.id, event);
          persistCalendarEvents();
          return json(response, 200, { event });
        }
        if (calendarMatch && request.method === "DELETE") {
          const event = calendarEvents.get(calendarMatch[1]);
          if (!event || !canSeeEvent(event))
            return json(response, 404, { message: "Evento não encontrado." });
          if (
            event.ownerId !== currentUser.id &&
            !hasPermission(currentUser, "calendar.delete")
          )
            return json(response, 403, {
              message: "Você não pode excluir este evento.",
            });
          calendarEvents.delete(event.id);
          persistCalendarEvents();
          return json(response, 200, { ok: true });
        }
        if (url === "/clients" && request.method === "GET") {
          if (!hasPermission(currentUser, "clients.view"))
            return json(response, 403, {
              message: "Você não possui acesso aos clientes.",
            });
          return json(response, 200, {
            clients: [...clients.values()].sort((a, b) =>
              a.name.localeCompare(b.name, "pt-BR"),
            ),
          });
        }
        if (url === "/clients" && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar clientes.",
            });
          const input = await body(request);
          const name = String(input.name || "").trim();
          const document = String(input.document || "").trim(),
            primaryContactPhone = String(
              input.primaryContactPhone || "",
            ).trim();
          if (name.length < 2 || name.length > 120)
            return json(response, 400, {
              message: "Informe um nome de cliente válido.",
            });
          if (document && !validDocument(document))
            return json(response, 400, {
              message: "Informe um CPF ou CNPJ válido.",
            });
          if (!validPhone(primaryContactPhone))
            return json(response, 400, {
              message: "Informe um telefone válido com DDD.",
            });
          if (
            [...clients.values()].some(
              (client) => client.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Já existe um cliente com este nome.",
            });
          const now = new Date().toISOString();
          const client: Client = {
            id: randomUUID(),
            name,
            legalName: String(input.legalName || "").trim(),
            document,
            status: ["ACTIVE", "ATTENTION", "RISK", "INACTIVE"].includes(
              input.status,
            )
              ? input.status
              : "ACTIVE",
            segment: String(input.segment || "").trim(),
            website: String(input.website || "").trim(),
            primaryContactName: String(input.primaryContactName || "").trim(),
            primaryContactEmail: String(input.primaryContactEmail || "")
              .trim()
              .toLowerCase(),
            primaryContactPhone,
            owner: String(input.owner || "").trim(),
            notes: String(input.notes || "").trim(),
            createdAt: now,
            updatedAt: now,
          };
          clients.set(client.id, client);
          if (client.primaryContactName) {
            const contact: ClientContact = {
              id: randomUUID(),
              clientId: client.id,
              name: client.primaryContactName,
              role: "Contato principal",
              email: client.primaryContactEmail,
              phone: client.primaryContactPhone,
              whatsapp: client.primaryContactPhone,
              primary: true,
              createdAt: now,
            };
            clientContacts.set(contact.id, contact);
            persistClientContacts();
          }
          persistClients();
          return json(response, 201, { client });
        }
        const clientMatch = url.match(/^\/clients\/([^/]+)$/);
        if (clientMatch && request.method === "GET") {
          if (!hasPermission(currentUser, "clients.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const client = clients.get(clientMatch[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const services = [...clientServices.values()].filter(
              (item) => item.clientId === client.id,
            ),
            projects = [...onboardingProjects.values()].filter(
              (item) => item.clientId === client.id,
            ),
            contacts = [...clientContacts.values()].filter(
              (item) => item.clientId === client.id,
            );
          const commercial = [...opportunities.values()]
            .filter((item) => item.convertedClientId === client.id)
            .flatMap((item) =>
              item.activities.map((activity) => ({
                ...activity,
                phase: "COMMERCIAL",
                opportunityId: item.id,
              })),
            );
          const clientAssignments = [...mediaAssignments.values()].filter(
              (item) => item.clientId === client.id,
            ),
            linkedAccountIds = new Set(
              clientAssignments.map((item) => item.accountId),
            );
          let mediaAccounts: Array<{
            id: string;
            name: string;
            pageName?: string | null;
            platform: string;
            responsibleName: string;
            campaignCount: number;
          }> = [];
          if (existsSync(localMetaDashboardCachePath))
            try {
              const cached = JSON.parse(
                readFileSync(localMetaDashboardCachePath, "utf8"),
              ) as {
                payload?: {
                  accounts?: Array<{
                    id: string;
                    name: string;
                    pageName?: string | null;
                  }>;
                  campaigns?: Array<{ accountId: string }>;
                };
              };
              mediaAccounts = (cached.payload?.accounts || [])
                .filter((account) => linkedAccountIds.has(account.id))
                .map((account) => {
                  const assignment = clientAssignments.find(
                    (item) => item.accountId === account.id,
                  );
                  return {
                    ...account,
                    platform: assignment?.platform || "META_ADS",
                    responsibleName:
                      users.get(assignment?.responsibleId || "")?.name ||
                      "Não atribuído",
                    campaignCount: (cached.payload?.campaigns || []).filter(
                      (campaign) => campaign.accountId === account.id,
                    ).length,
                  };
                });
            } catch {
              mediaAccounts = [];
            }
          const relatedEntries = [...financialEntries.values()].filter(
              (item) => item.clientId === client.id,
            ),
            relatedTasks = [...workTasks.values()].filter(
              (item) => item.clientId === client.id,
            ),
            relatedEvents = [...calendarEvents.values()].filter(
              (item) => item.clientId === client.id,
            ),
            canViewFinance = hasPermission(currentUser, "finance.view_values");
          const financeBalance = canViewFinance
            ? relatedEntries
                .filter((item) => item.status !== "CANCELLED")
                .reduce(
                  (sum, item) =>
                    sum + (item.type === "INCOME" ? item.amount : -item.amount),
                  0,
                )
            : null;
          return json(response, 200, {
            client,
            contacts,
            services,
            projects,
            timeline: [...commercial].sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt),
            ),
            connections: {
              mediaAccounts,
              mediaAssignmentCount: clientAssignments.length,
              financeEntryCount: relatedEntries.length,
              financeBalance,
              taskCount: relatedTasks.length,
              eventCount: relatedEvents.length,
            },
          });
        }
        if (clientMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "clients.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar clientes.",
            });
          const client = clients.get(clientMatch[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const input = await body(request);
          const name = String(input.name || "").trim();
          const document = String(input.document || "").trim(),
            primaryContactPhone = String(
              input.primaryContactPhone || "",
            ).trim();
          if (name.length < 2 || name.length > 120)
            return json(response, 400, {
              message: "Informe um nome de cliente válido.",
            });
          if (document && !validDocument(document))
            return json(response, 400, {
              message: "Informe um CPF ou CNPJ válido.",
            });
          if (!validPhone(primaryContactPhone))
            return json(response, 400, {
              message: "Informe um telefone válido com DDD.",
            });
          if (
            [...clients.values()].some(
              (item) =>
                item.id !== client.id &&
                item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Já existe outro cliente com este nome.",
            });
          Object.assign(client, {
            name,
            legalName: String(input.legalName || "").trim(),
            document,
            status: ["ACTIVE", "ATTENTION", "RISK", "INACTIVE"].includes(
              input.status,
            )
              ? input.status
              : client.status,
            segment: String(input.segment || "").trim(),
            website: String(input.website || "").trim(),
            primaryContactName: String(input.primaryContactName || "").trim(),
            primaryContactEmail: String(input.primaryContactEmail || "")
              .trim()
              .toLowerCase(),
            primaryContactPhone,
            owner: String(input.owner || "").trim(),
            notes: String(input.notes || "").trim(),
            updatedAt: new Date().toISOString(),
          });
          clients.set(client.id, client);
          persistClients();
          return json(response, 200, { client });
        }
        if (clientMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "clients.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir clientes.",
            });
          const client = clients.get(clientMatch[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          if (
            [...clientServices.values()].some(
              (item) => item.clientId === client.id,
            ) ||
            [...onboardingProjects.values()].some(
              (item) => item.clientId === client.id,
            ) ||
            [...opportunities.values()].some(
              (item) => item.convertedClientId === client.id,
            )
          )
            return json(response, 409, {
              message:
                "Este cliente possui histórico comercial, serviços ou projetos e não pode ser excluído. Altere o status para inativo ou arquivado.",
            });
          clients.delete(client.id);
          persistClients();
          return json(response, 200, { ok: true });
        }
        const clientContactCollection = url.match(
          /^\/clients\/([^/]+)\/contacts$/,
        );
        if (clientContactCollection && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar clientes.",
            });
          const client = clients.get(clientContactCollection[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const input = await body(request),
            name = String(input.name || "").trim(),
            phone = String(input.phone || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome do contato.",
            });
          if (!validPhone(phone))
            return json(response, 400, {
              message: "Informe um telefone válido.",
            });
          const primary = input.primary === true || input.primary === "true";
          if (primary)
            clientContacts.forEach((item) => {
              if (item.clientId === client.id) item.primary = false;
            });
          const contact: ClientContact = {
            id: randomUUID(),
            clientId: client.id,
            name,
            role: String(input.role || "").trim(),
            email: String(input.email || "")
              .trim()
              .toLowerCase(),
            phone,
            whatsapp: String(input.whatsapp || phone).trim(),
            primary,
            createdAt: new Date().toISOString(),
          };
          clientContacts.set(contact.id, contact);
          if (primary) {
            client.primaryContactName = contact.name;
            client.primaryContactEmail = contact.email;
            client.primaryContactPhone = contact.phone;
            client.updatedAt = new Date().toISOString();
            persistClients();
          }
          persistClientContacts();
          return json(response, 201, { contact });
        }
        const clientContactMatch = url.match(
          /^\/clients\/([^/]+)\/contacts\/([^/]+)$/,
        );
        if (clientContactMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "clients.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar clientes.",
            });
          const contact = clientContacts.get(clientContactMatch[2]);
          if (!contact || contact.clientId !== clientContactMatch[1])
            return json(response, 404, { message: "Contato não encontrado." });
          clientContacts.delete(contact.id);
          persistClientContacts();
          return json(response, 200, { ok: true });
        }
        const clientServiceCollection = url.match(
          /^\/clients\/([^/]+)\/services$/,
        );
        if (clientServiceCollection && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar clientes.",
            });
          const client = clients.get(clientServiceCollection[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const input = await body(request),
            name = String(input.name || "").trim(),
            value = Number(
              String(input.negotiatedValue || "0")
                .replace(/\./g, "")
                .replace(",", "."),
            );
          if (name.length < 2 || !Number.isFinite(value) || value < 0)
            return json(response, 400, {
              message: "Informe serviço e valor válidos.",
            });
          const service: ClientService = {
            id: randomUUID(),
            clientId: client.id,
            opportunityId: "",
            name,
            negotiatedValue: value,
            billingType:
              input.billingType === "ONE_TIME" ? "ONE_TIME" : "RECURRING",
            startDate: String(
              input.startDate || new Date().toISOString().slice(0, 10),
            ),
            managerUserId: String(input.managerUserId || ""),
            createdAt: new Date().toISOString(),
          };
          clientServices.set(service.id, service);
          persistClientServices();
          return json(response, 201, { service });
        }
        const clientProjectCollection = url.match(
          /^\/clients\/([^/]+)\/projects$/,
        );
        if (clientProjectCollection && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar clientes.",
            });
          const client = clients.get(clientProjectCollection[1]);
          if (!client)
            return json(response, 404, { message: "Cliente não encontrado." });
          const input = await body(request),
            name = String(input.name || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome do projeto.",
            });
          const project: OnboardingProject = {
            id: randomUUID(),
            clientId: client.id,
            serviceId: String(input.serviceId || ""),
            name,
            objective: String(input.objective || "").trim(),
            responsibleId: String(input.responsibleId || ""),
            teamIds: Array.isArray(input.teamIds)
              ? input.teamIds.map(String).filter((id) => users.has(id))
              : [],
            startDate: String(input.startDate || ""),
            dueDate: String(input.dueDate || ""),
            progress: 0,
            status: [
              "PLANNED",
              "ACTIVE",
              "PAUSED",
              "COMPLETED",
              "CANCELLED",
            ].includes(input.status)
              ? input.status
              : "PLANNED",
            createdAt: new Date().toISOString(),
            tasks: [],
          };
          onboardingProjects.set(project.id, project);
          persistProjects();
          return json(response, 201, { project });
        }
        if (url === "/crm/contacts" && request.method === "GET") {
          if (!hasPermission(currentUser, "crm.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao CRM.",
            });
          return json(response, 200, {
            contacts: [...crmContacts.values()].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            ),
          });
        }
        if (url === "/crm/contacts" && request.method === "POST") {
          if (!hasPermission(currentUser, "crm.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar contatos.",
            });
          const input = await body(request),
            name = String(input.name || "").trim(),
            email = String(input.email || "")
              .trim()
              .toLowerCase();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome do contato.",
            });
          if (
            email &&
            [...crmContacts.values()].some((item) => item.email === email)
          )
            return json(response, 409, {
              message: "Já existe um contato com este e-mail.",
            });
          const responsible = users.get(String(input.responsibleId || "")),
            now = new Date().toISOString(),
            activity: CrmActivity = {
              id: randomUUID(),
              type: "CREATED",
              description: "Contato criado",
              actorId: currentUser.id,
              actorName: currentUser.name,
              createdAt: now,
            };
          const contact: CrmContact = {
            id: randomUUID(),
            name,
            email,
            phone: String(input.phone || "").trim(),
            whatsapp: String(input.whatsapp || input.phone || "").trim(),
            role: String(input.role || "").trim(),
            companyId: crmCompanies.has(String(input.companyId || ""))
              ? String(input.companyId)
              : "",
            clientId: clients.has(String(input.clientId || ""))
              ? String(input.clientId)
              : "",
            opportunityIds: Array.isArray(input.opportunityIds)
              ? input.opportunityIds
                  .map(String)
                  .filter((id) => opportunities.has(id))
              : [],
            responsibleId: responsible?.id || "",
            responsibleName: responsible?.name || "",
            createdAt: now,
            updatedAt: now,
            activities: [activity],
          };
          crmContacts.set(contact.id, contact);
          contact.opportunityIds.forEach((id) => {
            const opportunity = opportunities.get(id);
            if (opportunity) {
              opportunity.contactIds = [
                ...new Set([...(opportunity.contactIds || []), contact.id]),
              ];
              opportunities.set(id, opportunity);
            }
          });
          persistCrmContacts();
          persistOpportunities();
          return json(response, 201, { contact });
        }
        const crmContactMatch = url.match(/^\/crm\/contacts\/([^/]+)$/);
        if (crmContactMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "crm.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar contatos.",
            });
          const contact = crmContacts.get(crmContactMatch[1]);
          if (!contact)
            return json(response, 404, { message: "Contato não encontrado." });
          const input = await body(request),
            previous = [...contact.opportunityIds],
            responsible = users.get(String(input.responsibleId || ""));
          contact.name = String(input.name || contact.name).trim();
          contact.email = String(input.email ?? contact.email)
            .trim()
            .toLowerCase();
          contact.phone = String(input.phone ?? contact.phone).trim();
          contact.whatsapp = String(input.whatsapp ?? contact.whatsapp).trim();
          contact.role = String(input.role ?? contact.role).trim();
          contact.companyId = crmCompanies.has(String(input.companyId || ""))
            ? String(input.companyId)
            : "";
          contact.clientId = clients.has(String(input.clientId || ""))
            ? String(input.clientId)
            : "";
          contact.opportunityIds = Array.isArray(input.opportunityIds)
            ? input.opportunityIds
                .map(String)
                .filter((id) => opportunities.has(id))
            : contact.opportunityIds;
          contact.responsibleId = responsible?.id || "";
          contact.responsibleName = responsible?.name || "";
          contact.updatedAt = new Date().toISOString();
          contact.activities.push({
            id: randomUUID(),
            type: "UPDATED",
            description: "Dados e vínculos do contato atualizados",
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: contact.updatedAt,
          });
          opportunities.forEach((opportunity) => {
            if (
              previous.includes(opportunity.id) &&
              !contact.opportunityIds.includes(opportunity.id)
            )
              opportunity.contactIds = (opportunity.contactIds || []).filter(
                (id) => id !== contact.id,
              );
            if (contact.opportunityIds.includes(opportunity.id))
              opportunity.contactIds = [
                ...new Set([...(opportunity.contactIds || []), contact.id]),
              ];
          });
          crmContacts.set(contact.id, contact);
          persistCrmContacts();
          persistOpportunities();
          return json(response, 200, { contact });
        }
        if (crmContactMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "crm.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir contatos.",
            });
          const contact = crmContacts.get(crmContactMatch[1]);
          if (!contact)
            return json(response, 404, { message: "Contato não encontrado." });
          opportunities.forEach(
            (item) =>
              (item.contactIds = (item.contactIds || []).filter(
                (id) => id !== contact.id,
              )),
          );
          crmContacts.delete(contact.id);
          persistCrmContacts();
          persistOpportunities();
          return json(response, 200, { ok: true });
        }
        const crmContactActivity = url.match(
          /^\/crm\/contacts\/([^/]+)\/activities$/,
        );
        if (crmContactActivity && request.method === "POST") {
          const contact = crmContacts.get(crmContactActivity[1]);
          if (!contact)
            return json(response, 404, { message: "Contato não encontrado." });
          const input = await body(request),
            description = String(input.description || "").trim();
          if (!description)
            return json(response, 400, { message: "Descreva a atividade." });
          contact.updatedAt = new Date().toISOString();
          contact.activities.push({
            id: randomUUID(),
            type: String(input.type || "NOTE"),
            description,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: contact.updatedAt,
          });
          crmContacts.set(contact.id, contact);
          persistCrmContacts();
          return json(response, 201, { contact });
        }
        if (url === "/crm/companies" && request.method === "GET") {
          if (!hasPermission(currentUser, "crm.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao CRM.",
            });
          return json(response, 200, {
            companies: [...crmCompanies.values()].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            ),
          });
        }
        if (url === "/crm/companies" && request.method === "POST") {
          if (!hasPermission(currentUser, "crm.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar empresas.",
            });
          const input = await body(request),
            name = String(input.name || "").trim(),
            document = String(input.document || "").trim();
          if (name.length < 2)
            return json(response, 400, {
              message: "Informe o nome da empresa.",
            });
          if (document && !validDocument(document))
            return json(response, 400, {
              message: "Informe um CPF ou CNPJ válido.",
            });
          if (
            document &&
            [...crmCompanies.values()].some(
              (item) => onlyDigits(item.document) === onlyDigits(document),
            )
          )
            return json(response, 409, {
              message: "Já existe uma empresa com este documento.",
            });
          const responsible = users.get(String(input.responsibleId || "")),
            now = new Date().toISOString(),
            company: CrmCompany = {
              id: randomUUID(),
              name,
              legalName: String(input.legalName || "").trim(),
              document,
              website: String(input.website || "").trim(),
              phone: String(input.phone || "").trim(),
              segment: String(input.segment || "").trim(),
              clientId: clients.has(String(input.clientId || ""))
                ? String(input.clientId)
                : "",
              responsibleId: responsible?.id || "",
              responsibleName: responsible?.name || "",
              createdAt: now,
              updatedAt: now,
              activities: [
                {
                  id: randomUUID(),
                  type: "CREATED",
                  description: "Empresa criada",
                  actorId: currentUser.id,
                  actorName: currentUser.name,
                  createdAt: now,
                },
              ],
            };
          crmCompanies.set(company.id, company);
          persistCrmCompanies();
          return json(response, 201, { company });
        }
        const crmCompanyMatch = url.match(/^\/crm\/companies\/([^/]+)$/);
        if (crmCompanyMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "crm.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar empresas.",
            });
          const company = crmCompanies.get(crmCompanyMatch[1]);
          if (!company)
            return json(response, 404, { message: "Empresa não encontrada." });
          const input = await body(request),
            responsible = users.get(String(input.responsibleId || ""));
          company.name = String(input.name || company.name).trim();
          company.legalName = String(
            input.legalName ?? company.legalName,
          ).trim();
          company.document = String(input.document ?? company.document).trim();
          company.website = String(input.website ?? company.website).trim();
          company.phone = String(input.phone ?? company.phone).trim();
          company.segment = String(input.segment ?? company.segment).trim();
          company.clientId = clients.has(String(input.clientId || ""))
            ? String(input.clientId)
            : "";
          company.responsibleId = responsible?.id || "";
          company.responsibleName = responsible?.name || "";
          company.updatedAt = new Date().toISOString();
          company.activities.push({
            id: randomUUID(),
            type: "UPDATED",
            description: "Dados da empresa atualizados",
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: company.updatedAt,
          });
          crmCompanies.set(company.id, company);
          persistCrmCompanies();
          return json(response, 200, { company });
        }
        if (crmCompanyMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "crm.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir empresas.",
            });
          const company = crmCompanies.get(crmCompanyMatch[1]);
          if (!company)
            return json(response, 404, { message: "Empresa não encontrada." });
          if (
            [...crmContacts.values()].some(
              (item) => item.companyId === company.id,
            ) ||
            [...opportunities.values()].some(
              (item) => item.companyId === company.id,
            )
          )
            return json(response, 409, {
              message:
                "Remova ou altere os vínculos de contatos e oportunidades antes de excluir esta empresa.",
            });
          crmCompanies.delete(company.id);
          persistCrmCompanies();
          return json(response, 200, { ok: true });
        }
        const crmCompanyActivity = url.match(
          /^\/crm\/companies\/([^/]+)\/activities$/,
        );
        if (crmCompanyActivity && request.method === "POST") {
          const company = crmCompanies.get(crmCompanyActivity[1]);
          if (!company)
            return json(response, 404, { message: "Empresa não encontrada." });
          const input = await body(request),
            description = String(input.description || "").trim();
          if (!description)
            return json(response, 400, { message: "Descreva a atividade." });
          company.updatedAt = new Date().toISOString();
          company.activities.push({
            id: randomUUID(),
            type: String(input.type || "NOTE"),
            description,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: company.updatedAt,
          });
          crmCompanies.set(company.id, company);
          persistCrmCompanies();
          return json(response, 201, { company });
        }
        if (url === "/crm/pipelines" && request.method === "GET") {
          if (!hasPermission(currentUser, "crm.view") && !hasPermission(currentUser, "opportunities.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao CRM.",
            });
          return json(response, 200, {
            pipelines: [...pipelines.values()].filter((item) =>
              canAccessPipeline(currentUser, item),
            ),
            canManage: hasPermission(currentUser, "crm.manage_pipelines"),
          });
        }
        if (url === "/crm/pipelines" && request.method === "POST") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para administrar pipelines.",
            });
          const input = await body(request),
            name = String(input.name || "").trim(),
            departmentIds = Array.isArray(input.departmentIds)
              ? input.departmentIds
                  .map(String)
                  .filter((id) => departments.has(id))
              : [];
          if (name.length < 2 || name.length > 80)
            return json(response, 400, {
              message: "Informe um nome de pipeline válido.",
            });
          if (
            [...pipelines.values()].some(
              (item) => item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Já existe um pipeline com este nome.",
            });
          const pipeline: CrmPipeline = {
            id: randomUUID(),
            name,
            departmentIds,
            createdAt: new Date().toISOString(),
            stages: [
              {
                id: randomUUID(),
                name: "Novo lead",
                color: "#4f8df7",
                probability: 10,
              },
              {
                id: randomUUID(),
                name: "Fechado — ganho",
                color: "#239667",
                probability: 100,
                terminal: "WON",
              },
              {
                id: randomUUID(),
                name: "Fechado — perdido",
                color: "#8a96a8",
                probability: 0,
                terminal: "LOST",
              },
            ],
          };
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 201, { pipeline });
        }
        const pipelineMatch = url.match(/^\/crm\/pipelines\/([^/]+)$/);
        if (pipelineMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para administrar pipelines.",
            });
          const pipeline = pipelines.get(pipelineMatch[1]);
          if (!pipeline)
            return json(response, 404, { message: "Pipeline não encontrado." });
          const input = await body(request),
            name = String(input.name || "").trim();
          if (name.length < 2 || name.length > 80)
            return json(response, 400, {
              message: "Informe um nome de pipeline válido.",
            });
          if (
            [...pipelines.values()].some(
              (item) =>
                item.id !== pipeline.id &&
                item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Já existe outro pipeline com este nome.",
            });
          pipeline.name = name;
          if (Array.isArray(input.departmentIds))
            pipeline.departmentIds = input.departmentIds
              .map(String)
              .filter((id) => departments.has(id));
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 200, { pipeline });
        }
        if (pipelineMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para administrar pipelines.",
            });
          const pipeline = pipelines.get(pipelineMatch[1]);
          if (!pipeline)
            return json(response, 404, { message: "Pipeline não encontrado." });
          if (pipelines.size <= 1)
            return json(response, 409, {
              message: "O CRM precisa manter pelo menos um pipeline.",
            });
          const linked = [...opportunities.values()].filter(
            (item) => item.pipelineId === pipeline.id,
          );
          if (linked.length) {
            const input = await body(request),
              target = pipelines.get(String(input.targetPipelineId || ""));
            if (!target || target.id === pipeline.id)
              return json(response, 409, {
                message:
                  "Selecione outro CRM para receber as oportunidades deste funil.",
              });
            const targetStage = target.stages.find((stage) => !stage.terminal);
            if (!targetStage)
              return json(response, 409, {
                message:
                  "O CRM de destino precisa possuir pelo menos uma etapa aberta.",
              });
            const now = new Date().toISOString();
            linked.forEach((opportunity) => {
              const previousStage = pipeline.stages.find(
                (stage) => stage.id === opportunity.stageId,
              );
              opportunity.pipelineId = target.id;
              opportunity.stageId = targetStage.id;
              opportunity.stageEnteredAt = now;
              opportunity.updatedAt = now;
              opportunity.activities.push({
                id: randomUUID(),
                type: "PIPELINE_CHANGED",
                description: `Transferida do CRM ${pipeline.name} (${previousStage?.name || "etapa removida"}) para ${target.name} (${targetStage.name}) antes da exclusão do funil`,
                actorId: currentUser.id,
                actorName: currentUser.name,
                createdAt: now,
                metadata: {
                  fromPipelineId: pipeline.id,
                  toPipelineId: target.id,
                  fromStageId: previousStage?.id || "",
                  toStageId: targetStage.id,
                },
              });
              opportunities.set(opportunity.id, opportunity);
            });
            persistOpportunities();
          }
          pipelines.delete(pipeline.id);
          persistPipelines();
          return json(response, 200, { ok: true });
        }
        const pipelineStageCollectionMatch = url.match(
          /^\/crm\/pipelines\/([^/]+)\/stages$/,
        );
        if (pipelineStageCollectionMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para administrar etapas.",
            });
          const pipeline = pipelines.get(pipelineStageCollectionMatch[1]);
          if (!pipeline)
            return json(response, 404, { message: "Pipeline não encontrado." });
          const input = await body(request),
            name = String(input.name || "").trim(),
            probability = Math.round(Number(input.probability));
          if (name.length < 2 || name.length > 60)
            return json(response, 400, {
              message: "Informe um nome de etapa válido.",
            });
          if (
            !Number.isFinite(probability) ||
            probability < 0 ||
            probability > 100
          )
            return json(response, 400, {
              message: "A probabilidade deve estar entre 0 e 100.",
            });
          if (
            pipeline.stages.some(
              (item) => item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Esta etapa já existe no pipeline.",
            });
          const terminal = ["WON", "LOST"].includes(String(input.terminal))
            ? (input.terminal as "WON" | "LOST")
            : undefined;
          if (
            terminal &&
            pipeline.stages.some((item) => item.terminal === terminal)
          )
            return json(response, 409, {
              message: `O pipeline já possui uma etapa final ${terminal === "WON" ? "de ganho" : "de perda"}.`,
            });
          const stage: CrmStage = {
            id: randomUUID(),
            name,
            color: /^#[0-9a-f]{6}$/i.test(String(input.color))
              ? String(input.color)
              : "#4f8df7",
            probability,
            requiredFields: Array.isArray(input.requiredFields)
              ? input.requiredFields.map(String)
              : [],
            terminal,
          };
          const terminalIndex = pipeline.stages.findIndex(
            (item) => item.terminal,
          );
          terminalIndex < 0
            ? pipeline.stages.push(stage)
            : pipeline.stages.splice(terminalIndex, 0, stage);
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 201, { stage, pipeline });
        }
        const pipelineReorderMatch = url.match(
          /^\/crm\/pipelines\/([^/]+)\/stages\/reorder$/,
        );
        if (pipelineReorderMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para reordenar etapas.",
            });
          const pipeline = pipelines.get(pipelineReorderMatch[1]);
          if (!pipeline)
            return json(response, 404, { message: "Pipeline não encontrado." });
          const input = await body(request),
            ids = Array.isArray(input.stageIds)
              ? input.stageIds.map(String)
              : [];
          if (
            ids.length !== pipeline.stages.length ||
            new Set(ids).size !== ids.length ||
            ids.some((id) => !pipeline.stages.some((stage) => stage.id === id))
          )
            return json(response, 400, {
              message: "A ordem enviada não corresponde às etapas do pipeline.",
            });
          pipeline.stages = ids.map(
            (id) => pipeline.stages.find((stage) => stage.id === id)!,
          );
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 200, { pipeline });
        }
        const pipelineStageMatch = url.match(
          /^\/crm\/pipelines\/([^/]+)\/stages\/([^/]+)$/,
        );
        if (pipelineStageMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para editar etapas.",
            });
          const pipeline = pipelines.get(pipelineStageMatch[1]),
            stage = pipeline?.stages.find(
              (item) => item.id === pipelineStageMatch[2],
            );
          if (!pipeline || !stage)
            return json(response, 404, { message: "Etapa não encontrada." });
          const input = await body(request),
            name = String(input.name || "").trim(),
            probability = Math.round(Number(input.probability));
          if (name.length < 2 || name.length > 60)
            return json(response, 400, {
              message: "Informe um nome de etapa válido.",
            });
          if (
            !Number.isFinite(probability) ||
            probability < 0 ||
            probability > 100
          )
            return json(response, 400, {
              message: "A probabilidade deve estar entre 0 e 100.",
            });
          if (
            pipeline.stages.some(
              (item) =>
                item.id !== stage.id &&
                item.name.toLowerCase() === name.toLowerCase(),
            )
          )
            return json(response, 409, {
              message: "Já existe outra etapa com este nome.",
            });
          stage.name = name;
          stage.probability = probability;
          stage.requiredFields = Array.isArray(input.requiredFields)
            ? input.requiredFields.map(String)
            : stage.requiredFields || [];
          if (/^#[0-9a-f]{6}$/i.test(String(input.color)))
            stage.color = String(input.color);
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 200, { stage, pipeline });
        }
        if (pipelineStageMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "crm.manage_pipelines"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir etapas.",
            });
          const pipeline = pipelines.get(pipelineStageMatch[1]),
            stage = pipeline?.stages.find(
              (item) => item.id === pipelineStageMatch[2],
            );
          if (!pipeline || !stage)
            return json(response, 404, { message: "Etapa não encontrada." });
          if (stage.terminal)
            return json(response, 409, {
              message:
                "Etapas finais de ganho e perda são obrigatórias e não podem ser excluídas.",
            });
          if (
            [...opportunities.values()].some(
              (item) =>
                item.pipelineId === pipeline.id && item.stageId === stage.id,
            )
          )
            return json(response, 409, {
              message: "Mova as oportunidades desta etapa antes de excluí-la.",
            });
          pipeline.stages = pipeline.stages.filter(
            (item) => item.id !== stage.id,
          );
          pipelines.set(pipeline.id, pipeline);
          persistPipelines();
          return json(response, 200, { pipeline });
        }
        if (url === "/crm/opportunities" && request.method === "GET") {
          if (!hasPermission(currentUser, "opportunities.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao CRM.",
            });
          return json(response, 200, {
            opportunities: [...opportunities.values()]
              .filter((item) => {
                const pipeline = pipelines.get(item.pipelineId);
                return !!pipeline && canAccessPipeline(currentUser, pipeline);
              })
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          });
        }
        if (url === "/crm/opportunities" && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.create"))
            return json(response, 403, {
              message: "Você não possui permissão para criar oportunidades.",
            });
          const input = await body(request);
          const name = String(input.name || "").trim();
          const pipeline =
            pipelines.get(String(input.pipelineId || "")) ||
            [...pipelines.values()][0];
          const stage =
            pipeline?.stages.find((item) => item.id === input.stageId) ||
            pipeline?.stages.find((item) => !item.terminal);
          if (name.length < 2 || !pipeline || !stage)
            return json(response, 400, {
              message: "Informe o lead e uma etapa inicial válidos.",
            });
          if (!canAccessPipeline(currentUser, pipeline))
            return json(response, 403, {
              message: "Seu setor não possui acesso a este CRM.",
            });
          const responsible = users.get(String(input.responsibleId || ""));
          const now = new Date().toISOString();
          const activity: CrmActivity = {
            id: randomUUID(),
            type: "CREATED",
            description: "Oportunidade criada",
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
          };
          const companyRecord = crmCompanies.get(String(input.companyId || "")),
            contactIds = Array.isArray(input.contactIds)
              ? input.contactIds.map(String).filter((id) => crmContacts.has(id))
              : [];
          const opportunity: Opportunity = {
            id: randomUUID(),
            name,
            company: companyRecord?.name || String(input.company || "").trim(),
            companyId: companyRecord?.id || "",
            contactIds,
            email: String(input.email || "")
              .trim()
              .toLowerCase(),
            phone: String(input.phone || "").trim(),
            whatsapp: String(input.whatsapp || input.phone || "").trim(),
            serviceInterest: String(input.serviceInterest || "").trim(),
            potentialValue:
              Number(
                String(input.potentialValue || "0")
                  .replace(/\./g, "")
                  .replace(",", "."),
              ) || 0,
            temperature: ["COLD", "WARM", "HOT"].includes(input.temperature)
              ? input.temperature
              : "WARM",
            priority: ["LOW", "MEDIUM", "HIGH"].includes(input.priority)
              ? input.priority
              : "MEDIUM",
            responsibleId: responsible?.id || "",
            responsibleName: responsible?.name || "",
            teamIds: Array.isArray(input.teamIds)
              ? input.teamIds.map(String).filter((id) => users.has(id))
              : [],
            tags: Array.isArray(input.tags)
              ? input.tags.map(String)
              : String(input.tags || "")
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
            pipelineId: pipeline.id,
            stageId: stage.id,
            status: "OPEN",
            nextAction: String(input.nextAction || "").trim(),
            nextActionAt: String(input.nextActionAt || ""),
            stageEnteredAt: now,
            createdAt: now,
            updatedAt: now,
            activities: [activity],
            proposals: [],
          };
          contactIds.forEach((id) => {
            const contact = crmContacts.get(id);
            if (contact) {
              contact.opportunityIds = [
                ...new Set([...contact.opportunityIds, opportunity.id]),
              ];
              contact.updatedAt = now;
              crmContacts.set(id, contact);
            }
          });
          if (contactIds.length) persistCrmContacts();
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 201, { opportunity });
        }
        const opportunityStageMatch = url.match(
          /^\/crm\/opportunities\/([^/]+)\/stage$/,
        );
        if (opportunityStageMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.move_stage"))
            return json(response, 403, {
              message: "Você não possui permissão para mover oportunidades.",
            });
          const opportunity = opportunities.get(opportunityStageMatch[1]);
          if (!opportunity)
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          const scopedPipeline = pipelines.get(opportunity.pipelineId);
          if (
            !scopedPipeline ||
            !canAccessPipeline(currentUser, scopedPipeline)
          )
            return json(response, 403, {
              message: "Seu setor não possui acesso a este CRM.",
            });
          if (opportunity.status === "CONVERTED")
            return json(response, 409, {
              message: "Uma oportunidade convertida não pode ser movida.",
            });
          const input = await body(request);
          const pipeline = pipelines.get(opportunity.pipelineId);
          const stage = pipeline?.stages.find(
            (item) => item.id === input.stageId,
          );
          if (!stage)
            return json(response, 400, { message: "Etapa inválida." });
          if (stage.terminal === "WON")
            return json(response, 409, {
              message:
                "Use o fluxo de conversão para fechar esta oportunidade como ganha.",
            });
          const requiredLabels: Record<string, string> = {
            company: "empresa",
            email: "e-mail",
            phone: "telefone",
            serviceInterest: "serviço de interesse",
            potentialValue: "valor potencial",
            responsibleId: "responsável",
            nextAction: "próxima ação",
            nextActionAt: "data da próxima ação",
          };
          const missing = (stage.requiredFields || []).filter((field) => {
            const value = (opportunity as unknown as Record<string, unknown>)[
              field
            ];
            return (
              value === undefined ||
              value === null ||
              value === "" ||
              (field === "potentialValue" && Number(value) <= 0)
            );
          });
          if (missing.length)
            return json(response, 400, {
              message: `Complete os campos obrigatórios antes de entrar nesta etapa: ${missing.map((field) => requiredLabels[field] || field).join(", ")}.`,
            });
          if (
            stage.terminal === "LOST" &&
            !String(input.lossReason || "").trim()
          )
            return json(response, 400, {
              message: "Informe o motivo da perda.",
            });
          const previous = pipeline?.stages.find(
            (item) => item.id === opportunity.stageId,
          );
          const now = new Date().toISOString();
          opportunity.stageId = stage.id;
          opportunity.stageEnteredAt = now;
          opportunity.updatedAt = now;
          opportunity.status = stage.terminal === "LOST" ? "LOST" : "OPEN";
          opportunity.lossReason =
            stage.terminal === "LOST"
              ? String(input.lossReason).trim()
              : undefined;
          opportunity.activities.push({
            id: randomUUID(),
            type: "STAGE_CHANGED",
            description: `Movida de ${previous?.name || "etapa anterior"} para ${stage.name}`,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
            metadata: {
              fromStageId: previous?.id || "",
              toStageId: stage.id,
              lossReason: opportunity.lossReason || "",
            },
          });
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 200, { opportunity });
        }
        const opportunityConvertMatch = url.match(
          /^\/crm\/opportunities\/([^/]+)\/convert$/,
        );
        if (opportunityConvertMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.convert"))
            return json(response, 403, {
              message: "Você não possui permissão para converter leads.",
            });
          const opportunity = opportunities.get(opportunityConvertMatch[1]);
          if (!opportunity)
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          const scopedPipeline = pipelines.get(opportunity.pipelineId);
          if (
            !scopedPipeline ||
            !canAccessPipeline(currentUser, scopedPipeline)
          )
            return json(response, 403, {
              message: "Seu setor não possui acesso a este CRM.",
            });
          if (
            opportunity.convertedClientId ||
            opportunity.status === "CONVERTED"
          )
            return json(response, 409, {
              message: "Esta oportunidade já foi convertida.",
            });
          const input = await body(request),
            clientName = String(input.clientName || "").trim(),
            document = String(input.document || "").trim(),
            email = String(input.email || opportunity.email || "")
              .trim()
              .toLowerCase(),
            phone = String(input.phone || opportunity.phone || "").trim();
          if (
            clientName.length < 2 ||
            !String(input.serviceName || "").trim() ||
            !String(input.startDate || "")
          )
            return json(response, 400, {
              message: "Informe cliente, serviço contratado e data de início.",
            });
          if (document && !validDocument(document))
            return json(response, 400, {
              message: "Informe um CPF ou CNPJ válido.",
            });
          if (!validPhone(phone))
            return json(response, 400, {
              message: "Informe um telefone válido.",
            });
          const normalized = (value: string) => onlyDigits(value),
            domain = (value: string) => {
              try {
                return new URL(
                  /^https?:/.test(value) ? value : `https://${value}`,
                ).hostname.replace(/^www\./, "");
              } catch {
                return "";
              }
            };
          const duplicates = [...clients.values()].flatMap((client) => {
            const reasons: string[] = [];
            if (
              document &&
              normalized(client.document) === normalized(document)
            )
              reasons.push("mesmo CPF/CNPJ");
            if (email && client.primaryContactEmail === email)
              reasons.push("mesmo e-mail");
            if (
              phone &&
              normalized(client.primaryContactPhone) === normalized(phone)
            )
              reasons.push("mesmo telefone");
            if (client.name.toLowerCase() === clientName.toLowerCase())
              reasons.push("mesmo nome");
            if (
              domain(client.website) &&
              domain(client.website) === domain(String(input.website || ""))
            )
              reasons.push("mesmo domínio");
            return reasons.length
              ? [
                  {
                    id: client.id,
                    name: client.name,
                    reason: reasons.join(", "),
                  },
                ]
              : [];
          });
          const existingClientId = String(input.existingClientId || ""),
            existingClient = existingClientId
              ? clients.get(existingClientId)
              : undefined;
          if (existingClientId && !existingClient)
            return json(response, 400, {
              message: "Selecione um cliente existente válido.",
            });
          if (duplicates.length && !input.allowDuplicate && !existingClient)
            return json(response, 409, {
              message: "Possível cliente duplicado.",
              duplicates,
            });
          const now = new Date().toISOString(),
            clientId = existingClient?.id || randomUUID();
          const client: Client = existingClient || {
            id: clientId,
            name: clientName,
            legalName: String(input.legalName || "").trim(),
            document,
            status: "ACTIVE",
            segment: String(input.segment || "").trim(),
            website: String(input.website || "").trim(),
            primaryContactName: opportunity.name,
            primaryContactEmail: email,
            primaryContactPhone: phone,
            owner:
              users.get(String(input.managerUserId || ""))?.name ||
              opportunity.responsibleName,
            notes: `Originado da oportunidade ${opportunity.id}.`,
            createdAt: now,
            updatedAt: now,
          };
          const service: ClientService = {
            id: randomUUID(),
            clientId: client.id,
            opportunityId: opportunity.id,
            name: String(input.serviceName).trim(),
            negotiatedValue:
              Number(
                String(input.negotiatedValue || opportunity.potentialValue)
                  .replace(/\./g, "")
                  .replace(",", "."),
              ) || 0,
            billingType:
              input.billingType === "ONE_TIME" ? "ONE_TIME" : "RECURRING",
            startDate: String(input.startDate),
            managerUserId: String(input.managerUserId || ""),
            createdAt: now,
          };
          if (!existingClient) clients.set(client.id, client);
          clientServices.set(service.id, service);
          opportunity.status = "CONVERTED";
          opportunity.convertedClientId = client.id;
          opportunity.convertedAt = now;
          opportunity.convertedBy = currentUser.id;
          opportunity.stageId =
            pipelines
              .get(opportunity.pipelineId)
              ?.stages.find((item) => item.terminal === "WON")?.id ||
            opportunity.stageId;
          opportunity.stageEnteredAt = now;
          opportunity.updatedAt = now;
          opportunity.activities.push({
            id: randomUUID(),
            type: "CONVERTED",
            description: `Convertida em cliente: ${client.name}`,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
            metadata: { clientId: client.id, serviceId: service.id },
          });
          if (input.createOnboarding === "true") {
            const project: OnboardingProject = {
              id: randomUUID(),
              clientId: client.id,
              serviceId: service.id,
              name: `Onboarding — ${client.name}`,
              status: "PLANNED",
              createdAt: now,
              tasks: [
                {
                  id: randomUUID(),
                  title: "Reunião de kickoff",
                  status: "TODO",
                },
                {
                  id: randomUUID(),
                  title: "Coletar acessos e materiais",
                  status: "TODO",
                },
                {
                  id: randomUUID(),
                  title: "Validar planejamento inicial",
                  status: "TODO",
                },
              ],
            };
            onboardingProjects.set(project.id, project);
          }
          persistClients();
          persistClientServices();
          persistOpportunities();
          persistProjects();
          return json(response, 201, { client, service, opportunity });
        }
        const opportunityReverseMatch = url.match(
          /^\/crm\/opportunities\/([^/]+)\/reverse-conversion$/,
        );
        if (opportunityReverseMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.reverse_conversion"))
            return json(response, 403, {
              message: "Você não possui permissão para reverter conversões.",
            });
          const opportunity = opportunities.get(opportunityReverseMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          if (
            !opportunity ||
            !pipeline ||
            !canAccessPipeline(currentUser, pipeline)
          )
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          if (
            opportunity.status !== "CONVERTED" ||
            !opportunity.convertedClientId
          )
            return json(response, 409, {
              message: "Esta oportunidade não possui uma conversão ativa.",
            });
          const input = await body(request),
            reason = String(input.reason || "").trim();
          if (reason.length < 10)
            return json(response, 400, {
              message:
                "Informe uma justificativa com pelo menos 10 caracteres.",
            });
          const derivedServices = [...clientServices.values()].filter(
              (item) => item.opportunityId === opportunity.id,
            ),
            derivedProjects = [...onboardingProjects.values()].filter((item) =>
              derivedServices.some((service) => service.id === item.serviceId),
            );
          const now = new Date().toISOString(),
            clientId = opportunity.convertedClientId;
          opportunity.status = "OPEN";
          delete opportunity.convertedClientId;
          delete opportunity.convertedAt;
          delete opportunity.convertedBy;
          opportunity.stageId =
            pipeline.stages.find((item) => !item.terminal)?.id ||
            opportunity.stageId;
          opportunity.stageEnteredAt = now;
          opportunity.updatedAt = now;
          opportunity.activities.push({
            id: randomUUID(),
            type: "CONVERSION_REVERSED",
            description: `Conversão revertida: ${reason}`,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
            metadata: {
              clientId,
              servicesPreserved: String(derivedServices.length),
              projectsPreserved: String(derivedProjects.length),
            },
          });
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 200, {
            opportunity,
            impact: {
              clientPreserved: true,
              servicesPreserved: derivedServices.length,
              projectsPreserved: derivedProjects.length,
            },
          });
        }
        const opportunityActivityMatch = url.match(
          /^\/crm\/opportunities\/([^/]+)\/activities$/,
        );
        if (opportunityActivityMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para registrar atividades.",
            });
          const opportunity = opportunities.get(opportunityActivityMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          if (
            !opportunity ||
            !pipeline ||
            !canAccessPipeline(currentUser, pipeline)
          )
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          const input = await body(request),
            description = String(input.description || "").trim(),
            allowedTypes = [
              "NOTE",
              "CALL",
              "MESSAGE",
              "EMAIL",
              "MEETING",
              "COMMENT",
              "FILE",
            ];
          if (description.length < 2)
            return json(response, 400, {
              message: "Descreva a atividade comercial.",
            });
          const type = allowedTypes.includes(String(input.type))
              ? String(input.type)
              : "NOTE",
            now = new Date().toISOString();
          const activity: CrmActivity = {
            id: randomUUID(),
            type,
            description,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
            metadata:
              input.metadata && typeof input.metadata === "object"
                ? Object.fromEntries(
                    Object.entries(input.metadata).map(([key, value]) => [
                      key,
                      String(value),
                    ]),
                  )
                : undefined,
          };
          opportunity.activities.push(activity);
          opportunity.updatedAt = now;
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 201, { activity, opportunity });
        }
        const opportunityProposalMatch = url.match(
          /^\/crm\/opportunities\/([^/]+)\/proposals$/,
        );
        if (opportunityProposalMatch && request.method === "POST") {
          if (!hasPermission(currentUser, "opportunities.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para adicionar propostas.",
            });
          const opportunity = opportunities.get(opportunityProposalMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          if (
            !opportunity ||
            !pipeline ||
            !canAccessPipeline(currentUser, pipeline)
          )
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          const input = await body(request),
            title = String(input.title || "").trim(),
            value = Number(
              String(input.value || "0")
                .replace(/\./g, "")
                .replace(",", "."),
            );
          if (title.length < 2 || !Number.isFinite(value) || value < 0)
            return json(response, 400, {
              message: "Informe título e valor válidos para a proposta.",
            });
          const now = new Date().toISOString(),
            proposal: CrmProposal = {
              id: randomUUID(),
              title,
              value,
              status: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"].includes(
                input.status,
              )
                ? input.status
                : "DRAFT",
              validUntil: String(input.validUntil || ""),
              notes: String(input.notes || "").trim(),
              createdBy: currentUser.id,
              createdAt: now,
            };
          opportunity.proposals.push(proposal);
          opportunity.activities.push({
            id: randomUUID(),
            type: "PROPOSAL",
            description: `Proposta adicionada: ${title} — R$ ${value.toFixed(2)}`,
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: now,
            metadata: { proposalId: proposal.id, status: proposal.status },
          });
          opportunity.updatedAt = now;
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 201, { proposal, opportunity });
        }
        const opportunityMatch = url.match(/^\/crm\/opportunities\/([^/]+)$/);
        if (opportunityMatch && request.method === "GET") {
          if (!hasPermission(currentUser, "opportunities.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao CRM.",
            });
          const opportunity = opportunities.get(opportunityMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          return opportunity &&
            pipeline &&
            canAccessPipeline(currentUser, pipeline)
            ? json(response, 200, { opportunity })
            : json(response, 404, { message: "Oportunidade não encontrada." });
        }
        if (opportunityMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "opportunities.edit"))
            return json(response, 403, {
              message: "Você não possui permissão para editar oportunidades.",
            });
          const opportunity = opportunities.get(opportunityMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          if (
            !opportunity ||
            !pipeline ||
            !canAccessPipeline(currentUser, pipeline)
          )
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          if (opportunity.status === "CONVERTED")
            return json(response, 409, {
              message:
                "Dados comerciais de uma oportunidade convertida não podem ser alterados.",
            });
          const input = await body(request),
            name = String(input.name || "").trim(),
            responsible = users.get(String(input.responsibleId || ""));
          if (name.length < 2 || name.length > 120)
            return json(response, 400, {
              message: "Informe um nome de lead válido.",
            });
          const before = {
            name: opportunity.name,
            company: opportunity.company,
            responsibleName: opportunity.responsibleName,
            potentialValue: String(opportunity.potentialValue),
          };
          const companyRecord = crmCompanies.get(String(input.companyId || "")),
            contactIds = Array.isArray(input.contactIds)
              ? input.contactIds.map(String).filter((id) => crmContacts.has(id))
              : opportunity.contactIds || [];
          Object.assign(opportunity, {
            name,
            company: companyRecord?.name || String(input.company || "").trim(),
            companyId: companyRecord?.id || "",
            contactIds,
            email: String(input.email || "")
              .trim()
              .toLowerCase(),
            phone: String(input.phone || "").trim(),
            whatsapp: String(input.whatsapp || input.phone || "").trim(),
            serviceInterest: String(input.serviceInterest || "").trim(),
            potentialValue:
              Number(
                String(input.potentialValue || "0")
                  .replace(/\./g, "")
                  .replace(",", "."),
              ) || 0,
            temperature: ["COLD", "WARM", "HOT"].includes(input.temperature)
              ? input.temperature
              : opportunity.temperature,
            priority: ["LOW", "MEDIUM", "HIGH"].includes(input.priority)
              ? input.priority
              : opportunity.priority,
            responsibleId: responsible?.id || "",
            responsibleName: responsible?.name || "",
            teamIds: Array.isArray(input.teamIds)
              ? input.teamIds.map(String).filter((id) => users.has(id))
              : opportunity.teamIds,
            tags: Array.isArray(input.tags)
              ? input.tags.map(String)
              : String(input.tags || "")
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
            nextAction: String(input.nextAction || "").trim(),
            nextActionAt: String(input.nextActionAt || ""),
            updatedAt: new Date().toISOString(),
          });
          crmContacts.forEach((contact) => {
            contact.opportunityIds = contactIds.includes(contact.id)
              ? [...new Set([...contact.opportunityIds, opportunity.id])]
              : contact.opportunityIds.filter((id) => id !== opportunity.id);
          });
          persistCrmContacts();
          opportunity.activities.push({
            id: randomUUID(),
            type: "UPDATED",
            description: "Dados da oportunidade atualizados",
            actorId: currentUser.id,
            actorName: currentUser.name,
            createdAt: opportunity.updatedAt,
            metadata: before,
          });
          opportunities.set(opportunity.id, opportunity);
          persistOpportunities();
          return json(response, 200, { opportunity });
        }
        if (opportunityMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "opportunities.delete"))
            return json(response, 403, {
              message: "Você não possui permissão para excluir oportunidades.",
            });
          const opportunity = opportunities.get(opportunityMatch[1]),
            pipeline = opportunity && pipelines.get(opportunity.pipelineId);
          if (
            !opportunity ||
            !pipeline ||
            !canAccessPipeline(currentUser, pipeline)
          )
            return json(response, 404, {
              message: "Oportunidade não encontrada.",
            });
          if (
            opportunity.convertedClientId ||
            opportunity.status === "CONVERTED"
          )
            return json(response, 409, {
              message:
                "Uma oportunidade convertida não pode ser excluída. O histórico comercial deve ser preservado.",
            });
          opportunities.delete(opportunity.id);
          persistOpportunities();
          return json(response, 200, { ok: true });
        }
        if (currentUser.profile === "CLIENT" && url.startsWith("/integrations"))
          return json(response, 403, {
            message: "Clientes externos não acessam a Central de Conexões.",
          });
        if (url === "/media/meta/token" && request.method === "GET") {
          let updatedAt: string | null = null;
          if (existsSync(localMetaTokenPath)) {
            try {
              updatedAt =
                JSON.parse(readFileSync(localMetaTokenPath, "utf8"))
                  .updatedAt || null;
            } catch {}
          }
          return json(response, 200, {
            configured: !!runtimeMetaAccessToken,
            storedInSystem: existsSync(localMetaTokenPath),
            updatedAt,
            canManage: currentUser.profile === "MASTER",
          });
        }
        if (url === "/media/meta/token" && request.method === "PATCH") {
          if (currentUser.profile !== "MASTER")
            return json(response, 403, {
              message: "Somente o Master pode configurar o token da Meta.",
            });
          const input = await body(request),
            token = String(input.token || "").trim();
          if (token.length < 80)
            return json(response, 400, {
              message: "Cole um token válido da Meta.",
            });
          try {
            const checkUrl = new URL(
              `https://graph.facebook.com/${metaGraphVersion}/me`,
            );
            checkUrl.searchParams.set("fields", "id,name");
            checkUrl.searchParams.set("access_token", token);
            const check = await fetch(checkUrl),
              payload = (await check.json()) as {
                error?: { message?: string };
              };
            if (!check.ok || payload.error)
              return json(response, 400, {
                message: payload.error?.message || "A Meta recusou este token.",
              });
            const encrypted = encryptIntegrationToken(token);
            writeFileSync(
              localMetaTokenPath,
              JSON.stringify(encrypted, null, 2),
              { mode: 0o600 },
            );
            runtimeMetaAccessToken = token;
            return json(response, 200, {
              configured: true,
              storedInSystem: true,
              updatedAt: encrypted.updatedAt,
              canManage: true,
              message: "API validada e conectada com segurança.",
            });
          } catch {
            return json(response, 502, {
              message: "Não foi possível validar o token com a Meta.",
            });
          }
        }
        if (url === "/media/meta/token" && request.method === "DELETE") {
          if (currentUser.profile !== "MASTER")
            return json(response, 403, {
              message: "Somente o Master pode revogar o token da Meta.",
            });
          runtimeMetaAccessToken = "";
          if (existsSync(localMetaTokenPath)) unlinkSync(localMetaTokenPath);
          return json(response, 200, {
            configured: false,
            storedInSystem: false,
            updatedAt: null,
            canManage: true,
            message:
              "Token anterior revogado do PW OS. Agora você pode cadastrar um novo token.",
          });
        }
        if (url === "/media/google/token" && request.method === "GET") {
          let updatedAt: string | null = null;
          if (existsSync(localGoogleDeveloperTokenPath)) {
            try {
              updatedAt =
                JSON.parse(readFileSync(localGoogleDeveloperTokenPath, "utf8"))
                  .updatedAt || null;
            } catch {}
          }
          return json(response, 200, {
            configured:
              !!runtimeGoogleRefreshToken && !!runtimeGoogleDeveloperToken,
            storedInSystem: existsSync(localGoogleDeveloperTokenPath),
            refreshTokenConfigured: !!runtimeGoogleRefreshToken,
            developerTokenConfigured: !!runtimeGoogleDeveloperToken,
            oauthClientConfigured:
              !!runtimeGoogleClientId && !!runtimeGoogleClientSecret,
            updatedAt,
            canManage: currentUser.profile === "MASTER",
          });
        }
        if (url === "/media/google/token" && request.method === "PATCH") {
          if (currentUser.profile !== "MASTER")
            return json(response, 403, {
              message:
                "Somente o Master pode configurar a chave da API do Google Ads.",
            });
          const input = await body(request),
            token = String(input.token || "").trim();
          if (token.length < 10 || token.length > 512 || /\s/.test(token))
            return json(response, 400, {
              message:
                "Cole uma chave da API (developer token) válida, sem espaços.",
            });
          try {
            const encrypted = encryptIntegrationToken(token);
            writeFileSync(
              localGoogleDeveloperTokenPath,
              JSON.stringify(encrypted, null, 2),
              { mode: 0o600 },
            );
            runtimeGoogleDeveloperToken = token;
            return json(response, 200, {
              configured: true,
              storedInSystem: true,
              refreshTokenConfigured: !!runtimeGoogleRefreshToken,
              developerTokenConfigured: true,
              oauthClientConfigured:
                !!runtimeGoogleClientId && !!runtimeGoogleClientSecret,
              updatedAt: encrypted.updatedAt,
              canManage: true,
              message:
                "Chave da API do Google Ads salva e ativada com segurança.",
            });
          } catch {
            return json(response, 500, {
              message:
                "Não foi possível proteger e salvar a chave da API do Google Ads.",
            });
          }
        }
        if (url === "/media/google/token" && request.method === "DELETE") {
          if (currentUser.profile !== "MASTER")
            return json(response, 403, {
              message:
                "Somente o Master pode revogar a chave da API do Google Ads.",
            });
          runtimeGoogleDeveloperToken = googleDeveloperToken;
          if (existsSync(localGoogleDeveloperTokenPath))
            unlinkSync(localGoogleDeveloperTokenPath);
          return json(response, 200, {
            configured: false,
            storedInSystem: false,
            refreshTokenConfigured: !!runtimeGoogleRefreshToken,
            developerTokenConfigured: !!googleDeveloperToken,
            oauthClientConfigured:
              !!runtimeGoogleClientId && !!runtimeGoogleClientSecret,
            updatedAt: null,
            canManage: true,
            message:
              "Chave da API anterior revogada. Agora você pode cadastrar uma nova.",
          });
        }
        if (url === "/content/meta/accounts" && request.method === "GET") {
          if (!hasPermission(currentUser, "tasks.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao conteúdo.",
            });
          if (!runtimeMetaAccessToken)
            return json(response, 503, {
              message: "Configure o token da Meta na Central de Conexões.",
            });
          try {
            const graphUrl = new URL(
              `https://graph.facebook.com/${metaGraphVersion}/me/accounts`,
            );
            graphUrl.searchParams.set(
              "fields",
              "id,name,picture.type(square){url},instagram_business_account{id,username,profile_picture_url}",
            );
            graphUrl.searchParams.set("limit", "100");
            graphUrl.searchParams.set("access_token", runtimeMetaAccessToken);
            const result = await fetch(graphUrl),
              payload = (await result.json()) as {
                data?: Array<{
                  id: string;
                  name: string;
                  picture?: { data?: { url?: string } };
                  instagram_business_account?: {
                    id: string;
                    username?: string;
                    profile_picture_url?: string;
                  };
                }>;
                error?: { message?: string };
              };
            if (!result.ok || payload.error)
              return json(response, 400, {
                message:
                  payload.error?.message ||
                  "A Meta recusou a consulta de conteúdo.",
              });
            return json(response, 200, {
              accounts: (payload.data || [])
                .filter((page) => page.instagram_business_account)
                .map((page) => ({
                  pageId: page.id,
                  pageName: page.name,
                  pagePicture: page.picture?.data?.url || null,
                  id: page.instagram_business_account!.id,
                  username:
                    page.instagram_business_account!.username || page.name,
                  profilePictureUrl:
                    page.instagram_business_account!.profile_picture_url ||
                    page.picture?.data?.url ||
                    null,
                })),
            });
          } catch {
            return json(response, 502, {
              message:
                "Não foi possível consultar as contas de conteúdo na Meta.",
            });
          }
        }
        const contentMediaMatch = url.match(
          /^\/content\/meta\/accounts\/([^/]+)\/media$/,
        );
        if (contentMediaMatch && request.method === "GET") {
          if (!hasPermission(currentUser, "tasks.view"))
            return json(response, 403, {
              message: "Você não possui acesso ao conteúdo.",
            });
          if (!runtimeMetaAccessToken)
            return json(response, 503, {
              message: "Configure o token da Meta na Central de Conexões.",
            });
          try {
            const graphUrl = new URL(
              `https://graph.facebook.com/${metaGraphVersion}/${encodeURIComponent(contentMediaMatch[1])}/media`,
            );
            graphUrl.searchParams.set(
              "fields",
              "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
            );
            graphUrl.searchParams.set("limit", "50");
            graphUrl.searchParams.set("access_token", runtimeMetaAccessToken);
            const result = await fetch(graphUrl),
              payload = (await result.json()) as {
                data?: unknown[];
                error?: { message?: string };
              };
            if (!result.ok || payload.error)
              return json(response, 400, {
                message:
                  payload.error?.message ||
                  "A Meta recusou a leitura das publicações.",
              });
            return json(response, 200, {
              media: payload.data || [],
              syncedAt: new Date().toISOString(),
            });
          } catch {
            return json(response, 502, {
              message: "Não foi possível ler as publicações da Meta.",
            });
          }
        }
        if (url === "/notifications" && request.method === "GET") {
          const alerts: OperationalAlert[] = [];
          if (existsSync(localMetaDashboardCachePath))
            try {
              const cached = JSON.parse(
                readFileSync(localMetaDashboardCachePath, "utf8"),
              ) as {
                cachedAt?: string;
                payload?: {
                  accounts?: Array<{
                    id: string;
                    name: string;
                    pageName?: string | null;
                  }>;
                  campaigns?: Array<{
                    id: string;
                    accountId: string;
                    name: string;
                    status: string;
                    spend: number;
                    dailyBudget: number;
                    leads: number;
                    conversations: number;
                    frequency: number;
                    reach: number;
                    impressions: number;
                  }>;
                };
              };
              const createdAt = cached.cachedAt || new Date().toISOString(),
                isMaster = currentUser.profile === "MASTER";
              const pushAlert = (
                input: Omit<
                  OperationalAlert,
                  "createdAt" | "read" | "responsibleName" | "clientName"
                >,
              ) => {
                const assignment = mediaAssignments.get(
                    `META_ADS:${input.accountId}`,
                  ),
                  responsible = users.get(assignment?.responsibleId || ""),
                  client = clients.get(assignment?.clientId || ""),
                  account = cached.payload?.accounts?.find(
                    (item) => item.id === input.accountId,
                  );
                // The bell is reserved for actionable work with a clear owner.
                // Unassigned accounts remain visible in Media management instead.
                if (!assignment?.responsibleId) return;
                if (!isMaster && assignment?.responsibleId !== currentUser.id)
                  return;
                const readKey = `${currentUser.id}:${input.id}`;
                alerts.push({
                  ...input,
                  createdAt,
                  read: notificationReads.has(readKey),
                  responsibleId: assignment?.responsibleId || "",
                  responsibleName: responsible?.name || "Não atribuído",
                  clientName:
                    client?.name ||
                    account?.pageName ||
                    account?.name ||
                    "Conta Meta",
                });
              };
              const issueAccounts = new Set<string>(),
                noResultAccounts = new Set<string>(),
                campaigns = [...(cached.payload?.campaigns || [])].sort(
                  (a, b) => Number(b.spend || 0) - Number(a.spend || 0),
                );
              for (const campaign of campaigns) {
                if (
                  campaign.status === "WITH_ISSUES" &&
                  !issueAccounts.has(campaign.accountId)
                ) {
                  issueAccounts.add(campaign.accountId);
                  pushAlert({
                    id: `media:${campaign.accountId}:issues`,
                    type: "CAMPAIGN_ISSUE",
                    severity: "CRITICAL",
                    title: "Campanha com problema",
                    message:
                      "A Meta identificou um problema que pode interromper ou limitar a veiculação.",
                    accountId: campaign.accountId,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    responsibleId: "",
                  });
                }
                if (
                  campaign.status === "ACTIVE" &&
                  campaign.spend >=
                    Math.max((campaign.dailyBudget || 0) * 2, 200) &&
                  campaign.leads + campaign.conversations === 0 &&
                  !noResultAccounts.has(campaign.accountId)
                ) {
                  noResultAccounts.add(campaign.accountId);
                  pushAlert({
                    id: `media:${campaign.accountId}:no-results`,
                    type: "SPEND_WITHOUT_RESULTS",
                    severity: "CRITICAL",
                    title: "Investimento sem resultado",
                    message: `A campanha investiu R$ ${campaign.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} sem registrar leads ou conversas.`,
                    accountId: campaign.accountId,
                    campaignId: campaign.id,
                    campaignName: campaign.name,
                    responsibleId: "",
                  });
                }
              }
            } catch {
              /* cache inválido não impede o restante do sistema */
            }
          for (const task of workTasks.values()) {
            if (task.archivedAt || !task.approvalHistory?.length) continue;
            const latest = task.approvalHistory.at(-1)!;
            const isSubmission = latest.action === "SUBMITTED";
            const isDecision = !isSubmission;
            const shouldNotifyReviewer =
              isSubmission &&
              latest.actorId !== currentUser.id &&
              hasPermission(currentUser, "tasks.review");
            const shouldNotifyCreator =
              isDecision &&
              latest.actorId !== currentUser.id &&
              task.responsibleId === currentUser.id;
            if (!shouldNotifyReviewer && !shouldNotifyCreator) continue;
            const readKey = `${currentUser.id}:task-review:${latest.id}`,
              client = clients.get(task.clientId),
              decisionLabel =
                latest.action === "APPROVED"
                  ? "Demanda aprovada"
                  : latest.action === "CHANGES_REQUESTED"
                    ? "Ajustes solicitados"
                    : latest.action === "REJECTED"
                      ? "Demanda recusada"
                      : "Nova revisão pendente";
            alerts.push({
              id: `task-review:${latest.id}`,
              type: `TASK_REVIEW_${latest.action}`,
              severity:
                latest.action === "REJECTED"
                  ? "CRITICAL"
                  : latest.action === "CHANGES_REQUESTED"
                    ? "WARNING"
                    : "INFO",
              title: decisionLabel,
              message:
                latest.comment ||
                (isSubmission
                  ? "A demanda está pronta para sua revisão."
                  : "Abra a demanda para consultar a decisão."),
              accountId: task.id,
              campaignName: task.title,
              clientName: client?.name || "Creative Ops",
              responsibleId: task.responsibleId,
              responsibleName: task.responsibleName,
              createdAt: latest.createdAt,
              read: notificationReads.has(readKey),
              targetUrl: `/tarefas?task=${encodeURIComponent(task.id)}`,
            });
          }
          const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
          alerts.sort(
            (a, b) =>
              Number(a.read) - Number(b.read) ||
              severityOrder[a.severity] - severityOrder[b.severity] ||
              b.createdAt.localeCompare(a.createdAt),
          );
          const unreadAlerts = alerts.filter((item) => !item.read);
          return json(response, 200, {
            notifications: unreadAlerts.slice(0, 20),
            unreadCount: unreadAlerts.length,
          });
        }
        if (url === "/notifications/read" && request.method === "POST") {
          const input = await body(request),
            alertId = String(input.alertId || "");
          if (!alertId)
            return json(response, 400, { message: "Alerta inválido." });
          notificationReads.set(
            `${currentUser.id}:${alertId}`,
            new Date().toISOString(),
          );
          persistNotificationReads();
          return json(response, 200, { ok: true });
        }
        if (url === "/notifications/read-all" && request.method === "POST") {
          const input = await body(request),
            ids = Array.isArray(input.alertIds)
              ? input.alertIds.map(String)
              : [];
          ids.forEach((id) =>
            notificationReads.set(
              `${currentUser.id}:${id}`,
              new Date().toISOString(),
            ),
          );
          persistNotificationReads();
          return json(response, 200, { ok: true });
        }
        if (url === "/media/assignments" && request.method === "GET") {
          if (!hasPermission(currentUser, "media.view"))
            return json(response, 403, {
              message: "Você não possui acesso aos vínculos de mídia.",
            });
          return json(response, 200, {
            assignments: [...mediaAssignments.values()],
          });
        }
        const mediaAssignmentMatch = url.match(
          /^\/media\/accounts\/([^/]+)\/assignment$/,
        );
        if (mediaAssignmentMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "media.edit"))
            return json(response, 403, {
              message:
                "Você não possui permissão para editar vínculos de mídia.",
            });
          const input = await body(request),
            accountId = decodeURIComponent(mediaAssignmentMatch[1]),
            platform =
              input.platform === "GOOGLE_ADS" ? "GOOGLE_ADS" : "META_ADS",
            clientId = String(input.clientId || ""),
            responsibleId = String(input.responsibleId || "");
          if (clientId && !clients.has(clientId))
            return json(response, 400, {
              message: "Selecione um cliente válido.",
            });
          if (responsibleId && !users.has(responsibleId))
            return json(response, 400, {
              message: "Selecione um responsável válido.",
            });
          const identitySource: MediaAssignment["identitySource"] =
            input.identitySource === "META_PORTFOLIO"
              ? "META_PORTFOLIO"
              : clientId
                ? "CLIENT"
                : "UNLINKED";
          const assignment: MediaAssignment = {
            accountId,
            platform,
            clientId,
            responsibleId,
            identitySource,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.id,
          };
          mediaAssignments.set(`${platform}:${accountId}`, assignment);
          persistMediaAssignments();
          return json(response, 200, { assignment });
        }
        const metaPictureMatch = url.match(
          /^\/media\/meta\/accounts\/([^/]+)\/picture(?:\?.*)?$/,
        );
        if (metaPictureMatch && request.method === "GET") {
          if (!hasPermission(currentUser, "media.view")) {
            response.statusCode = 403;
            return response.end();
          }
          const pictureUrl = metaAccountPictures.get(
            decodeURIComponent(metaPictureMatch[1]),
          );
          if (!pictureUrl) {
            response.statusCode = 404;
            return response.end();
          }
          try {
            const pictureResponse = await fetch(pictureUrl, {
              headers: {
                Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
              },
            });
            if (!pictureResponse.ok) throw new Error("Imagem indisponível");
            const bytes = Buffer.from(await pictureResponse.arrayBuffer());
            response.statusCode = 200;
            response.setHeader(
              "Content-Type",
              pictureResponse.headers.get("content-type") || "image/jpeg",
            );
            response.setHeader("Cache-Control", "private, max-age=1800");
            response.setHeader("Content-Length", String(bytes.length));
            return response.end(bytes);
          } catch {
            response.statusCode = 404;
            return response.end();
          }
        }
        if (
          url.startsWith("/media/google/campaigns") &&
          request.method === "GET"
        ) {
          if (!hasPermission(currentUser, "media.view"))
            return json(response, 403, {
              message: "Você não possui acesso às campanhas.",
            });
          const missing = [
            !runtimeGoogleClientId && "OAuth Client ID",
            !runtimeGoogleClientSecret && "OAuth Client Secret",
            !runtimeGoogleRefreshToken && "Refresh token",
            !runtimeGoogleDeveloperToken && "Chave da API (developer token)",
          ].filter(Boolean);
          if (missing.length)
            return json(response, 503, {
              message: `Complete a conexão do Google Ads: ${missing.join(", ")}.`,
              missingCredentials: missing,
            });
          const requestUrl = new URL(request.url || "", "http://localhost"),
            today = new Date().toISOString().slice(0, 10),
            defaultSince = new Date(Date.now() - 6 * 86400000)
              .toISOString()
              .slice(0, 10),
            since = /^\d{4}-\d{2}-\d{2}$/.test(
              requestUrl.searchParams.get("since") || "",
            )
              ? requestUrl.searchParams.get("since")!
              : defaultSince,
            until = /^\d{4}-\d{2}-\d{2}$/.test(
              requestUrl.searchParams.get("until") || "",
            )
              ? requestUrl.searchParams.get("until")!
              : today;
          try {
            const oauthResponse = await fetch(
              "https://www.googleapis.com/oauth2/v3/token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  client_id: runtimeGoogleClientId,
                  client_secret: runtimeGoogleClientSecret,
                  refresh_token: runtimeGoogleRefreshToken,
                }),
              },
            );
            const oauth = (await oauthResponse.json()) as {
              access_token?: string;
              error_description?: string;
            };
            if (!oauthResponse.ok || !oauth.access_token)
              throw new Error(
                oauth.error_description ||
                  "O Google recusou a renovação do acesso OAuth.",
              );
            const googleHeaders = (loginCustomerId?: string) => ({
              Authorization: `Bearer ${oauth.access_token}`,
              "developer-token": runtimeGoogleDeveloperToken,
              "Content-Type": "application/json",
              ...(loginCustomerId
                ? { "login-customer-id": loginCustomerId }
                : {}),
            });
            const googleError = async (result: Response) => {
              const payload = (await result.json().catch(() => ({}))) as {
                error?: {
                  message?: string;
                  details?: { errors?: { message?: string }[] }[];
                };
              };
              return (
                payload.error?.details?.flatMap(
                  (detail) => detail.errors || [],
                )[0]?.message ||
                payload.error?.message ||
                "O Google Ads recusou a consulta."
              );
            };
            const accessibleResponse = await fetch(
              "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers",
              { headers: googleHeaders() },
            );
            if (!accessibleResponse.ok)
              throw new Error(await googleError(accessibleResponse));
            const accessible = (await accessibleResponse.json()) as {
              resourceNames?: string[];
            };
            const roots = (accessible.resourceNames || []).map((value) =>
              value.replace("customers/", ""),
            );
            type GoogleAccount = {
              id: string;
              name: string;
              currency: string;
              loginCustomerId: string;
              manager: boolean;
            };
            const accountMap = new Map<string, GoogleAccount>();
            const search = async (
              customerId: string,
              loginId: string,
              query: string,
            ) => {
              const result = await fetch(
                `https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:searchStream`,
                {
                  method: "POST",
                  headers: googleHeaders(loginId),
                  body: JSON.stringify({ query }),
                },
              );
              if (!result.ok) throw new Error(await googleError(result));
              const pages = (await result.json()) as {
                results?: Record<string, any>[];
              }[];
              return pages.flatMap((page) => page.results || []);
            };
            for (const rootId of roots) {
              try {
                const hierarchy = await search(
                  rootId,
                  rootId,
                  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status != 'CANCELED'",
                );
                hierarchy.forEach((row) => {
                  const item = row.customerClient || {},
                    id = String(item.id || "");
                  if (id)
                    accountMap.set(id, {
                      id,
                      name: item.descriptiveName || `Conta Google ${id}`,
                      currency: item.currencyCode || "BRL",
                      loginCustomerId: rootId,
                      manager: !!item.manager,
                    });
                });
              } catch {
                accountMap.set(rootId, {
                  id: rootId,
                  name: `Conta Google ${rootId}`,
                  currency: "BRL",
                  loginCustomerId: rootId,
                  manager: false,
                });
              }
            }
            const accounts = [...accountMap.values()].filter(
                (item) => !item.manager,
              ),
              campaigns: Record<string, any>[] = [];
            for (const account of accounts) {
              const rows = await search(
                account.id,
                account.loginCustomerId,
                `SELECT customer.id, customer.descriptive_name, customer.currency_code, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, campaign_budget.period, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.average_cpc FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`,
              );
              rows.forEach((row) => {
                const campaign = row.campaign || {},
                  metrics = row.metrics || {},
                  budget = row.campaignBudget || {},
                  spend = Number(metrics.costMicros || 0) / 1_000_000,
                  conversions = Number(metrics.conversions || 0);
                campaigns.push({
                  id: String(campaign.id || ""),
                  accountId: `google_${account.id}`,
                  client: row.customer?.descriptiveName || account.name,
                  currency: row.customer?.currencyCode || account.currency,
                  name: campaign.name || `Campanha ${campaign.id}`,
                  objective: campaign.advertisingChannelType || "GOOGLE_ADS",
                  status:
                    campaign.status === "ENABLED"
                      ? "ACTIVE"
                      : campaign.status === "REMOVED"
                        ? "DELETED"
                        : campaign.status || "PAUSED",
                  dailyBudget:
                    budget.period === "DAILY"
                      ? Number(budget.amountMicros || 0) / 1_000_000
                      : 0,
                  lifetimeBudget: 0,
                  spend,
                  reach: 0,
                  impressions: Number(metrics.impressions || 0),
                  clicks: Number(metrics.clicks || 0),
                  leads: conversions,
                  conversations: 0,
                  cpl: conversions ? spend / conversions : null,
                  frequency: 0,
                });
              });
            }
            const googlePayload = {
              schemaVersion: 5,
              since,
              until,
              syncedAt: new Date().toISOString(),
              accounts: accounts.map((account) => ({
                id: `google_${account.id}`,
                name: account.name,
                businessPortfolioId: null,
                pageName: account.name,
                profilePictureUrl: null,
                currency: account.currency,
                amountSpent: campaigns
                  .filter(
                    (campaign) => campaign.accountId === `google_${account.id}`,
                  )
                  .reduce((sum, campaign) => sum + campaign.spend, 0),
                spendCap: 0,
              })),
              campaigns,
            };
            mkdirSync("data", { recursive: true });
            writeFileSync(localGoogleDashboardCachePath, JSON.stringify(googlePayload, null, 2), { mode: 0o600 });
            return json(response, 200, googlePayload);
          } catch (cause) {
            return json(response, 502, {
              message:
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível consultar o Google Ads.",
            });
          }
        }
        if (
          url.startsWith("/media/meta/campaigns") &&
          request.method === "GET"
        ) {
          const backgroundSync =
            request.headers["x-pw-meta-background"] === metaInternalSyncToken;
          if (!backgroundSync && !hasPermission(currentUser, "media.view"))
            return json(response, 403, {
              message: "Você não possui acesso às campanhas.",
            });
          if (!runtimeMetaAccessToken)
            return json(response, 503, {
              message: "Configure o token da Meta na Central de Conexões.",
            });
          const requestUrl = new URL(request.url || "", "http://localhost");
          const today = new Date().toISOString().slice(0, 10);
          const defaultSince = new Date(Date.now() - 6 * 86400000)
            .toISOString()
            .slice(0, 10);
          const since = /^\d{4}-\d{2}-\d{2}$/.test(
            requestUrl.searchParams.get("since") || "",
          )
            ? requestUrl.searchParams.get("since")!
            : defaultSince;
          const until = /^\d{4}-\d{2}-\d{2}$/.test(
            requestUrl.searchParams.get("until") || "",
          )
            ? requestUrl.searchParams.get("until")!
            : today;
          const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
          if (!forceRefresh && existsSync(localMetaDashboardCachePath))
            try {
              const cached = JSON.parse(
                readFileSync(localMetaDashboardCachePath, "utf8"),
              ) as {
                schemaVersion?: number;
                since: string;
                until: string;
                cachedAt: string;
                payload: Record<string, unknown>;
                pictures?: Record<string, string>;
              };
              if (
                cached.schemaVersion === 6 &&
                cached.since === since &&
                cached.until === until &&
                Date.now() - new Date(cached.cachedAt).getTime() <
                  10 * 60 * 1000
              ) {
                Object.entries(cached.pictures || {}).forEach(([id, picture]) =>
                  metaAccountPictures.set(id, picture),
                );
                return json(response, 200, {
                  ...cached.payload,
                  cache: {
                    status: "fresh",
                    cachedAt: cached.cachedAt,
                    nextSyncAt: new Date(
                      new Date(cached.cachedAt).getTime() + 10 * 60 * 1000,
                    ).toISOString(),
                  },
                });
              }
            } catch {}
          const graph = async <T>(path: string) => {
            const separator = path.includes("?") ? "&" : "?";
            const result = await fetch(
              path.startsWith("http")
                ? path
                : `https://graph.facebook.com/${metaGraphVersion}/${path}${separator}access_token=${encodeURIComponent(runtimeMetaAccessToken)}`,
            );
            const payload = (await result.json()) as T & {
              error?: { message?: string; code?: number };
            };
            if (!result.ok || payload.error)
              throw new Error(
                payload.error?.message ||
                  "A Meta recusou a consulta de campanhas.",
              );
            return payload;
          };
          try {
            const listAll = async <T>(path: string) => {
              const rows: T[] = [];
              let next: string | undefined = path;
              while (next) {
                const page: { data?: T[]; paging?: { next?: string } } =
                  await graph<{ data?: T[]; paging?: { next?: string } }>(next);
                rows.push(...(page.data || []));
                next = page.paging?.next;
              }
              return rows;
            };
            const accountRefs = await listAll<{ id: string }>(
              "me/adaccounts?fields=id&limit=100",
            );
            type MetaPagePicture = {
              id: string;
              name?: string;
              picture?: { data?: { url?: string } };
              instagram_business_account?: {
                id: string;
                username?: string;
                profile_picture_url?: string;
              };
            };
            type MetaBusinessPortfolio = {
              id: string;
              name?: string;
              profile_picture_uri?: string;
              owned_ad_accounts?: { data?: Array<{ id: string }> };
              client_ad_accounts?: { data?: Array<{ id: string }> };
            };
            const managedPages = await listAll<MetaPagePicture>(
              "me/accounts?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}&limit=100",
            ).catch(() => []);
            const businessPortfolios = await listAll<MetaBusinessPortfolio>(
              "me/businesses?fields=id,name,profile_picture_uri,owned_ad_accounts.limit(500){id},client_ad_accounts.limit(500){id}&limit=100",
            ).catch(() => []);
            const portfolioByAccount = new Map<string, MetaBusinessPortfolio>();
            businessPortfolios.forEach((portfolio) =>
              [
                ...(portfolio.owned_ad_accounts?.data || []),
                ...(portfolio.client_ad_accounts?.data || []),
              ].forEach((account) => {
                portfolioByAccount.set(account.id, portfolio);
                portfolioByAccount.set(
                  account.id.replace(/^act_/, ""),
                  portfolio,
                );
              }),
            );
            const normalizeMetaName = (value: string | undefined) =>
              (value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase();
            const accounts: MetaAccountPayload[] = [];
            const accountCampaigns = new Map<string, MetaCampaignPayload[]>();
            const accountInsights = new Map<string, Map<string, MetaInsight>>();
            for (const item of accountRefs) {
              const accountDetail = await graph<MetaAccountPayload>(
                `${item.id}?fields=id,name,currency,amount_spent,spend_cap`,
              );
              const portfolio =
                portfolioByAccount.get(accountDetail.id) ||
                portfolioByAccount.get(accountDetail.id.replace(/^act_/, ""));
              try {
                const identity = await graph<{
                  business_name?: string;
                  owner_business?: {
                    id: string;
                    name?: string;
                    profile_picture_uri?: string;
                  };
                }>(
                  `${item.id}?fields=business_name,owner_business{id,name,profile_picture_uri}`,
                );
                accountDetail.business_name = identity.business_name;
                accountDetail.owner_business = identity.owner_business;
              } catch {
                /* identidade complementar opcional */
              }
              try {
                const businessResult = await graph<{
                  business?: {
                    id: string;
                    name?: string;
                    profile_picture_uri?: string;
                  };
                }>(`${item.id}?fields=business{id,name,profile_picture_uri}`);
                accountDetail.business = businessResult.business;
              } catch {
                /* business_management é opcional; página e Instagram continuam como fallback */
              }
              const campaignRows = await listAll<MetaCampaignPayload>(
                `${item.id}/campaigns?fields=id,name,objective,effective_status,daily_budget,lifetime_budget&limit=500`,
              );
              const adSetRows = await listAll<{
                promoted_object?: {
                  page_id?: string;
                  instagram_actor_id?: string;
                };
              }>(`${item.id}/adsets?fields=promoted_object&limit=500`);
              const adRows = await listAll<{
                creative?: {
                  effective_object_story_id?: string;
                  object_story_id?: string;
                  instagram_actor_id?: string;
                  thumbnail_url?: string;
                  object_story_spec?: {
                    page_id?: string;
                    instagram_actor_id?: string;
                  };
                };
              }>(
                `${item.id}/ads?fields=creative{effective_object_story_id,object_story_id,instagram_actor_id,thumbnail_url,object_story_spec}&limit=500`,
              ).catch(() => []);
              const pageFrequency = new Map<string, number>();
              adSetRows.forEach((adset) => {
                const pageId = adset.promoted_object?.page_id;
                if (pageId)
                  pageFrequency.set(
                    pageId,
                    (pageFrequency.get(pageId) || 0) + 1,
                  );
              });
              adRows.forEach((ad) => {
                const pageId =
                  ad.creative?.object_story_spec?.page_id ||
                  ad.creative?.object_story_id?.split("_")[0] ||
                  ad.creative?.effective_object_story_id?.split("_")[0];
                if (pageId)
                  pageFrequency.set(
                    pageId,
                    (pageFrequency.get(pageId) || 0) + 1,
                  );
              });
              const campaignPageId = [...pageFrequency.entries()].sort(
                (a, b) => b[1] - a[1],
              )[0]?.[0];
              const instagramFrequency = new Map<string, number>();
              adSetRows.forEach((adset) => {
                const instagramId = adset.promoted_object?.instagram_actor_id;
                if (instagramId)
                  instagramFrequency.set(
                    instagramId,
                    (instagramFrequency.get(instagramId) || 0) + 1,
                  );
              });
              adRows.forEach((ad) => {
                const instagramId =
                  ad.creative?.object_story_spec?.instagram_actor_id ||
                  ad.creative?.instagram_actor_id;
                if (instagramId)
                  instagramFrequency.set(
                    instagramId,
                    (instagramFrequency.get(instagramId) || 0) + 1,
                  );
              });
              const campaignInstagramId = [
                ...instagramFrequency.entries(),
              ].sort((a, b) => b[1] - a[1])[0]?.[0];
              let primaryInstagram:
                | {
                    id: string;
                    username?: string;
                    profile_picture_url?: string;
                  }
                | undefined;
              if (campaignInstagramId)
                try {
                  primaryInstagram = await graph<{
                    id: string;
                    username?: string;
                    profile_picture_url?: string;
                  }>(
                    `${campaignInstagramId}?fields=id,username,profile_picture_url`,
                  );
                } catch {
                  primaryInstagram = undefined;
                }
              let primaryPage: MetaPagePicture | undefined;
              if (campaignPageId)
                try {
                  primaryPage = await graph<MetaPagePicture>(
                    `${campaignPageId}?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}`,
                  );
                } catch {
                  primaryPage = undefined;
                }
              if (!primaryPage) {
                const promotedPages = await listAll<MetaPagePicture>(
                  `${item.id}/promote_pages?fields=id,name,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}&limit=25`,
                );
                const accountName = normalizeMetaName(accountDetail.name);
                primaryPage =
                  promotedPages.find((page) => {
                    const pageName = normalizeMetaName(page.name);
                    return (
                      pageName.length > 3 &&
                      (accountName.includes(pageName) ||
                        pageName.includes(accountName))
                    );
                  }) ||
                  promotedPages[0] ||
                  managedPages.find((page) => {
                    const pageName = normalizeMetaName(page.name);
                    return (
                      pageName.length > 3 &&
                      (accountName.includes(pageName) ||
                        pageName.includes(accountName))
                    );
                  });
              }
              const pictureUrl =
                accountDetail.business?.profile_picture_uri ||
                accountDetail.owner_business?.profile_picture_uri ||
                portfolio?.profile_picture_uri ||
                primaryInstagram?.profile_picture_url ||
                primaryPage?.instagram_business_account?.profile_picture_url ||
                primaryPage?.picture?.data?.url;
              if (pictureUrl)
                metaAccountPictures.set(accountDetail.id, pictureUrl);
              else metaAccountPictures.delete(accountDetail.id);
              accounts.push({
                ...accountDetail,
                businessPortfolioId:
                  accountDetail.business?.id ||
                  accountDetail.owner_business?.id ||
                  portfolio?.id,
                pageName:
                  accountDetail.business?.name ||
                  accountDetail.owner_business?.name ||
                  accountDetail.business_name ||
                  portfolio?.name ||
                  primaryPage?.name ||
                  (primaryInstagram?.username
                    ? `@${primaryInstagram.username}`
                    : undefined),
                profilePictureUrl: pictureUrl
                  ? `/api/media/meta/accounts/${encodeURIComponent(accountDetail.id)}/picture?v=${Date.now()}`
                  : undefined,
              });
              const insightRows = await listAll<MetaInsight>(
                `${item.id}/insights?fields=campaign_id,spend,reach,impressions,clicks,ctr,frequency,actions,cost_per_action_type&level=campaign&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&action_report_time=conversion&use_account_attribution_setting=true&limit=500`,
              );
              accountCampaigns.set(item.id, campaignRows);
              accountInsights.set(
                item.id,
                new Map(
                  insightRows
                    .filter((row) => row.campaign_id)
                    .map((row) => [row.campaign_id!, row]),
                ),
              );
            }
            const actionValue = (
              actions: MetaAction[] | undefined,
              names: string[],
            ) =>
              Number(
                actions?.find((action) =>
                  names.includes(action.action_type || ""),
                )?.value || 0,
              );
            const campaigns = accounts.flatMap((account) =>
              (accountCampaigns.get(account.id) || []).map((campaign) => {
                const insight =
                  accountInsights.get(account.id)?.get(campaign.id) || {};
                const leadResult = extractMetaLeads(insight.actions);
                const leads = leadResult.leads;
                const conversations = actionValue(insight.actions, [
                  "onsite_conversion.messaging_conversation_started_7d",
                  "messaging_conversation_started_7d",
                ]);
                const spend = Number(insight.spend || 0);
                if (process.env.PW_META_ACTION_DEBUG === "1" && spend > 0)
                  console.info("[Meta insights]", {
                    account: { id: account.id, name: account.name || account.id },
                    campaign: { id: campaign.id, name: campaign.name },
                    actions: insight.actions || [],
                    cost_per_action_type: insight.cost_per_action_type || [],
                    selectedLeadActionType: leadResult.actionType,
                    leads,
                    spend,
                    cpl: leads ? spend / leads : null,
                    warning: leads === 0 ? "Gasto sem action type de lead suportado" : undefined,
                  });
                return {
                  id: campaign.id,
                  accountId: account.id,
                  client: account.name || account.id,
                  currency: account.currency || "BRL",
                  name: campaign.name,
                  objective: campaign.objective || "OUTRO",
                  status: campaign.effective_status || "UNKNOWN",
                  dailyBudget: Number(campaign.daily_budget || 0) / 100,
                  lifetimeBudget: Number(campaign.lifetime_budget || 0) / 100,
                  spend,
                  reach: Number(insight.reach || 0),
                  impressions: Number(insight.impressions || 0),
                  clicks: Number(insight.clicks || 0),
                  leads,
                  conversations,
                  cpl: leads ? spend / leads : null,
                  frequency: Number(insight.frequency || 0),
                };
              }),
            );
            const syncedAt = new Date().toISOString(),
              payload = {
                schemaVersion: 6,
                since,
                until,
                syncedAt,
                accounts: accounts.map((account) => ({
                  id: account.id,
                  name: account.name || account.id,
                  businessPortfolioId: account.businessPortfolioId || null,
                  pageName: account.pageName || null,
                  profilePictureUrl: account.profilePictureUrl || null,
                  currency: account.currency || "BRL",
                  amountSpent: Number(account.amount_spent || 0) / 100,
                  spendCap: Number(account.spend_cap || 0) / 100,
                })),
                campaigns,
              };
            mkdirSync("data", { recursive: true });
            writeFileSync(
              localMetaDashboardCachePath,
              JSON.stringify(
                {
                  schemaVersion: 6,
                  since,
                  until,
                  cachedAt: syncedAt,
                  payload,
                  pictures: Object.fromEntries(metaAccountPictures),
                },
                null,
                2,
              ),
              { mode: 0o600 },
            );
            scheduleDatabaseMirror();
            return json(response, 200, {
              ...payload,
              cache: {
                status: "updated",
                cachedAt: syncedAt,
                nextSyncAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
              },
            });
          } catch (cause) {
            return json(response, 502, {
              message:
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível consultar a Meta Ads.",
            });
          }
        }
        if (url === "/permissions/catalog" && request.method === "GET") {
          if (!hasPermission(currentUser, "roles.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          return json(response, 200, { modules: permissionCatalog });
        }
        if (url === "/roles" && request.method === "GET") {
          if (!hasPermission(currentUser, "roles.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const canSeeDeveloperRole =
            currentUser.roleId === developerRole.id ||
            currentUser.roleId === ceoRole.id;
          return json(response, 200, {
            roles: [...roles.values()]
              .filter((role) => role.id !== developerRole.id || canSeeDeveloperRole)
              .map((role) => ({
              ...role,
              userCount: [...users.values()].filter(
                (user) => user.roleId === role.id,
              ).length,
              })),
          });
        }
        if (url === "/roles" && request.method === "POST") {
          if (!hasPermission(currentUser, "roles.create"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const input = await body(request);
          if (!input.name)
            return json(response, 400, { message: "Informe o nome do cargo." });
          const role: Role = {
            id: randomUUID(),
            name: input.name,
            description: input.description || "",
            level: Number(input.level || 10),
            system: false,
            permissions: sanitizePermissions(input.permissions),
          };
          roles.set(role.id, role);
          persistRoles();
          return json(response, 201, { role });
        }
        const roleMatch = url.match(/^\/roles\/([^/]+)$/);
        if (roleMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "roles.edit"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const role = roles.get(roleMatch[1]);
          if (!role || role.system)
            return json(response, 403, { message: "Cargo protegido." });
          const input = await body(request);
          role.name = input.name || role.name;
          role.description = input.description ?? role.description;
          role.level = Number(input.level || role.level);
          role.permissions = Array.isArray(input.permissions)
            ? sanitizePermissions(input.permissions)
            : role.permissions;
          roles.set(role.id, role);
          users.forEach((user) => {
            if (user.roleId === role.id) user.role = role.name;
          });
          persistRoles();
          persistUsers();
          return json(response, 200, { role });
        }
        if (roleMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "roles.delete"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const role = roles.get(roleMatch[1]);
          if (!role || role.system)
            return json(response, 403, { message: "Cargo protegido." });
          if ([...users.values()].some((user) => user.roleId === role.id))
            return json(response, 409, {
              message: "Reatribua os usuários antes de excluir este cargo.",
            });
          roles.delete(role.id);
          persistRoles();
          return json(response, 200, { ok: true });
        }
        if (url === "/users" && request.method === "GET") {
          if (!hasPermission(currentUser, "users.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          return json(response, 200, {
            users: [...users.values()].map(publicUser),
          });
        }
        if (url === "/users" && request.method === "POST") {
          if (!hasPermission(currentUser, "users.create"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const input = await body(request);
          if (!input.name || !input.email || !input.password)
            return json(response, 400, {
              message: "Preencha nome, e-mail e senha inicial.",
            });
          if (
            [...users.values()].some(
              (item) => item.email === input.email.toLowerCase(),
            )
          )
            return json(response, 409, { message: "E-mail já cadastrado." });
          const userSalt = randomBytes(16).toString("hex");
          if (input.profile === "CLIENT")
            return json(response, 400, {
              message:
                "Clientes externos devem ser cadastrados dentro do cliente correspondente.",
            });
          const selectedRole = input.roleId && roles.get(input.roleId);
          const selectedDepartment =
            input.departmentId && departments.get(String(input.departmentId));
          if (!selectedRole || selectedRole.assignable === false)
            return json(response, 400, {
              message: "Selecione um cargo válido para este usuário.",
            });
          if (input.departmentId && !selectedDepartment)
            return json(response, 400, {
              message: "Selecione um setor válido.",
            });
          const user: User = {
            id: randomUUID(),
            name: input.name,
            email: input.email.toLowerCase(),
            profile: input.profile || "COLLABORATOR",
            role: selectedRole.name,
            roleId: selectedRole.id,
            departmentId: selectedDepartment?.id,
            departmentName: selectedDepartment?.name,
            permissionOverrides: {},
            mustChangePassword: true,
            salt: userSalt,
            passwordHash: hash(input.password, userSalt),
          };
          users.set(user.id, user);
          if (selectedDepartment && input.departmentManager === true) {
            selectedDepartment.managerUserId = user.id;
            selectedDepartment.managerName = user.name;
            departments.set(selectedDepartment.id, selectedDepartment);
            persistDepartments();
          }
          persistUsers();
          return json(response, 201, { user: publicUser(user) });
        }
        const clientUserCollection = url.match(/^\/clients\/([^/]+)\/users$/);
        if (clientUserCollection && request.method === "GET") {
          if (!hasPermission(currentUser, "clients.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          return json(response, 200, {
            users: clientUsers(clientUserCollection[1]).map(publicUser),
            limit: 2,
          });
        }
        if (clientUserCollection && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.create_access"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const client = clients.get(clientUserCollection[1]);
          if (!client) return json(response, 404, { message: "Cliente não encontrado." });
          if (clientUsers(client.id).length >= 2)
            return json(response, 409, { message: "Este cliente já possui os 2 acessos permitidos." });
          const input = await body(request), email = String(input.email || "").trim().toLowerCase();
          if (!input.name || !email || !input.password)
            return json(response, 400, { message: "Preencha nome, e-mail e senha temporária." });
          if ([...users.values()].some((item) => item.email === email))
            return json(response, 409, { message: "E-mail já cadastrado." });
          if (String(input.password).length < 6)
            return json(response, 400, { message: "A senha temporária deve ter ao menos 6 caracteres." });
          const userSalt = randomBytes(16).toString("hex");
          const user: User = {
            id: randomUUID(), name: String(input.name).trim(), email,
            profile: "CLIENT", role: "Cliente", clientId: client.id,
            permissionOverrides: {}, mustChangePassword: true, salt: userSalt,
            passwordHash: hash(String(input.password), userSalt),
          };
          users.set(user.id, user); persistUsers();
          return json(response, 201, { user: publicUser(user), portalUrl: "/portal-cliente" });
        }
        const userAccessMatch = url.match(/^\/users\/([^/]+)\/access$/);
        if (userAccessMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "users.edit"))
            return json(response, 403, { message: "Permissão insuficiente." });
          const user = users.get(userAccessMatch[1]);
          if (!user || user.profile === "MASTER")
            return json(response, 403, {
              message: "O acesso do dono é protegido.",
            });
          const input = await body(request);
          const role = roles.get(input.roleId);
          const department = input.departmentId
            ? departments.get(String(input.departmentId))
            : undefined;
          if (!role || role.assignable === false)
            return json(response, 400, {
              message: "Cargo inválido para este usuário.",
            });
          if (input.departmentId && !department)
            return json(response, 400, {
              message: "Setor inválido para este usuário.",
            });
          const overrides =
            input.permissionOverrides &&
            typeof input.permissionOverrides === "object"
              ? input.permissionOverrides
              : {};
          const previousDepartment = user.departmentId;
          user.roleId = role.id;
          user.role = role.name;
          user.departmentId = department?.id;
          user.departmentName = department?.name;
          if (previousDepartment && previousDepartment !== user.departmentId) {
            const previous = departments.get(previousDepartment);
            if (previous?.managerUserId === user.id) {
              delete previous.managerUserId;
              delete previous.managerName;
              departments.set(previous.id, previous);
              persistDepartments();
            }
          }
          user.permissionOverrides = Object.fromEntries(
            Object.entries(overrides).filter(
              ([permission, effect]) =>
                allPermissions.includes(permission) &&
                ["ALLOW", "DENY"].includes(String(effect)),
            ),
          ) as Record<string, "ALLOW" | "DENY">;
          users.set(user.id, user);
          persistUsers();
          return json(response, 200, {
            user: publicUser(user),
            effectivePermissions: allPermissions.map((permission) => ({
              permission,
              allowed: user.permissionOverrides?.[permission]
                ? user.permissionOverrides[permission] === "ALLOW"
                : role.permissions.includes(permission),
              source: user.permissionOverrides?.[permission]
                ? `USER_${user.permissionOverrides[permission]}`
                : "ROLE",
            })),
          });
        }
        const userMatch = url.match(/^\/users\/([^/]+)$/);
        if (userMatch && request.method === "DELETE") {
          const canDeleteUsers =
            currentUser.roleId === developerRole.id ||
            currentUser.roleId === ceoRole.id;
          if (!canDeleteUsers)
            return json(response, 403, {
              message: "Somente CEO e Desenvolvedor podem excluir usuários.",
            });
          const user = users.get(userMatch[1]);
          if (!user || user.profile === "MASTER")
            return json(response, 403, {
              message: "A conta do dono não pode ser excluída.",
            });
          if (user.id === currentUser.id)
            return json(response, 400, {
              message: "Você não pode excluir a própria conta.",
            });
          const input = await body(request);
          if (
            !input.password ||
            !safeEqual(
              currentUser.passwordHash,
              hash(String(input.password), currentUser.salt),
            )
          )
            return json(response, 401, {
              message: "Senha incorreta. A exclusão não foi realizada.",
            });
          if (user.departmentId) {
            const department = departments.get(user.departmentId);
            if (department?.managerUserId === user.id) {
              delete department.managerUserId;
              delete department.managerName;
              departments.set(department.id, department);
              persistDepartments();
            }
          }
          users.delete(user.id);
          persistUsers();
          return json(response, 200, { ok: true });
        }
        if (url === "/integrations" && request.method === "GET") {
          if (!hasPermission(currentUser, "integrations.view"))
            return json(response, 403, { message: "Permissão insuficiente." });
          return json(response, 200, {
            integrations: [...integrations.values()],
          });
        }
        if (/^\/integrations\/(google_ads|meta_ads)\/demo$/.test(url))
          return json(response, 410, {
            message:
              "Conexões simuladas foram desativadas. Configure as credenciais OAuth oficiais.",
          });
        const integrationMatch = url.match(
          /^\/integrations\/([^/]+)(?:\/(test|sync))?$/,
        );
        if (integrationMatch) {
          const integration = integrations.get(integrationMatch[1]);
          if (!integration)
            return json(response, 404, { message: "Conexão não encontrada." });
          if (request.method === "POST" && integrationMatch[2] === "test") {
            if (!hasPermission(currentUser, "integrations.authorize"))
              return json(response, 403, { message: "Permissão insuficiente." });
            if (integration.demo)
              return json(response, 410, {
                message: "Esta conexão simulada está desativada.",
              });
            return json(response, 200, {
              ok: true,
              message: "Conexão válida.",
              checkedAt: new Date().toISOString(),
            });
          }
          if (request.method === "POST" && integrationMatch[2] === "sync") {
            if (!hasPermission(currentUser, "integrations.sync"))
              return json(response, 403, { message: "Permissão insuficiente." });
            if (integration.demo)
              return json(response, 410, {
                message: "Esta conexão simulada está desativada.",
              });
            return json(response, 501, {
              message:
                "O adaptador oficial desta plataforma ainda não foi configurado no servidor.",
            });
          }
          if (request.method === "DELETE" && !integrationMatch[2]) {
            if (!hasPermission(currentUser, "integrations.delete"))
              return json(response, 403, { message: "Permissão insuficiente." });
            integrations.delete(integration.id);
            persistIntegrations();
            return json(response, 200, { ok: true, historyPreserved: true });
          }
        }
        return json(response, 404, { message: "Rota não encontrada." });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const masterEmail = env.PW_OS_MASTER_EMAIL;
  const masterPassword = env.PW_OS_MASTER_INITIAL_PASSWORD;
  if (!masterEmail || !masterPassword)
    throw new Error(
      "Configure PW_OS_MASTER_EMAIL e PW_OS_MASTER_INITIAL_PASSWORD no arquivo .env.local.",
    );
  return {
    plugins: [
      react(),
      localApi(
        masterEmail,
        masterPassword,
        env.META_ADS_ACCESS_TOKEN || "",
        env.META_ADS_GRAPH_VERSION || "v23.0",
        env.GOOGLE_ADS_CLIENT_ID || "",
        env.GOOGLE_ADS_CLIENT_SECRET || "",
        env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
        env.GOOGLE_ADS_REFRESH_TOKEN || "",
      ),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "PW OS — Performance Workspace",
          short_name: "PW OS",
          description: "ERP + CRM da PW Media",
          theme_color: "#0c79d8",
          background_color: "#f4f6f8",
          display: "standalone",
          icons: [
            {
              src: "/favicon-pw.png?v=3",
              sizes: "600x600",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/favicon-pw.png?v=3",
              sizes: "600x600",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
    resolve: { alias: { "@": "/apps/web/src" } },
    build: { outDir: "dist" },
  };
});
