import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { CalendarDays, Check, CheckSquare2, ChevronLeft, ChevronRight, Clock3, Eye, EyeOff, MapPin, Plus, Users, X } from "lucide-react";

type CalendarEvent={id:string;title:string;description:string;ownerId:string;ownerName:string;participantIds:string[];startAt:string;endAt:string;location:string;category:string};
type Task={id:string;title:string;responsibleId:string;responsibleName:string;dueAt:string;priority:string;status:string};
type User={id:string;name:string};
type Client={id:string;name:string};
type Opportunity={id:string;name:string;company:string;status:string;serviceInterest:string};
type View="DAY"|"WEEK"|"MONTH";
type CreateType="EVENT"|"TASK";
type CalendarItem={kind:"event"|"task";id:string;title:string;ownerId:string;ownerName:string;start:Date;end:Date;location?:string;category:string;editable:boolean};

const pad=(value:number)=>String(value).padStart(2,"0");
const localInput=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const startOfDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const addDays=(date:Date,days:number)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days,date.getHours(),date.getMinutes());
const sameDay=(a:Date,b:Date)=>a.toDateString()===b.toDateString();
const weekStart=(date:Date)=>addDays(startOfDay(date),-((date.getDay()+6)%7));
const calendarColors=["#2563eb","#7c3aed","#db2777","#ea580c","#0891b2","#16a34a","#ca8a04","#dc2626","#4f46e5","#0d9488"];
const ownerColor=(ownerId:string)=>calendarColors[[...ownerId].reduce((sum,char)=>sum+char.charCodeAt(0),0)%calendarColors.length];

