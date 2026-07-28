import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { allPermissions, permissionCatalog } from "./packages/permissions/src/catalog";

type User = { id: string; name: string; email: string; phone?: string; avatarDataUrl?: string; profile: string; role: string; roleId?: string; departmentId?: string; departmentName?: string; permissionOverrides?: Record<string, "ALLOW" | "DENY">; mustChangePassword: boolean; salt: string; passwordHash: string };
type Role = { id: string; name: string; description: string; level: number; system: boolean; assignable?: boolean; permissions: string[] };
type Integration = { id: string; platform: "GOOGLE_ADS" | "META_ADS"; name: string; status: string; demo: boolean; managerName: string; accountCount: number; campaignCount: number; responsible: string; lastSyncAt: string | null; nextSyncAt: string | null; frequency: string };
type Client = { id:string; name:string; legalName:string; document:string; status:"ACTIVE"|"ATTENTION"|"RISK"|"INACTIVE"; segment:string; website:string; primaryContactName:string; primaryContactEmail:string; primaryContactPhone:string; owner:string; notes:string; createdAt:string; updatedAt:string };
type Department = { id:string; name:string; description:string; active:boolean; managerUserId?:string; managerName?:string; createdAt:string };
type TicketComment = { id:string; authorId:string; authorName:string; message:string; mentions:string[]; createdAt:string };
type Ticket = { id:string; code:string; title:string; description:string; departmentId:string; requesterId:string; requesterName:string; assigneeId:string; assigneeName:string; priority:"LOW"|"MEDIUM"|"HIGH"|"URGENT"; status:"OPEN"|"IN_PROGRESS"|"WAITING"|"RESOLVED"|"CLOSED"; dueAt:string; participantIds:string[]; comments:TicketComment[]; createdAt:string; updatedAt:string };
type CrmStage={id:string;name:string;color:string;probability:number;requiredFields?:string[];terminal?:"WON"|"LOST"};
type CrmPipeline={id:string;name:string;departmentIds:string[];stages:CrmStage[];createdAt:string};
type CrmActivity={id:string;type:string;description:string;actorId:string;actorName:string;createdAt:string;metadata?:Record<string,string>};
type CrmProposal={id:string;title:string;value:number;status:"DRAFT"|"SENT"|"ACCEPTED"|"REJECTED";validUntil:string;notes:string;createdBy:string;createdAt:string};
type Opportunity={id:string;name:string;company:string;companyId?:string;contactIds?:string[];email:string;phone:string;whatsapp:string;serviceInterest:string;potentialValue:number;temperature:"COLD"|"WARM"|"HOT";priority:"LOW"|"MEDIUM"|"HIGH";responsibleId:string;responsibleName:string;teamIds:string[];tags:string[];pipelineId:string;stageId:string;status:"OPEN"|"WON"|"LOST"|"CONVERTED";nextAction:string;nextActionAt:string;lossReason?:string;convertedClientId?:string;convertedAt?:string;convertedBy?:string;stageEnteredAt:string;createdAt:string;updatedAt:string;activities:CrmActivity[];proposals:CrmProposal[]};
type CrmContact={id:string;name:string;email:string;phone:string;whatsapp:string;role:string;companyId:string;clientId:string;opportunityIds:string[];responsibleId:string;responsibleName:string;createdAt:string;updatedAt:string;activities:CrmActivity[]};
type CrmCompany={id:string;name:string;legalName:string;document:string;website:string;phone:string;segment:string;clientId:string;responsibleId:string;responsibleName:string;createdAt:string;updatedAt:string;activities:CrmActivity[]};
type ClientService={id:string;clientId:string;opportunityId:string;name:string;negotiatedValue:number;billingType:"RECURRING"|"ONE_TIME";startDate:string;managerUserId:string;createdAt:string};
type ClientContact={id:string;clientId:string;name:string;role:string;email:string;phone:string;whatsapp:string;primary:boolean;createdAt:string};
type OnboardingProject={id:string;clientId:string;serviceId:string;name:string;objective?:string;responsibleId?:string;teamIds?:string[];startDate?:string;dueDate?:string;progress?:number;status:"PLANNED"|"ACTIVE"|"PAUSED"|"COMPLETED"|"CANCELLED";createdAt:string;tasks:{id:string;title:string;status:string}[]};
type WorkTask={id:string;title:string;description:string;clientId:string;projectId:string;opportunityId:string;responsibleId:string;responsibleName:string;participantIds:string[];priority:"LOW"|"MEDIUM"|"HIGH"|"URGENT";status:"BACKLOG"|"TODO"|"IN_PROGRESS"|"WAITING_CLIENT"|"REVIEW"|"DONE"|"CANCELLED";startAt:string;dueAt:string;estimateMinutes:number;trackedMinutes:number;tags:string[];checklist:{id:string;title:string;done:boolean}[];comments:TicketComment[];createdBy:string;createdAt:string;updatedAt:string};
type CalendarEvent={id:string;title:string;description:string;ownerId:string;ownerName:string;participantIds:string[];startAt:string;endAt:string;location:string;category:string;clientId:string;projectId:string;opportunityId:string;taskId:string;recurrence:string;reminderMinutes:number;createdAt:string;updatedAt:string};
type FinancialAccount={id:string;name:string;institution:string;type:"CHECKING"|"SAVINGS"|"CASH"|"CARD";openingBalance:number;active:boolean;createdAt:string};
type FinancialCategory={id:string;name:string;type:"INCOME"|"EXPENSE";color:string;active:boolean;createdAt:string};
type FinancialEntry={id:string;type:"INCOME"|"EXPENSE";description:string;amount:number;dueDate:string;paidAt:string;status:"OPEN"|"PAID"|"CANCELLED";categoryId:string;accountId:string;clientId:string;supplier:string;costCenter:string;documentNumber:string;paymentMethod:string;recurrence:"NONE"|"MONTHLY"|"YEARLY";notes:string;createdBy:string;createdByName:string;createdAt:string;updatedAt:string};
type FinancialSupplier={id:string;name:string;document:string;email:string;phone:string;notes:string;active:boolean;createdAt:string};
type FinancialCostCenter={id:string;name:string;code:string;description:string;active:boolean;createdAt:string};
type FinancialAudit={id:string;entryId:string;action:string;reason:string;userId:string;userName:string;createdAt:string};
const sessions = new Map<string, string>();
const users = new Map<string, User>();
const roles = new Map<string, Role>();
const integrations = new Map<string, Integration>();
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
const financialAccounts = new Map<string,FinancialAccount>();
const financialCategories = new Map<string,FinancialCategory>();
const financialEntries = new Map<string,FinancialEntry>();
const financialSuppliers = new Map<string,FinancialSupplier>();
const financialCostCenters = new Map<string,FinancialCostCenter>();
const financialAudits:FinancialAudit[]=[];
const hash = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
const onlyDigits=(value:string)=>value.replace(/\D/g,"");
const repeatedDigits=(value:string)=>/^(\d)\1+$/.test(value);
const validCPF=(value:string)=>{const raw=onlyDigits(value);if(raw.length!==11||repeatedDigits(raw))return false;const check=(length:number)=>{let sum=0;for(let i=0;i<length;i++)sum+=Number(raw[i])*(length+1-i);const mod=(sum*10)%11;return(mod===10?0:mod)===Number(raw[length])};return check(9)&&check(10)};
const validCNPJ=(value:string)=>{const raw=onlyDigits(value);if(raw.length!==14||repeatedDigits(raw))return false;const calc=(base:string)=>{let factor=base.length-7,sum=0;for(const digit of base){sum+=Number(digit)*factor--;if(factor===1)factor=9}const mod=sum%11;return mod<2?0:11-mod};return calc(raw.slice(0,12))===Number(raw[12])&&calc(raw.slice(0,13))===Number(raw[13])};
const validDocument=(value:string)=>{const raw=onlyDigits(value);return raw.length===11?validCPF(raw):raw.length===14?validCNPJ(raw):false};
const validPhone=(value:string)=>{const raw=onlyDigits(value);return !value||raw.length===10||raw.length===11};
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const publicUser = ({ passwordHash: _, salt: __, ...user }: User) => user;
const hasPermission = (user: User, permission: string) => {
  if (user.profile === "MASTER") return true;
  const override = user.permissionOverrides?.[permission];
  if (override) return override === "ALLOW";
  return !!user.roleId && !!roles.get(user.roleId)?.permissions.includes(permission);
};
const cookies = (request: IncomingMessage) => Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map(value => value.trim().split("=")));
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

