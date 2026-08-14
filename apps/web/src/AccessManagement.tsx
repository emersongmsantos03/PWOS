import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Check, ChevronDown, Crown, Edit3, KeyRound, LockKeyhole, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, Trash2, UserPlus, Users, X } from "lucide-react";
import "./PermissionRefinements.css";

type Effect = "ALLOW" | "DENY";
type User = { id: string; name: string; email: string; avatarDataUrl?: string; profile: string; role: string; roleId?: string; departmentId?:string; departmentName?:string; permissionOverrides?: Record<string, Effect> };
type Role = { id: string; name: string; description: string; level: number; system: boolean; assignable?: boolean; permissions: string[]; userCount?: number };
type CatalogModule = { module: string; key: string; actions: string[] };
type Department={id:string;name:string;description?:string;active:boolean;managerUserId?:string;managerName?:string};

const actionNames: Record<string,string> = {
  view:"Visualizar", create:"Criar", edit:"Editar", delete:"Excluir", assign:"Atribuir responsável",
  move_stage:"Mover de etapa", convert:"Converter em cliente", reverse_conversion:"Reverter conversão",
  view_values:"Visualizar valores", export:"Exportar", manage_pipelines:"Gerenciar funis",
  view_team:"Visualizar equipe", settle:"Dar baixa", manage_settings:"Gerenciar configurações",
  sync:"Sincronizar", share:"Compartilhar", download:"Baixar", block:"Bloquear usuário",
  authorize:"Autorizar", manage_accounts:"Gerenciar contas", manage_campaigns:"Gerenciar campanhas",
  manage_client_access:"Gerenciar portal do cliente", view_logs:"Ver logs", revoke:"Revogar acesso",
  review:"Revisar e aprovar demandas", view_all:"Visualizar todas", edit_all:"Editar todas", edit_team:"Editar demandas da equipe",
  comment:"Comentar", manage_departments:"Gerenciar setores", create_access:"Criar acesso do cliente"
};