export function CalendarManagement(){
  const [events,setEvents]=useState<CalendarEvent[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [opportunities,setOpportunities]=useState<Opportunity[]>([]);
  const [currentUserId,setCurrentUserId]=useState("");
  const [canViewTeam,setCanViewTeam]=useState(false);
  const [canEditAllEvents,setCanEditAllEvents]=useState(false);
  const [canEditAllTasks,setCanEditAllTasks]=useState(false);
  const [ownerIds,setOwnerIds]=useState<string[]>([]);
  const [anchor,setAnchor]=useState(()=>new Date());
  const [view,setView]=useState<View>("WEEK");
  const [creating,setCreating]=useState(false);
  const [createType,setCreateType]=useState<CreateType>("EVENT");
  const [draftStart,setDraftStart]=useState(()=>new Date());
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    const [eventResponse,taskResponse,userResponse,sessionResponse,clientResponse,opportunityResponse]=await Promise.all([fetch("/api/calendar/events"),fetch("/api/tasks"),fetch("/api/users"),fetch("/api/auth/session"),fetch("/api/clients"),fetch("/api/crm/opportunities")]);
    const [eventData,taskData,userData,sessionData,clientData,opportunityData]=await Promise.all([eventResponse.json(),taskResponse.json(),userResponse.json(),sessionResponse.json(),clientResponse.json(),opportunityResponse.json()]);
    if(eventResponse.ok){setEvents(eventData.events||[]);setCanViewTeam(!!eventData.canViewTeam);setCanEditAllEvents(!!eventData.canEditAll)}
    if(taskResponse.ok){setTasks(taskData.tasks||[]);setCanEditAllTasks(!!taskData.canEditAll)}
    if(userResponse.ok)setUsers(userData.users||[]);
    if(clientResponse.ok)setClients(clientData.clients||[]);
    if(opportunityResponse.ok)setOpportunities(opportunityData.opportunities||[]);
    if(sessionResponse.ok){setCurrentUserId(sessionData.user.id);setOwnerIds(value=>value.length?value:[sessionData.user.id])}
  };
  useEffect(()=>{void load()},[]);

  const items=useMemo<CalendarItem[]>(()=>{
    const eventItems=events.filter(event=>ownerIds.some(ownerId=>event.ownerId===ownerId||event.participantIds?.includes(ownerId))).map(event=>({kind:"event" as const,id:event.id,title:event.title,ownerId:event.ownerId,ownerName:event.ownerName,start:new Date(event.startAt),end:new Date(event.endAt),location:event.location,category:event.category,editable:event.ownerId===currentUserId||canEditAllEvents}));
    const taskItems=tasks.filter(task=>ownerIds.includes(task.responsibleId)&&task.dueAt&&!["DONE","CANCELLED"].includes(task.status)).map(task=>{const start=new Date(task.dueAt);return{kind:"task" as const,id:task.id,title:task.title,ownerId:task.responsibleId,ownerName:task.responsibleName,start,end:new Date(start.getTime()+30*60_000),category:`TASK_${task.priority}`,editable:task.responsibleId===currentUserId||canEditAllTasks}});
    return [...eventItems,...taskItems].sort((a,b)=>a.start.getTime()-b.start.getTime());
  },[events,tasks,ownerIds,currentUserId,canEditAllEvents,canEditAllTasks]);

  const days=useMemo(()=>{
    if(view==="DAY")return[startOfDay(anchor)];
    if(view==="WEEK"){const start=weekStart(anchor);return Array.from({length:7},(_,index)=>addDays(start,index))}
    const first=new Date(anchor.getFullYear(),anchor.getMonth(),1),start=weekStart(first);return Array.from({length:42},(_,index)=>addDays(start,index));
  },[anchor,view]);
  const movePeriod=(direction:number)=>setAnchor(date=>view==="DAY"?addDays(date,direction):view==="WEEK"?addDays(date,direction*7):new Date(date.getFullYear(),date.getMonth()+direction,1));
  const openCreate=(date=new Date())=>{setDraftStart(date);setError("");setCreating(true)};

  const drop=async(event:DragEvent,day:Date,hour?:number)=>{
    event.preventDefault();
    const payload=event.dataTransfer.getData("application/pw-calendar");
    if(!payload)return;
    const dragged=JSON.parse(payload) as {kind:"event"|"task";id:string};
    const source=items.find(item=>item.kind===dragged.kind&&item.id===dragged.id);
    if(!source)return;
    if(!source.editable){setError("Esta agenda é somente para visualização. Você só pode mover seus próprios itens.");return}
    const nextStart=new Date(day.getFullYear(),day.getMonth(),day.getDate(),hour??source.start.getHours(),source.start.getMinutes());
    setSaving(true);
    if(dragged.kind==="event"){
      const duration=source.end.getTime()-source.start.getTime();
      await fetch(`/api/calendar/events/${dragged.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({startAt:nextStart.toISOString(),endAt:new Date(nextStart.getTime()+duration).toISOString()})});
    }else{
      await fetch(`/api/tasks/${dragged.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({dueAt:nextStart.toISOString()})});
    }
    await load();setSaving(false);
  };
  const drag=(event:DragEvent,item:CalendarItem)=>event.dataTransfer.setData("application/pw-calendar",JSON.stringify({kind:item.kind,id:item.id}));

  const save=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);setError("");
    const form=new FormData(event.currentTarget);
    const input={...Object.fromEntries(form),participantIds:form.getAll("participantIds").map(String)};
    const response=await fetch(createType==="EVENT"?"/api/calendar/events":"/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
    const data=await response.json();
    if(!response.ok){setError(data.message||"Não foi possível salvar.");setSaving(false);return}
    setCreating(false);await load();setSaving(false);
  };

  const title=view==="DAY"?anchor.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}):view==="WEEK"?`${days[0].toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})} – ${days[6].toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"})}`:anchor.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const visibleOwners=users.filter(user=>ownerIds.includes(user.id));
  const toggleOwner=(id:string)=>setOwnerIds(current=>current.includes(id)?current.length===1?current:current.filter(value=>value!==id):[...current,id]);

  return <div className="page operations-page calendar-workspace">
    <div className="page-head"><div><span className="eyebrow">PLANEJAMENTO</span><h1>Agenda</h1><p>Eventos e tarefas de cada colaborador em uma única visão.</p></div><button className="primary" onClick={()=>openCreate(new Date())}><Plus/> Criar</button></div>
    <section className="panel google-calendar">
      <header className="calendar-toolbar">
        <div className="calendar-navigation"><button className="secondary today" onClick={()=>setAnchor(new Date())}>Hoje</button><button onClick={()=>movePeriod(-1)} aria-label="Período anterior"><ChevronLeft/></button><button onClick={()=>movePeriod(1)} aria-label="Próximo período"><ChevronRight/></button><h2>{title}</h2></div>
        <div className="calendar-controls">{canViewTeam&&<span className="calendar-merged-badge"><Users/>{ownerIds.length} agenda{ownerIds.length!==1?"s":""}</span>}<div className="calendar-view-switch">{(["DAY","WEEK","MONTH"] as View[]).map(value=><button className={view===value?"active":""} onClick={()=>setView(value)} key={value}>{value==="DAY"?"Dia":value==="WEEK"?"Semana":"Mês"}</button>)}</div></div>
      </header>
      {error&&!creating&&<div className="calendar-permission-notice"><Eye/>{error}<button onClick={()=>setError("")}><X/></button></div>}
      <div className="calendar-merge-layout">
        {canViewTeam&&<aside className="calendar-agenda-selector"><header><div><Users/><span><b>Agendas</b><small>Sobreponha calendários</small></span></div><button onClick={()=>setOwnerIds(users.map(user=>user.id))}>Todas</button></header><div>{users.map(user=>{const selected=ownerIds.includes(user.id),color=ownerColor(user.id);return <button className={selected?"selected":""} onClick={()=>toggleOwner(user.id)} key={user.id}><i style={{background:color}}>{selected?<Check/>:null}</i><span><b>{user.id===currentUserId?"Minha agenda":user.name}</b><small>{events.filter(event=>event.ownerId===user.id).length} eventos</small></span>{selected?<Eye/>:<EyeOff/>}</button>})}</div><footer><span><i className="event-dot"/>Evento</span><span><i className="task-dot"/>Tarefa</span></footer></aside>}
        <div className="calendar-merge-main"><div className="calendar-owner-strip"><div className="calendar-owner-stack">{visibleOwners.slice(0,4).map(user=><span className="calendar-owner-avatar" style={{background:ownerColor(user.id)}} key={user.id}>{user.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span>)}{visibleOwners.length>4&&<span className="calendar-owner-more">+{visibleOwners.length-4}</span>}</div><div><b>{visibleOwners.length===1?(visibleOwners[0]?.id===currentUserId?"Minha agenda":visibleOwners[0]?.name):`${visibleOwners.length} agendas combinadas`}</b><small>{items.length} itens visíveis · cada pessoa tem uma cor · arraste para alterar</small></div>{saving&&<em>Salvando…</em>}</div>
        {view==="MONTH"?<MonthGrid days={days} anchor={anchor} items={items} onDrop={drop} onDrag={drag} onCreate={openCreate}/>:<TimeGrid days={days} items={items} onDrop={drop} onDrag={drag} onCreate={openCreate}/>}</div>
      </div>
    </section>
    {creating&&<CreateModal type={createType} setType={setCreateType} start={draftStart} users={users} clients={clients} opportunities={opportunities} currentUserId={currentUserId} saving={saving} error={error} onClose={()=>setCreating(false)} onSubmit={save}/>}
  </div>
}

