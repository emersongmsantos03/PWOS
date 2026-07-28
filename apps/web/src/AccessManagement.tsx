import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, Crown, Edit3, KeyRound, LockKeyhole, MoreHorizontal, Plus, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";

type Effect = "ALLOW" | "DENY";
type User = { id: string; name: string; email: string; profile: string; role: string; roleId?: string; permissionOverrides?: Record<string, Effect> };
type Role = { id: string; name: string; description: string; level: number; system: boolean; permissions: string[]; userCount?: number };
type CatalogModule = { module: string; key: string; actions: string[] };

const actionNames: Record<string,string> = {
  view:"Visualizar", create:"Criar", edit:"Editar", delete:"Excluir", assign:"Atribuir responsável",
  sync:"Sincronizar", share:"Compartilhar", download:"Baixar", block:"Bloquear usuário",
  authorize:"Autorizar", manage_accounts:"Gerenciar contas", manage_campaigns:"Gerenciar campanhas",
  manage_client_access:"Gerenciar portal do cliente", view_logs:"Ver logs", revoke:"Revogar acesso"
};

export function AccessManagement() {
  const [tab,setTab]=useState<"users"|"roles">("users");
  const [users,setUsers]=useState<User[]>([]);
  const [roles,setRoles]=useState<Role[]>([]);
  const [catalog,setCatalog]=useState<CatalogModule[]>([]);
  const [newUser,setNewUser]=useState(false);
  const [newRole,setNewRole]=useState(false);
  const [editingUser,setEditingUser]=useState<User|null>(null);
  const [editingRole,setEditingRole]=useState<Role|null>(null);
  const [error,setError]=useState("");
  const load=async()=>{const [usersResponse,rolesResponse,catalogResponse]=await Promise.all([fetch("/api/users"),fetch("/api/roles"),fetch("/api/permissions/catalog")]);setUsers((await usersResponse.json()).users||[]);setRoles((await rolesResponse.json()).roles||[]);setCatalog((await catalogResponse.json()).modules||[])};
  useEffect(()=>{void load()},[]);
  return <div className="page access-page">
    <div className="page-head"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Equipe e acessos</h1><p>Defina cargos padrão e personalize o que cada pessoa pode fazer.</p></div><button className="primary" onClick={()=>tab==="users"?setNewUser(true):setNewRole(true)}><Plus/> {tab==="users"?"Criar usuário":"Criar cargo"}</button></div>
    <div className="access-tabs"><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}><Users/> Usuários <span>{users.length}</span></button><button className={tab==="roles"?"active":""} onClick={()=>setTab("roles")}><ShieldCheck/> Cargos e permissões <span>{roles.length}</span></button></div>
    {tab==="users"?<UsersPanel users={users} roles={roles} onEdit={setEditingUser}/>:<RolesPanel roles={roles} catalog={catalog} onEdit={setEditingRole} onCreate={()=>setNewRole(true)}/>}
    {newUser&&<NewUserModal roles={roles} error={error} onClose={()=>{setNewUser(false);setError("")}} onSave={async event=>{event.preventDefault();setError("");const input=Object.fromEntries(new FormData(event.currentTarget));const response=await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const data=await response.json();if(!response.ok)return setError(data.message);setNewUser(false);void load()}}/>}
    {newRole&&<RoleEditor catalog={catalog} onClose={()=>setNewRole(false)} onSave={async input=>{await fetch("/api/roles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setNewRole(false);void load()}}/>}
    {editingRole&&<RoleEditor role={editingRole} catalog={catalog} onClose={()=>setEditingRole(null)} onSave={async input=>{await fetch(`/api/roles/${editingRole.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setEditingRole(null);void load()}}/>}
    {editingUser&&<UserAccessEditor user={editingUser} roles={roles} catalog={catalog} onClose={()=>setEditingUser(null)} onSave={async input=>{await fetch(`/api/users/${editingUser.id}/access`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});setEditingUser(null);void load()}}/>}
  </div>;
}

function UsersPanel({users,roles,onEdit}:{users:User[];roles:Role[];onEdit:(user:User)=>void}) {
  return <section className="panel access-panel"><div className="access-toolbar"><div className="search small"><Search/><input placeholder="Buscar usuário..."/></div><button className="secondary"><SlidersHorizontal/> Filtros</button></div><div className="access-list-head"><span>Usuário</span><span>Perfil técnico</span><span>Cargo</span><span>Exceções</span><span>Acesso efetivo</span><span/></div>{users.map(user=>{const role=roles.find(item=>item.id===user.roleId);const overrides=Object.keys(user.permissionOverrides||{}).length;return <div className="access-user-row" key={user.id}><span className="avatar">{user.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><div><b>{user.name}</b><small>{user.email}</small></div><span className={`technical-profile ${user.profile.toLowerCase()}`}>{user.profile}</span><span>{role?.name||user.role}</span><span className={overrides?"has-overrides":""}>{overrides?`${overrides} ${overrides===1?"ajuste":"ajustes"}`:"Nenhuma"}</span><span className="effective-access"><ShieldCheck/>{user.profile==="MASTER"?"Tudo":`${role?.permissions.length||0} permissões`}</span><button onClick={()=>onEdit(user)} disabled={user.profile==="MASTER"} title={user.profile==="MASTER"?"A conta master tem acesso total protegido":"Editar acesso"}>{user.profile==="MASTER"?<Crown/>:<Edit3/>}</button></div>})}</section>;
}

function RolesPanel({roles,catalog,onEdit,onCreate}:{roles:Role[];catalog:CatalogModule[];onEdit:(role:Role)=>void;onCreate:()=>void}) {
  const total=catalog.reduce((sum,module)=>sum+module.actions.length,0);
  return <section className="panel roles-table"><header><div><h2>Cargos da organização</h2><p>Permissões padrão que podem ser personalizadas por usuário.</p></div><button className="secondary" onClick={onCreate}><Plus/> Novo cargo</button></header><div className="roles-list-head"><span>Cargo</span><span>Nível</span><span>Usuários</span><span>Permissões</span><span>Tipo</span><span/></div>{roles.map(role=><div className="role-row" key={role.id}><span className={role.system?"role-symbol system-role":"role-symbol"}>{role.system?<Crown/>:<ShieldCheck/>}</span><div><b>{role.name}</b><small>{role.description}</small></div><span>{role.level}</span><span><Users/> {role.userCount||0}</span><div className="role-permission-count"><div><i style={{width:`${((role.system?total:role.permissions.length)/total)*100}%`}}/></div><b>{role.system?total:role.permissions.length}/{total}</b></div><span className={role.system?"role-type system":"role-type"}>{role.system?"Padrão do sistema":"Personalizado"}</span><button onClick={()=>onEdit(role)} disabled={role.system} aria-label={role.system?"Cargo protegido":"Editar cargo"}>{role.system?<LockKeyhole/>:<MoreHorizontal/>}</button></div>)}{roles.length===1&&<button className="create-first-role" onClick={onCreate}><span><Plus/></span><div><b>Criar primeiro cargo personalizado</b><p>Defina permissões por módulo e ação.</p></div><strong>Criar cargo</strong></button>}</section>;
}

function NewUserModal({roles,error,onClose,onSave}:{roles:Role[];error:string;onClose:()=>void;onSave:(event:FormEvent<HTMLFormElement>)=>void}) {
  return <Modal title="Criar usuário" subtitle="O cargo define o acesso padrão. No primeiro login, a pessoa deverá criar uma nova senha." icon={<UserPlus/>} onClose={onClose}><form onSubmit={onSave}><label>Nome completo<input name="name" required autoFocus/></label><label>E-mail<input name="email" type="email" required/></label><div className="form-grid"><label>Perfil técnico<select name="profile"><option value="COLLABORATOR">Colaborador</option><option value="ADMIN">Administrador</option></select></label><label>Cargo<select name="roleId" required><option value="">Selecione...</option>{roles.map(role=><option value={role.id} disabled={role.system} key={role.id}>{role.name}{role.system?" — reservado à conta master":""}</option>)}</select></label></div><label>Senha inicial<input name="password" type="password" minLength={8} required autoComplete="new-password"/><small className="field-help">Senha temporária usada somente no primeiro acesso.</small></label><div className="client-user-note"><Users/><span>Usuários de clientes externos são cadastrados em <b>Clientes → Detalhes → Usuários do cliente</b>.</span></div>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">Criar usuário</button></div></form></Modal>;
}

function RoleEditor({role,catalog,onClose,onSave}:{role?:Role;catalog:CatalogModule[];onClose:()=>void;onSave:(input:{name:string;description:string;level:number;permissions:string[]})=>void}) {
  const [name,setName]=useState(role?.name||"");
  const [description,setDescription]=useState(role?.description||"");
  const [level,setLevel]=useState(role?.level||10);
  const [permissions,setPermissions]=useState<string[]>(role?.permissions||[]);
  const [expanded,setExpanded]=useState<string[]>(() => {
    const selectedModules=catalog.filter(module=>module.actions.some(action=>(role?.permissions||[]).includes(`${module.key}.${action}`))).map(module=>module.key);
    return selectedModules.length ? selectedModules : catalog.slice(0,2).map(module=>module.key);
  });
  const toggle=(permission:string)=>setPermissions(value=>value.includes(permission)?value.filter(item=>item!==permission):[...value,permission]);
  const toggleModule=(module:CatalogModule)=>{const keys=module.actions.map(action=>`${module.key}.${action}`);const all=keys.every(key=>permissions.includes(key));setPermissions(value=>all?value.filter(item=>!keys.includes(item)):Array.from(new Set([...value,...keys])))};
  const toggleExpanded=(key:string)=>setExpanded(value=>value.includes(key)?value.filter(item=>item!==key):[...value,key]);
  const allExpanded=expanded.length===catalog.length;
  return <Modal wide title={role?"Editar cargo":"Novo cargo"} subtitle="Configure o acesso padrão. Exceções individuais continuam disponíveis em cada usuário." icon={<ShieldCheck/>} onClose={onClose}>
    <div className="role-form">
      <div className="role-basics">
        <label>Nome do cargo<input value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Gestor de Tráfego" autoFocus/></label>
        <label>Nível hierárquico<input type="number" min={1} max={99} value={level} onChange={event=>setLevel(Number(event.target.value))}/></label>
        <label className="role-description">Descrição<input value={description} onChange={event=>setDescription(event.target.value)} placeholder="Descreva brevemente a responsabilidade deste cargo"/></label>
      </div>
      <div className="permission-editor-head"><div><b>Permissões do cargo</b><p>{permissions.length} de {catalog.reduce((sum,module)=>sum+module.actions.length,0)} ações selecionadas</p></div><button onClick={()=>setExpanded(allExpanded?[]:catalog.map(module=>module.key))}>{allExpanded?"Recolher todos":"Expandir todos"}</button></div>
      <div className="permission-matrix">{catalog.map(module=>{
        const keys=module.actions.map(action=>`${module.key}.${action}`);
        const checked=keys.every(key=>permissions.includes(key));
        const selectedCount=keys.filter(key=>permissions.includes(key)).length;
        const isExpanded=expanded.includes(module.key);
        return <section className={isExpanded?"expanded":""} key={module.key}>
          <header>
            <button className="module-toggle" onClick={()=>toggleExpanded(module.key)} aria-expanded={isExpanded}>
              <span className="permission-module-icon"><ShieldCheck/></span>
              <span><b>{module.module}</b><small>{selectedCount} de {module.actions.length} selecionadas</small></span>
              <ChevronDown/>
            </button>
            <label className="select-module"><input type="checkbox" checked={checked} onChange={()=>toggleModule(module)}/><span>Selecionar tudo</span></label>
          </header>
          <div className="module-actions">{module.actions.map(action=>{
            const key=`${module.key}.${action}`;
            return <label key={key}><span>{actionNames[action]||action}<small>{key}</small></span><input type="checkbox" checked={permissions.includes(key)} onChange={()=>toggle(key)}/></label>
          })}</div>
        </section>;
      })}</div>
      <div className="sticky-modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={!name} onClick={()=>onSave({name,description,level,permissions})}>{role?"Salvar alterações":"Criar cargo"}</button></div>
    </div>
  </Modal>;
}

function UserAccessEditor({user,roles,catalog,onClose,onSave}:{user:User;roles:Role[];catalog:CatalogModule[];onClose:()=>void;onSave:(input:{roleId:string;permissionOverrides:Record<string,Effect>})=>void}) {
  const [roleId,setRoleId]=useState(user.roleId||"");
  const [overrides,setOverrides]=useState<Record<string,Effect>>(user.permissionOverrides||{});
  const role=roles.find(item=>item.id===roleId);
  const setOverride=(key:string,value:"INHERIT"|Effect)=>{setOverrides(current=>{const next={...current};if(value==="INHERIT")delete next[key];else next[key]=value;return next})};
  return <Modal wide title={`Acesso de ${user.name}`} subtitle="A permissão individual prevalece sobre o cargo." icon={<KeyRound/>} onClose={onClose}><div className="user-access-summary"><label>Cargo padrão<select value={roleId} onChange={event=>setRoleId(event.target.value)}>{roles.filter(item=>!item.system).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div><span><ShieldCheck/></span><p><b>{role?.permissions.length||0} permissões herdadas</b> do cargo selecionado</p></div><div><span><SlidersHorizontal/></span><p><b>{Object.keys(overrides).length} exceções individuais</b> concedem ou negam ações específicas</p></div></div><div className="override-legend"><span><i className="inherit"/>Herdar do cargo</span><span><i className="allow"/>Conceder</span><span><i className="deny"/>Negar</span></div><div className="permission-matrix override-matrix">{catalog.map(module=><section key={module.key}><header><b>{module.module}</b></header><div>{module.actions.map(action=>{const key=`${module.key}.${action}`;const value:"INHERIT"|Effect=Object.prototype.hasOwnProperty.call(overrides,key)?overrides[key]:"INHERIT";const inherited=role?.permissions.includes(key);return <div className="override-row" key={key}><span><b>{actionNames[action]||action}</b><small>{key}</small></span><div className="tri-state"><button className={value==="INHERIT"?"active inherit":""} onClick={()=>setOverride(key,"INHERIT")}>{inherited?<Check/>:<X/>} Cargo</button><button className={value==="ALLOW"?"active allow":""} onClick={()=>setOverride(key,"ALLOW")}><Check/> Conceder</button><button className={value==="DENY"?"active deny":""} onClick={()=>setOverride(key,"DENY")}><X/> Negar</button></div></div>})}</div></section>)}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={()=>onSave({roleId,permissionOverrides:overrides})}>Salvar acesso</button></div></Modal>;
}

function Modal({title,subtitle,icon,onClose,wide,children}:{title:string;subtitle:string;icon:React.ReactNode;onClose:()=>void;wide?:boolean;children:React.ReactNode}) {
  return <div className="modal-backdrop"><div className={`modal access-modal ${wide?"wide":""}`} role="dialog" aria-modal="true"><button className="modal-close" onClick={onClose}><X/></button><span className="modal-icon">{icon}</span><h2>{title}</h2><p>{subtitle}</p>{children}</div></div>;
}