export function AccessManagement({permissions,profile,role,roleId}:{permissions:string[];profile:string;role:string;roleId?:string}) {
  const [tab,setTab]=useState<"users"|"roles"|"departments">("users");
  const [users,setUsers]=useState<User[]>([]);
  const [roles,setRoles]=useState<Role[]>([]);
  const [catalog,setCatalog]=useState<CatalogModule[]>([]);
  const [departments,setDepartments]=useState<Department[]>([]);
  const [newUser,setNewUser]=useState(false);
  const [newRole,setNewRole]=useState(false);
  const [editingUser,setEditingUser]=useState<User|null>(null);
  const [editingRole,setEditingRole]=useState<Role|null>(null);
  const [viewingRoleUsers,setViewingRoleUsers]=useState<Role|null>(null);
  const [deletingUser,setDeletingUser]=useState<User|null>(null);
  const [error,setError]=useState("");
  const can=(permission:string)=>profile==="MASTER"||permissions.includes(permission);
  const canDeleteUsers=profile==="MASTER"||roleId==="owner-system-role"||role==="CEO"||role==="Desenvolvedor";
  const load=async()=>{const [usersResponse,rolesResponse,catalogResponse,departmentsResponse]=await Promise.all([fetch("/api/users"),fetch("/api/roles"),fetch("/api/permissions/catalog"),fetch("/api/departments")]);setUsers(usersResponse.ok?(await usersResponse.json()).users||[]:[]);setRoles(rolesResponse.ok?(await rolesResponse.json()).roles||[]:[]);setCatalog(catalogResponse.ok?(await catalogResponse.json()).modules||[]:[]);setDepartments(departmentsResponse.ok?(await departmentsResponse.json()).departments||[]:[])};
  useEffect(()=>{void load()},[]);
  return <div className="page access-page">
    <div className="page-head"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Equipe e acessos</h1><p>Gerencie usuários, cargos, permissões e setores da organização.</p></div>{tab!=="departments"&&can(tab==="users"?"users.create":"roles.create")&&<button className="primary" onClick={()=>tab==="users"?setNewUser(true):setNewRole(true)}><Plus/> {tab==="users"?"Criar usuário":"Criar cargo"}</button>}</div>
    <div className="access-tabs"><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}><Users/> Usuários <span>{users.length}</span></button><button className={tab==="roles"?"active":""} onClick={()=>setTab("roles")}><ShieldCheck/> Cargos e permissões <span>{roles.length}</span></button><button className={tab==="departments"?"active":""} onClick={()=>setTab("departments")}><Building2/> Setores <span>{departments.length}</span></button></div>
    {tab==="users"?<UsersPanel users={users} roles={roles} canDelete={canDeleteUsers} onEdit={setEditingUser} onDelete={setDeletingUser}/>:tab==="roles"?<RolesPanel roles={roles} catalog={catalog} onEdit={setEditingRole} onCreate={()=>setNewRole(true)} onViewUsers={setViewingRoleUsers}/>:<DepartmentsPanel departments={departments} users={users} canManage={can("tickets.manage_departments")} onChange={load}/>}
    {newUser&&<NewUserModal roles={roles} departments={departments} error={error} onClose={()=>{setNewUser(false);setError("")}} onSave={async event=>{event.preventDefault();setError("");const formInput=Object.fromEntries(new FormData(event.currentTarget));const input={...formInput,departmentManager:formInput.departmentManager==="on"};const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)return setError(data.message);setNewUser(false);void load()}}/>}
    {newRole&&<RoleEditor catalog={catalog} onClose={()=>setNewRole(false)} onSave={async input=>{await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setNewRole(false);void load()}}/>}
    {editingRole&&<RoleEditor role={editingRole} catalog={catalog} onClose={()=>setEditingRole(null)} onSave={async input=>{await fetch(`/api/roles/${editingRole.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setEditingRole(null);void load()}}/>}
    {editingUser&&<UserAccessEditor user={editingUser} roles={roles} departments={departments} catalog={catalog} canDelete={canDeleteUsers} onDelete={()=>{setDeletingUser(editingUser);setEditingUser(null)}} onClose={()=>setEditingUser(null)} onSave={async input=>{await fetch(`/api/users/${editingUser.id}/access`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setEditingUser(null);void load()}}/>}
    {viewingRoleUsers&&<RoleUsersModal role={viewingRoleUsers} users={users.filter(user=>user.roleId===viewingRoleUsers.id)} onClose={()=>setViewingRoleUsers(null)}/>}
    {deletingUser&&<DeleteUserModal user={deletingUser} onClose={()=>setDeletingUser(null)} onDeleted={async()=>{setDeletingUser(null);await load()}}/>}
  </div>;
}

function UsersPanel({users,roles,canDelete,onEdit,onDelete}:{users:User[];roles:Role[];canDelete:boolean;onEdit:(user:User)=>void;onDelete:(user:User)=>void}) {
  return <section className="panel access-panel">
    <div className="access-toolbar"><div className="search small"><Search/><input placeholder="Buscar usuário..."/></div><button className="secondary"><SlidersHorizontal/> Filtros</button></div>
    <div className="access-list-head"><span>Usuário</span><span>Perfil técnico</span><span>Cargo</span><span>Setor</span><span>Exceções</span><span>Acesso efetivo</span><span/></div>
    {users.map(user=>{const assignedRole=roles.find(item=>item.id===user.roleId);const overrides=Object.keys(user.permissionOverrides||{}).length;return <div className="access-user-row" key={user.id}>
      <span className="avatar access-user-avatar">{user.avatarDataUrl?<img src={user.avatarDataUrl} alt={`Foto de ${user.name}`}/>:user.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span>
      <div><b>{user.name}</b><small>{user.email}</small></div><span className={`technical-profile ${user.profile.toLowerCase()}`}>{user.profile}</span><span>{assignedRole?.name||user.role}</span><span className="user-department">{user.departmentName||"Sem setor"}</span><span className={overrides?"has-overrides":""}>{overrides?`${overrides} ${overrides===1?"ajuste":"ajustes"}`:"Nenhuma"}</span><span className="effective-access"><ShieldCheck/>{user.profile==="MASTER"?"Tudo":`${assignedRole?.permissions.length||0} permissões`}</span>
      <div className="access-row-actions">{canDelete&&user.profile!=="MASTER"&&<button className="delete" onClick={()=>onDelete(user)} title={`Excluir ${user.name}`}><Trash2/></button>}<button onClick={()=>onEdit(user)} disabled={user.profile==="MASTER"} title={user.profile==="MASTER"?"A conta master tem acesso total protegido":"Editar acesso"}>{user.profile==="MASTER"?<Crown/>:<Edit3/>}</button></div>
    </div>})}
  </section>;
}

function RolesPanel({roles,catalog,onEdit,onCreate,onViewUsers}:{roles:Role[];catalog:CatalogModule[];onEdit:(role:Role)=>void;onCreate:()=>void;onViewUsers:(role:Role)=>void}) {
  const total=catalog.reduce((sum,module)=>sum+module.actions.length,0);
  return <section className="panel roles-table">
    <header><div><h2>Cargos da organização</h2><p>Permissões padrão que podem ser personalizadas por usuário.</p></div><button className="secondary" onClick={onCreate}><Plus/> Novo cargo</button></header>
    <div className="roles-list-head"><span>Cargo</span><span>Nível</span><span>Usuários</span><span>Permissões</span><span>Tipo</span><span/></div>
    {roles.map(role=>{const granted=role.system?total:role.permissions.length;const percentage=total?Math.round(granted/total*100):0;return <div className="role-row" key={role.id}>
      <span className={role.system?"role-symbol system-role":"role-symbol"}>{role.system?<Crown/>:<ShieldCheck/>}</span>
      <div><b>{role.name}</b><small>{role.description}</small></div><span>{role.level}</span>
      <button className="role-users-button" onClick={()=>onViewUsers(role)} title={`Ver usuários do cargo ${role.name}`}><Users/><b>{role.userCount||0}</b><span>Ver usuários</span></button>
      <div className="role-permission-count"><div className="role-permission-meta"><b>{percentage===100?"Acesso completo":`${percentage}% liberado`}</b><span>{granted} de {total} permissões</span></div><div className="role-permission-track" role="progressbar" aria-label={`${percentage}% das permissões concedidas`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${percentage}%`}}/></div></div>
      <span className={role.system?"role-type system":"role-type"}>{role.system?"Padrão do sistema":"Personalizado"}</span><button onClick={()=>onEdit(role)} disabled={role.system} aria-label={role.system?"Cargo protegido":"Editar cargo"}>{role.system?<LockKeyhole/>:<MoreHorizontal/>}</button>
    </div>})}
    {roles.length===1&&<button className="create-first-role" onClick={onCreate}><span><Plus/></span><div><b>Criar primeiro cargo personalizado</b><p>Defina permissões por módulo e ação.</p></div><strong>Criar cargo</strong></button>}
  </section>;
}