function ItemCard({item,onDrag}:{item:CalendarItem;onDrag:(event:DragEvent,item:CalendarItem)=>void}){
  const color=ownerColor(item.ownerId);
  return <article draggable={item.editable} onDragStart={event=>item.editable&&onDrag(event,item)} className={`calendar-item ${item.kind} ${item.category.toLowerCase()} ${item.editable?"editable":"read-only"}`} style={{"--owner-color":color} as React.CSSProperties} title={`${item.ownerName} · ${item.editable?"arraste para alterar o horário":"somente visualização"}`}><span>{item.kind==="task"?<CheckSquare2/>:<Clock3/>}</span><div><b>{item.title}</b><small>{item.start.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}{item.kind==="event"&&` – ${item.end.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`} · {item.ownerName}</small></div>{!item.editable&&<Eye/>}</article>
}

function TimeGrid({days,items,onDrop,onDrag,onCreate}:{days:Date[];items:CalendarItem[];onDrop:(event:DragEvent,day:Date,hour?:number)=>void;onDrag:(event:DragEvent,item:CalendarItem)=>void;onCreate:(date:Date)=>void}){
  return <div className="calendar-time-scroll"><div className="calendar-time-grid" style={{"--calendar-days":days.length} as React.CSSProperties}>
    <div className="calendar-corner"/>{days.map(day=><header className={sameDay(day,new Date())?"today":""} key={day.toISOString()}><small>{day.toLocaleDateString("pt-BR",{weekday:"short"})}</small><b>{day.getDate()}</b></header>)}
    {Array.from({length:15},(_,index)=>index+6).flatMap(hour=>[<time key={`time-${hour}`}>{pad(hour)}:00</time>,...days.map(day=><section key={`${day.toISOString()}-${hour}`} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.currentTarget.dataset.justDropped="true";void onDrop(event,day,hour);setTimeout(()=>delete event.currentTarget.dataset.justDropped,0)}} onClick={event=>{if(event.currentTarget.dataset.justDropped)return;if((event.target as HTMLElement).closest(".calendar-item"))return;onCreate(new Date(day.getFullYear(),day.getMonth(),day.getDate(),hour))}}>{items.filter(item=>sameDay(item.start,day)&&item.start.getHours()===hour).map(item=><ItemCard item={item} onDrag={onDrag} key={`${item.kind}-${item.id}`}/>)}</section>)])}
  </div></div>
}

