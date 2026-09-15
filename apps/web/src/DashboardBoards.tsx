import { requestMediaPeriod } from "./mediaPeriodRequest";
import { MetaLogo, GoogleAdsLogo } from "./PlatformLogos";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, AlarmClock, ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, ChartLine, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, Clock3, Handshake, ListChecks, Megaphone, SearchCheck, Sparkles, Target, UserRoundCheck, Users, WalletCards } from "lucide-react";
import { NavLink } from "react-router-dom";
import "./CampaignIntelligenceBoard.css";

type User={id:string;name:string;role:string;profile:string;permissions?:string[];departmentId?:string;departmentName?:string};
type TeamUser={id:string;name:string;role?:string;profile?:string};
type Ticket={id:string;title:string;priority:string;status:string;assigneeId:string;assigneeName:string;dueAt:string};
type Client={id:string;name:string;status:string};
type Task={id:string;title:string;responsibleId:string;responsibleName:string;priority:string;status:string;dueAt:string;createdAt:string;updatedAt?:string};
type Stage={id:string;name:string;color:string;probability:number;terminal?:"WON"|"LOST"};
type Pipeline={id:string;name:string;stages:Stage[]};
type Opportunity={id:string;name:string;company:string;serviceInterest:string;potentialValue:number;responsibleId:string;responsibleName:string;pipelineId:string;stageId:string;status:"OPEN"|"WON"|"LOST"|"CONVERTED";nextAction:string;nextActionAt:string;createdAt:string;updatedAt:string};
type CalendarEvent={id:string;title:string;ownerId:string;ownerName:string;participantIds:string[];startAt:string;endAt:string;category:string};
type FinanceEntry={id:string;type:"INCOME"|"EXPENSE";amount:number;dueDate:string;status:string};
type Data={tickets:Ticket[];clients:Client[];tasks:Task[];users:TeamUser[];pipelines:Pipeline[];opportunities:Opportunity[];events:CalendarEvent[];finance:FinanceEntry[];canViewFinanceValues:boolean};

const brl=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const first=(name:string)=>name.split(" ")[0];
const initials=(name:string)=>name.split(" ").filter(Boolean).map(part=>part[0]).join("").slice(0,2);
const sameDay=(value:string,date=new Date())=>!!value&&new Date(value).toDateString()===date.toDateString();
const overdue=(task:Task)=>!!task.dueAt&&new Date(task.dueAt)<new Date()&&!["DONE","CANCELLED"].includes(task.status);
const taskStatus=(status:string)=>({BACKLOG:"Backlog",TODO:"A fazer",IN_PROGRESS:"Em andamento",WAITING_CLIENT:"Aguardando cliente",REVIEW:"Em revisão",DONE:"Concluída",CANCELLED:"Cancelada"}[status]||status);
const formatDate=(value:string)=>value?new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}):"Sem prazo";
const fullDate=()=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",year:"numeric",weekday:"long"}).format(new Date());
const empty:Data={tickets:[],clients:[],tasks:[],users:[],pipelines:[],opportunities:[],events:[],finance:[],canViewFinanceValues:false};