function RoleUsersModal({role,users,onClose}:{role:Role;users:User[];onClose:()=>void}) {
  return <Modal title={`Usuários — ${role.name}`} subtitle={`${users.length} ${users.length===1?"pessoa utiliza":"pessoas utilizam"} este cargo.`} icon={<Users/>} onClose={onClose}><div className="role-users-modal-list">{users.map(user=><article key={user.id}><span className="avatar access-user-avatar">{user.avatarDataUrl?<img src={user.avatarDataUrl} alt={`Foto de ${user.name}`}/>:user.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><div><b>{user.name}</b><small>{user.email}</small></div><span className={`technical-profile ${user.profile.toLowerCase()}`}>{user.profile}</span></article>)}{users.length===0&&<div className="role-users-empty"><Users/><b>Nenhum usuário neste cargo</b><p>Quando alguém receber este cargo, aparecerá aqui.</p></div>}</div><div className="modal-actions"><button className="primary" onClick={onClose}>Fechar</button></div></Modal>;
}

function DepartmentsPanel({departments,users,canManage,onChange}:{departments:Department[];users:User[];canManage:boolean;onChange:()=>Promise<void>}) {
  const [editing,setEditing]=useState<Department|null>(null);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");
  const activeDepartments=departments.filter(item=>item.active).length;
  const request=async(url:string,method:string,input?:Record<string,unknown>)=>{setError("");const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:input?JSON.stringify(input):undefined});const data=await response.json();if(!response.ok){setError(data.message||"Não foi possível salvar o setor.");return false}await onChange();return true};
  const create=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget;const input=Object.fromEntries(new FormData(form));if(await request("/api/departments","POST",input)){form.reset();setCreating(false)}};
  const save=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!editing)return;const input:Record<string,unknown>=Object.fromEntries(new FormData(event.currentTarget));input.active=input.active==="true";if(await request(`/api/departments/${editing.id}`,"PATCH",input))setEditing(null)};
  const remove=async(department:Department)=>{if(window.confirm(`Excluir o setor “${department.name}”?`))await request(`/api/departments/${department.id}`,"DELETE")};
  return <section className="departments-workspace">
    <header className="departments-heading"><div><span><Building2/></span><div><h2>Setores da organização</h2><p>Organize equipes, responsáveis e o direcionamento dos chamados internos.</p></div></div><div className="departments-heading-actions"><span className="department-total"><strong>{activeDepartments}</strong><small>{activeDepartments===1?"setor ativo":"setores ativos"}</small></span>{canManage&&<button className="primary" onClick={()=>{setError("");setCreating(true)}}><Plus/> Novo setor</button>}</div></header>
    {error&&<div className="form-error department-error">{error}</div>}
    {departments.length?<div className="department-table"><div className="department-table-head"><span>Setor</span><span>Responsável</span><span>Colaboradores</span><span>Status</span><span/></div>{departments.map(department=><div className={`department-table-row ${department.active?"":"inactive"}`} key={department.id}><div className="department-identity"><span><Building2/></span><div><b>{department.name}</b><small>{department.description||"Sem descrição cadastrada"}</small></div></div><div className="department-manager"><span className="avatar">{department.managerName?department.managerName.split(" ").map(part=>part[0]).join("").slice(0,2):"—"}</span><div><b>{department.managerName||"Não definido"}</b><small>{department.managerName?"Responsável principal":"Defina um responsável"}</small></div></div><span className="department-member-count"><Users/>{users.filter(user=>user.departmentId===department.id).length}</span><span className={department.active?"department-status active":"department-status"}><i/>{department.active?"Ativo":"Inativo"}</span>{canManage?<div className="department-row-actions"><button onClick={()=>{setError("");setEditing(department)}} title="Editar setor"><Edit3/></button><button className="danger" onClick={()=>void remove(department)} title="Excluir setor"><Trash2/></button></div>:<span/>}</div>)}</div>:<div className="departments-empty"><Building2/><b>Nenhum setor criado</b><p>Crie o primeiro setor para organizar a equipe.</p>{canManage&&<button className="primary" onClick={()=>setCreating(true)}><Plus/> Criar primeiro setor</button>}</div>}
    {creating&&<Modal title="Novo setor" subtitle="Crie uma área e defina quem será o responsável principal." icon={<Building2/>} onClose={()=>setCreating(false)}><form className="department-edit-form" onSubmit={create}><label>Nome<input name="name" required minLength={2} placeholder="Ex.: Financeiro" autoFocus/></label><label>Descrição<textarea name="description" placeholder="Descreva as responsabilidades do setor"/></label><label>Responsável<select name="managerUserId"><option value="">Definir depois</option>{users.filter(user=>user.profile!=="CLIENT").map(user=><option value={user.id} key={user.id}>{user.name}</option>)}</select></label>{error&&<div className="form-error department-modal-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancelar</button><button className="primary"><Plus/> Criar setor</button></div></form></Modal>}
    {editing&&<Modal title="Editar setor" subtitle="Atualize os dados, o responsável e a disponibilidade deste setor." icon={<Building2/>} onClose={()=>setEditing(null)}><form className="department-edit-form" onSubmit={save}><label>Nome<input name="name" defaultValue={editing.name} required minLength={2}/></label><label>Descrição<textarea name="description" defaultValue={editing.description}/></label><label>Responsável<select name="managerUserId" defaultValue={editing.managerUserId||""}><option value="">Sem responsável</option>{users.filter(user=>user.profile!=="CLIENT").map(user=><option value={user.id} key={user.id}>{user.name}</option>)}</select></label><label>Status<select name="active" defaultValue={String(editing.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="primary">Salvar alterações</button></div></form></Modal>}
  </section>;
}

function NewUserModal({roles,departments,error,onClose,onSave}:{roles:Role[];departments:Department[];error:string;onClose:()=>void;onSave:(event:FormEvent<HTMLFormElement>)=>void}) {
  const [departmentId,setDepartmentId]=useState("");
  return <Modal title="Criar usuário" subtitle="Defina cargo, setor e responsabilidade. No primeiro login, a pessoa criará uma nova senha." icon={<UserPlus/>} onClose={onClose}><form onSubmit={onSave}><label>Nome completo<input name="name" required autoFocus/></label><label>E-mail<input name="email" type="email" required/></label><div className="form-grid"><label>Perfil técnico<select name="profile"><option value="COLLABORATOR">Colaborador</option><option value="ADMIN">Administrador</option></select></label><label>Cargo<select name="roleId" required><option value="">Selecione...</option>{roles.map(role=><option value={role.id} disabled={role.assignable===false} key={role.id}>{role.name}{role.assignable===false?" — conta técnica":role.system?" — cargo padrão":""}</option>)}</select></label><label>Setor<select name="departmentId" value={departmentId} onChange={event=>setDepartmentId(event.target.value)}><option value="">Sem setor</option>{departments.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}{item.managerName?` · Resp.: ${item.managerName}`:""}</option>)}</select></label><label className="department-manager-option"><input name="departmentManager" type="checkbox" disabled={!departmentId}/><span><b>Responsável pelo setor</b><small>Substitui o responsável atual deste setor.</small></span></label></div><label>Senha inicial<input name="password" type="password" minLength={8} required autoComplete="new-password"/><small className="field-help">Senha temporária usada somente no primeiro acesso.</small></label><div className="client-user-note"><Users/><span>O setor organiza chamados e responsabilidades. Um setor pode ter apenas um responsável principal.</span></div>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Criar usuário</button></div></form></Modal>;
}

function RoleEditor({role,catalog,onClose,onSave}:{role?:Role;catalog:CatalogModule[];onClose:()=>void;onSave:(input:{name:string;description:string;level:number;permissions:string[]})=>void}) {
  const [name,setName]=useState(role?.name||"");
  const [description,setDescription]=useState(role?.description||"");
  const [level,setLevel]=useState(role?.level||10);
  const [permissions,setPermissions]=useState<string[]>(role?.permissions||[]);
  const toggle=(permission:string)=>setPermissions(value=>value.includes(permission)?value.filter(item=>item!==permission):[...value,permission]);
  const toggleModule=(module:CatalogModule)=>{const keys=module.actions.map(action=>`${module.key}.${action}`);const all=keys.every(key=>permissions.includes(key));setPermissions(value=>all?value.filter(item=>!keys.includes(item)):Array.from(new Set([...value,...keys])))};
  const basicActions=["view","create","edit","delete"];
  const total=catalog.reduce((sum,module)=>sum+module.actions.length,0);
  const setAll=(enabled:boolean)=>setPermissions(enabled?catalog.flatMap(module=>module.actions.map(action=>`${module.key}.${action}`)):[]);
  return <Modal wide title={role?"Editar cargo":"Novo cargo"} subtitle="Configure o acesso padrão. Exceções individuais continuam disponíveis em cada usuário." icon={<ShieldCheck/>} onClose={onClose}>
    <div className="role-form">
      <div className="role-basics">
        <label>Nome do cargo<input value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Gestor de Tráfego" autoFocus/></label>
        <label>Nível hierárquico<input type="number" min={1} max={99} value={level} onChange={event=>setLevel(Number(event.target.value))}/></label>
        <label className="role-description">Descrição<input value={description} onChange={event=>setDescription(event.target.value)} placeholder="Descreva brevemente a responsabilidade deste cargo"/></label>
      </div>
      <div className="permission-editor-head"><div><b>Permissões do cargo</b><p>{permissions.length} de {total} ações selecionadas</p></div><div className="permission-quick-actions"><button onClick={()=>setAll(true)}>Conceder tudo</button><button onClick={()=>setAll(false)}>Limpar seleção</button></div></div>
      <div className="permission-table-wrap"><div className="permission-table">
        <div className="permission-table-head"><span>Módulo</span>{basicActions.map(action=><span key={action}>{actionNames[action]}</span>)}<span>Ações específicas</span></div>
        {catalog.map(module=>{
        const keys=module.actions.map(action=>`${module.key}.${action}`);
        const checked=keys.every(key=>permissions.includes(key));
        const selectedCount=keys.filter(key=>permissions.includes(key)).length;
        const extras=module.actions.filter(action=>!basicActions.includes(action));
        return <div className="permission-table-row" key={module.key}>
          <div className="permission-module-cell"><label><input type="checkbox" checked={checked} onChange={()=>toggleModule(module)}/><span><b>{module.module}</b><small>{selectedCount}/{module.actions.length} selecionadas</small></span></label></div>
          {basicActions.map(action=>{const key=`${module.key}.${action}`;const available=module.actions.includes(action);return <div className="permission-action-cell" key={action}>{available?<label title={`${actionNames[action]} em ${module.module}`}><input type="checkbox" checked={permissions.includes(key)} onChange={()=>toggle(key)}/><span>{actionNames[action]}</span></label>:<i>—</i>}</div>})}
          <div className="permission-extra-cell">{extras.length?extras.map(action=>{const key=`${module.key}.${action}`;return <label className={permissions.includes(key)?"selected":""} key={key}><input type="checkbox" checked={permissions.includes(key)} onChange={()=>toggle(key)}/><span>{actionNames[action]||action.replaceAll("_"," ")}</span></label>}):<i>Nenhuma</i>}</div>
        </div>;
      })}</div></div>
      <div className="sticky-modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!name} onClick={()=>onSave({name,description,level,permissions})}>{role?"Salvar alterações":"Criar cargo"}</button></div>
    </div>
  </Modal>;
}

function UserAccessEditor({user,roles,departments,catalog,canDelete,onDelete,onClose,onSave}:{user:User;roles:Role[];departments:Department[];catalog:CatalogModule[];canDelete:boolean;onDelete:()=>void;onClose:()=>void;onSave:(input:{roleId:string;departmentId:string;permissionOverrides:Record<string,Effect>})=>void}) {
  const [roleId,setRoleId]=useState(user.roleId||"");
  const [departmentId,setDepartmentId]=useState(user.departmentId||"");
  const [overrides,setOverrides]=useState<Record<string,Effect>>(user.permissionOverrides||{});
  const role=roles.find(item=>item.id===roleId);
  const basicActions=["view","create","edit","delete"];
  const isAllowed=(key:string)=>overrides[key]?overrides[key]==="ALLOW":Boolean(role?.permissions.includes(key));
  const toggleAccess=(key:string)=>setOverrides(current=>{const inherited=Boolean(role?.permissions.includes(key));const allowed=current[key]?current[key]==="ALLOW":inherited;const next={...current};if(!allowed===inherited)delete next[key];else next[key]=!allowed?"ALLOW":"DENY";return next});
  const toggleModule=(module:CatalogModule)=>{const keys=module.actions.map(action=>`${module.key}.${action}`);const grant=!keys.every(isAllowed);setOverrides(current=>{const next={...current};keys.forEach(key=>{const inherited=Boolean(role?.permissions.includes(key));if(grant===inherited)delete next[key];else next[key]=grant?"ALLOW":"DENY"});return next})};
  const changed=Object.keys(overrides).length;
  return <Modal wide title={`Acesso de ${user.name}`} subtitle="Marque o que a pessoa poderá fazer. Diferenças em relação ao cargo ficam destacadas." icon={<KeyRound/>} onClose={onClose}>
    <div className="user-access-summary"><label>Cargo padrão<select value={roleId} onChange={event=>{setRoleId(event.target.value);setOverrides({})}}>{roles.filter(item=>item.assignable!==false).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Setor<select value={departmentId} onChange={event=>setDepartmentId(event.target.value)}><option value="">Sem setor</option>{departments.filter(item=>item.active).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div><span><ShieldCheck/></span><p><b>{role?.permissions.length||0} permissões do cargo</b> usadas como ponto de partida</p></div><div><span><SlidersHorizontal/></span><p><b>{changed} {changed===1?"ajuste individual":"ajustes individuais"}</b> neste usuário</p></div></div>
    <div className="permission-editor-head user-permission-head"><div><b>Permissões efetivas</b><p>Checkbox marcado significa acesso concedido.</p></div>{changed>0&&<button onClick={()=>setOverrides({})}>Restaurar padrão do cargo</button>}</div>
    <div className="permission-table-wrap"><div className="permission-table user-permission-table"><div className="permission-table-head"><span>Módulo</span>{basicActions.map(action=><span key={action}>{actionNames[action]}</span>)}<span>Ações específicas</span></div>{catalog.map(module=>{const keys=module.actions.map(action=>`${module.key}.${action}`);const extras=module.actions.filter(action=>!basicActions.includes(action));const selected=keys.filter(isAllowed).length;return <div className="permission-table-row" key={module.key}><div className="permission-module-cell"><label><input type="checkbox" checked={selected===keys.length} onChange={()=>toggleModule(module)}/><span><b>{module.module}</b><small>{selected}/{keys.length} concedidas</small></span></label></div>{basicActions.map(action=>{const key=`${module.key}.${action}`;const available=module.actions.includes(action);return <div className="permission-action-cell" key={action}>{available?<label className={overrides[key]?"permission-changed":""} title={`${actionNames[action]} em ${module.module}`}><input type="checkbox" checked={isAllowed(key)} onChange={()=>toggleAccess(key)}/><span>{actionNames[action]}</span></label>:<i>—</i>}</div>})}<div className="permission-extra-cell">{extras.length?extras.map(action=>{const key=`${module.key}.${action}`;return <label className={`${isAllowed(key)?"selected":""} ${overrides[key]?"permission-changed":""}`} key={key}><input type="checkbox" checked={isAllowed(key)} onChange={()=>toggleAccess(key)}/><span>{actionNames[action]||action.replaceAll("_"," ")}</span></label>}):<i>Nenhuma</i>}</div></div>})}</div></div>
    <div className="modal-actions user-access-actions">{canDelete&&<button className="delete-user-action" onClick={onDelete}><Trash2/> Excluir usuário</button>}<button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={()=>onSave({roleId,departmentId,permissionOverrides:overrides})}>Salvar acesso</button></div>
  </Modal>;
}

function DeleteUserModal({user,onClose,onDeleted}:{user:User;onClose:()=>void;onDeleted:()=>Promise<void>}) {
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const remove=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setLoading(true);setError("");const response=await fetch(`/api/users/${user.id}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});const data=await response.json();if(!response.ok){setError(data.message||"Não foi possível excluir o usuário.");setLoading(false);return}await onDeleted()};
  return <Modal title={`Excluir ${user.name}?`} subtitle="Esta ação remove o acesso do usuário e exige a confirmação da sua senha." icon={<Trash2/>} onClose={onClose}><form className="delete-user-form" onSubmit={remove}><div className="delete-user-warning"><Trash2/><span><b>Exclusão permanente</b><small>Os registros históricos permanecem, mas a pessoa não poderá mais acessar o sistema.</small></span></div><label>Sua senha<input type="password" value={password} onChange={event=>setPassword(event.target.value)} required autoFocus autoComplete="current-password" placeholder="Confirme sua senha atual"/></label>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="danger-confirm" disabled={!password||loading}>{loading?"Excluindo...":"Confirmar exclusão"}</button></div></form></Modal>;
}

function Modal({title,subtitle,icon,onClose,wide,children}:{title:string;subtitle:string;icon:React.ReactNode;onClose:()=>void;wide?:boolean;children:React.ReactNode}) {
  return <div className="modal-backdrop"><div className={`modal access-modal ${wide?"wide":""}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose}><X/></button><span className="modal-icon">{icon}</span><h2>{title}</h2><p>{subtitle}</p>{children}</div></div>;
}