function MonthGrid({days,anchor,items,onDrop,onDrag,onCreate}:{days:Date[];anchor:Date;items:CalendarItem[];onDrop:(event:DragEvent,day:Date)=>void;onDrag:(event:DragEvent,item:CalendarItem)=>void;onCreate:(date:Date)=>void}){
  return <div className="calendar-month"><div className="month-weekdays">{["seg","ter","qua","qui","sex","sáb","dom"].map(day=><span key={day}>{day}</span>)}</div><div className="month-grid">{days.map(day=><section className={`${day.getMonth()!==anchor.getMonth()?"outside":""} ${sameDay(day,new Date())?"today":""}`} key={day.toISOString()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.currentTarget.dataset.justDropped="true";void onDrop(event,day);setTimeout(()=>delete event.currentTarget.dataset.justDropped,0)}} onClick={event=>{if(event.currentTarget.dataset.justDropped)return;if((event.target as HTMLElement).closest(".calendar-item"))return;onCreate(new Date(day.getFullYear(),day.getMonth(),day.getDate(),9))}}><b>{day.getDate()}</b>{items.filter(item=>sameDay(item.start,day)).slice(0,4).map(item=><ItemCard item={item} onDrag={onDrag} key={`${item.kind}-${item.id}`}/>)}{items.filter(item=>sameDay(item.start,day)).length>4&&<small>+{items.filter(item=>sameDay(item.start,day)).length-4} itens</small>}</section>)}</div></div>
}