export function DashboardBoards({user}:{user:User}){
  const [data,setData]=useState<Data>(empty),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const can=(permission:string)=>user.profile==="MASTER"||Boolean(user.permissions?.includes(permission));
  useEffect(()=>{
    const endpoints=[
      ["tickets","tickets.view","tickets"],
      ["clients","clients.view","clients"],
      ["tasks","tasks.view","tasks"],
      ["users","users.view","users"],
      ["pipelines","crm.view","crm/pipelines"],
      ["opportunities","opportunities.view","crm/opportunities"],
      ["events","calendar.view","calendar/events"],
      ["finance","finance.view","finance"],
    ] as const;
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setLoading(true); setLoadError(""); setData(empty);
    Promise.allSettled(endpoints.filter(([,permission])=>can(permission)).map(async([key,,path])=>{
      const response=await fetch(`/api/${path}`, {signal:controller.signal});
      if(!response.ok) throw new Error(key);
      return {key,data:await response.json()};
    })).then(results=>{
      if(disposed || controller.signal.aborted) return;
      setData(results.reduce((next,result)=>{
        if(result.status!=="fulfilled")return next;
        const {key,data}=result.value;
        return key==="finance"?{...next,finance:data.entries||[],canViewFinanceValues:data.canViewValues!==false}:{...next,[key]:data[key]||[]};
      },{...empty}));
      if(results.some(result=>result.status==="rejected")) setLoadError("Alguns indicadores não puderam ser carregados. Atualize a página para tentar novamente.");
    }).finally(()=>{clearTimeout(timeout);if(disposed)return;setLoading(false);if(controller.signal.aborted)setLoadError("A consulta excedeu o tempo de espera. Atualize a página para tentar novamente.");});
    return ()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[user.id,user.profile,user.permissions?.join("|")]);
  const executive=can("dashboard.view_executive");
  if(loading)return <div className="dashboard-loading"><Activity/> Atualizando indicadores operacionais...</div>;
  const campaignIntelligence = user.departmentName?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("inteligencia de campanha");
  return <>{loadError&&<p role="alert">{loadError}</p>}{campaignIntelligence?<CampaignIntelligenceBoard user={user} data={data}/>:executive?<ExecutiveBoard user={user} data={data}/>:<CollaboratorBoard user={user} data={data}/>}</>;
}

type BoardCampaign={id:string;accountId:string;platform?:"META_ADS"|"GOOGLE_ADS";name:string;client:string;currency?:string;status:string;dailyBudget:number;lifetimeBudget:number;remainingBudget?:number|null;accountRemainingBudget?:number|null;spend:number;impressions:number;clicks:number;leads:number;cpl:number|null;verifiedAt?:string|null;landingPageStatus?:string|null};
const campaignHealth=(item:BoardCampaign)=>{
  if(!item.impressions&&!item.clicks&&!item.spend)return -1;
  const ctr=item.impressions?item.clicks/item.impressions*100:0;
  let score=100;
  if(item.status==="WITH_ISSUES")score-=35;
  if(!item.leads)score-=25;
  if(ctr<1)score-=20;else if(ctr<2)score-=10;
  if(item.landingPageStatus==="INACTIVE")score-=25;
  return Math.max(0,score);
};
const reviewOverdue=(item:BoardCampaign)=>!item.verifiedAt||Date.now()-new Date(item.verifiedAt).getTime()>=7*86400000;
const balanceRisk=(item:BoardCampaign)=>{
  const available=item.accountRemainingBudget ?? item.remainingBudget;
  const balance=available==null?null:Math.max(0,Number(available));
  if(item.status!=="ACTIVE"||balance==null)return null;
  if(item.dailyBudget>0){const days=balance/item.dailyBudget;return days<=2?"critical":days<=4?"warning":null;}
  if(item.lifetimeBudget>0){const rate=balance/item.lifetimeBudget;return rate<=.15?"critical":rate<=.3?"warning":null;}
  return null;
};
const campaignBalance=(item:BoardCampaign)=>{const available=item.accountRemainingBudget ?? item.remainingBudget;return available==null?null:Math.max(0,Number(available));};
const campaignCurrency=(item:BoardCampaign)=>item.currency||"BRL";
const campaignMoney=(value:number,item:BoardCampaign)=>value.toLocaleString("pt-BR",{style:"currency",currency:campaignCurrency(item),maximumFractionDigits:0});
const campaignUrl=(item:BoardCampaign)=>`/midia/gestao?campaign=${encodeURIComponent(`${item.platform||"META_ADS"}:${item.accountId}:${item.id}`)}`;
const taskUrl=(task:Task)=>`/tarefas?task=${encodeURIComponent(task.id)}`;
const ticketUrl=(ticket:Ticket)=>`/chamados?ticket=${encodeURIComponent(ticket.id)}`;
const agendaUrl=(event:CalendarEvent)=>`/agenda?date=${encodeURIComponent(event.startAt)}`;

function CampaignIntelligenceBoard({user,data}:{user:User;data:Data}){
  const [campaigns,setCampaigns]=useState<BoardCampaign[]>([]),[campaignLoading,setCampaignLoading]=useState(true),[campaignError,setCampaignError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),255000);
    let disposed=false;
    const iso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    const end=new Date(),start=new Date();start.setDate(end.getDate()-6);
    const until=iso(end),since=iso(start);
    setCampaignLoading(true);setCampaignError("");
    Promise.allSettled(["meta","google"].map(async provider=>{
      const {response,payload}=await requestMediaPeriod(`/api/media/${provider}/campaigns?since=${since}&until=${until}`,controller.signal);
      if(!response.ok)throw new Error(`${provider === "meta" ? "Meta Ads" : "Google Ads"}: ${payload.message || "Não foi possível consultar as campanhas."}`);
      return(payload.campaigns||[]).map((item:BoardCampaign)=>({...item,platform:provider==="meta"?"META_ADS":"GOOGLE_ADS",accountRemainingBudget:(payload.accounts||[]).find((account:{id:string;remainingBudget?:number|null})=>account.id===item.accountId)?.remainingBudget??null}));
    })).then(results=>{
      if(disposed)return;
      setCampaigns(results.flatMap(result=>result.status==="fulfilled"?result.value:[]));
      const failures=results.filter((result): result is PromiseRejectedResult=>result.status==="rejected");
      if(failures.length)setCampaignError(failures.map(result=>result.reason instanceof Error ? result.reason.message : "Não foi possível carregar as campanhas. Tente novamente.").join(" · "));
    }).finally(()=>{clearTimeout(timeout);if(!disposed)setCampaignLoading(false);});
    return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[user.id]);
  const active=campaigns.filter(item=>item.status==="ACTIVE"),critical=active.filter(item=>{const score=campaignHealth(item);return score>=0&&score<70}),warning=active.filter(item=>{const score=campaignHealth(item);return score>=70&&score<90}),overdueReviews=active.filter(reviewOverdue),balanceAttention=active.filter(item=>balanceRisk(item)).sort((a,b)=>{const riskA=balanceRisk(a)==="critical"?0:1,riskB=balanceRisk(b)==="critical"?0:1;const daysA=a.dailyBudget?Number(campaignBalance(a)||0)/a.dailyBudget:1,daysB=b.dailyBudget?Number(campaignBalance(b)||0)/b.dailyBudget:1;return riskA-riskB||daysA-daysB;}),healthy=active.filter(item=>{const score=campaignHealth(item);return score>=90}),todayEvents=data.events.filter(event=>(event.ownerId===user.id||event.participantIds?.includes(user.id))&&sameDay(event.startAt)).sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime()),myTasks=data.tasks.filter(task=>task.responsibleId===user.id&&!['DONE','CANCELLED'].includes(task.status)).sort((a,b)=>Number(overdue(b))-Number(overdue(a))),todayTasks=myTasks.filter(task=>sameDay(task.dueAt)||overdue(task)).slice(0,7),waitingD1=myTasks.filter(task=>/d\+1|aguardando resultado|validar resultado/i.test(`${task.title} ${task.status}`)),myTickets=data.tickets.filter(ticket=>ticket.assigneeId===user.id&&!['RESOLVED','CLOSED'].includes(ticket.status)),teamTickets=data.tickets.filter(ticket=>ticket.assigneeId!==user.id&&!['RESOLVED','CLOSED'].includes(ticket.status)),reportTasks=myTasks.filter(task=>/relat[oó]rio|report/i.test(task.title));
  const attention=[...critical,...warning.filter(item=>!critical.some(value=>value.id===item.id)),...overdueReviews.filter(item=>![...critical,...warning].some(value=>value.id===item.id))].slice(0,6);
  const todayLabel=new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());
  const timeOfDay=new Date().getHours()<12?"Bom dia":new Date().getHours()<18?"Boa tarde":"Boa noite";
  return <div className="campaign-intelligence-board ci-reference-board">
    <header className="ci-reference-greeting">
      <div className="ci-sun"><Sparkles/></div><div className="ci-greeting-copy"><h1>{timeOfDay}, {first(user.name)}!</h1><b>Hoje é dia {fullDate()}.</b><p>Tenha certeza que será um ótimo dia!</p></div>
      <blockquote><Sparkles/><span>Lembre-se: o seu futuro só depende de você,<br/>e temos certeza que você é capaz.</span></blockquote>
      <aside><span><Target/></span><div><small>DEPARTAMENTO</small><b>{user.departmentName||"Inteligência de Campanhas"}</b></div><em>Liderança operacional</em></aside>
    </header>
    {campaignError&&<p role="alert">{campaignError}</p>}
    {campaignLoading&&<p role="status">Atualizando campanhas dos últimos 7 dias…</p>}
    <section className="ci-campaign-status" aria-label="Status das campanhas">
      <CiStatus value={critical.length} label="Críticas" detail="verificar agora" tone="critical" icon={AlertTriangle} to="/midia/hoje"/>
      <CiStatus value={warning.length} label="Em atenção" detail="score entre 70 e 89" tone="warning" icon={Activity} to="/midia/hoje"/>
      <CiStatus value={overdueReviews.length} label="Revisões vencidas" detail="há 7 dias ou mais" tone="blue" icon={Clock3} to="/midia/hoje"/>
      <CiStatus value={waitingD1.length} label="Aguardando D+1" detail="validar resultado" tone="purple" icon={CheckCircle2} to="/tarefas"/>
      <CiStatus value={healthy.length} label="Saudáveis" detail={`${active.length} campanhas ativas`} tone="healthy" icon={Check} to="/midia/gestao"/>
    </section>
    <div className="ci-reference-main">
      <section className="ci-card ci-day-agenda"><CiTitle icon={CalendarDays} title="Sua agenda" action="Abrir agenda" to="/agenda"/>{todayEvents.length?<div className="ci-timeline">{todayEvents.slice(0,8).map(event=><NavLink to={agendaUrl(event)} key={event.id} className="ci-timeline-link"><article><time>{new Date(event.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><div><b>{event.title}</b><small>{new Date(event.endAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · {event.category||"Compromisso"}</small></div></article></NavLink>)}</div>:<Empty text="Nenhum compromisso agendado para hoje."/>}</section>
      <section className="ci-card ci-day-tasks"><CiTitle icon={ClipboardCheck} title={`Suas tarefas do dia · ${todayLabel}`} action="Ver todas" to="/tarefas"/><div className="ci-task-list">{todayTasks.map(task=><NavLink to={taskUrl(task)} key={task.id} className="ci-task-row"><span><i className={overdue(task)?"is-late":task.status==="IN_PROGRESS"?"is-progress":""}/>{task.title}</span><em className={overdue(task)?"late":task.status==="IN_PROGRESS"?"progress":""}>{overdue(task)?"Atrasada":taskStatus(task.status)}</em></NavLink>)}{!todayTasks.length&&<Empty text="Nenhuma tarefa prevista para hoje."/>}</div></section>
    </div>
    <section className="ci-overview-cards">
      <CiBalanceFocus campaigns={balanceAttention} loading={campaignLoading}/>
      <CiOverview icon={WalletCards} title="Operação de campanhas" caption="panorama de hoje" tone="gold" rows={[["Campanhas ativas",String(active.length),"Em veiculação","/midia/gestao"],["Saldo em atenção",String(balanceAttention.length),"Até quatro dias de saldo","/midia/hoje"],["Em atenção",String(warning.length),"Precisam de acompanhamento","/midia/hoje"],["Revisões pendentes",String(overdueReviews.length),"Ciclo de 7 dias","/midia/hoje"]]} to="/midia/hoje"/>
      <CiOverview icon={ClipboardCheck} title="Relatórios para enviar" caption="organização de entregas" tone="purple" rows={reportTasks.slice(0,4).map(task=>[task.title,formatDate(task.dueAt),taskStatus(task.status),taskUrl(task)])} empty="Nenhum relatório pendente." to="/relatorios"/>
      <CiOverview icon={AlertTriangle} title="Alertas em atenção" caption="campanhas para revisar" tone="red" rows={attention.slice(0,4).map(item=>[item.client||"Cliente",item.name,campaignHealth(item)<70?"Score crítico — verificar agora":"Acompanhar campanha",campaignUrl(item),campaignHealth(item)<70?"Verificar":"Analisar"])} empty={campaignLoading?"Carregando campanhas…":"Nenhuma campanha requer atenção."} to="/midia/hoje"/>
    </section>
    <section className="ci-tickets-grid">
      <CiTickets title="Seus chamados" number="01" tickets={myTickets} empty="Nenhum chamado aberto para você." to="/chamados"/>
      <CiTickets title="Chamados com terceiros" number="02" tickets={teamTickets} empty="Nenhum chamado de terceiros em aberto." to="/chamados" secondary/>
    </section>
  </div>;
}
function CiTitle({icon:Icon,title,action,to}:{icon:typeof Activity;title:string;action:string;to:string}){return <header className="ci-card-title"><span><Icon/></span><b>{title}</b><NavLink to={to}>{action}<ArrowRight/></NavLink></header>}
function CiStatus({value,label,detail,tone,icon:Icon,to}:{value:number;label:string;detail:string;tone:string;icon:typeof Activity;to:string}){return <NavLink to={to} className={`ci-status ${tone}`}><span><Icon/></span><div><b>{label}</b><strong>{value}</strong><small>{detail}</small></div></NavLink>}
function PlatformBadge({platform}:{platform?:BoardCampaign["platform"]}){const meta=platform==="META_ADS";return <span className={`ci-platform ${meta?"meta":"google"}`} title={meta?"Meta Ads":"Google Ads"}>{meta?<MetaLogo />:<GoogleAdsLogo />}</span>}
function CiBalanceFocus({campaigns,loading}:{campaigns:BoardCampaign[];loading:boolean}){return <section className="ci-balance-focus"><header><span><CircleDollarSign/></span><div><b>Saldo que exige atenção</b><small>Somente campanhas com saldo para até quatro dias</small></div><NavLink to="/midia/gestao">Ver campanhas <ArrowRight/></NavLink></header><div className="ci-balance-list">{campaigns.length?campaigns.slice(0,6).map(item=>{const balance=campaignBalance(item)||0,days=item.dailyBudget>0?balance/item.dailyBudget:null;return <article key={`${item.platform}:${item.accountId}:${item.id}`} className={`ci-balance-row ${balanceRisk(item)}`}><PlatformBadge platform={item.platform}/><NavLink to={campaignUrl(item)} className="ci-balance-campaign"><b title={item.client||"Cliente não vinculado"}>{item.client||"Cliente não vinculado"}</b><small title={item.name}>{item.name}</small></NavLink><strong><small>Investimento diário</small>{item.dailyBudget>0?campaignMoney(item.dailyBudget,item)+"/dia":"Não informado"}</strong><strong><small>Saldo restante</small>{campaignMoney(balance,item)}{days!=null&&<em>{days<=1?"menos de 1 dia":`${Math.ceil(days)} dias`}</em>}</strong><NavLink className="ci-campaign-action analyze" to={campaignUrl(item)}><BarChart3/> Analisar</NavLink></article>}):<Empty text={loading?"Carregando saldos das campanhas…":"Nenhuma campanha com saldo em atenção."}/>}</div></section>}
function CiOverview({icon:Icon,title,caption,tone,rows,empty,to}:{icon:typeof Activity;title:string;caption:string;tone:string;rows:string[][];empty?:string;to:string}){return <section className={`ci-overview-card ${tone}`}><header><span><Icon/></span><div><b>{title}</b><small>{caption}</small></div></header><div className="ci-overview-rows">{rows.length?rows.map((row,index)=>{const content=<><b title={row[0]}>{row[0]}</b><span title={row[1]}>{row[1]}</span><em>{row[2]}</em></>;return row[4]?<article className="ci-overview-action-row" key={`${row[0]}-${index}`}>{content}<NavLink className="ci-campaign-action verify" to={row[3]}><CheckCircle2/>{row[4]}</NavLink></article>:row[3]?<NavLink className="ci-overview-row-link" to={row[3]} key={`${row[0]}-${index}`}>{content}</NavLink>:<article key={`${row[0]}-${index}`}>{content}</article>}):<Empty text={empty||"Sem itens para exibir."}/>}</div><NavLink to={to}>Ver mais <ArrowRight/></NavLink></section>}
function CiTickets({title,number,tickets,empty,to,secondary=false}:{title:string;number:string;tickets:Ticket[];empty:string;to:string;secondary?:boolean}){return <section className={`ci-tickets-card ${secondary?"secondary":""}`}><header><span>{number}</span><b>{title}</b><NavLink to={to}>Ver mais <ArrowRight/></NavLink></header><div className="ci-ticket-table"><div className="ci-ticket-head"><span>PRIORIDADE</span><span>CHAMADO</span><span>RESPONSÁVEL</span><span>PRAZO</span><span>STATUS</span></div>{tickets.length?tickets.slice(0,5).map(ticket=><NavLink className="ci-ticket-row" to={ticketUrl(ticket)} key={ticket.id}><i className={ticket.priority.toLowerCase()}>{ticket.priority==="URGENT"?"Urgente":ticket.priority==="HIGH"?"Alta":"Normal"}</i><b>{ticket.title}</b><span>{ticket.assigneeName||"Sem responsável"}</span><time>{formatDate(ticket.dueAt)}</time><em className={ticket.status.toLowerCase()}>{ticket.status==="IN_PROGRESS"?"Em produção":ticket.status==="WAITING"?"Aguardando":"Verificar"}</em></NavLink>):<Empty text={empty}/>}</div></section>}

function ExecutiveBoard({user,data}:{user:User;data:Data}){
  const {tickets,clients,tasks,users,pipelines,opportunities,events,finance}=data;
  const activeClients=clients.filter(client=>client.status==="ACTIVE").length;
  const open=opportunities.filter(item=>item.status==="OPEN");
  const won=opportunities.filter(item=>["WON","CONVERTED"].includes(item.status));
  const proposals=open.filter(item=>stageName(item,pipelines).toLowerCase().includes("proposta")).length;
  const negotiations=open.filter(item=>stageName(item,pipelines).toLowerCase().includes("negocia")).length;
  const inProgress=tasks.filter(task=>task.status==="IN_PROGRESS"),waiting=tasks.filter(task=>task.status==="WAITING_CLIENT"),late=tasks.filter(overdue);
  const doneToday=tasks.filter(task=>task.status==="DONE"&&sameDay(task.updatedAt||task.createdAt));
  const team=users.filter(member=>member.profile!=="CLIENT");
  const teamStats=team.map(member=>{const assigned=tasks.filter(task=>task.responsibleId===member.id),done=assigned.filter(task=>task.status==="DONE").length;return{...member,assigned,done,performance:assigned.length?Math.round(done/assigned.length*100):0}}).sort((a,b)=>b.performance-a.performance||b.done-a.done);
  const todayEvents=events.filter(event=>sameDay(event.startAt));
  const month=new Date().toISOString().slice(0,7),monthFinance=finance.filter(entry=>entry.dueDate?.startsWith(month)&&entry.status!=="CANCELLED");
  const income=monthFinance.filter(entry=>entry.type==="INCOME").reduce((sum,entry)=>sum+entry.amount,0),expense=monthFinance.filter(entry=>entry.type==="EXPENSE").reduce((sum,entry)=>sum+entry.amount,0),receivable=monthFinance.filter(entry=>entry.type==="INCOME"&&entry.status==="OPEN").reduce((sum,entry)=>sum+entry.amount,0),payable=monthFinance.filter(entry=>entry.type==="EXPENSE"&&entry.status==="OPEN").reduce((sum,entry)=>sum+entry.amount,0);
  const financeValue=(value:number)=>data.canViewFinanceValues?brl(value):"••••••";
  const margin=income?Math.round((income-expense)/income*100):0;
  return <div className="executive-board">
    <header className="board-greeting"><div><h1>Bom dia, {first(user.name)}! <span>👋</span></h1><p>Indicadores calculados com os registros atuais da operação.</p></div><div className="company-health"><small>ESTADO DA OPERAÇÃO</small><b><i/> {late.length?"ATENÇÃO":"SAUDÁVEL"}</b><span>{late.length?`${late.length} tarefa(s) atrasada(s)`:"Nenhuma tarefa atrasada"}</span></div><div className="board-date"><CalendarDays/><span><b>{fullDate()}</b><small>Dados atualizados agora</small></span></div></header>
    <section className="executive-kpis"><ExecKpi icon={CircleDollarSign} label="Receita do mês" value={financeValue(income)} footer={`${financeValue(receivable)} a receber`} tone="green"/><ExecKpi icon={WalletCards} label="Caixa operacional" value={financeValue(income-expense)} footer={`${financeValue(payable)} a pagar`} tone="blue"/><ExecKpi icon={ChartLine} label="Pipeline previsto" value={brl(open.reduce((sum,item)=>sum+Number(item.potentialValue||0),0))} footer={`${open.length} negociações abertas`} tone="purple"/><ExecKpi icon={UserRoundCheck} label="Clientes ativos" value={String(activeClients)} footer={`${clients.length} clientes visíveis`} tone="cyan"/><ExecKpi icon={Target} label="Margem operacional" value={data.canViewFinanceValues?`${margin}%`:"••••••"} footer={`${financeValue(income-expense)} de resultado`} tone="orange"/><ExecKpi icon={Handshake} label="Pipeline comercial" value={brl(won.reduce((sum,item)=>sum+Number(item.potentialValue||0),0))} footer={`${won.length} oportunidades ganhas`} tone="cyan"/></section>
    <section className="executive-health-row"><Health icon={BriefcaseBusiness} label="COMERCIAL" status={open.length?"CRESCENDO":"ESTÁVEL"} detail={`${open.length} oportunidades abertas`}/><Health icon={Activity} label="OPERAÇÃO" status={late.length?"ATENÇÃO":"EM DIA"} attention={!!late.length} detail={`${late.length} entregas atrasadas`}/><Health icon={CircleDollarSign} label="FINANCEIRO" status={payable>receivable?"ATENÇÃO":"SAUDÁVEL"} attention={payable>receivable} detail={`${monthFinance.length} lançamentos no mês`}/><Health icon={Megaphone} label="MARKETING" status="EM DIA" detail={`${clients.length} clientes acompanhados`}/><Health icon={Users} label="EQUIPE" status="PRODUTIVA" detail={`${doneToday.length} conclusões hoje`}/></section>
    <div className="executive-main-grid">
      <section className="exec-panel commercial-center"><PanelHead title="Central comercial" link="Ver funil completo" to="/crm"/><div className="exec-mini-kpis"><span><b>{open.length}</b> Leads ativos</span><span><b>{pipelines.length}</b> Funis</span><span><b>{proposals}</b> Propostas</span><span><b>{won.length}</b> Fechamentos</span></div><div className="commercial-content"><ExecTable rows={open.slice(0,7).map(item=>[item.company||item.name,stageName(item,pipelines),brl(item.potentialValue||0),item.responsibleName||"Sem responsável",item.nextAction||"Sem próxima ação"])} emptyText="Nenhuma oportunidade aberta."/><div className="sales-funnel"><b>FUNIL DE VENDAS</b>{pipelines[0]?.stages.slice(0,5).map(stage=>{const count=opportunities.filter(item=>item.stageId===stage.id).length;return <span key={stage.id}><small>{stage.name}</small><em>{count}</em><i><u style={{width:`${Math.max(10,open.length?count/open.length*100:0)}%`,background:stage.color}}/></i></span>})}{!pipelines.length&&<small>Sem funil cadastrado.</small>}</div></div></section>
      <section className="exec-panel execution-center"><PanelHead title="Central de execução" link="Ver tarefas" to="/tarefas"/><div className="execution-counts"><b className="red">{late.length}<small>Atrasadas</small></b><b className="orange">{inProgress.length}<small>Em andamento</small></b><b className="green">{doneToday.length}<small>Concluídas hoje</small></b><b className="blue">{waiting.length}<small>Aguardando cliente</small></b></div><ExecTable rows={[...tasks].sort((a,b)=>Number(overdue(b))-Number(overdue(a))).slice(0,7).map(task=>[task.priority,task.responsibleName||"Sem responsável",task.title,taskStatus(task.status),overdue(task)?"Atrasada":formatDate(task.dueAt)])} emptyText="Nenhuma tarefa cadastrada."/></section>
      <aside className="exec-right-rail"><section className="exec-panel team-performance"><PanelHead title="Performance da equipe" link="Ver equipe" to="/equipe"/>{teamStats.length?teamStats.slice(0,6).map(member=><div className="team-performance-row" key={member.id}><span>{initials(member.name)}</span><b>{member.name}</b><small>{member.assigned.length} tarefas</small><em>{member.performance}%</em><i><span style={{width:`${member.performance}%`}}/></i></div>):<Empty text="Nenhum colaborador cadastrado."/>}</section><section className="exec-panel master-agenda"><PanelHead title="Agenda de hoje" link="Ver agenda" to="/agenda"/>{todayEvents.slice(0,5).map(event=><article key={event.id}><time>{new Date(event.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><span><b>{event.title}</b><small>{event.ownerName}</small></span></article>)}{!todayEvents.length&&<Empty text="Nenhum compromisso hoje."/>}</section><section className="exec-panel master-alerts"><PanelHead title="Alertas importantes" link="Ver tarefas" to="/tarefas"/>{late.slice(0,4).map(task=><p key={task.id}><i/> <span><b>{task.title}</b><small>{task.responsibleName||"Sem responsável"} · prazo {formatDate(task.dueAt)}</small></span></p>)}{!late.length&&<p className="master-all-clear"><Check/> Nenhuma tarefa atrasada.</p>}</section></aside>
      <section className="exec-panel collaborator-tasks"><PanelHead title="Gestão de tarefas por colaborador" link="Ver todas as tarefas" to="/tarefas"/>{teamStats.length?<div>{teamStats.slice(0,6).map(member=><article className={!member.assigned.length?"is-empty":""} key={member.id}><header><span>{initials(member.name)}</span><div><b>{member.name}</b><small>{member.assigned.length} tarefas atribuídas</small></div><em>{member.done}/{member.assigned.length}</em></header>{member.assigned.slice(0,4).map(task=><p key={task.id}><i className={overdue(task)?"urgent":task.priority==="HIGH"||task.priority==="URGENT"?"warning":"ok"}/>{task.title}<small>{overdue(task)?"Atrasada":formatDate(task.dueAt)}</small></p>)}{!member.assigned.length&&<div className="collaborator-empty"><ListChecks/><span>Nenhuma tarefa atribuída</span></div>}</article>)}</div>:<Empty text="Cadastre colaboradores para acompanhar a distribuição de tarefas."/>}</section>
    </div>
    <section className="executive-advice ai-council"><header><Sparkles/><b>CONSELHO IA</b><span>Análise inteligente do cenário atual da operação</span></header><div><Advice title="Pontos fortes" tone="green" items={[`${doneToday.length} entregas concluídas hoje`,`${won.length} oportunidades conquistadas`,`${activeClients} clientes ativos`]}/><Advice title="Pontos de atenção" tone="orange" items={[`${late.length} tarefas atrasadas`,`${waiting.length} aguardando cliente`,`${open.filter(item=>!item.responsibleId).length} negociações sem responsável`]}/><Advice title="Oportunidades" tone="blue" items={[`${open.length} negociações podem avançar`,`${proposals} propostas em andamento`,`Revisar os ${tickets.filter(ticket=>!["RESOLVED","CLOSED"].includes(ticket.status)).length} chamados abertos`]}/><Advice title="Ações sugeridas" tone="purple" items={[late.length?"Priorizar entregas vencidas":"Manter ritmo das entregas",open.length?"Atualizar próximas ações comerciais":"Prospectar novas oportunidades",todayEvents.length?"Preparar compromissos de hoje":"Planejar agenda da equipe"]}/><article className="ai-next-action"><b>PRÓXIMA MELHOR AÇÃO</b><p>{late.length?`Resolver a tarefa mais antiga entre as ${late.length} atrasadas.`:open.length?`Avançar a oportunidade ${open[0].company||open[0].name}.`:"Criar a próxima ação comercial prioritária."}</p><NavLink to={late.length?"/tarefas":"/crm"}>Tomar ação agora <ArrowRight/></NavLink></article></div></section>
  </div>
}

function CollaboratorBoard({user,data}:{user:User;data:Data}){
  const can=(permission:string)=>user.profile==="MASTER"||Boolean(user.permissions?.includes(permission));
  const tasks=data.tasks.filter(task=>task.responsibleId===user.id),events=data.events.filter(event=>event.ownerId===user.id||event.participantIds?.includes(user.id));
  const todayEvents=events.filter(event=>sameDay(event.startAt)).sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime()),todayTasks=tasks.filter(task=>sameDay(task.dueAt)).sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime());
  const tickets=data.tickets.filter(ticket=>ticket.assigneeId===user.id),open=data.opportunities.filter(item=>item.responsibleId===user.id&&item.status==="OPEN");
  return <div className="collaborator-board"><header className="collab-greeting"><div><h1>Bom dia, {first(user.name)}! 👋</h1><p>{fullDate()}</p></div><blockquote><b>Seu dia em um só lugar</b><span>Agenda, tarefas, chamados e oportunidades ligados à sua conta.</span></blockquote>{can("tickets.create")&&<NavLink className="primary collab-new-ticket" to="/chamados">+ Novo chamado</NavLink>}</header>
    <section className="collab-agenda real-agenda"><header><div><CalendarDays/><b>Minha agenda de hoje</b></div>{can("calendar.view")&&<NavLink to="/agenda">Abrir agenda completa <ArrowRight/></NavLink>}</header><div className="real-agenda-list">{todayEvents.map(event=><article key={event.id}><time>{new Date(event.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><div><b>{event.title}</b><small>{new Date(event.endAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · {event.category||"Evento"}</small></div></article>)}{!todayEvents.length&&<Empty text="Nenhum compromisso na sua agenda hoje."/>}</div></section>
    <div className="collab-grid"><section className="collab-panel"><PanelHead title="Meus chamados" link={can("tickets.view")?"Ver chamados":undefined} to="/chamados"/><div className="collab-ticket-list">{tickets.slice(0,6).map(ticket=><article key={ticket.id}><span className={["HIGH","URGENT"].includes(ticket.priority)?"high":""}>{["HIGH","URGENT"].includes(ticket.priority)?"↑":"—"}</span><em>{ticket.status==="IN_PROGRESS"?"Em produção":ticket.status==="WAITING"?"Aguardando":"Aberto"}</em><b>{ticket.title}</b><small>{ticket.assigneeName}</small><time>{formatDate(ticket.dueAt)}</time></article>)}{!tickets.length&&<Empty text="Nenhum chamado atribuído a você."/>}</div></section><section className="collab-panel daily-activities"><PanelHead title="Minhas tarefas do dia" link={can("tasks.create")?"Nova tarefa":undefined} to="/tarefas"/>{todayTasks.map(task=><label key={task.id} className={task.status==="DONE"?"done":""}><input type="checkbox" checked={task.status==="DONE"} readOnly/><span>{task.title}</span><time>{new Date(task.dueAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><b>{taskStatus(task.status)}</b></label>)}{!todayTasks.length&&<Empty text="Nenhuma tarefa prevista para hoje."/>}</section></div>
    <section className="collab-kpis"><ExecKpi icon={ListChecks} label="Minhas tarefas" value={String(tasks.length)} footer={`${tasks.filter(task=>task.status==="IN_PROGRESS").length} em andamento`} tone="blue"/><ExecKpi icon={Clock3} label="Atrasadas" value={String(tasks.filter(overdue).length)} footer="tarefas fora do prazo" tone="orange"/><ExecKpi icon={Check} label="Concluídas" value={String(tasks.filter(task=>task.status==="DONE").length)} footer="no histórico visível" tone="green"/><ExecKpi icon={BriefcaseBusiness} label="Oportunidades" value={String(open.length)} footer={brl(open.reduce((sum,item)=>sum+Number(item.potentialValue||0),0))} tone="purple"/><ExecKpi icon={CalendarDays} label="Agenda hoje" value={String(todayEvents.length)} footer={`${events.length} eventos visíveis`} tone="cyan"/></section>
  </div>
}

function stageName(item:Opportunity,pipelines:Pipeline[]){return pipelines.find(pipeline=>pipeline.id===item.pipelineId)?.stages.find(stage=>stage.id===item.stageId)?.name||"Etapa não encontrada"}
function ExecKpi({icon:Icon,label,value,footer,tone}:{icon:typeof Activity;label:string;value:string;footer:string;tone:string}){return <article className={`board-kpi ${tone}`}><span><Icon/></span><small>{label}</small><b>{value}</b><p>{footer}</p></article>}
function Health({icon:Icon,label,status,detail,attention=false}:{icon:typeof Activity;label:string;status:string;detail:string;attention?:boolean}){return <span><Icon/><b>{label}</b><em className={attention?"attention":""}>{status}</em><small>{detail}</small></span>}
function PanelHead({title,link,to}:{title:string;link?:string;to:string}){return <header className="board-panel-head"><b>{title}</b>{link&&<NavLink to={to}>{link} <ArrowRight/></NavLink>}</header>}
function ExecTable({rows,emptyText}:{rows:string[][];emptyText:string}){return rows.length?<div className="exec-table">{rows.map((row,index)=><div key={index}>{row.map((cell,i)=><span key={i} title={cell}>{cell}</span>)}</div>)}</div>:<Empty text={emptyText}/>}
function Advice({title,tone,items}:{title:string;tone:string;items:string[]}){return <article className={tone}><b>{title}</b>{items.map(item=><p key={item}><Check/>{item}</p>)}</article>}
function Empty({text}:{text:string}){return <div className="board-empty-row">{text}</div>}
