import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, BriefcaseBusiness, Building2, Check, ChevronDown, Edit3, ExternalLink, Globe2, Mail, MoreHorizontal, Phone, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { isValidDocument, maskDocument, maskPhone } from "./inputMasks";

type ClientStatus = "ACTIVE"|"ATTENTION"|"RISK"|"INACTIVE";
type Client = {
  id:string; name:string; legalName:string; document:string; status:ClientStatus; segment:string;
  website:string; primaryContactName:string; primaryContactEmail:string; primaryContactPhone:string;
  owner:string; notes:string; createdAt:string; updatedAt:string;
};

const statusMeta:Record<ClientStatus,{label:string;className:string}> = {
  ACTIVE:{label:"Ativo",className:"active"}, ATTENTION:{label:"Em atenção",className:"attention"},
  RISK:{label:"Em risco",className:"risk"}, INACTIVE:{label:"Inativo",className:"inactive"}
};

function ClientStatusBadge({status}:{status:ClientStatus}) {
  const meta=statusMeta[status];
  return <span className={`client-status-badge ${meta.className}`}>{status==="ACTIVE"?<Check/>:<AlertTriangle/>}{meta.label}</span>;
}

export function ClientsManagement() {
  const [clients,setClients]=useState<Client[]>([]);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState<"ALL"|ClientStatus>("ALL");
  const [editing,setEditing]=useState<Client|null>(null);
  const [creating,setCreating]=useState(false);
  const [viewing,setViewing]=useState<Client|null>(null);
  const [deleting,setDeleting]=useState<Client|null>(null);
  const [error,setError]=useState("");
  const load=()=>fetch("/api/clients").then(async response=>{const data=await response.json();if(response.ok)setClients(data.clients||[]);});
  useEffect(()=>{void load()},[]);
  const visible=useMemo(()=>clients.filter(client=>{
    const term=search.toLowerCase();
    return (status==="ALL"||client.status===status)&&(!term||[client.name,client.legalName,client.segment,client.primaryContactName,client.primaryContactEmail].some(value=>value?.toLowerCase().includes(term)));
  }),[clients,search,status]);
  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");
    const input=Object.fromEntries(new FormData(event.currentTarget));
    const target=editing?`/api/clients/${editing.id}`:"/api/clients";
    const response=await fetch(target,{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
    const data=await response.json();
    if(!response.ok)return setError(data.message);
    setCreating(false);setEditing(null);await load();
  };
  const remove=async()=>{if(!deleting)return;const response=await fetch(`/api/clients/${deleting.id}`,{method:"DELETE"});if(response.ok){setDeleting(null);setViewing(null);await load()}};
  const counts={active:clients.filter(c=>c.status==="ACTIVE").length,attention:clients.filter(c=>c.status==="ATTENTION").length,risk:clients.filter(c=>c.status==="RISK").length,inactive:clients.filter(c=>c.status==="INACTIVE").length};
  return <div className="page clients-page"><div className="page-head"><div><span className="eyebrow">CARTEIRA</span><h1>Clientes</h1><p>Cadastre, organize e acompanhe toda a carteira da PW Media.</p></div><button className="primary" onClick={()=>{setCreating(true);setError("")}}><Plus/> Novo cliente</button></div>
    <section className="client-summary-cards"><article><span className="client-summary-icon"><Building2/></span><div><small>Total de clientes</small><strong>{clients.length}</strong></div></article><article><i className="active"/><div><small>Ativos</small><strong>{counts.active}</strong></div></article><article><i className="attention"/><div><small>Em atenção</small><strong>{counts.attention}</strong></div></article><article><i className="risk"/><div><small>Em risco</small><strong>{counts.risk}</strong></div></article><article><i className="inactive"/><div><small>Inativos</small><strong>{counts.inactive}</strong></div></article></section>
    <section className="panel clients-panel"><div className="clients-toolbar"><div className="search clients-search"><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar por nome, segmento ou contato..."/></div><label className="client-status-filter">Status<select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="ALL">Todos</option>{Object.entries(statusMeta).map(([value,meta])=><option value={value} key={value}>{meta.label}</option>)}</select><ChevronDown/></label></div>
      {visible.length===0?<div className="clients-empty"><span><BriefcaseBusiness/></span><h2>{clients.length?"Nenhum cliente encontrado":"Sua carteira está vazia"}</h2><p>{clients.length?"Tente ajustar a busca ou o filtro de status.":"Cadastre o primeiro cliente para começar a organizar contas, campanhas e contatos."}</p>{!clients.length&&<button className="primary" onClick={()=>setCreating(true)}><Plus/> Cadastrar primeiro cliente</button>}</div>:<div className="clients-table"><div className="clients-table-head"><span>Cliente</span><span>Status</span><span>Segmento</span><span>Contato principal</span><span>Responsável</span><span/></div>{visible.map(client=><button className="client-row" key={client.id} onClick={()=>setViewing(client)}><span className="client-company-avatar">{client.name.slice(0,2).toUpperCase()}</span><span className="client-main-cell"><b>{client.name}</b><small>{client.legalName||client.document||"Cadastro empresarial"}</small></span><ClientStatusBadge status={client.status}/><span>{client.segment||"Não informado"}</span><span className="client-contact-cell"><b>{client.primaryContactName||"Sem contato"}</b><small>{client.primaryContactEmail}</small></span><span>{client.owner||"Não atribuído"}</span><MoreHorizontal/></button>)}</div>}
    </section>
    {(creating||editing)&&<ClientForm client={editing} error={error} onClose={()=>{setCreating(false);setEditing(null);setError("")}} onSave={save}/>}
    {viewing&&<ClientDetails client={viewing} onClose={()=>setViewing(null)} onEdit={()=>{setEditing(viewing);setViewing(null);setError("")}} onDelete={()=>setDeleting(viewing)}/>}
    {deleting&&<DeleteClient client={deleting} onClose={()=>setDeleting(null)} onConfirm={remove}/>}
  </div>;
}

function ClientForm({client,error,onClose,onSave}:{client:Client|null;error:string;onClose:()=>void;onSave:(event:FormEvent<HTMLFormElement>)=>void}) {
  return <div className="modal-backdrop"><section className="client-form-modal" role="dialog" aria-modal="true"><header><span><Building2/></span><div><h2>{client?"Editar cliente":"Novo cliente"}</h2><p>{client?"Atualize os dados cadastrais e operacionais.":"Adicione uma nova empresa à carteira da PW Media."}</p></div><button onClick={onClose}><X/></button></header><form onSubmit={onSave}><div className="client-form-section"><div className="client-form-section-title"><b>Dados da empresa</b><span>Informações principais do cadastro</span></div><div className="client-form-grid"><label>Nome de exibição *<input name="name" defaultValue={client?.name} required autoFocus placeholder="Ex.: Solar Prime"/></label><label>Razão social<input name="legalName" defaultValue={client?.legalName} placeholder="Nome empresarial completo"/></label><label>CPF / CNPJ<input name="document" defaultValue={client?.document} placeholder="000.000.000-00 ou 00.000.000/0000-00" inputMode="numeric" onInput={event=>{const input=event.currentTarget;input.value=maskDocument(input.value);input.setCustomValidity(input.value&&!isValidDocument(input.value)?"Informe um CPF ou CNPJ válido.":"")}}/><small>O dígito verificador é validado automaticamente.</small></label><label>Segmento<input name="segment" defaultValue={client?.segment} placeholder="Ex.: Energia solar"/></label><label>Website<input name="website" defaultValue={client?.website} type="url" placeholder="https://empresa.com.br"/></label><label>Status<select name="status" defaultValue={client?.status||"ACTIVE"}>{Object.entries(statusMeta).map(([value,meta])=><option value={value} key={value}>{meta.label}</option>)}</select></label></div></div><div className="client-form-section"><div className="client-form-section-title"><b>Contato e atendimento</b><span>Quem devemos procurar e quem é responsável internamente</span></div><div className="client-form-grid"><label>Contato principal<input name="primaryContactName" defaultValue={client?.primaryContactName} placeholder="Nome do contato"/></label><label>E-mail do contato<input name="primaryContactEmail" defaultValue={client?.primaryContactEmail} type="email" placeholder="contato@empresa.com"/></label><label>Telefone<input name="primaryContactPhone" defaultValue={client?.primaryContactPhone} inputMode="tel" placeholder="(00) 00000-0000" onInput={event=>{event.currentTarget.value=maskPhone(event.currentTarget.value)}}/></label><label>Responsável interno<input name="owner" defaultValue={client?.owner} placeholder="Ex.: Emerson Santos"/></label><label className="full-field">Observações<textarea name="notes" defaultValue={client?.notes} placeholder="Contexto, preferências e informações importantes..."/></label></div></div>{error&&<div className="form-error">{error}</div>}<footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary">{client?"Salvar alterações":"Criar cliente"}</button></footer></form></section></div>;
}

function ClientDetails({client,onClose,onEdit,onDelete}:{client:Client;onClose:()=>void;onEdit:()=>void;onDelete:()=>void}) {
  return <div className="modal-backdrop client-details-backdrop"><aside className="client-details"><header><button onClick={onClose}><X/></button><span className="client-detail-logo">{client.name.slice(0,2).toUpperCase()}</span><div><ClientStatusBadge status={client.status}/><h2>{client.name}</h2><p>{client.legalName||"Cliente PW Media"}</p></div></header><div className="client-detail-actions"><button className="primary" onClick={onEdit}><Edit3/> Editar cliente</button><button className="secondary" onClick={onDelete}><Trash2/> Excluir</button></div><main><section><h3>Dados da empresa</h3><dl><div><dt>Documento</dt><dd>{client.document||"Não informado"}</dd></div><div><dt>Segmento</dt><dd>{client.segment||"Não informado"}</dd></div><div><dt>Website</dt><dd>{client.website?<a href={client.website} target="_blank" rel="noreferrer">{client.website}<ExternalLink/></a>:"Não informado"}</dd></div><div><dt>Responsável interno</dt><dd>{client.owner||"Não atribuído"}</dd></div></dl></section><section><h3>Contato principal</h3><div className="contact-detail"><UserRound/><div><b>{client.primaryContactName||"Sem contato cadastrado"}</b>{client.primaryContactEmail&&<span><Mail/>{client.primaryContactEmail}</span>}{client.primaryContactPhone&&<span><Phone/>{client.primaryContactPhone}</span>}</div></div></section><section><h3>Contas e campanhas</h3><div className="client-module-empty"><Globe2/><p>Nenhuma conta de anúncios vinculada.</p><button>Ir para Central de Conexões</button></div></section>{client.notes&&<section><h3>Observações</h3><p className="client-notes">{client.notes}</p></section>}</main></aside></div>;
}

function DeleteClient({client,onClose,onConfirm}:{client:Client;onClose:()=>void;onConfirm:()=>void}) {
  const [confirmed,setConfirmed]=useState(false);
  return <div className="modal-backdrop"><section className="delete-client-modal"><span><Trash2/></span><h2>Excluir {client.name}?</h2><p>O cliente será removido da carteira. Contas, campanhas e histórico vinculados deverão ser tratados antes da exclusão definitiva em produção.</p><label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> Entendo que esta ação remove o cadastro local.</label><div><button className="secondary" onClick={onClose}>Cancelar</button><button className="danger-button" disabled={!confirmed} onClick={onConfirm}>Excluir cliente</button></div></section></div>;
}