function CreateModal({type,setType,start,users,clients,opportunities,currentUserId,saving,error,onClose,onSubmit}:{type:CreateType;setType:(type:CreateType)=>void;start:Date;users:User[];clients:Client[];opportunities:Opportunity[];currentUserId:string;saving:boolean;error:string;onClose:()=>void;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}){
  const end=new Date(start.getTime()+60*60_000);
  const [participantSearch,setParticipantSearch]=useState("");
  const [participantIds,setParticipantIds]=useState<string[]>([]);
  const [clientId,setClientId]=useState("");
  const visibleParticipants=users.filter(user=>user.id!==currentUserId&&user.name.toLowerCase().includes(participantSearch.toLowerCase()));
  const relatedOpportunities=opportunities.filter(item=>item.status!=="CONVERTED"&&(!clientId||clients.find(client=>client.id===clientId)?.name.toLowerCase()===item.company.toLowerCase()));
  return <div className="modal-backdrop"><section className="operations-modal calendar-create-modal"><header><div><h2>Novo item na agenda</h2><p>Crie um compromisso ou planeje uma tarefa.</p></div><button onClick={onClose}><X/></button></header><div className="calendar-create-tabs"><button className={type==="EVENT"?"active":""} onClick={()=>setType("EVENT")}><CalendarDays/> Evento</button><button className={type==="TASK"?"active":""} onClick={()=>setType("TASK")}><CheckSquare2/> Tarefa</button></div><form onSubmit={onSubmit}>
    <label className="full">Título *<input name="title" required autoFocus/></label>
    {type==="EVENT"?<><label>Início<input name="startAt" type="datetime-local" defaultValue={localInput(start)} required/></label><label>Fim<input name="endAt" type="datetime-local" defaultValue={localInput(end)} required/></label><label>Categoria<select name="category"><option value="WORK">Bloco de trabalho</option><option value="MEETING">Reunião</option><option value="UNAVAILABLE">Indisponível</option><option value="PERSONAL">Pessoal</option></select></label><label>Local ou link<div className="input-with-icon"><MapPin/><input name="location"/></div></label></>:<><input type="hidden" name="status" value="TODO"/><label>Prazo e horário<input name="dueAt" type="datetime-local" defaultValue={localInput(start)} required/></label><label>Responsável<select name="responsibleId" defaultValue={currentUserId}>{users.map(user=><option value={user.id} key={user.id}>{user.name}</option>)}</select></label><label>Prioridade<select name="priority"><option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label><label>Estimativa (minutos)<input name="estimateMinutes" type="number" min="0" defaultValue="60"/></label></>}
    <fieldset className="calendar-related full"><legend>Referente a</legend><label>Cliente<select name="clientId" value={clientId} onChange={event=>setClientId(event.target.value)}><option value="">Nenhum cliente</option>{clients.map(client=><option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label>Lead ou oportunidade do CRM<select name="opportunityId"><option value="">Nenhum lead</option>{relatedOpportunities.map(item=><option value={item.id} key={item.id}>{item.name}{item.company?` · ${item.company}`:""}{item.serviceInterest?` · ${item.serviceInterest}`:""}</option>)}</select></label></fieldset>
    {type==="EVENT"&&<div className="participant-picker full"><div className="participant-picker-head"><div><b>Participantes</b><small>Selecione os colaboradores que receberão este compromisso.</small></div><div className="participant-search"><Users/><input value={participantSearch} onChange={event=>setParticipantSearch(event.target.value)} placeholder="Buscar colaborador..."/></div></div><div className="participant-options">{visibleParticipants.length?visibleParticipants.map(user=>{const selected=participantIds.includes(user.id);return <label className={selected?"selected":""} key={user.id}><input type="checkbox" checked={selected} onChange={()=>setParticipantIds(value=>selected?value.filter(id=>id!==user.id):[...value,user.id])}/><span>{user.name.split(" ").map(part=>part[0]).join("").slice(0,2)}</span><div><b>{user.name}</b><small>{selected?"Participará do evento":"Clique para convidar"}</small></div><i>{selected?"✓":"+"}</i></label>}):<p>Nenhum colaborador encontrado.</p>}</div>{participantIds.map(id=><input type="hidden" name="participantIds" value={id} key={id}/>)}</div>}
    {type==="EVENT"&&<><label>Lembrete<select name="reminderMinutes"><option value="0">Sem lembrete</option><option value="5">5 minutos antes</option><option value="15">15 minutos antes</option><option value="60">1 hora antes</option></select></label><label>Recorrência<select name="recurrence"><option value="NONE">Não repetir</option><option value="DAILY">Diariamente</option><option value="WEEKLY">Semanalmente</option><option value="MONTHLY">Mensalmente</option></select></label></>}
    <label className="full">Descrição<textarea name="description"/></label>{error&&<div className="form-error full">{error}</div>}<footer><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving?"Salvando…":type==="EVENT"?"Criar evento":"Criar tarefa"}</button></footer>
  </form></section></div>
}