function localApi(masterEmail: string, masterPassword: string): Plugin {
  const localUsersPath = "data/users.local.json";
  const localRolesPath = "data/roles.local.json";
  const localIntegrationsPath = "data/integrations.local.json";
  const localClientsPath = "data/clients.local.json";
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
  const localCalendarPath = "data/calendar.local.json";
  const localFinancialAccountsPath = "data/financial-accounts.local.json";
  const localFinancialCategoriesPath = "data/financial-categories.local.json";
  const localFinancialEntriesPath = "data/financial-entries.local.json";
  const localFinancialSuppliersPath = "data/financial-suppliers.local.json";
  const localFinancialCostCentersPath = "data/financial-cost-centers.local.json";
  const localFinancialAuditsPath = "data/financial-audits.local.json";
  const developerRole: Role = { id: "developer-system-role", name: "Desenvolvedor", description: "Acesso técnico total e protegido para desenvolvimento e manutenção do PW OS.", level: 100, system: true, assignable: false, permissions: [...allPermissions] };
  const ceoRole: Role = { id: "owner-system-role", name: "CEO", description: "Acesso executivo total e protegido para a direção da empresa.", level: 99, system: true, assignable: true, permissions: [...allPermissions] };
  roles.set(developerRole.id, developerRole);
  roles.set(ceoRole.id, ceoRole);
  if (existsSync(localRolesPath)) {
    const storedRoles = JSON.parse(readFileSync(localRolesPath, "utf8")) as Role[];
    storedRoles.forEach(role => roles.set(role.id, role));
  }
  const salt = randomBytes(16).toString("hex");
  const master: User = { id: randomUUID(), name: "Emerson Santos", email: masterEmail.toLowerCase(), profile: "MASTER", role: developerRole.name, roleId: developerRole.id, permissionOverrides: {}, mustChangePassword: false, salt, passwordHash: hash(masterPassword, salt) };
  if (existsSync(localMasterUserPath)) {
    Object.assign(master, JSON.parse(readFileSync(localMasterUserPath, "utf8")), { email: masterEmail.toLowerCase(), profile: "MASTER", role: developerRole.name, roleId: developerRole.id });
  } else if (existsSync(localMasterProfilePath)) {
    Object.assign(master, JSON.parse(readFileSync(localMasterProfilePath, "utf8")));
  }
  users.set(master.id, master);
  if (existsSync(localUsersPath)) {
    const storedUsers = JSON.parse(readFileSync(localUsersPath, "utf8")) as User[];
    storedUsers.forEach(user => users.set(user.id, { ...user, mustChangePassword: user.mustChangePassword ?? true }));
  }
  const persistUsers = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(localUsersPath, JSON.stringify([...users.values()].filter(user => user.profile !== "MASTER"), null, 2), { mode: 0o600 });
  };
  const persistUser = (user: User) => {
    if (user.profile === "MASTER") {
      mkdirSync("data", { recursive: true });
      writeFileSync(localMasterUserPath, JSON.stringify(user, null, 2), { mode: 0o600 });
    } else persistUsers();
  };
  const persistRoles = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(localRolesPath, JSON.stringify([...roles.values()].filter(role => !role.system), null, 2), { mode: 0o600 });
  };
  if (existsSync(localIntegrationsPath)) {
    const storedIntegrations = JSON.parse(readFileSync(localIntegrationsPath, "utf8")) as Integration[];
    storedIntegrations.forEach(integration => integrations.set(integration.id, integration));
  }
  const persistIntegrations = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(localIntegrationsPath, JSON.stringify([...integrations.values()], null, 2), { mode: 0o600 });
  };
  if (existsSync(localClientsPath)) {
    const storedClients = JSON.parse(readFileSync(localClientsPath, "utf8")) as Client[];
    storedClients.forEach(client => clients.set(client.id, client));
  }
  const persistClients = () => {
    mkdirSync("data", { recursive: true });
    writeFileSync(localClientsPath, JSON.stringify([...clients.values()], null, 2), { mode: 0o600 });
  };
  if (existsSync(localDepartmentsPath)) (JSON.parse(readFileSync(localDepartmentsPath,"utf8")) as Department[]).forEach(item=>departments.set(item.id,item));
  if (existsSync(localTicketsPath)) (JSON.parse(readFileSync(localTicketsPath,"utf8")) as Ticket[]).forEach(item=>tickets.set(item.id,item));
  const persistDepartments=()=>{mkdirSync("data",{recursive:true});writeFileSync(localDepartmentsPath,JSON.stringify([...departments.values()],null,2),{mode:0o600})};
  const persistTickets=()=>{mkdirSync("data",{recursive:true});writeFileSync(localTicketsPath,JSON.stringify([...tickets.values()],null,2),{mode:0o600})};
  const defaultPipeline:CrmPipeline={id:"sales-default",name:"Pipeline comercial",departmentIds:[],createdAt:new Date().toISOString(),stages:[
    {id:"new-lead",name:"Novo lead",color:"#4f8df7",probability:10},{id:"first-contact",name:"Primeiro contato",color:"#21a4a6",probability:20},
    {id:"qualification",name:"Qualificação",color:"#8b5cf6",probability:35},{id:"diagnosis",name:"Diagnóstico",color:"#d97706",probability:45},
    {id:"proposal-draft",name:"Proposta em elaboração",color:"#f59e0b",probability:55},{id:"proposal-sent",name:"Proposta enviada",color:"#ec6b33",probability:65},
    {id:"negotiation",name:"Negociação",color:"#e34a3b",probability:80},{id:"won",name:"Fechado — ganho",color:"#239667",probability:100,terminal:"WON"},
    {id:"lost",name:"Fechado — perdido",color:"#8a96a8",probability:0,terminal:"LOST"}]};
  if(existsSync(localPipelinesPath))(JSON.parse(readFileSync(localPipelinesPath,"utf8")) as CrmPipeline[]).forEach(item=>pipelines.set(item.id,{...item,departmentIds:item.departmentIds||[]}));else pipelines.set(defaultPipeline.id,defaultPipeline);
  if(existsSync(localOpportunitiesPath))(JSON.parse(readFileSync(localOpportunitiesPath,"utf8")) as Opportunity[]).forEach(item=>opportunities.set(item.id,{...item,contactIds:item.contactIds||[],teamIds:item.teamIds||[],tags:item.tags||[],activities:item.activities||[],proposals:item.proposals||[]}));
  if(existsSync(localCrmContactsPath))(JSON.parse(readFileSync(localCrmContactsPath,"utf8")) as CrmContact[]).forEach(item=>crmContacts.set(item.id,{...item,opportunityIds:item.opportunityIds||[],activities:item.activities||[]}));
  if(existsSync(localCrmCompaniesPath))(JSON.parse(readFileSync(localCrmCompaniesPath,"utf8")) as CrmCompany[]).forEach(item=>crmCompanies.set(item.id,{...item,activities:item.activities||[]}));
  if(existsSync(localClientServicesPath))(JSON.parse(readFileSync(localClientServicesPath,"utf8")) as ClientService[]).forEach(item=>clientServices.set(item.id,item));
  if(existsSync(localProjectsPath))(JSON.parse(readFileSync(localProjectsPath,"utf8")) as OnboardingProject[]).forEach(item=>onboardingProjects.set(item.id,item));
  if(existsSync(localClientContactsPath))(JSON.parse(readFileSync(localClientContactsPath,"utf8")) as ClientContact[]).forEach(item=>clientContacts.set(item.id,item));
  if(existsSync(localTasksPath))(JSON.parse(readFileSync(localTasksPath,"utf8")) as WorkTask[]).forEach(item=>workTasks.set(item.id,item));
  if(existsSync(localCalendarPath))(JSON.parse(readFileSync(localCalendarPath,"utf8")) as CalendarEvent[]).forEach(item=>calendarEvents.set(item.id,item));
  if(existsSync(localFinancialAccountsPath))(JSON.parse(readFileSync(localFinancialAccountsPath,"utf8")) as FinancialAccount[]).forEach(item=>financialAccounts.set(item.id,item));
  if(existsSync(localFinancialCategoriesPath))(JSON.parse(readFileSync(localFinancialCategoriesPath,"utf8")) as FinancialCategory[]).forEach(item=>financialCategories.set(item.id,item));
  if(existsSync(localFinancialEntriesPath))(JSON.parse(readFileSync(localFinancialEntriesPath,"utf8")) as FinancialEntry[]).forEach(item=>financialEntries.set(item.id,item));
  if(existsSync(localFinancialSuppliersPath))(JSON.parse(readFileSync(localFinancialSuppliersPath,"utf8")) as FinancialSupplier[]).forEach(item=>financialSuppliers.set(item.id,item));
  if(existsSync(localFinancialCostCentersPath))(JSON.parse(readFileSync(localFinancialCostCentersPath,"utf8")) as FinancialCostCenter[]).forEach(item=>financialCostCenters.set(item.id,item));
  if(existsSync(localFinancialAuditsPath))financialAudits.push(...JSON.parse(readFileSync(localFinancialAuditsPath,"utf8")) as FinancialAudit[]);
  const persistPipelines=()=>{mkdirSync("data",{recursive:true});writeFileSync(localPipelinesPath,JSON.stringify([...pipelines.values()],null,2),{mode:0o600})};
  const persistOpportunities=()=>{mkdirSync("data",{recursive:true});writeFileSync(localOpportunitiesPath,JSON.stringify([...opportunities.values()],null,2),{mode:0o600})};
  const persistCrmContacts=()=>{mkdirSync("data",{recursive:true});writeFileSync(localCrmContactsPath,JSON.stringify([...crmContacts.values()],null,2),{mode:0o600})};
  const persistCrmCompanies=()=>{mkdirSync("data",{recursive:true});writeFileSync(localCrmCompaniesPath,JSON.stringify([...crmCompanies.values()],null,2),{mode:0o600})};
  const persistClientServices=()=>{mkdirSync("data",{recursive:true});writeFileSync(localClientServicesPath,JSON.stringify([...clientServices.values()],null,2),{mode:0o600})};
  const persistProjects=()=>{mkdirSync("data",{recursive:true});writeFileSync(localProjectsPath,JSON.stringify([...onboardingProjects.values()],null,2),{mode:0o600})};
  const persistClientContacts=()=>{mkdirSync("data",{recursive:true});writeFileSync(localClientContactsPath,JSON.stringify([...clientContacts.values()],null,2),{mode:0o600})};
  const persistWorkTasks=()=>{mkdirSync("data",{recursive:true});writeFileSync(localTasksPath,JSON.stringify([...workTasks.values()],null,2),{mode:0o600})};
  const persistCalendarEvents=()=>{mkdirSync("data",{recursive:true});writeFileSync(localCalendarPath,JSON.stringify([...calendarEvents.values()],null,2),{mode:0o600})};
  const persistFinancialAccounts=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialAccountsPath,JSON.stringify([...financialAccounts.values()],null,2),{mode:0o600})};
  const persistFinancialCategories=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialCategoriesPath,JSON.stringify([...financialCategories.values()],null,2),{mode:0o600})};
  const persistFinancialEntries=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialEntriesPath,JSON.stringify([...financialEntries.values()],null,2),{mode:0o600})};
  const persistFinancialSuppliers=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialSuppliersPath,JSON.stringify([...financialSuppliers.values()],null,2),{mode:0o600})};
  const persistFinancialCostCenters=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialCostCentersPath,JSON.stringify([...financialCostCenters.values()],null,2),{mode:0o600})};
  const persistFinancialAudits=()=>{mkdirSync("data",{recursive:true});writeFileSync(localFinancialAuditsPath,JSON.stringify(financialAudits,null,2),{mode:0o600})};
  const canAccessPipeline=(user:User,pipeline:CrmPipeline)=>user.profile==="MASTER"||hasPermission(user,"crm.manage_pipelines")||pipeline.departmentIds.length===0||!!user.departmentId&&pipeline.departmentIds.includes(user.departmentId);
  if(!existsSync(localPipelinesPath))persistPipelines();
  return {
    name: "pw-os-local-api",
    configureServer(server) {
      server.middlewares.use("/api", async (request, response) => {
        const url = request.url || "/";
        const sessionId = cookies(request).pw_os_session;
        const userId = sessionId && sessions.get(sessionId);
        const currentUser = userId && users.get(userId);
        if (url === "/auth/login" && request.method === "POST") {
          const input = await body(request);
          const user = [...users.values()].find(item => item.email === input.email?.toLowerCase());
          if (!user || !safeEqual(user.passwordHash, hash(input.password || "", user.salt))) return json(response, 401, { message: "E-mail ou senha inválidos." });
          const token = randomBytes(32).toString("hex");
          sessions.set(token, user.id);
          response.setHeader("Set-Cookie", `pw_os_session=${token}; HttpOnly; SameSite=Strict; Path=/`);
          return json(response, 200, { user: publicUser(user) });
        }
        if (url === "/auth/session" && request.method === "GET") return currentUser ? json(response, 200, { user: publicUser(currentUser) }) : json(response, 401, { message: "Sessão necessária." });
        if (url === "/auth/logout" && request.method === "POST") {
          if (sessionId) sessions.delete(sessionId);
          response.setHeader("Set-Cookie", "pw_os_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
          return json(response, 200, { ok: true });
        }
        if (!currentUser) return json(response, 401, { message: "Sessão necessária." });
        if (url === "/auth/change-password" && request.method === "POST") {
          const input = await body(request);
          const currentPassword = String(input.currentPassword || "");
          const password = String(input.password || "");
          const confirmation = String(input.confirmation || "");
          if (!currentUser.mustChangePassword && !safeEqual(currentUser.passwordHash, hash(currentPassword, currentUser.salt))) return json(response, 400, { message: "A senha atual está incorreta." });
          const localPart = currentUser.email.split("@")[0].toLowerCase();
          const commonPasswords = ["password","senha123","12345678","qwerty","admin123","welcome"];
          const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password) && !/\s/.test(password);
          if (password !== confirmation) return json(response, 400, { message: "A confirmação não corresponde à nova senha." });
          if (!strong) return json(response, 400, { message: "A senha precisa atender a todos os requisitos de segurança." });
          if (commonPasswords.some(value => password.toLowerCase().includes(value)) || password.toLowerCase().includes(localPart) || currentUser.name.toLowerCase().split(/\s+/).some((part: string) => part.length >= 4 && password.toLowerCase().includes(part))) return json(response, 400, { message: "A senha não pode conter seu nome, e-mail ou sequências comuns." });
          if (safeEqual(currentUser.passwordHash, hash(password, currentUser.salt))) return json(response, 400, { message: "A nova senha deve ser diferente da senha inicial." });
          currentUser.salt = randomBytes(16).toString("hex");
          currentUser.passwordHash = hash(password, currentUser.salt);
          currentUser.mustChangePassword = false;
          users.set(currentUser.id, currentUser); persistUser(currentUser);
          return json(response, 200, { user: publicUser(currentUser) });
        }
        if (currentUser.mustChangePassword) return json(response, 403, { message: "Troque sua senha antes de continuar.", code: "PASSWORD_CHANGE_REQUIRED" });
        if(url==="/finance"&&request.method==="GET"){
          if(!hasPermission(currentUser,"finance.view"))return json(response,403,{message:"Você não possui acesso ao financeiro."});
          return json(response,200,{entries:[...financialEntries.values()].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),accounts:[...financialAccounts.values()],categories:[...financialCategories.values()],suppliers:[...financialSuppliers.values()],costCenters:[...financialCostCenters.values()],audits:financialAudits.slice(-250).reverse(),canManage:hasPermission(currentUser,"finance.manage_settings"),canViewValues:hasPermission(currentUser,"finance.view_values"),canExport:hasPermission(currentUser,"finance.export")});
        }
        if(url==="/finance/entries"&&request.method==="POST"){
          if(!hasPermission(currentUser,"finance.create"))return json(response,403,{message:"Você não possui permissão para criar lançamentos."});
          const input=await body(request),description=String(input.description||"").trim(),amount=Number(String(input.amount||"0").replace(/\./g,"").replace(",",".")),dueDate=String(input.dueDate||"");
          if(description.length<3||!Number.isFinite(amount)||amount<=0||!dueDate)return json(response,400,{message:"Informe descrição, valor e vencimento válidos."});
          if(input.categoryId&&!financialCategories.has(String(input.categoryId)))return json(response,400,{message:"Categoria inválida."});if(input.accountId&&!financialAccounts.has(String(input.accountId)))return json(response,400,{message:"Conta inválida."});if(input.clientId&&!clients.has(String(input.clientId)))return json(response,400,{message:"Cliente inválido."});
          const now=new Date().toISOString(),installments=Math.max(1,Math.min(120,Number(input.installments)||1)),created:FinancialEntry[]=[];
          for(let index=0;index<installments;index++){const date=new Date(`${dueDate}T12:00:00`);date.setMonth(date.getMonth()+index);const entry:FinancialEntry={id:randomUUID(),type:input.type==="EXPENSE"?"EXPENSE":"INCOME",description:installments>1?`${description} (${index+1}/${installments})`:description,amount:Math.round(amount/installments*100)/100,dueDate:date.toISOString().slice(0,10),paidAt:"",status:"OPEN",categoryId:String(input.categoryId||""),accountId:String(input.accountId||""),clientId:String(input.clientId||""),supplier:String(input.supplier||"").trim(),costCenter:String(input.costCenter||"").trim(),documentNumber:String(input.documentNumber||"").trim(),paymentMethod:String(input.paymentMethod||"").trim(),recurrence:["MONTHLY","YEARLY"].includes(input.recurrence)?input.recurrence:"NONE",notes:String(input.notes||"").trim(),createdBy:currentUser.id,createdByName:currentUser.name,createdAt:now,updatedAt:now};financialEntries.set(entry.id,entry);created.push(entry)}
          persistFinancialEntries();return json(response,201,{entry:created[0],entries:created});
        }
        const financeEntryMatch=url.match(/^\/finance\/entries\/([^/]+)$/);
        if(financeEntryMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"finance.edit"))return json(response,403,{message:"Você não possui permissão para editar lançamentos."});const entry=financialEntries.get(financeEntryMatch[1]);if(!entry)return json(response,404,{message:"Lançamento não encontrado."});const input=await body(request);
          if(input.settle===true){if(!hasPermission(currentUser,"finance.settle"))return json(response,403,{message:"Você não possui permissão para realizar baixas."});entry.status="PAID";entry.paidAt=String(input.paidAt||new Date().toISOString().slice(0,10));if(input.accountId&&financialAccounts.has(String(input.accountId)))entry.accountId=String(input.accountId);financialAudits.push({id:randomUUID(),entryId:entry.id,action:"SETTLED",reason:"Baixa financeira",userId:currentUser.id,userName:currentUser.name,createdAt:new Date().toISOString()});persistFinancialAudits()}
          else if(input.reverse===true){if(!hasPermission(currentUser,"finance.settle"))return json(response,403,{message:"Você não possui permissão para estornar baixas."});const reason=String(input.reason||"").trim();if(reason.length<5)return json(response,400,{message:"Informe o motivo do estorno."});entry.status="OPEN";entry.paidAt="";financialAudits.push({id:randomUUID(),entryId:entry.id,action:"REVERSED",reason,userId:currentUser.id,userName:currentUser.name,createdAt:new Date().toISOString()});persistFinancialAudits()}
          else{if(input.description!==undefined)entry.description=String(input.description).trim();if(input.amount!==undefined){const amount=Number(String(input.amount).replace(/\./g,"").replace(",","."));if(!Number.isFinite(amount)||amount<=0)return json(response,400,{message:"Informe um valor válido."});entry.amount=amount}if(input.dueDate!==undefined)entry.dueDate=String(input.dueDate);if(["INCOME","EXPENSE"].includes(input.type))entry.type=input.type;if(input.categoryId!==undefined)entry.categoryId=String(input.categoryId);if(input.accountId!==undefined)entry.accountId=String(input.accountId);if(input.clientId!==undefined)entry.clientId=String(input.clientId);if(input.supplier!==undefined)entry.supplier=String(input.supplier).trim();if(input.costCenter!==undefined)entry.costCenter=String(input.costCenter).trim();if(input.documentNumber!==undefined)entry.documentNumber=String(input.documentNumber).trim();if(input.paymentMethod!==undefined)entry.paymentMethod=String(input.paymentMethod).trim();if(["NONE","MONTHLY","YEARLY"].includes(input.recurrence))entry.recurrence=input.recurrence;if(input.notes!==undefined)entry.notes=String(input.notes).trim();if(input.status==="CANCELLED")entry.status="CANCELLED"}
          entry.updatedAt=new Date().toISOString();financialEntries.set(entry.id,entry);persistFinancialEntries();return json(response,200,{entry});
        }
        if(financeEntryMatch&&request.method==="DELETE"){if(!hasPermission(currentUser,"finance.delete"))return json(response,403,{message:"Você não possui permissão para excluir lançamentos."});const entry=financialEntries.get(financeEntryMatch[1]);if(!entry)return json(response,404,{message:"Lançamento não encontrado."});if(entry.status==="PAID")return json(response,409,{message:"Lançamentos baixados não podem ser excluídos. Cancele ou estorne a baixa primeiro."});financialEntries.delete(entry.id);persistFinancialEntries();return json(response,200,{ok:true})}
        if(url==="/finance/accounts"&&request.method==="POST"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão para gerenciar contas."});const input=await body(request),name=String(input.name||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome da conta."});const account:FinancialAccount={id:randomUUID(),name,institution:String(input.institution||"").trim(),type:["SAVINGS","CASH","CARD"].includes(input.type)?input.type:"CHECKING",openingBalance:Number(String(input.openingBalance||"0").replace(/\./g,"").replace(",","."))||0,active:true,createdAt:new Date().toISOString()};financialAccounts.set(account.id,account);persistFinancialAccounts();return json(response,201,{account})}
        if(url==="/finance/categories"&&request.method==="POST"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão para gerenciar categorias."});const input=await body(request),name=String(input.name||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome da categoria."});const category:FinancialCategory={id:randomUUID(),name,type:input.type==="EXPENSE"?"EXPENSE":"INCOME",color:String(input.color||"#3b82f6"),active:true,createdAt:new Date().toISOString()};financialCategories.set(category.id,category);persistFinancialCategories();return json(response,201,{category})}
        const financeAccountMatch=url.match(/^\/finance\/accounts\/([^/]+)$/),financeCategoryMatch=url.match(/^\/finance\/categories\/([^/]+)$/);
        if(financeAccountMatch&&request.method==="PATCH"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const account=financialAccounts.get(financeAccountMatch[1]);if(!account)return json(response,404,{message:"Conta não encontrada."});const input=await body(request);if(input.name!==undefined&&String(input.name).trim().length>=2)account.name=String(input.name).trim();if(input.institution!==undefined)account.institution=String(input.institution).trim();if(["CHECKING","SAVINGS","CASH","CARD"].includes(input.type))account.type=input.type;if(input.openingBalance!==undefined)account.openingBalance=Number(String(input.openingBalance).replace(/\./g,"").replace(",","."))||0;financialAccounts.set(account.id,account);persistFinancialAccounts();return json(response,200,{account})}
        if(financeCategoryMatch&&request.method==="PATCH"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const category=financialCategories.get(financeCategoryMatch[1]);if(!category)return json(response,404,{message:"Categoria não encontrada."});const input=await body(request);if(input.name!==undefined&&String(input.name).trim().length>=2)category.name=String(input.name).trim();if(["INCOME","EXPENSE"].includes(input.type))category.type=input.type;if(input.color!==undefined)category.color=String(input.color);financialCategories.set(category.id,category);persistFinancialCategories();return json(response,200,{category})}
        if(financeAccountMatch&&request.method==="DELETE"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});if([...financialEntries.values()].some(item=>item.accountId===financeAccountMatch[1]))return json(response,409,{message:"Esta conta possui lançamentos e não pode ser excluída."});financialAccounts.delete(financeAccountMatch[1]);persistFinancialAccounts();return json(response,200,{ok:true})}
        if(financeCategoryMatch&&request.method==="DELETE"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});if([...financialEntries.values()].some(item=>item.categoryId===financeCategoryMatch[1]))return json(response,409,{message:"Esta categoria possui lançamentos e não pode ser excluída."});financialCategories.delete(financeCategoryMatch[1]);persistFinancialCategories();return json(response,200,{ok:true})}
        if(url==="/finance/transfers"&&request.method==="POST"){if(!hasPermission(currentUser,"finance.create")||!hasPermission(currentUser,"finance.settle"))return json(response,403,{message:"Sem permissão para transferir."});const input=await body(request),from=String(input.fromAccountId||""),to=String(input.toAccountId||""),amount=Number(String(input.amount||"0").replace(/\./g,"").replace(",",".")),date=String(input.date||new Date().toISOString().slice(0,10));if(from===to||!financialAccounts.has(from)||!financialAccounts.has(to)||!Number.isFinite(amount)||amount<=0)return json(response,400,{message:"Informe contas diferentes e um valor válido."});const now=new Date().toISOString(),group=randomUUID(),base={amount,dueDate:date,paidAt:date,status:"PAID" as const,categoryId:"",clientId:"",supplier:"",costCenter:"Transferências",documentNumber:group,paymentMethod:"Transferência",recurrence:"NONE" as const,notes:String(input.notes||""),createdBy:currentUser.id,createdByName:currentUser.name,createdAt:now,updatedAt:now};const debit:FinancialEntry={...base,id:randomUUID(),type:"EXPENSE",description:`Transferência para ${financialAccounts.get(to)!.name}`,accountId:from},credit:FinancialEntry={...base,id:randomUUID(),type:"INCOME",description:`Transferência de ${financialAccounts.get(from)!.name}`,accountId:to};financialEntries.set(debit.id,debit);financialEntries.set(credit.id,credit);financialAudits.push({id:randomUUID(),entryId:group,action:"TRANSFER",reason:`${from} → ${to}`,userId:currentUser.id,userName:currentUser.name,createdAt:now});persistFinancialEntries();persistFinancialAudits();return json(response,201,{debit,credit})}
        const financeSupplierMatch=url.match(/^\/finance\/suppliers\/([^/]+)$/),financeCostCenterMatch=url.match(/^\/finance\/cost-centers\/([^/]+)$/);
        if(url==="/finance/suppliers"&&request.method==="POST"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const input=await body(request),name=String(input.name||"").trim(),document=String(input.document||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome do fornecedor."});if(document&&!validDocument(document))return json(response,400,{message:"CPF ou CNPJ inválido."});const item:FinancialSupplier={id:randomUUID(),name,document,email:String(input.email||"").trim(),phone:String(input.phone||"").trim(),notes:String(input.notes||"").trim(),active:true,createdAt:new Date().toISOString()};financialSuppliers.set(item.id,item);persistFinancialSuppliers();return json(response,201,{supplier:item})}
        if(financeSupplierMatch&&request.method==="PATCH"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const item=financialSuppliers.get(financeSupplierMatch[1]);if(!item)return json(response,404,{message:"Fornecedor não encontrado."});const input=await body(request);Object.assign(item,{name:String(input.name??item.name).trim(),document:String(input.document??item.document).trim(),email:String(input.email??item.email).trim(),phone:String(input.phone??item.phone).trim(),notes:String(input.notes??item.notes).trim()});if(item.document&&!validDocument(item.document))return json(response,400,{message:"CPF ou CNPJ inválido."});persistFinancialSuppliers();return json(response,200,{supplier:item})}
        if(financeSupplierMatch&&request.method==="DELETE"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const item=financialSuppliers.get(financeSupplierMatch[1]);if(!item)return json(response,404,{message:"Fornecedor não encontrado."});if([...financialEntries.values()].some(entry=>entry.supplier===item.name))return json(response,409,{message:"Fornecedor vinculado a lançamentos; desative ou renomeie em vez de excluir."});financialSuppliers.delete(item.id);persistFinancialSuppliers();return json(response,200,{ok:true})}
        if(url==="/finance/cost-centers"&&request.method==="POST"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const input=await body(request),name=String(input.name||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome do centro de custo."});const item:FinancialCostCenter={id:randomUUID(),name,code:String(input.code||"").trim(),description:String(input.description||"").trim(),active:true,createdAt:new Date().toISOString()};financialCostCenters.set(item.id,item);persistFinancialCostCenters();return json(response,201,{costCenter:item})}
        if(financeCostCenterMatch&&request.method==="PATCH"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const item=financialCostCenters.get(financeCostCenterMatch[1]);if(!item)return json(response,404,{message:"Centro de custo não encontrado."});const input=await body(request);Object.assign(item,{name:String(input.name??item.name).trim(),code:String(input.code??item.code).trim(),description:String(input.description??item.description).trim()});persistFinancialCostCenters();return json(response,200,{costCenter:item})}
        if(financeCostCenterMatch&&request.method==="DELETE"){if(!hasPermission(currentUser,"finance.manage_settings"))return json(response,403,{message:"Sem permissão."});const item=financialCostCenters.get(financeCostCenterMatch[1]);if(!item)return json(response,404,{message:"Centro de custo não encontrado."});if([...financialEntries.values()].some(entry=>entry.costCenter===item.name))return json(response,409,{message:"Centro de custo vinculado a lançamentos."});financialCostCenters.delete(item.id);persistFinancialCostCenters();return json(response,200,{ok:true})}
        if (url === "/profile" && request.method === "PATCH") {
          const input = await body(request);
          const name = String(input.name || "").trim();
          const phone = String(input.phone || "").trim();
          const avatarDataUrl = String(input.avatarDataUrl || "");
          if (name.length < 2 || name.length > 100) return json(response, 400, { message: "Informe um nome válido." });
          if (!validPhone(phone)) return json(response, 400, { message: "Informe um telefone válido com DDD." });
          if (avatarDataUrl && (!/^data:image\/(png|jpeg|webp);base64,/.test(avatarDataUrl) || avatarDataUrl.length > 1_600_000)) return json(response, 400, { message: "Use uma imagem PNG, JPG ou WebP de até 1 MB." });
          currentUser.name = name; currentUser.phone = phone; currentUser.avatarDataUrl = avatarDataUrl;
          users.set(currentUser.id, currentUser); persistUser(currentUser);
          return json(response, 200, { user: publicUser(currentUser) });
        }
        if(url==="/departments"&&request.method==="GET") return json(response,200,{departments:[...departments.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"))});
        if(url==="/departments"&&request.method==="POST"){
          if(!hasPermission(currentUser,"tickets.manage_departments"))return json(response,403,{message:"Você não possui permissão para gerenciar setores."});
          const input=await body(request);const name=String(input.name||"").trim();
          if(name.length<2)return json(response,400,{message:"Informe o nome do setor."});
          if([...departments.values()].some(item=>item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Este setor já existe."});
          const department:Department={id:randomUUID(),name,description:String(input.description||"").trim(),active:true,createdAt:new Date().toISOString()};
          departments.set(department.id,department);persistDepartments();return json(response,201,{department});
        }
        const departmentMatch=url.match(/^\/departments\/([^/]+)$/);
        if(departmentMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"tickets.manage_departments"))return json(response,403,{message:"Permissão insuficiente."});
          const department=departments.get(departmentMatch[1]);if(!department)return json(response,404,{message:"Setor não encontrado."});
          const input=await body(request);department.name=String(input.name||department.name).trim();department.description=String(input.description??department.description).trim();department.active=input.active!==false;
          departments.set(department.id,department);persistDepartments();return json(response,200,{department});
        }
        if(departmentMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"tickets.manage_departments"))return json(response,403,{message:"Permissão insuficiente."});
          if([...tickets.values()].some(ticket=>ticket.departmentId===departmentMatch[1]))return json(response,409,{message:"Este setor possui chamados e não pode ser excluído."});
          if([...users.values()].some(user=>user.departmentId===departmentMatch[1]))return json(response,409,{message:"Este setor possui colaboradores vinculados. Reatribua-os antes de excluir."});
          departments.delete(departmentMatch[1]);persistDepartments();return json(response,200,{ok:true});
        }
        const canSeeTicket=(ticket:Ticket)=>hasPermission(currentUser,"tickets.view_all")||ticket.requesterId===currentUser.id||ticket.assigneeId===currentUser.id||ticket.participantIds.includes(currentUser.id);
        if(url==="/tickets"&&request.method==="GET"){
          if(!hasPermission(currentUser,"tickets.view"))return json(response,403,{message:"Você não possui acesso aos chamados."});
          return json(response,200,{tickets:[...tickets.values()].filter(canSeeTicket).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),canViewAll:hasPermission(currentUser,"tickets.view_all"),canManageDepartments:hasPermission(currentUser,"tickets.manage_departments")});
        }
        if(url==="/tickets"&&request.method==="POST"){
          if(!hasPermission(currentUser,"tickets.create"))return json(response,403,{message:"Você não possui permissão para abrir chamados."});
          const input=await body(request);const title=String(input.title||"").trim();const assignee=users.get(String(input.assigneeId||""));
          if(title.length<4||!departments.has(String(input.departmentId||"")))return json(response,400,{message:"Informe título e setor válidos."});
          if(!assignee)return json(response,400,{message:"Selecione um responsável válido."});
          const now=new Date().toISOString();const sequence=String(tickets.size+1).padStart(4,"0");
          const ticket:Ticket={id:randomUUID(),code:`CH-${new Date().getFullYear()}-${sequence}`,title,description:String(input.description||"").trim(),departmentId:String(input.departmentId),requesterId:currentUser.id,requesterName:currentUser.name,assigneeId:assignee.id,assigneeName:assignee.name,priority:["LOW","MEDIUM","HIGH","URGENT"].includes(input.priority)?input.priority:"MEDIUM",status:"OPEN",dueAt:String(input.dueAt||""),participantIds:[currentUser.id,assignee.id],comments:[],createdAt:now,updatedAt:now};
          tickets.set(ticket.id,ticket);persistTickets();return json(response,201,{ticket});
        }
        const ticketCommentMatch=url.match(/^\/tickets\/([^/]+)\/comments$/);
        if(ticketCommentMatch&&request.method==="POST"){
          const ticket=tickets.get(ticketCommentMatch[1]);if(!ticket||!canSeeTicket(ticket))return json(response,404,{message:"Chamado não encontrado."});
          if(!hasPermission(currentUser,"tickets.comment"))return json(response,403,{message:"Você não possui permissão para comentar."});
          const input=await body(request);const message=String(input.message||"").trim();if(!message)return json(response,400,{message:"Escreva uma atualização."});
          const mentioned=[...users.values()].filter(user=>message.toLowerCase().includes(`@${user.name.toLowerCase()}`));
          const comment:TicketComment={id:randomUUID(),authorId:currentUser.id,authorName:currentUser.name,message,mentions:mentioned.map(user=>user.id),createdAt:new Date().toISOString()};
          ticket.comments.push(comment);ticket.participantIds=[...new Set([...ticket.participantIds,...comment.mentions])];ticket.updatedAt=comment.createdAt;tickets.set(ticket.id,ticket);persistTickets();return json(response,201,{comment,ticket});
        }
        const ticketMatch=url.match(/^\/tickets\/([^/]+)$/);
        if(ticketMatch&&request.method==="GET"){const ticket=tickets.get(ticketMatch[1]);return ticket&&canSeeTicket(ticket)?json(response,200,{ticket}):json(response,404,{message:"Chamado não encontrado."})}
        if(ticketMatch&&request.method==="PATCH"){
          const ticket=tickets.get(ticketMatch[1]);if(!ticket||!canSeeTicket(ticket))return json(response,404,{message:"Chamado não encontrado."});
          if(!hasPermission(currentUser,"tickets.edit"))return json(response,403,{message:"Você não possui permissão para editar chamados."});
          const input=await body(request);const assignee=input.assigneeId&&users.get(String(input.assigneeId));
          if(input.title)ticket.title=String(input.title).trim();if(input.description!==undefined)ticket.description=String(input.description).trim();
          if(input.departmentId&&departments.has(String(input.departmentId)))ticket.departmentId=String(input.departmentId);
          if(assignee){ticket.assigneeId=assignee.id;ticket.assigneeName=assignee.name;ticket.participantIds=[...new Set([...ticket.participantIds,assignee.id])]}
          if(["LOW","MEDIUM","HIGH","URGENT"].includes(input.priority))ticket.priority=input.priority;
          if(["OPEN","IN_PROGRESS","WAITING","RESOLVED","CLOSED"].includes(input.status))ticket.status=input.status;
          if(input.dueAt!==undefined)ticket.dueAt=String(input.dueAt);ticket.updatedAt=new Date().toISOString();tickets.set(ticket.id,ticket);persistTickets();return json(response,200,{ticket});
        }
        if(ticketMatch&&request.method==="DELETE"){
          const ticket=tickets.get(ticketMatch[1]);if(!ticket||!canSeeTicket(ticket))return json(response,404,{message:"Chamado não encontrado."});
          if(!hasPermission(currentUser,"tickets.delete"))return json(response,403,{message:"Você não possui permissão para excluir chamados."});
          tickets.delete(ticket.id);persistTickets();return json(response,200,{ok:true});
        }
        const canSeeTask=(task:WorkTask)=>hasPermission(currentUser,"tasks.view_all")||task.createdBy===currentUser.id||task.responsibleId===currentUser.id||task.participantIds.includes(currentUser.id);
        if(url==="/tasks"&&request.method==="GET"){
          if(!hasPermission(currentUser,"tasks.view"))return json(response,403,{message:"Você não possui acesso às tarefas."});
          return json(response,200,{tasks:[...workTasks.values()].filter(canSeeTask).sort((a,b)=>(a.dueAt||"9999").localeCompare(b.dueAt||"9999")),canViewAll:hasPermission(currentUser,"tasks.view_all"),canEditAll:hasPermission(currentUser,"tasks.edit_all")});
        }
        if(url==="/tasks"&&request.method==="POST"){
          if(!hasPermission(currentUser,"tasks.create"))return json(response,403,{message:"Você não possui permissão para criar tarefas."});
          const input=await body(request),title=String(input.title||"").trim(),responsible=users.get(String(input.responsibleId||""));if(title.length<3)return json(response,400,{message:"Informe um título de tarefa válido."});
          if(input.clientId&&!clients.has(String(input.clientId)))return json(response,400,{message:"Cliente inválido."});if(input.projectId&&!onboardingProjects.has(String(input.projectId)))return json(response,400,{message:"Projeto inválido."});
          const now=new Date().toISOString(),task:WorkTask={id:randomUUID(),title,description:String(input.description||"").trim(),clientId:String(input.clientId||""),projectId:String(input.projectId||""),opportunityId:String(input.opportunityId||""),responsibleId:responsible?.id||currentUser.id,responsibleName:responsible?.name||currentUser.name,participantIds:Array.isArray(input.participantIds)?input.participantIds.map(String).filter(id=>users.has(id)):[],priority:["LOW","MEDIUM","HIGH","URGENT"].includes(input.priority)?input.priority:"MEDIUM",status:["BACKLOG","TODO","IN_PROGRESS","WAITING_CLIENT","REVIEW","DONE","CANCELLED"].includes(input.status)?input.status:"TODO",startAt:String(input.startAt||""),dueAt:String(input.dueAt||""),estimateMinutes:Number(input.estimateMinutes||0),trackedMinutes:0,tags:String(input.tags||"").split(",").map(item=>item.trim()).filter(Boolean),checklist:[],comments:[],createdBy:currentUser.id,createdAt:now,updatedAt:now};
          workTasks.set(task.id,task);persistWorkTasks();return json(response,201,{task});
        }
        const taskCommentMatch=url.match(/^\/tasks\/([^/]+)\/comments$/);
        if(taskCommentMatch&&request.method==="POST"){
          const task=workTasks.get(taskCommentMatch[1]);if(!task||!canSeeTask(task))return json(response,404,{message:"Tarefa não encontrada."});
          const input=await body(request),message=String(input.message||"").trim();if(!message)return json(response,400,{message:"Escreva um comentário."});
          const mentioned=[...users.values()].filter(user=>message.toLowerCase().includes(`@${user.name.toLowerCase()}`)),comment:TicketComment={id:randomUUID(),authorId:currentUser.id,authorName:currentUser.name,message,mentions:mentioned.map(user=>user.id),createdAt:new Date().toISOString()};
          task.comments.push(comment);task.participantIds=[...new Set([...task.participantIds,...comment.mentions])];task.updatedAt=comment.createdAt;workTasks.set(task.id,task);persistWorkTasks();return json(response,201,{task});
        }
        const taskMatch=url.match(/^\/tasks\/([^/]+)$/);
        if(taskMatch&&request.method==="PATCH"){
          const task=workTasks.get(taskMatch[1]);if(!task||!canSeeTask(task))return json(response,404,{message:"Tarefa não encontrada."});if(!hasPermission(currentUser,"tasks.edit")||(task.responsibleId!==currentUser.id&&task.createdBy!==currentUser.id&&!hasPermission(currentUser,"tasks.edit_all")))return json(response,403,{message:"Você só pode editar suas próprias tarefas."});
          const input=await body(request),responsible=input.responsibleId?users.get(String(input.responsibleId)):undefined;
          if(input.title!==undefined&&String(input.title).trim().length<3)return json(response,400,{message:"Informe um título válido."});
          Object.assign(task,{title:input.title!==undefined?String(input.title).trim():task.title,description:input.description!==undefined?String(input.description).trim():task.description,status:["BACKLOG","TODO","IN_PROGRESS","WAITING_CLIENT","REVIEW","DONE","CANCELLED"].includes(input.status)?input.status:task.status,priority:["LOW","MEDIUM","HIGH","URGENT"].includes(input.priority)?input.priority:task.priority,dueAt:input.dueAt!==undefined?String(input.dueAt):task.dueAt,trackedMinutes:input.trackedMinutes!==undefined?Number(input.trackedMinutes):task.trackedMinutes,responsibleId:responsible?.id||task.responsibleId,responsibleName:responsible?.name||task.responsibleName,updatedAt:new Date().toISOString()});workTasks.set(task.id,task);persistWorkTasks();return json(response,200,{task});
        }
        if(taskMatch&&request.method==="DELETE"){
          const task=workTasks.get(taskMatch[1]);if(!task||!canSeeTask(task))return json(response,404,{message:"Tarefa não encontrada."});if(!hasPermission(currentUser,"tasks.delete"))return json(response,403,{message:"Você não possui permissão para excluir tarefas."});
          workTasks.delete(task.id);persistWorkTasks();return json(response,200,{ok:true});
        }
        const canSeeEvent=(event:CalendarEvent)=>hasPermission(currentUser,"calendar.view_team")||event.ownerId===currentUser.id||event.participantIds.includes(currentUser.id);
        if(url==="/calendar/events"&&request.method==="GET"){
          if(!hasPermission(currentUser,"calendar.view"))return json(response,403,{message:"Você não possui acesso à agenda."});
          return json(response,200,{events:[...calendarEvents.values()].filter(canSeeEvent).sort((a,b)=>a.startAt.localeCompare(b.startAt)),canViewTeam:hasPermission(currentUser,"calendar.view_team"),canEditAll:hasPermission(currentUser,"calendar.edit_all")});
        }
        if(url==="/calendar/events"&&request.method==="POST"){
          if(!hasPermission(currentUser,"calendar.create"))return json(response,403,{message:"Você não possui permissão para criar eventos."});
          const input=await body(request),title=String(input.title||"").trim(),startAt=String(input.startAt||""),endAt=String(input.endAt||"");if(title.length<3||!startAt||!endAt||new Date(endAt)<=new Date(startAt))return json(response,400,{message:"Informe título e período válidos."});
          const now=new Date().toISOString(),event:CalendarEvent={id:randomUUID(),title,description:String(input.description||"").trim(),ownerId:currentUser.id,ownerName:currentUser.name,participantIds:Array.isArray(input.participantIds)?input.participantIds.map(String).filter(id=>users.has(id)):[],startAt,endAt,location:String(input.location||"").trim(),category:String(input.category||"WORK"),clientId:String(input.clientId||""),projectId:String(input.projectId||""),opportunityId:String(input.opportunityId||""),taskId:String(input.taskId||""),recurrence:String(input.recurrence||"NONE"),reminderMinutes:Number(input.reminderMinutes||15),createdAt:now,updatedAt:now};calendarEvents.set(event.id,event);persistCalendarEvents();return json(response,201,{event});
        }
        const calendarMatch=url.match(/^\/calendar\/events\/([^/]+)$/);
        if(calendarMatch&&request.method==="PATCH"){
          const event=calendarEvents.get(calendarMatch[1]);if(!event||!canSeeEvent(event))return json(response,404,{message:"Evento não encontrado."});if(!hasPermission(currentUser,"calendar.edit")||(event.ownerId!==currentUser.id&&!hasPermission(currentUser,"calendar.edit_all")))return json(response,403,{message:"Você só pode editar seus próprios eventos."});
          const input=await body(request);Object.assign(event,{title:input.title!==undefined?String(input.title).trim():event.title,description:input.description!==undefined?String(input.description).trim():event.description,startAt:input.startAt!==undefined?String(input.startAt):event.startAt,endAt:input.endAt!==undefined?String(input.endAt):event.endAt,location:input.location!==undefined?String(input.location):event.location,updatedAt:new Date().toISOString()});calendarEvents.set(event.id,event);persistCalendarEvents();return json(response,200,{event});
        }
        if(calendarMatch&&request.method==="DELETE"){
          const event=calendarEvents.get(calendarMatch[1]);if(!event||!canSeeEvent(event))return json(response,404,{message:"Evento não encontrado."});if(event.ownerId!==currentUser.id&&!hasPermission(currentUser,"calendar.delete"))return json(response,403,{message:"Você não pode excluir este evento."});
          calendarEvents.delete(event.id);persistCalendarEvents();return json(response,200,{ok:true});
        }
        if (url === "/clients" && request.method === "GET") {
          if (!hasPermission(currentUser, "clients.view")) return json(response, 403, { message: "Você não possui acesso aos clientes." });
          return json(response, 200, { clients: [...clients.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")) });
        }
        if (url === "/clients" && request.method === "POST") {
          if (!hasPermission(currentUser, "clients.create")) return json(response, 403, { message: "Você não possui permissão para criar clientes." });
          const input = await body(request);
          const name = String(input.name || "").trim();
          const document=String(input.document||"").trim(),primaryContactPhone=String(input.primaryContactPhone||"").trim();
          if (name.length < 2 || name.length > 120) return json(response, 400, { message: "Informe um nome de cliente válido." });
          if(document&&!validDocument(document))return json(response,400,{message:"Informe um CPF ou CNPJ válido."});
          if(!validPhone(primaryContactPhone))return json(response,400,{message:"Informe um telefone válido com DDD."});
          if ([...clients.values()].some(client=>client.name.toLowerCase()===name.toLowerCase())) return json(response, 409, { message: "Já existe um cliente com este nome." });
          const now = new Date().toISOString();
          const client:Client = { id:randomUUID(), name, legalName:String(input.legalName||"").trim(), document, status:["ACTIVE","ATTENTION","RISK","INACTIVE"].includes(input.status)?input.status:"ACTIVE", segment:String(input.segment||"").trim(), website:String(input.website||"").trim(), primaryContactName:String(input.primaryContactName||"").trim(), primaryContactEmail:String(input.primaryContactEmail||"").trim().toLowerCase(), primaryContactPhone, owner:String(input.owner||"").trim(), notes:String(input.notes||"").trim(), createdAt:now, updatedAt:now };
          clients.set(client.id,client);if(client.primaryContactName){const contact:ClientContact={id:randomUUID(),clientId:client.id,name:client.primaryContactName,role:"Contato principal",email:client.primaryContactEmail,phone:client.primaryContactPhone,whatsapp:client.primaryContactPhone,primary:true,createdAt:now};clientContacts.set(contact.id,contact);persistClientContacts()}persistClients();
          return json(response,201,{client});
        }
        const clientMatch=url.match(/^\/clients\/([^/]+)$/);
        if(clientMatch&&request.method==="GET"){
          if(!hasPermission(currentUser,"clients.view"))return json(response,403,{message:"Permissão insuficiente."});
          const client=clients.get(clientMatch[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          const services=[...clientServices.values()].filter(item=>item.clientId===client.id),projects=[...onboardingProjects.values()].filter(item=>item.clientId===client.id),contacts=[...clientContacts.values()].filter(item=>item.clientId===client.id);
          const commercial=[...opportunities.values()].filter(item=>item.convertedClientId===client.id).flatMap(item=>item.activities.map(activity=>({...activity,phase:"COMMERCIAL",opportunityId:item.id})));
          return json(response,200,{client,contacts,services,projects,timeline:[...commercial].sort((a,b)=>a.createdAt.localeCompare(b.createdAt))});
        }
        if(clientMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"clients.edit"))return json(response,403,{message:"Você não possui permissão para editar clientes."});
          const client=clients.get(clientMatch[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          const input=await body(request);const name=String(input.name||"").trim();
          const document=String(input.document||"").trim(),primaryContactPhone=String(input.primaryContactPhone||"").trim();
          if(name.length<2||name.length>120)return json(response,400,{message:"Informe um nome de cliente válido."});
          if(document&&!validDocument(document))return json(response,400,{message:"Informe um CPF ou CNPJ válido."});
          if(!validPhone(primaryContactPhone))return json(response,400,{message:"Informe um telefone válido com DDD."});
          if([...clients.values()].some(item=>item.id!==client.id&&item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Já existe outro cliente com este nome."});
          Object.assign(client,{name,legalName:String(input.legalName||"").trim(),document,status:["ACTIVE","ATTENTION","RISK","INACTIVE"].includes(input.status)?input.status:client.status,segment:String(input.segment||"").trim(),website:String(input.website||"").trim(),primaryContactName:String(input.primaryContactName||"").trim(),primaryContactEmail:String(input.primaryContactEmail||"").trim().toLowerCase(),primaryContactPhone,owner:String(input.owner||"").trim(),notes:String(input.notes||"").trim(),updatedAt:new Date().toISOString()});
          clients.set(client.id,client);persistClients();return json(response,200,{client});
        }
        if(clientMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"clients.delete"))return json(response,403,{message:"Você não possui permissão para excluir clientes."});
          const client=clients.get(clientMatch[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          if([...clientServices.values()].some(item=>item.clientId===client.id)||[...onboardingProjects.values()].some(item=>item.clientId===client.id)||[...opportunities.values()].some(item=>item.convertedClientId===client.id))return json(response,409,{message:"Este cliente possui histórico comercial, serviços ou projetos e não pode ser excluído. Altere o status para inativo ou arquivado."});
          clients.delete(client.id);persistClients();return json(response,200,{ok:true});
        }
        const clientContactCollection=url.match(/^\/clients\/([^/]+)\/contacts$/);
        if(clientContactCollection&&request.method==="POST"){
          if(!hasPermission(currentUser,"clients.edit"))return json(response,403,{message:"Você não possui permissão para editar clientes."});
          const client=clients.get(clientContactCollection[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          const input=await body(request),name=String(input.name||"").trim(),phone=String(input.phone||"").trim();
          if(name.length<2)return json(response,400,{message:"Informe o nome do contato."});if(!validPhone(phone))return json(response,400,{message:"Informe um telefone válido."});
          const primary=input.primary===true||input.primary==="true";if(primary)clientContacts.forEach(item=>{if(item.clientId===client.id)item.primary=false});
          const contact:ClientContact={id:randomUUID(),clientId:client.id,name,role:String(input.role||"").trim(),email:String(input.email||"").trim().toLowerCase(),phone,whatsapp:String(input.whatsapp||phone).trim(),primary,createdAt:new Date().toISOString()};
          clientContacts.set(contact.id,contact);if(primary){client.primaryContactName=contact.name;client.primaryContactEmail=contact.email;client.primaryContactPhone=contact.phone;client.updatedAt=new Date().toISOString();persistClients()}persistClientContacts();return json(response,201,{contact});
        }
        const clientContactMatch=url.match(/^\/clients\/([^/]+)\/contacts\/([^/]+)$/);
        if(clientContactMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"clients.edit"))return json(response,403,{message:"Você não possui permissão para editar clientes."});
          const contact=clientContacts.get(clientContactMatch[2]);if(!contact||contact.clientId!==clientContactMatch[1])return json(response,404,{message:"Contato não encontrado."});
          clientContacts.delete(contact.id);persistClientContacts();return json(response,200,{ok:true});
        }
        const clientServiceCollection=url.match(/^\/clients\/([^/]+)\/services$/);
        if(clientServiceCollection&&request.method==="POST"){
          if(!hasPermission(currentUser,"clients.edit"))return json(response,403,{message:"Você não possui permissão para editar clientes."});
          const client=clients.get(clientServiceCollection[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          const input=await body(request),name=String(input.name||"").trim(),value=Number(String(input.negotiatedValue||"0").replace(/\./g,"").replace(",","."));
          if(name.length<2||!Number.isFinite(value)||value<0)return json(response,400,{message:"Informe serviço e valor válidos."});
          const service:ClientService={id:randomUUID(),clientId:client.id,opportunityId:"",name,negotiatedValue:value,billingType:input.billingType==="ONE_TIME"?"ONE_TIME":"RECURRING",startDate:String(input.startDate||new Date().toISOString().slice(0,10)),managerUserId:String(input.managerUserId||""),createdAt:new Date().toISOString()};
          clientServices.set(service.id,service);persistClientServices();return json(response,201,{service});
        }
        const clientProjectCollection=url.match(/^\/clients\/([^/]+)\/projects$/);
        if(clientProjectCollection&&request.method==="POST"){
          if(!hasPermission(currentUser,"clients.edit"))return json(response,403,{message:"Você não possui permissão para editar clientes."});
          const client=clients.get(clientProjectCollection[1]);if(!client)return json(response,404,{message:"Cliente não encontrado."});
          const input=await body(request),name=String(input.name||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome do projeto."});
          const project:OnboardingProject={id:randomUUID(),clientId:client.id,serviceId:String(input.serviceId||""),name,objective:String(input.objective||"").trim(),responsibleId:String(input.responsibleId||""),teamIds:Array.isArray(input.teamIds)?input.teamIds.map(String).filter(id=>users.has(id)):[],startDate:String(input.startDate||""),dueDate:String(input.dueDate||""),progress:0,status:["PLANNED","ACTIVE","PAUSED","COMPLETED","CANCELLED"].includes(input.status)?input.status:"PLANNED",createdAt:new Date().toISOString(),tasks:[]};
          onboardingProjects.set(project.id,project);persistProjects();return json(response,201,{project});
        }
        if(url==="/crm/contacts"&&request.method==="GET"){
          if(!hasPermission(currentUser,"crm.view"))return json(response,403,{message:"Você não possui acesso ao CRM."});
          return json(response,200,{contacts:[...crmContacts.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
        }
        if(url==="/crm/contacts"&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.create"))return json(response,403,{message:"Você não possui permissão para criar contatos."});
          const input=await body(request),name=String(input.name||"").trim(),email=String(input.email||"").trim().toLowerCase();
          if(name.length<2)return json(response,400,{message:"Informe o nome do contato."});
          if(email&&[...crmContacts.values()].some(item=>item.email===email))return json(response,409,{message:"Já existe um contato com este e-mail."});
          const responsible=users.get(String(input.responsibleId||"")),now=new Date().toISOString(),activity:CrmActivity={id:randomUUID(),type:"CREATED",description:"Contato criado",actorId:currentUser.id,actorName:currentUser.name,createdAt:now};
          const contact:CrmContact={id:randomUUID(),name,email,phone:String(input.phone||"").trim(),whatsapp:String(input.whatsapp||input.phone||"").trim(),role:String(input.role||"").trim(),companyId:crmCompanies.has(String(input.companyId||""))?String(input.companyId):"",clientId:clients.has(String(input.clientId||""))?String(input.clientId):"",opportunityIds:Array.isArray(input.opportunityIds)?input.opportunityIds.map(String).filter(id=>opportunities.has(id)):[],responsibleId:responsible?.id||"",responsibleName:responsible?.name||"",createdAt:now,updatedAt:now,activities:[activity]};
          crmContacts.set(contact.id,contact);contact.opportunityIds.forEach(id=>{const opportunity=opportunities.get(id);if(opportunity){opportunity.contactIds=[...new Set([...(opportunity.contactIds||[]),contact.id])];opportunities.set(id,opportunity)}});persistCrmContacts();persistOpportunities();return json(response,201,{contact});
        }
        const crmContactMatch=url.match(/^\/crm\/contacts\/([^/]+)$/);
        if(crmContactMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"crm.edit"))return json(response,403,{message:"Você não possui permissão para editar contatos."});
          const contact=crmContacts.get(crmContactMatch[1]);if(!contact)return json(response,404,{message:"Contato não encontrado."});const input=await body(request),previous=[...contact.opportunityIds],responsible=users.get(String(input.responsibleId||""));
          contact.name=String(input.name||contact.name).trim();contact.email=String(input.email??contact.email).trim().toLowerCase();contact.phone=String(input.phone??contact.phone).trim();contact.whatsapp=String(input.whatsapp??contact.whatsapp).trim();contact.role=String(input.role??contact.role).trim();contact.companyId=crmCompanies.has(String(input.companyId||""))?String(input.companyId):"";contact.clientId=clients.has(String(input.clientId||""))?String(input.clientId):"";contact.opportunityIds=Array.isArray(input.opportunityIds)?input.opportunityIds.map(String).filter(id=>opportunities.has(id)):contact.opportunityIds;contact.responsibleId=responsible?.id||"";contact.responsibleName=responsible?.name||"";contact.updatedAt=new Date().toISOString();contact.activities.push({id:randomUUID(),type:"UPDATED",description:"Dados e vínculos do contato atualizados",actorId:currentUser.id,actorName:currentUser.name,createdAt:contact.updatedAt});
          opportunities.forEach(opportunity=>{if(previous.includes(opportunity.id)&&!contact.opportunityIds.includes(opportunity.id))opportunity.contactIds=(opportunity.contactIds||[]).filter(id=>id!==contact.id);if(contact.opportunityIds.includes(opportunity.id))opportunity.contactIds=[...new Set([...(opportunity.contactIds||[]),contact.id])]});crmContacts.set(contact.id,contact);persistCrmContacts();persistOpportunities();return json(response,200,{contact});
        }
        if(crmContactMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"crm.delete"))return json(response,403,{message:"Você não possui permissão para excluir contatos."});
          const contact=crmContacts.get(crmContactMatch[1]);if(!contact)return json(response,404,{message:"Contato não encontrado."});opportunities.forEach(item=>item.contactIds=(item.contactIds||[]).filter(id=>id!==contact.id));crmContacts.delete(contact.id);persistCrmContacts();persistOpportunities();return json(response,200,{ok:true});
        }
        const crmContactActivity=url.match(/^\/crm\/contacts\/([^/]+)\/activities$/);
        if(crmContactActivity&&request.method==="POST"){
          const contact=crmContacts.get(crmContactActivity[1]);if(!contact)return json(response,404,{message:"Contato não encontrado."});const input=await body(request),description=String(input.description||"").trim();if(!description)return json(response,400,{message:"Descreva a atividade."});contact.updatedAt=new Date().toISOString();contact.activities.push({id:randomUUID(),type:String(input.type||"NOTE"),description,actorId:currentUser.id,actorName:currentUser.name,createdAt:contact.updatedAt});crmContacts.set(contact.id,contact);persistCrmContacts();return json(response,201,{contact});
        }
        if(url==="/crm/companies"&&request.method==="GET"){
          if(!hasPermission(currentUser,"crm.view"))return json(response,403,{message:"Você não possui acesso ao CRM."});
          return json(response,200,{companies:[...crmCompanies.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
        }
        if(url==="/crm/companies"&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.create"))return json(response,403,{message:"Você não possui permissão para criar empresas."});
          const input=await body(request),name=String(input.name||"").trim(),document=String(input.document||"").trim();if(name.length<2)return json(response,400,{message:"Informe o nome da empresa."});if(document&&!validDocument(document))return json(response,400,{message:"Informe um CPF ou CNPJ válido."});if(document&&[...crmCompanies.values()].some(item=>onlyDigits(item.document)===onlyDigits(document)))return json(response,409,{message:"Já existe uma empresa com este documento."});
          const responsible=users.get(String(input.responsibleId||"")),now=new Date().toISOString(),company:CrmCompany={id:randomUUID(),name,legalName:String(input.legalName||"").trim(),document,website:String(input.website||"").trim(),phone:String(input.phone||"").trim(),segment:String(input.segment||"").trim(),clientId:clients.has(String(input.clientId||""))?String(input.clientId):"",responsibleId:responsible?.id||"",responsibleName:responsible?.name||"",createdAt:now,updatedAt:now,activities:[{id:randomUUID(),type:"CREATED",description:"Empresa criada",actorId:currentUser.id,actorName:currentUser.name,createdAt:now}]};crmCompanies.set(company.id,company);persistCrmCompanies();return json(response,201,{company});
        }
        const crmCompanyMatch=url.match(/^\/crm\/companies\/([^/]+)$/);
        if(crmCompanyMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"crm.edit"))return json(response,403,{message:"Você não possui permissão para editar empresas."});const company=crmCompanies.get(crmCompanyMatch[1]);if(!company)return json(response,404,{message:"Empresa não encontrada."});const input=await body(request),responsible=users.get(String(input.responsibleId||""));company.name=String(input.name||company.name).trim();company.legalName=String(input.legalName??company.legalName).trim();company.document=String(input.document??company.document).trim();company.website=String(input.website??company.website).trim();company.phone=String(input.phone??company.phone).trim();company.segment=String(input.segment??company.segment).trim();company.clientId=clients.has(String(input.clientId||""))?String(input.clientId):"";company.responsibleId=responsible?.id||"";company.responsibleName=responsible?.name||"";company.updatedAt=new Date().toISOString();company.activities.push({id:randomUUID(),type:"UPDATED",description:"Dados da empresa atualizados",actorId:currentUser.id,actorName:currentUser.name,createdAt:company.updatedAt});crmCompanies.set(company.id,company);persistCrmCompanies();return json(response,200,{company});
        }
        if(crmCompanyMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"crm.delete"))return json(response,403,{message:"Você não possui permissão para excluir empresas."});const company=crmCompanies.get(crmCompanyMatch[1]);if(!company)return json(response,404,{message:"Empresa não encontrada."});if([...crmContacts.values()].some(item=>item.companyId===company.id)||[...opportunities.values()].some(item=>item.companyId===company.id))return json(response,409,{message:"Remova ou altere os vínculos de contatos e oportunidades antes de excluir esta empresa."});crmCompanies.delete(company.id);persistCrmCompanies();return json(response,200,{ok:true});
        }
        const crmCompanyActivity=url.match(/^\/crm\/companies\/([^/]+)\/activities$/);
        if(crmCompanyActivity&&request.method==="POST"){const company=crmCompanies.get(crmCompanyActivity[1]);if(!company)return json(response,404,{message:"Empresa não encontrada."});const input=await body(request),description=String(input.description||"").trim();if(!description)return json(response,400,{message:"Descreva a atividade."});company.updatedAt=new Date().toISOString();company.activities.push({id:randomUUID(),type:String(input.type||"NOTE"),description,actorId:currentUser.id,actorName:currentUser.name,createdAt:company.updatedAt});crmCompanies.set(company.id,company);persistCrmCompanies();return json(response,201,{company})}
        if(url==="/crm/pipelines"&&request.method==="GET"){
          if(!hasPermission(currentUser,"crm.view"))return json(response,403,{message:"Você não possui acesso ao CRM."});
          return json(response,200,{pipelines:[...pipelines.values()].filter(item=>canAccessPipeline(currentUser,item)),canManage:hasPermission(currentUser,"crm.manage_pipelines")});
        }
        if(url==="/crm/pipelines"&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para administrar pipelines."});
          const input=await body(request),name=String(input.name||"").trim(),departmentIds=Array.isArray(input.departmentIds)?input.departmentIds.map(String).filter(id=>departments.has(id)):[];
          if(name.length<2||name.length>80)return json(response,400,{message:"Informe um nome de pipeline válido."});
          if([...pipelines.values()].some(item=>item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Já existe um pipeline com este nome."});
          const pipeline:CrmPipeline={id:randomUUID(),name,departmentIds,createdAt:new Date().toISOString(),stages:[
            {id:randomUUID(),name:"Novo lead",color:"#4f8df7",probability:10},
            {id:randomUUID(),name:"Fechado — ganho",color:"#239667",probability:100,terminal:"WON"},
            {id:randomUUID(),name:"Fechado — perdido",color:"#8a96a8",probability:0,terminal:"LOST"}]};
          pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,201,{pipeline});
        }
        const pipelineMatch=url.match(/^\/crm\/pipelines\/([^/]+)$/);
        if(pipelineMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para administrar pipelines."});
          const pipeline=pipelines.get(pipelineMatch[1]);if(!pipeline)return json(response,404,{message:"Pipeline não encontrado."});
          const input=await body(request),name=String(input.name||"").trim();
          if(name.length<2||name.length>80)return json(response,400,{message:"Informe um nome de pipeline válido."});
          if([...pipelines.values()].some(item=>item.id!==pipeline.id&&item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Já existe outro pipeline com este nome."});
          pipeline.name=name;if(Array.isArray(input.departmentIds))pipeline.departmentIds=input.departmentIds.map(String).filter(id=>departments.has(id));pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,200,{pipeline});
        }
        if(pipelineMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para administrar pipelines."});
          const pipeline=pipelines.get(pipelineMatch[1]);if(!pipeline)return json(response,404,{message:"Pipeline não encontrado."});
          if(pipelines.size<=1)return json(response,409,{message:"O CRM precisa manter pelo menos um pipeline."});
          const linked=[...opportunities.values()].filter(item=>item.pipelineId===pipeline.id);
          if(linked.length){
            const input=await body(request),target=pipelines.get(String(input.targetPipelineId||""));
            if(!target||target.id===pipeline.id)return json(response,409,{message:"Selecione outro CRM para receber as oportunidades deste funil."});
            const targetStage=target.stages.find(stage=>!stage.terminal);
            if(!targetStage)return json(response,409,{message:"O CRM de destino precisa possuir pelo menos uma etapa aberta."});
            const now=new Date().toISOString();
            linked.forEach(opportunity=>{
              const previousStage=pipeline.stages.find(stage=>stage.id===opportunity.stageId);
              opportunity.pipelineId=target.id;opportunity.stageId=targetStage.id;opportunity.stageEnteredAt=now;opportunity.updatedAt=now;
              opportunity.activities.push({id:randomUUID(),type:"PIPELINE_CHANGED",description:`Transferida do CRM ${pipeline.name} (${previousStage?.name||"etapa removida"}) para ${target.name} (${targetStage.name}) antes da exclusão do funil`,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:{fromPipelineId:pipeline.id,toPipelineId:target.id,fromStageId:previousStage?.id||"",toStageId:targetStage.id}});
              opportunities.set(opportunity.id,opportunity);
            });
            persistOpportunities();
          }
          pipelines.delete(pipeline.id);persistPipelines();return json(response,200,{ok:true});
        }
        const pipelineStageCollectionMatch=url.match(/^\/crm\/pipelines\/([^/]+)\/stages$/);
        if(pipelineStageCollectionMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para administrar etapas."});
          const pipeline=pipelines.get(pipelineStageCollectionMatch[1]);if(!pipeline)return json(response,404,{message:"Pipeline não encontrado."});
          const input=await body(request),name=String(input.name||"").trim(),probability=Math.round(Number(input.probability));
          if(name.length<2||name.length>60)return json(response,400,{message:"Informe um nome de etapa válido."});
          if(!Number.isFinite(probability)||probability<0||probability>100)return json(response,400,{message:"A probabilidade deve estar entre 0 e 100."});
          if(pipeline.stages.some(item=>item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Esta etapa já existe no pipeline."});
          const terminal=["WON","LOST"].includes(String(input.terminal))?input.terminal as "WON"|"LOST":undefined;
          if(terminal&&pipeline.stages.some(item=>item.terminal===terminal))return json(response,409,{message:`O pipeline já possui uma etapa final ${terminal==="WON"?"de ganho":"de perda"}.`});
          const stage:CrmStage={id:randomUUID(),name,color:/^#[0-9a-f]{6}$/i.test(String(input.color))?String(input.color):"#4f8df7",probability,requiredFields:Array.isArray(input.requiredFields)?input.requiredFields.map(String):[],terminal};
          const terminalIndex=pipeline.stages.findIndex(item=>item.terminal);terminalIndex<0?pipeline.stages.push(stage):pipeline.stages.splice(terminalIndex,0,stage);
          pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,201,{stage,pipeline});
        }
        const pipelineReorderMatch=url.match(/^\/crm\/pipelines\/([^/]+)\/stages\/reorder$/);
        if(pipelineReorderMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para reordenar etapas."});
          const pipeline=pipelines.get(pipelineReorderMatch[1]);if(!pipeline)return json(response,404,{message:"Pipeline não encontrado."});
          const input=await body(request),ids=Array.isArray(input.stageIds)?input.stageIds.map(String):[];
          if(ids.length!==pipeline.stages.length||new Set(ids).size!==ids.length||ids.some(id=>!pipeline.stages.some(stage=>stage.id===id)))return json(response,400,{message:"A ordem enviada não corresponde às etapas do pipeline."});
          pipeline.stages=ids.map(id=>pipeline.stages.find(stage=>stage.id===id)!);pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,200,{pipeline});
        }
        const pipelineStageMatch=url.match(/^\/crm\/pipelines\/([^/]+)\/stages\/([^/]+)$/);
        if(pipelineStageMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para editar etapas."});
          const pipeline=pipelines.get(pipelineStageMatch[1]),stage=pipeline?.stages.find(item=>item.id===pipelineStageMatch[2]);if(!pipeline||!stage)return json(response,404,{message:"Etapa não encontrada."});
          const input=await body(request),name=String(input.name||"").trim(),probability=Math.round(Number(input.probability));
          if(name.length<2||name.length>60)return json(response,400,{message:"Informe um nome de etapa válido."});
          if(!Number.isFinite(probability)||probability<0||probability>100)return json(response,400,{message:"A probabilidade deve estar entre 0 e 100."});
          if(pipeline.stages.some(item=>item.id!==stage.id&&item.name.toLowerCase()===name.toLowerCase()))return json(response,409,{message:"Já existe outra etapa com este nome."});
          stage.name=name;stage.probability=probability;stage.requiredFields=Array.isArray(input.requiredFields)?input.requiredFields.map(String):stage.requiredFields||[];if(/^#[0-9a-f]{6}$/i.test(String(input.color)))stage.color=String(input.color);
          pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,200,{stage,pipeline});
        }
        if(pipelineStageMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"crm.manage_pipelines"))return json(response,403,{message:"Você não possui permissão para excluir etapas."});
          const pipeline=pipelines.get(pipelineStageMatch[1]),stage=pipeline?.stages.find(item=>item.id===pipelineStageMatch[2]);if(!pipeline||!stage)return json(response,404,{message:"Etapa não encontrada."});
          if(stage.terminal)return json(response,409,{message:"Etapas finais de ganho e perda são obrigatórias e não podem ser excluídas."});
          if([...opportunities.values()].some(item=>item.pipelineId===pipeline.id&&item.stageId===stage.id))return json(response,409,{message:"Mova as oportunidades desta etapa antes de excluí-la."});
          pipeline.stages=pipeline.stages.filter(item=>item.id!==stage.id);pipelines.set(pipeline.id,pipeline);persistPipelines();return json(response,200,{pipeline});
        }
        if(url==="/crm/opportunities"&&request.method==="GET"){
          if(!hasPermission(currentUser,"crm.view"))return json(response,403,{message:"Você não possui acesso ao CRM."});
          return json(response,200,{opportunities:[...opportunities.values()].filter(item=>{const pipeline=pipelines.get(item.pipelineId);return !!pipeline&&canAccessPipeline(currentUser,pipeline)}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))});
        }
        if(url==="/crm/opportunities"&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.create"))return json(response,403,{message:"Você não possui permissão para criar oportunidades."});
          const input=await body(request);const name=String(input.name||"").trim();const pipeline=pipelines.get(String(input.pipelineId||""))||[...pipelines.values()][0];const stage=pipeline?.stages.find(item=>item.id===input.stageId)||pipeline?.stages.find(item=>!item.terminal);
          if(name.length<2||!pipeline||!stage)return json(response,400,{message:"Informe o lead e uma etapa inicial válidos."});
          if(!canAccessPipeline(currentUser,pipeline))return json(response,403,{message:"Seu setor não possui acesso a este CRM."});
          const responsible=users.get(String(input.responsibleId||""));const now=new Date().toISOString();
          const activity:CrmActivity={id:randomUUID(),type:"CREATED",description:"Oportunidade criada",actorId:currentUser.id,actorName:currentUser.name,createdAt:now};
          const companyRecord=crmCompanies.get(String(input.companyId||"")),contactIds=Array.isArray(input.contactIds)?input.contactIds.map(String).filter(id=>crmContacts.has(id)):[];
          const opportunity:Opportunity={id:randomUUID(),name,company:companyRecord?.name||String(input.company||"").trim(),companyId:companyRecord?.id||"",contactIds,email:String(input.email||"").trim().toLowerCase(),phone:String(input.phone||"").trim(),whatsapp:String(input.whatsapp||input.phone||"").trim(),serviceInterest:String(input.serviceInterest||"").trim(),potentialValue:Number(String(input.potentialValue||"0").replace(/\./g,"").replace(",","."))||0,temperature:["COLD","WARM","HOT"].includes(input.temperature)?input.temperature:"WARM",priority:["LOW","MEDIUM","HIGH"].includes(input.priority)?input.priority:"MEDIUM",responsibleId:responsible?.id||"",responsibleName:responsible?.name||"",teamIds:Array.isArray(input.teamIds)?input.teamIds.map(String).filter(id=>users.has(id)):[],tags:Array.isArray(input.tags)?input.tags.map(String):String(input.tags||"").split(",").map(item=>item.trim()).filter(Boolean),pipelineId:pipeline.id,stageId:stage.id,status:"OPEN",nextAction:String(input.nextAction||"").trim(),nextActionAt:String(input.nextActionAt||""),stageEnteredAt:now,createdAt:now,updatedAt:now,activities:[activity],proposals:[]};
          contactIds.forEach(id=>{const contact=crmContacts.get(id);if(contact){contact.opportunityIds=[...new Set([...contact.opportunityIds,opportunity.id])];contact.updatedAt=now;crmContacts.set(id,contact)}});if(contactIds.length)persistCrmContacts();
          opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,201,{opportunity});
        }
        const opportunityStageMatch=url.match(/^\/crm\/opportunities\/([^/]+)\/stage$/);
        if(opportunityStageMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.move_stage"))return json(response,403,{message:"Você não possui permissão para mover oportunidades."});
          const opportunity=opportunities.get(opportunityStageMatch[1]);if(!opportunity)return json(response,404,{message:"Oportunidade não encontrada."});
          const scopedPipeline=pipelines.get(opportunity.pipelineId);if(!scopedPipeline||!canAccessPipeline(currentUser,scopedPipeline))return json(response,403,{message:"Seu setor não possui acesso a este CRM."});
          if(opportunity.status==="CONVERTED")return json(response,409,{message:"Uma oportunidade convertida não pode ser movida."});
          const input=await body(request);const pipeline=pipelines.get(opportunity.pipelineId);const stage=pipeline?.stages.find(item=>item.id===input.stageId);
          if(!stage)return json(response,400,{message:"Etapa inválida."});if(stage.terminal==="WON")return json(response,409,{message:"Use o fluxo de conversão para fechar esta oportunidade como ganha."});
          const requiredLabels:Record<string,string>={company:"empresa",email:"e-mail",phone:"telefone",serviceInterest:"serviço de interesse",potentialValue:"valor potencial",responsibleId:"responsável",nextAction:"próxima ação",nextActionAt:"data da próxima ação"};
          const missing=(stage.requiredFields||[]).filter(field=>{const value=(opportunity as unknown as Record<string,unknown>)[field];return value===undefined||value===null||value===""||field==="potentialValue"&&Number(value)<=0});
          if(missing.length)return json(response,400,{message:`Complete os campos obrigatórios antes de entrar nesta etapa: ${missing.map(field=>requiredLabels[field]||field).join(", ")}.`});
          if(stage.terminal==="LOST"&&!String(input.lossReason||"").trim())return json(response,400,{message:"Informe o motivo da perda."});
          const previous=pipeline?.stages.find(item=>item.id===opportunity.stageId);const now=new Date().toISOString();
          opportunity.stageId=stage.id;opportunity.stageEnteredAt=now;opportunity.updatedAt=now;opportunity.status=stage.terminal==="LOST"?"LOST":"OPEN";opportunity.lossReason=stage.terminal==="LOST"?String(input.lossReason).trim():undefined;
          opportunity.activities.push({id:randomUUID(),type:"STAGE_CHANGED",description:`Movida de ${previous?.name||"etapa anterior"} para ${stage.name}`,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:{fromStageId:previous?.id||"",toStageId:stage.id,lossReason:opportunity.lossReason||""}});
          opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,200,{opportunity});
        }
        const opportunityConvertMatch=url.match(/^\/crm\/opportunities\/([^/]+)\/convert$/);
        if(opportunityConvertMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.convert"))return json(response,403,{message:"Você não possui permissão para converter leads."});
          const opportunity=opportunities.get(opportunityConvertMatch[1]);if(!opportunity)return json(response,404,{message:"Oportunidade não encontrada."});
          const scopedPipeline=pipelines.get(opportunity.pipelineId);if(!scopedPipeline||!canAccessPipeline(currentUser,scopedPipeline))return json(response,403,{message:"Seu setor não possui acesso a este CRM."});
          if(opportunity.convertedClientId||opportunity.status==="CONVERTED")return json(response,409,{message:"Esta oportunidade já foi convertida."});
          const input=await body(request),clientName=String(input.clientName||"").trim(),document=String(input.document||"").trim(),email=String(input.email||opportunity.email||"").trim().toLowerCase(),phone=String(input.phone||opportunity.phone||"").trim();
          if(clientName.length<2||!String(input.serviceName||"").trim()||!String(input.startDate||""))return json(response,400,{message:"Informe cliente, serviço contratado e data de início."});
          if(document&&!validDocument(document))return json(response,400,{message:"Informe um CPF ou CNPJ válido."});if(!validPhone(phone))return json(response,400,{message:"Informe um telefone válido."});
          const normalized=(value:string)=>onlyDigits(value),domain=(value:string)=>{try{return new URL(/^https?:/.test(value)?value:`https://${value}`).hostname.replace(/^www\./,"")}catch{return ""}};
          const duplicates=[...clients.values()].flatMap(client=>{const reasons:string[]=[];if(document&&normalized(client.document)===normalized(document))reasons.push("mesmo CPF/CNPJ");if(email&&client.primaryContactEmail===email)reasons.push("mesmo e-mail");if(phone&&normalized(client.primaryContactPhone)===normalized(phone))reasons.push("mesmo telefone");if(client.name.toLowerCase()===clientName.toLowerCase())reasons.push("mesmo nome");if(domain(client.website)&&domain(client.website)===domain(String(input.website||"")))reasons.push("mesmo domínio");return reasons.length?[{id:client.id,name:client.name,reason:reasons.join(", ")}]:[]});
          const existingClientId=String(input.existingClientId||""),existingClient=existingClientId?clients.get(existingClientId):undefined;
          if(existingClientId&&!existingClient)return json(response,400,{message:"Selecione um cliente existente válido."});
          if(duplicates.length&&!input.allowDuplicate&&!existingClient)return json(response,409,{message:"Possível cliente duplicado.",duplicates});
          const now=new Date().toISOString(),clientId=existingClient?.id||randomUUID();
          const client:Client=existingClient||{id:clientId,name:clientName,legalName:String(input.legalName||"").trim(),document,status:"ACTIVE",segment:String(input.segment||"").trim(),website:String(input.website||"").trim(),primaryContactName:opportunity.name,primaryContactEmail:email,primaryContactPhone:phone,owner:users.get(String(input.managerUserId||""))?.name||opportunity.responsibleName,notes:`Originado da oportunidade ${opportunity.id}.`,createdAt:now,updatedAt:now};
          const service:ClientService={id:randomUUID(),clientId:client.id,opportunityId:opportunity.id,name:String(input.serviceName).trim(),negotiatedValue:Number(String(input.negotiatedValue||opportunity.potentialValue).replace(/\./g,"").replace(",","."))||0,billingType:input.billingType==="ONE_TIME"?"ONE_TIME":"RECURRING",startDate:String(input.startDate),managerUserId:String(input.managerUserId||""),createdAt:now};
          if(!existingClient)clients.set(client.id,client);clientServices.set(service.id,service);opportunity.status="CONVERTED";opportunity.convertedClientId=client.id;opportunity.convertedAt=now;opportunity.convertedBy=currentUser.id;opportunity.stageId=pipelines.get(opportunity.pipelineId)?.stages.find(item=>item.terminal==="WON")?.id||opportunity.stageId;opportunity.stageEnteredAt=now;opportunity.updatedAt=now;
          opportunity.activities.push({id:randomUUID(),type:"CONVERTED",description:`Convertida em cliente: ${client.name}`,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:{clientId:client.id,serviceId:service.id}});
          if(input.createOnboarding==="true"){const project:OnboardingProject={id:randomUUID(),clientId:client.id,serviceId:service.id,name:`Onboarding — ${client.name}`,status:"PLANNED",createdAt:now,tasks:[{id:randomUUID(),title:"Reunião de kickoff",status:"TODO"},{id:randomUUID(),title:"Coletar acessos e materiais",status:"TODO"},{id:randomUUID(),title:"Validar planejamento inicial",status:"TODO"}]};onboardingProjects.set(project.id,project)}
          persistClients();persistClientServices();persistOpportunities();persistProjects();return json(response,201,{client,service,opportunity});
        }
        const opportunityReverseMatch=url.match(/^\/crm\/opportunities\/([^/]+)\/reverse-conversion$/);
        if(opportunityReverseMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.reverse_conversion"))return json(response,403,{message:"Você não possui permissão para reverter conversões."});
          const opportunity=opportunities.get(opportunityReverseMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          if(!opportunity||!pipeline||!canAccessPipeline(currentUser,pipeline))return json(response,404,{message:"Oportunidade não encontrada."});
          if(opportunity.status!=="CONVERTED"||!opportunity.convertedClientId)return json(response,409,{message:"Esta oportunidade não possui uma conversão ativa."});
          const input=await body(request),reason=String(input.reason||"").trim();if(reason.length<10)return json(response,400,{message:"Informe uma justificativa com pelo menos 10 caracteres."});
          const derivedServices=[...clientServices.values()].filter(item=>item.opportunityId===opportunity.id),derivedProjects=[...onboardingProjects.values()].filter(item=>derivedServices.some(service=>service.id===item.serviceId));const now=new Date().toISOString(),clientId=opportunity.convertedClientId;
          opportunity.status="OPEN";delete opportunity.convertedClientId;delete opportunity.convertedAt;delete opportunity.convertedBy;opportunity.stageId=pipeline.stages.find(item=>!item.terminal)?.id||opportunity.stageId;opportunity.stageEnteredAt=now;opportunity.updatedAt=now;
          opportunity.activities.push({id:randomUUID(),type:"CONVERSION_REVERSED",description:`Conversão revertida: ${reason}`,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:{clientId,servicesPreserved:String(derivedServices.length),projectsPreserved:String(derivedProjects.length)}});
          opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,200,{opportunity,impact:{clientPreserved:true,servicesPreserved:derivedServices.length,projectsPreserved:derivedProjects.length}});
        }
        const opportunityActivityMatch=url.match(/^\/crm\/opportunities\/([^/]+)\/activities$/);
        if(opportunityActivityMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.edit"))return json(response,403,{message:"Você não possui permissão para registrar atividades."});
          const opportunity=opportunities.get(opportunityActivityMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          if(!opportunity||!pipeline||!canAccessPipeline(currentUser,pipeline))return json(response,404,{message:"Oportunidade não encontrada."});
          const input=await body(request),description=String(input.description||"").trim(),allowedTypes=["NOTE","CALL","MESSAGE","EMAIL","MEETING","COMMENT","FILE"];
          if(description.length<2)return json(response,400,{message:"Descreva a atividade comercial."});
          const type=allowedTypes.includes(String(input.type))?String(input.type):"NOTE",now=new Date().toISOString();
          const activity:CrmActivity={id:randomUUID(),type,description,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:input.metadata&&typeof input.metadata==="object"?Object.fromEntries(Object.entries(input.metadata).map(([key,value])=>[key,String(value)])):undefined};
          opportunity.activities.push(activity);opportunity.updatedAt=now;opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,201,{activity,opportunity});
        }
        const opportunityProposalMatch=url.match(/^\/crm\/opportunities\/([^/]+)\/proposals$/);
        if(opportunityProposalMatch&&request.method==="POST"){
          if(!hasPermission(currentUser,"crm.edit"))return json(response,403,{message:"Você não possui permissão para adicionar propostas."});
          const opportunity=opportunities.get(opportunityProposalMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          if(!opportunity||!pipeline||!canAccessPipeline(currentUser,pipeline))return json(response,404,{message:"Oportunidade não encontrada."});
          const input=await body(request),title=String(input.title||"").trim(),value=Number(String(input.value||"0").replace(/\./g,"").replace(",","."));
          if(title.length<2||!Number.isFinite(value)||value<0)return json(response,400,{message:"Informe título e valor válidos para a proposta."});
          const now=new Date().toISOString(),proposal:CrmProposal={id:randomUUID(),title,value,status:["DRAFT","SENT","ACCEPTED","REJECTED"].includes(input.status)?input.status:"DRAFT",validUntil:String(input.validUntil||""),notes:String(input.notes||"").trim(),createdBy:currentUser.id,createdAt:now};
          opportunity.proposals.push(proposal);opportunity.activities.push({id:randomUUID(),type:"PROPOSAL",description:`Proposta adicionada: ${title} — R$ ${value.toFixed(2)}`,actorId:currentUser.id,actorName:currentUser.name,createdAt:now,metadata:{proposalId:proposal.id,status:proposal.status}});opportunity.updatedAt=now;
          opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,201,{proposal,opportunity});
        }
        const opportunityMatch=url.match(/^\/crm\/opportunities\/([^/]+)$/);
        if(opportunityMatch&&request.method==="GET"){
          if(!hasPermission(currentUser,"crm.view"))return json(response,403,{message:"Você não possui acesso ao CRM."});
          const opportunity=opportunities.get(opportunityMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          return opportunity&&pipeline&&canAccessPipeline(currentUser,pipeline)?json(response,200,{opportunity}):json(response,404,{message:"Oportunidade não encontrada."});
        }
        if(opportunityMatch&&request.method==="PATCH"){
          if(!hasPermission(currentUser,"crm.edit"))return json(response,403,{message:"Você não possui permissão para editar oportunidades."});
          const opportunity=opportunities.get(opportunityMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          if(!opportunity||!pipeline||!canAccessPipeline(currentUser,pipeline))return json(response,404,{message:"Oportunidade não encontrada."});
          if(opportunity.status==="CONVERTED")return json(response,409,{message:"Dados comerciais de uma oportunidade convertida não podem ser alterados."});
          const input=await body(request),name=String(input.name||"").trim(),responsible=users.get(String(input.responsibleId||""));
          if(name.length<2||name.length>120)return json(response,400,{message:"Informe um nome de lead válido."});
          const before={name:opportunity.name,company:opportunity.company,responsibleName:opportunity.responsibleName,potentialValue:String(opportunity.potentialValue)};
          const companyRecord=crmCompanies.get(String(input.companyId||"")),contactIds=Array.isArray(input.contactIds)?input.contactIds.map(String).filter(id=>crmContacts.has(id)):opportunity.contactIds||[];
          Object.assign(opportunity,{name,company:companyRecord?.name||String(input.company||"").trim(),companyId:companyRecord?.id||"",contactIds,email:String(input.email||"").trim().toLowerCase(),phone:String(input.phone||"").trim(),whatsapp:String(input.whatsapp||input.phone||"").trim(),serviceInterest:String(input.serviceInterest||"").trim(),potentialValue:Number(String(input.potentialValue||"0").replace(/\./g,"").replace(",","."))||0,temperature:["COLD","WARM","HOT"].includes(input.temperature)?input.temperature:opportunity.temperature,priority:["LOW","MEDIUM","HIGH"].includes(input.priority)?input.priority:opportunity.priority,responsibleId:responsible?.id||"",responsibleName:responsible?.name||"",teamIds:Array.isArray(input.teamIds)?input.teamIds.map(String).filter(id=>users.has(id)):opportunity.teamIds,tags:Array.isArray(input.tags)?input.tags.map(String):String(input.tags||"").split(",").map(item=>item.trim()).filter(Boolean),nextAction:String(input.nextAction||"").trim(),nextActionAt:String(input.nextActionAt||""),updatedAt:new Date().toISOString()});
          crmContacts.forEach(contact=>{contact.opportunityIds=contactIds.includes(contact.id)?[...new Set([...contact.opportunityIds,opportunity.id])]:contact.opportunityIds.filter(id=>id!==opportunity.id)});persistCrmContacts();
          opportunity.activities.push({id:randomUUID(),type:"UPDATED",description:"Dados da oportunidade atualizados",actorId:currentUser.id,actorName:currentUser.name,createdAt:opportunity.updatedAt,metadata:before});
          opportunities.set(opportunity.id,opportunity);persistOpportunities();return json(response,200,{opportunity});
        }
        if(opportunityMatch&&request.method==="DELETE"){
          if(!hasPermission(currentUser,"crm.delete"))return json(response,403,{message:"Você não possui permissão para excluir oportunidades."});
          const opportunity=opportunities.get(opportunityMatch[1]),pipeline=opportunity&&pipelines.get(opportunity.pipelineId);
          if(!opportunity||!pipeline||!canAccessPipeline(currentUser,pipeline))return json(response,404,{message:"Oportunidade não encontrada."});
          if(opportunity.convertedClientId||opportunity.status==="CONVERTED")return json(response,409,{message:"Uma oportunidade convertida não pode ser excluída. O histórico comercial deve ser preservado."});
          opportunities.delete(opportunity.id);persistOpportunities();return json(response,200,{ok:true});
        }
        if (currentUser.profile === "CLIENT" && url.startsWith("/integrations")) return json(response, 403, { message: "Clientes externos não acessam a Central de Conexões." });
        if (url === "/permissions/catalog" && request.method === "GET") return json(response, 200, { modules: permissionCatalog });
        if (url === "/roles" && request.method === "GET") return json(response, 200, { roles: [...roles.values()].map(role => ({ ...role, userCount: [...users.values()].filter(user => user.roleId === role.id).length })) });
        if (url === "/roles" && request.method === "POST") {
          if (!hasPermission(currentUser, "roles.create")) return json(response, 403, { message: "Permissão insuficiente." });
          const input = await body(request);
          if (!input.name) return json(response, 400, { message: "Informe o nome do cargo." });
          const role: Role = { id: randomUUID(), name: input.name, description: input.description || "", level: Number(input.level || 10), system: false, permissions: Array.isArray(input.permissions) ? input.permissions.filter(permission => allPermissions.includes(permission)) : [] };
          roles.set(role.id, role); persistRoles();
          return json(response, 201, { role });
        }
        const roleMatch = url.match(/^\/roles\/([^/]+)$/);
        if (roleMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "roles.edit")) return json(response, 403, { message: "Permissão insuficiente." });
          const role = roles.get(roleMatch[1]);
          if (!role || role.system) return json(response, 403, { message: "Cargo protegido." });
          const input = await body(request);
          role.name = input.name || role.name; role.description = input.description ?? role.description; role.level = Number(input.level || role.level);
          role.permissions = Array.isArray(input.permissions) ? input.permissions.filter(permission => allPermissions.includes(permission)) : role.permissions;
          roles.set(role.id, role);
          users.forEach(user => { if (user.roleId === role.id) user.role = role.name; });
          persistRoles(); persistUsers();
          return json(response, 200, { role });
        }
        if (roleMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "roles.delete")) return json(response, 403, { message: "Permissão insuficiente." });
          const role = roles.get(roleMatch[1]);
          if (!role || role.system) return json(response, 403, { message: "Cargo protegido." });
          if ([...users.values()].some(user => user.roleId === role.id)) return json(response, 409, { message: "Reatribua os usuários antes de excluir este cargo." });
          roles.delete(role.id); persistRoles();
          return json(response, 200, { ok: true });
        }
        if (url === "/users" && request.method === "GET") return json(response, 200, { users: [...users.values()].map(publicUser) });
        if (url === "/users" && request.method === "POST") {
          if (!hasPermission(currentUser, "users.create")) return json(response, 403, { message: "Permissão insuficiente." });
          const input = await body(request);
          if (!input.name || !input.email || !input.password) return json(response, 400, { message: "Preencha nome, e-mail e senha inicial." });
          if ([...users.values()].some(item => item.email === input.email.toLowerCase())) return json(response, 409, { message: "E-mail já cadastrado." });
          const userSalt = randomBytes(16).toString("hex");
          if (input.profile === "CLIENT") return json(response, 400, { message: "Clientes externos devem ser cadastrados dentro do cliente correspondente." });
          const selectedRole = input.roleId && roles.get(input.roleId);
          const selectedDepartment=input.departmentId&&departments.get(String(input.departmentId));
          if (!selectedRole || selectedRole.assignable === false) return json(response, 400, { message: "Selecione um cargo válido para este usuário." });
          if(input.departmentId&&!selectedDepartment)return json(response,400,{message:"Selecione um setor válido."});
          const user: User = { id: randomUUID(), name: input.name, email: input.email.toLowerCase(), profile: input.profile || "COLLABORATOR", role: selectedRole.name, roleId: selectedRole.id, departmentId:selectedDepartment?.id, departmentName:selectedDepartment?.name, permissionOverrides: {}, mustChangePassword: true, salt: userSalt, passwordHash: hash(input.password, userSalt) };
          users.set(user.id, user);
          if(selectedDepartment&&input.departmentManager===true){selectedDepartment.managerUserId=user.id;selectedDepartment.managerName=user.name;departments.set(selectedDepartment.id,selectedDepartment);persistDepartments()}
          persistUsers();
          return json(response, 201, { user: publicUser(user) });
        }
        const userAccessMatch = url.match(/^\/users\/([^/]+)\/access$/);
        if (userAccessMatch && request.method === "PATCH") {
          if (!hasPermission(currentUser, "users.edit")) return json(response, 403, { message: "Permissão insuficiente." });
          const user = users.get(userAccessMatch[1]);
          if (!user || user.profile === "MASTER") return json(response, 403, { message: "O acesso do dono é protegido." });
          const input = await body(request);
          const role = roles.get(input.roleId);
          const department=input.departmentId?departments.get(String(input.departmentId)):undefined;
          if (!role || role.assignable === false) return json(response, 400, { message: "Cargo inválido para este usuário." });
          if(input.departmentId&&!department)return json(response,400,{message:"Setor inválido para este usuário."});
          const overrides = input.permissionOverrides && typeof input.permissionOverrides === "object" ? input.permissionOverrides : {};
          const previousDepartment=user.departmentId;
          user.roleId = role.id; user.role = role.name;
          user.departmentId=department?.id;user.departmentName=department?.name;
          if(previousDepartment&&previousDepartment!==user.departmentId){const previous=departments.get(previousDepartment);if(previous?.managerUserId===user.id){delete previous.managerUserId;delete previous.managerName;departments.set(previous.id,previous);persistDepartments()}}
          user.permissionOverrides = Object.fromEntries(Object.entries(overrides).filter(([permission,effect]) => allPermissions.includes(permission) && ["ALLOW","DENY"].includes(String(effect)))) as Record<string, "ALLOW" | "DENY">;
          users.set(user.id, user); persistUsers();
          return json(response, 200, { user: publicUser(user), effectivePermissions: allPermissions.map(permission => ({ permission, allowed: user.permissionOverrides?.[permission] ? user.permissionOverrides[permission] === "ALLOW" : role.permissions.includes(permission), source: user.permissionOverrides?.[permission] ? `USER_${user.permissionOverrides[permission]}` : "ROLE" })) });
        }
        const userMatch = url.match(/^\/users\/([^/]+)$/);
        if (userMatch && request.method === "DELETE") {
          if (!hasPermission(currentUser, "users.edit")) return json(response, 403, { message: "Permissão insuficiente." });
          const user = users.get(userMatch[1]);
          if (!user || user.profile === "MASTER") return json(response, 403, { message: "A conta do dono não pode ser excluída." });
          if(user.departmentId){const department=departments.get(user.departmentId);if(department?.managerUserId===user.id){delete department.managerUserId;delete department.managerName;departments.set(department.id,department);persistDepartments()}}
          users.delete(user.id); persistUsers();
          return json(response, 200, { ok: true });
        }
        if (url === "/integrations" && request.method === "GET") return json(response, 200, { integrations: [...integrations.values()] });
        if (/^\/integrations\/(google_ads|meta_ads)\/demo$/.test(url)) return json(response, 410, { message: "Conexões simuladas foram desativadas. Configure as credenciais OAuth oficiais." });
        const integrationMatch = url.match(/^\/integrations\/([^/]+)(?:\/(test|sync))?$/);
        if (integrationMatch) {
          const integration = integrations.get(integrationMatch[1]);
          if (!integration) return json(response, 404, { message: "Conexão não encontrada." });
          if (request.method === "POST" && integrationMatch[2] === "test") {
            if (integration.demo) return json(response, 410, { message: "Esta conexão simulada está desativada." });
            return json(response, 200, { ok: true, message: "Conexão válida.", checkedAt: new Date().toISOString() });
          }
          if (request.method === "POST" && integrationMatch[2] === "sync") {
            if (integration.demo) return json(response, 410, { message: "Esta conexão simulada está desativada." });
            return json(response, 501, { message: "O adaptador oficial desta plataforma ainda não foi configurado no servidor." });
          }
          if (request.method === "DELETE" && !integrationMatch[2]) {
            integrations.delete(integration.id); persistIntegrations();
            return json(response, 200, { ok: true, historyPreserved: true });
          }
        }
        return json(response, 404, { message: "Rota não encontrada." });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "PW_OS_");
  const masterEmail = env.PW_OS_MASTER_EMAIL;
  const masterPassword = env.PW_OS_MASTER_INITIAL_PASSWORD;
  if (!masterEmail || !masterPassword) throw new Error("Configure PW_OS_MASTER_EMAIL e PW_OS_MASTER_INITIAL_PASSWORD no arquivo .env.local.");
  return {
    plugins: [
      react(),
      localApi(masterEmail, masterPassword),
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "PW OS — Performance Workspace", short_name: "PW OS", description: "ERP + CRM da PW Media",
          theme_color: "#1b2838", background_color: "#f4f6f8", display: "standalone",
          icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
        }
      })
    ],
    resolve: { alias: { "@": "/apps/web/src" } },
    build: { outDir: "dist" }
  };
});
