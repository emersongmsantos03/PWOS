import { requestMediaPeriod } from "./mediaPeriodRequest";
import { googleOptimizationScore } from "./optimizationScore";
import { MetaLogo, GoogleAdsLogo } from "./PlatformLogos";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, AlarmClock, ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, ChartLine, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, Clock3, Eye, EyeOff, X, Handshake, ListChecks, MessagesSquare, Megaphone, SearchCheck, Sparkles, Target, UserRoundCheck, Users, WalletCards } from "lucide-react";
import { NavLink } from "react-router-dom";
import { systemConfirm } from "./SystemDialog";
import { actionStatusLabels, addDays, dayOf, displayStatus, formatLabels, localDay, overallPerception, timeOf, typeLabels, type Meeting, type MeetingsData } from "./meetingsModel";
import { DirectorsBoard } from "./DirectorsBoard";
import { MarketingBoard, marketingDepartmentId } from "./MarketingBoard";
import { userColor } from "./userColors";
import "./CampaignIntelligenceBoard.css";
import "./GestaoBoard.css";

type User={id:string;name:string;role:string;profile:string;permissions?:string[];departmentId?:string;departmentName?:string};
type TeamUser={id:string;name:string;role?:string;profile?:string;color?:string};
type Ticket={id:string;title:string;priority:string;status:string;assigneeId:string;assigneeName:string;dueAt:string;code?:string;clientName?:string;steps?:{name:string;status:string;adjustment?:{note:string}}[]};
type Client={id:string;name:string;status:string};
type Task={id:string;title:string;responsibleId:string;responsibleName:string;priority:string;status:string;dueAt:string;createdAt:string;updatedAt?:string};
type Stage={id:string;name:string;color:string;probability:number;terminal?:"WON"|"LOST"};
type Pipeline={id:string;name:string;stages:Stage[]};
type Opportunity={id:string;name:string;company:string;serviceInterest:string;potentialValue:number;responsibleId:string;responsibleName:string;pipelineId:string;stageId:string;status:"OPEN"|"WON"|"LOST"|"CONVERTED";nextAction:string;nextActionAt:string;createdAt:string;updatedAt:string};
type CalendarEvent={id:string;title:string;ownerId:string;ownerName:string;participantIds:string[];startAt:string;endAt:string;category:string;location?:string};
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
  // Diretoria (setor e líder) tem um painel próprio, que busca os dados de toda a equipe.
  if(user.permissions?.includes("tickets.manage_flows"))return <DirectorsBoard user={user}/>;
  // Marketing e Criação: agenda, tarefas e chamados; o líder também vê os chamados do setor.
  if(user.departmentId===marketingDepartmentId||/marketing/i.test(user.departmentName||""))return <MarketingBoard user={user}/>;
  if(loading)return <div className="dashboard-loading"><Activity/> Atualizando indicadores operacionais...</div>;
  const campaignIntelligence = user.departmentName?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes("inteligencia de campanha");
  // Liderança de Gestão / Customer Success tem um painel focado em reuniões e carteira.
  const management = ["gestao","customer success","supervisao"].some(name=>user.departmentName?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(name));
  return <>{loadError&&<p role="alert">{loadError}</p>}{management?<GestaoBoard user={user} data={data}/>:campaignIntelligence?<CampaignIntelligenceBoard user={user} data={data}/>:executive?<ExecutiveBoard user={user} data={data}/>:<CollaboratorBoard user={user} data={data}/>}</>;
}

type BoardCampaign={id:string;accountId:string;platform?:"META_ADS"|"GOOGLE_ADS";name:string;client:string;currency?:string;status:string;dailyBudget:number;lifetimeBudget:number;remainingBudget?:number|null;spend:number;impressions:number;clicks:number;leads:number;cpl:number|null;verifiedAt?:string|null;landingPageStatus?:string|null;optimizationStatus?:string|null};
const campaignHealth=(item:BoardCampaign)=>{
  if(!item.impressions&&!item.clicks&&!item.spend)return -1;
  // No Google Ads vale a pontuação de otimização da própria plataforma.
  const optimization=googleOptimizationScore(item);
  if(optimization!=null)return optimization;
  const ctr=item.impressions?item.clicks/item.impressions*100:0;
  let score=100;
  if(item.status==="WITH_ISSUES")score-=35;
  if(!item.leads)score-=25;
  if(ctr<1)score-=20;else if(ctr<2)score-=10;
  if(item.landingPageStatus==="INACTIVE")score-=25;
  return Math.max(0,score);
};
const reviewOverdue=(item:BoardCampaign)=>!item.verifiedAt||Date.now()-new Date(item.verifiedAt).getTime()>=7*86400000;
type BoardAccount={id:string;name:string;platform:"META_ADS"|"GOOGLE_ADS";currency?:string;spendCap?:number;amountSpent?:number;prepaidBalance?:number|null;remainingBudget?:number|null};
// Cliente precisa pedir crédito quando o saldo da conta cobre até este número de dias
// do orçamento diário somado das campanhas ativas da conta.
const creditAlertDays=1.5,creditCriticalDays=1,creditSuggestionDays=30;
type CreditNeed={account:BoardAccount;client:string;daily:number;balance:number;days:number;suggested:number;link:string};
// Saldo da conta: na Meta, o crédito pré-pago (Pix/boleto) e o que falta até o limite de
// gastos — vale o menor dos dois, pois qualquer um para a veiculação; no Google, o
// orçamento da conta ainda não veiculado. Quando o saldo sobe, a conta sai da lista sozinha.
const metaBalance=(account:BoardAccount)=>{
  const cap=account.spendCap&&account.spendCap>0?Math.max(0,account.spendCap-Number(account.amountSpent||0)):null,prepaid=account.prepaidBalance==null?null:Math.max(0,account.prepaidBalance);
  return cap==null?prepaid:prepaid==null?cap:Math.min(cap,prepaid);
};
const accountBalance=(account:BoardAccount)=>account.platform==="META_ADS"
  ?metaBalance(account)
  :(account.remainingBudget==null?null:Math.max(0,Number(account.remainingBudget)));
const creditCoverage=(account:BoardAccount,campaigns:BoardCampaign[])=>{
  const active=campaigns.filter(item=>item.platform===account.platform&&item.accountId===account.id&&item.status==="ACTIVE"&&item.dailyBudget>0);
  return{active,daily:active.reduce((sum,item)=>sum+item.dailyBudget,0),balance:accountBalance(account)};
};
const creditNeeds=(accounts:BoardAccount[],campaigns:BoardCampaign[]):CreditNeed[]=>accounts.flatMap(account=>{
  const {active,daily,balance}=creditCoverage(account,campaigns);
  if(!active.length||balance==null||balance/daily>creditAlertDays)return [];
  const named=active.find(item=>item.client&&!/^\d+$/.test(item.client));
  return [{account,client:named?.client||account.name,daily,balance,days:balance/daily,suggested:Math.max(0,daily*creditSuggestionDays-balance),link:campaignUrl(active[0])}];
}).sort((a,b)=>a.days-b.days);
// Controle manual do pedido de crédito. Uma marcação antiga não vale para um novo
// alerta da mesma conta: o ciclo termina quando o saldo volta a cobrir o alerta e,
// por segurança, o pedido expira em 10 dias e o recebimento em 3.
type CreditMark={requestedAt?:string;requestedBy?:string;receivedAt?:string;receivedBy?:string;previous?:{requestedAt:string;receivedAt?:string}};
const creditKey=(account:BoardAccount)=>`${account.platform}:${account.id}`;
const withinDays=(value:string|undefined,days:number)=>!!value&&Date.now()-new Date(value).getTime()<days*86400000;
const currentCreditMark=(mark?:CreditMark)=>{
  if(!mark||!withinDays(mark.requestedAt,10)||(mark.receivedAt&&!withinDays(mark.receivedAt,3)))return undefined;
  return mark;
};
const markDate=(value:string)=>new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const shortMarkDate=(value:string)=>new Date(value).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
type CreditStatus="PENDING"|"REQUESTED"|"RECEIVED";
// Conta tirada da lista de pedido de crédito (cliente pausado que pode voltar).
type CreditHidden={hiddenAt:string;hiddenBy:string;client:string;accountName:string};
// Pedido anterior, exibido abaixo de "Pendente": o ciclo vencido ou o último encerrado.
const lastCreditCycle=(raw?:CreditMark)=>raw?.requestedAt?{requestedAt:raw.requestedAt,receivedAt:raw.receivedAt}:raw?.previous;
// Dias de calendário desde o pedido: um pedido de outro dia pode ser refeito ("Solicitar novamente").
const requestAge=(value?:string)=>{if(!value)return 0;const day=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();return Math.round((day(new Date())-day(new Date(value)))/86400000)};
type CreditChoice=CreditStatus|"RENEW";
const creditStatus=(mark?:CreditMark):CreditStatus=>mark?.receivedAt?"RECEIVED":mark?.requestedAt?"REQUESTED":"PENDING";
const accountMoney=(value:number,account:BoardAccount)=>value.toLocaleString("pt-BR",{style:"currency",currency:account.currency||"BRL",maximumFractionDigits:0});
const campaignUrl=(item:BoardCampaign)=>`/midia/gestao?campaign=${encodeURIComponent(`${item.platform||"META_ADS"}:${item.accountId}:${item.id}`)}`;
const taskUrl=(task:Task)=>`/tarefas?task=${encodeURIComponent(task.id)}`;
const ticketUrl=(ticket:Ticket)=>`/chamados?ticket=${encodeURIComponent(ticket.id)}`;
const agendaUrl=(event:CalendarEvent)=>`/agenda?date=${encodeURIComponent(event.startAt)}`;

function CampaignIntelligenceBoard({user,data}:{user:User;data:Data}){
  const [campaigns,setCampaigns]=useState<BoardCampaign[]>([]),[accounts,setAccounts]=useState<BoardAccount[]>([]),[campaignLoading,setCampaignLoading]=useState(true),[campaignError,setCampaignError]=useState("");
  const [creditMarks,setCreditMarks]=useState<Record<string,CreditMark>>({}),[creditHidden,setCreditHidden]=useState<Record<string,CreditHidden>>({});
  useEffect(()=>{
    fetch("/api/media/credit-requests").then(response=>response.ok?response.json():null).then(payload=>{if(payload?.requests)setCreditMarks(payload.requests);if(payload?.hidden)setCreditHidden(payload.hidden)}).catch(()=>{});
  },[user.id]);
  const setHidden=async(platform:string,accountId:string,hidden:boolean,names:{client?:string;accountName?:string}={})=>{
    const response=await fetch("/api/media/credit-hidden",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform,accountId,hidden,...names})}).catch(()=>null);
    const payload=response?.ok?await response.json().catch(()=>null):null;
    if(!payload?.key)return;
    setCreditHidden(current=>{const next={...current};if(payload.hidden)next[payload.key]=payload.hidden;else delete next[payload.key];return next});
  };
  const hideCredit=async(need:CreditNeed)=>{
    if(!await systemConfirm({title:`Ocultar ${need.client}?`,message:"A conta sai da lista de pedido de crédito (e da contagem) até alguém mostrar de novo em “Ocultos”. Use para clientes pausados que podem voltar.",confirmLabel:"Ocultar"}))return;
    await setHidden(need.account.platform||"META_ADS",need.account.id,true,{client:need.client,accountName:need.account.name});
  };
  // Escolha no menu de status → chamada da API: voltar de "Recebido" para "Solicitado"
  // no mesmo dia desfaz o recebimento; em outro dia é um novo pedido (clientes que
  // pedem crédito toda semana). "Pendente" limpa o ciclo inteiro.
  const setCreditStatus=(account:BoardAccount,mark:CreditMark|undefined,status:CreditChoice)=>{
    // Novo pedido para uma conta já solicitada em outro dia: começa um ciclo novo com a data de hoje.
    if(status==="RENEW")return sendCreditMark(account,"REQUESTED",true);
    const current=creditStatus(mark);
    if(status===current)return;
    if(status==="PENDING")return sendCreditMark(account,"REQUESTED",false);
    if(status==="RECEIVED")return sendCreditMark(account,"RECEIVED",true);
    return current==="RECEIVED"&&sameDay(mark?.receivedAt||"")?sendCreditMark(account,"RECEIVED",false):sendCreditMark(account,"REQUESTED",true);
  };
  const sendCreditMark=async(account:BoardAccount,step:"REQUESTED"|"RECEIVED"|"CLOSE",checked:boolean,requestedAt?:string)=>{
    const response=await fetch("/api/media/credit-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({platform:account.platform,accountId:account.id,step,checked,requestedAt})}).catch(()=>null);
    const payload=response?.ok?await response.json().catch(()=>null):null;
    if(!payload?.key)return;
    setCreditMarks(current=>{const next={...current};if(payload.request)next[payload.key]=payload.request;else delete next[payload.key];return next});
  };
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
      const platform=provider==="meta"?"META_ADS" as const:"GOOGLE_ADS" as const;
      return{campaigns:(payload.campaigns||[]).map((item:BoardCampaign)=>({...item,platform})) as BoardCampaign[],accounts:(payload.accounts||[]).map((account:BoardAccount)=>({...account,platform})) as BoardAccount[]};
    })).then(results=>{
      if(disposed)return;
      setCampaigns(results.flatMap(result=>result.status==="fulfilled"?result.value.campaigns:[]));
      setAccounts(results.flatMap(result=>result.status==="fulfilled"?result.value.accounts:[]));
      const failures=results.filter((result): result is PromiseRejectedResult=>result.status==="rejected");
      if(failures.length)setCampaignError(failures.map(result=>result.reason instanceof Error ? result.reason.message : "Não foi possível carregar as campanhas. Tente novamente.").join(" · "));
    }).finally(()=>{clearTimeout(timeout);if(!disposed)setCampaignLoading(false);});
    return()=>{disposed=true;clearTimeout(timeout);controller.abort();};
  },[user.id]);
  // Fim do ciclo: quando o saldo volta a cobrir o alerta (o crédito caiu), a marcação é
  // encerrada; se a conta precisar de crédito de novo, ela volta como Pendente.
  useEffect(()=>{
    if(campaignLoading)return;
    Object.entries(creditMarks).forEach(([key,mark])=>{
      const account=accounts.find(item=>creditKey(item)===key);
      if(!account||!mark.requestedAt)return;
      const {daily,balance}=creditCoverage(account,campaigns);
      if(daily>0&&balance!=null&&balance/daily>creditAlertDays)void sendCreditMark(account,"CLOSE",true,mark.requestedAt);
    });
  },[campaignLoading,accounts,campaigns,creditMarks]);
  // Conta oculta no pedido de crédito sai também de críticas, atenção e revisões.
  const active=campaigns.filter(item=>item.status==="ACTIVE"),alertable=active.filter(item=>!creditHidden[`${item.platform||"META_ADS"}:${item.accountId}`]),critical=alertable.filter(item=>{const score=campaignHealth(item);return score>=0&&score<70}),warning=alertable.filter(item=>{const score=campaignHealth(item);return score>=70&&score<90}),overdueReviews=alertable.filter(reviewOverdue),credit=creditNeeds(accounts,campaigns).filter(need=>!creditHidden[creditKey(need.account)]),healthy=active.filter(item=>{const score=campaignHealth(item);return score>=90}),todayEvents=data.events.filter(event=>(event.ownerId===user.id||event.participantIds?.includes(user.id))&&sameDay(event.startAt)).sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime()),myTasks=data.tasks.filter(task=>task.responsibleId===user.id&&!['DONE','CANCELLED'].includes(task.status)).sort((a,b)=>Number(overdue(b))-Number(overdue(a))),todayTasks=myTasks.filter(task=>sameDay(task.dueAt)||overdue(task)).slice(0,7),waitingD1=myTasks.filter(task=>/d\+1|aguardando resultado|validar resultado/i.test(`${task.title} ${task.status}`)),myTickets=data.tickets.filter(ticket=>ticket.assigneeId===user.id&&!['RESOLVED','CLOSED'].includes(ticket.status)),teamTickets=data.tickets.filter(ticket=>ticket.assigneeId!==user.id&&!['RESOLVED','CLOSED'].includes(ticket.status)),reportTasks=myTasks.filter(task=>/relat[oó]rio|report/i.test(task.title));
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
      <CiCreditNeeds needs={credit} loading={campaignLoading} marks={creditMarks} onStatus={setCreditStatus} hidden={creditHidden} onHide={hideCredit} onShow={key=>{const [platform,...id]=key.split(":");void setHidden(platform,id.join(":"),false)}}/>
      <CiOverview icon={WalletCards} title="Operação de campanhas" caption="panorama de hoje" tone="gold" rows={[["Campanhas ativas",String(active.length),"Em veiculação","/midia/gestao"],["Pedir créditos",String(credit.length),`Clientes com saldo para até ${creditAlertDays} dias`,"/midia/gestao"],["Em atenção",String(warning.length),"Precisam de acompanhamento","/midia/hoje"],["Revisões pendentes",String(overdueReviews.length),"Ciclo de 7 dias","/midia/hoje"]]} to="/midia/hoje"/>
      <CiOverview icon={ClipboardCheck} title="Relatórios para enviar" caption="organização de entregas" tone="purple" rows={reportTasks.slice(0,4).map(task=>[task.title,formatDate(task.dueAt),taskStatus(task.status),taskUrl(task)])} empty="Nenhum relatório pendente." to="/relatorios"/>
      <CiOverview icon={AlertTriangle} title="Alertas em atenção" caption="campanhas para revisar" tone="red" rows={attention.slice(0,4).map(item=>[item.client||"Cliente",item.name,campaignHealth(item)<70?"Score crítico — verificar agora":"Acompanhar campanha",campaignUrl(item),campaignHealth(item)<70?"Verificar":"Analisar"])} empty={campaignLoading?"Carregando campanhas…":"Nenhuma campanha requer atenção."} to="/midia/hoje"/>
    </section>
    <section className="ci-tickets-grid">
      <CiTickets title="Seus chamados" number="01" tickets={myTickets} empty="Nenhum chamado aberto para você." to="/chamados"/>
      <CiTickets title="Chamados com terceiros" number="02" tickets={teamTickets} empty="Nenhum chamado de terceiros em aberto." to="/chamados?filtro=terceiros" secondary/>
    </section>
  </div>;
}
function CiTitle({icon:Icon,title,action,to}:{icon:typeof Activity;title:string;action:string;to:string}){return <header className="ci-card-title"><span><Icon/></span><b>{title}</b><NavLink to={to}>{action}<ArrowRight/></NavLink></header>}
function CiStatus({value,label,detail,tone,icon:Icon,to}:{value:number;label:string;detail:string;tone:string;icon:typeof Activity;to:string}){return <NavLink to={to} className={`ci-status ${tone}`}><span><Icon/></span><div><b>{label}</b><strong>{value}</strong><small>{detail}</small></div></NavLink>}
function PlatformBadge({platform}:{platform?:BoardCampaign["platform"]}){const meta=platform==="META_ADS";return <span className={`ci-platform ${meta?"meta":"google"}`} title={meta?"Meta Ads":"Google Ads"}>{meta?<MetaLogo />:<GoogleAdsLogo />}</span>}
function CiCreditNeeds({needs,loading,marks,onStatus,hidden,onHide,onShow}:{needs:CreditNeed[];loading:boolean;marks:Record<string,CreditMark>;onStatus:(account:BoardAccount,mark:CreditMark|undefined,status:CreditChoice)=>void;hidden:Record<string,CreditHidden>;onHide:(need:CreditNeed)=>void;onShow:(key:string)=>void}){const [showHidden,setShowHidden]=useState(false),hiddenList=Object.entries(hidden).sort((a,b)=>a[1].client.localeCompare(b[1].client,"pt-BR"));return <section className="ci-balance-focus"><header><span><CircleDollarSign/></span><div><b>Clientes que precisam solicitar créditos{needs.length?` (${needs.length})`:""}</b><small>Saldo da conta para até {creditAlertDays.toLocaleString("pt-BR")} dia do orçamento diário das campanhas ativas</small></div><button type="button" className="ci-hidden-toggle" onClick={()=>setShowHidden(true)} title="Clientes que não precisam pedir crédito"><EyeOff/>Ocultos{hiddenList.length?` (${hiddenList.length})`:""}</button><NavLink to="/midia/gestao">Ver campanhas <ArrowRight/></NavLink></header>
  {showHidden&&<div className="ci-hidden-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setShowHidden(false)}><div className="ci-hidden-dialog" role="dialog" aria-label="Clientes ocultos do pedido de crédito">
    <header><EyeOff/><div><b>Ocultos do pedido de crédito</b><small>Contas que não precisam pedir crédito agora. Mostre de novo quando o cliente voltar.</small></div><button type="button" onClick={()=>setShowHidden(false)} aria-label="Fechar"><X/></button></header>
    {hiddenList.length?<ul>{hiddenList.map(([key,item])=><li key={key}><PlatformBadge platform={key.split(":")[0] as BoardCampaign["platform"]}/><div><b>{item.client||item.accountName||key}</b><small>{item.accountName&&item.accountName!==item.client?`${item.accountName} · `:""}ocultado por {item.hiddenBy||"—"} em {markDate(item.hiddenAt)}</small></div><button type="button" onClick={()=>onShow(key)}><Eye/>Mostrar de novo</button></li>)}</ul>:<p>Nenhum cliente oculto.</p>}
  </div></div>}
  <div className="ci-balance-list ci-credit-list">{needs.length?needs.map(need=>{const days=Math.floor(need.days);return <article key={`${need.account.platform}:${need.account.id}`} className={`ci-balance-row ${need.days<=creditCriticalDays?"critical":"warning"}`}><PlatformBadge platform={need.account.platform}/><NavLink to={need.link} className="ci-balance-campaign"><b title={need.client}>{need.client}</b><small title={`${need.account.name} · pedir cerca de ${accountMoney(need.suggested,need.account)} para ${creditSuggestionDays} dias`}>{need.account.name} · pedir ~{accountMoney(need.suggested,need.account)} p/ {creditSuggestionDays} dias</small></NavLink><strong><small>Investimento diário</small>{accountMoney(need.daily,need.account)}/dia</strong><strong><small>Saldo restante</small>{accountMoney(need.balance,need.account)}<em>{need.balance<=0?"sem saldo":days<1?"menos de 1 dia":`${days} dia${days>1?"s":""}`}</em></strong>{(()=>{const raw=marks[creditKey(need.account)],mark=currentCreditMark(raw),status=creditStatus(mark),last=status==="PENDING"?lastCreditCycle(raw):raw?.previous;return <div className="ci-credit-actions"><div className="ci-credit-links"><button type="button" className="ci-credit-hide" onClick={()=>onHide(need)} title="Ocultar: não precisa pedir crédito" aria-label={`Ocultar ${need.client} do pedido de crédito`}><EyeOff/></button><NavLink className="ci-campaign-action analyze" to={need.link}><BarChart3/> Ver conta</NavLink></div><select className={`ci-credit-status ${status.toLowerCase()}${status==="REQUESTED"&&requestAge(mark?.requestedAt)>=3?" stale":""}`} value={status} aria-label="Status do pedido de crédito" title={mark?.receivedAt?`Recebido, marcado por ${mark.receivedBy||"—"} em ${markDate(mark.receivedAt)}`:mark?.requestedAt?`Solicitado por ${mark.requestedBy||"—"} em ${markDate(mark.requestedAt)}`:"Escolha o status do pedido de crédito"} onChange={event=>onStatus(need.account,mark,event.target.value as CreditChoice)}><option value="PENDING">Pendente</option><option value="REQUESTED">{mark?.requestedAt?`Solicitado · ${shortMarkDate(mark.requestedAt)}${requestAge(mark.requestedAt)>=1?` (há ${requestAge(mark.requestedAt)} dia${requestAge(mark.requestedAt)>1?"s":""})`:""}`:"Solicitado"}</option>{status==="REQUESTED"&&requestAge(mark?.requestedAt)>=1&&<option value="RENEW">Solicitar novamente (hoje)</option>}<option value="RECEIVED">{mark?.receivedAt?`Recebido · ${shortMarkDate(mark.receivedAt)}`:"Recebido"}</option></select>{last&&<small className="ci-credit-last" title={last.receivedAt?`Último pedido em ${markDate(last.requestedAt)}, recebido em ${markDate(last.receivedAt)}`:`Último pedido em ${markDate(last.requestedAt)}`}>Último pedido {shortMarkDate(last.requestedAt)}{last.receivedAt?` · recebido ${shortMarkDate(last.receivedAt)}`:""}</small>}</div>})()}</article>}):<Empty text={loading?"Carregando saldos das contas…":"Nenhum cliente precisa solicitar créditos agora."}/>}</div></section>}
function CiOverview({icon:Icon,title,caption,tone,rows,empty,to}:{icon:typeof Activity;title:string;caption:string;tone:string;rows:string[][];empty?:string;to:string}){return <section className={`ci-overview-card ${tone}`}><header><span><Icon/></span><div><b>{title}</b><small>{caption}</small></div></header><div className="ci-overview-rows">{rows.length?rows.map((row,index)=>{const content=<><b title={row[0]}>{row[0]}</b><span title={row[1]}>{row[1]}</span><em>{row[2]}</em></>;return row[4]?<article className="ci-overview-action-row" key={`${row[0]}-${index}`}>{content}<NavLink className="ci-campaign-action verify" to={row[3]}><CheckCircle2/>{row[4]}</NavLink></article>:row[3]?<NavLink className="ci-overview-row-link" to={row[3]} key={`${row[0]}-${index}`}>{content}</NavLink>:<article key={`${row[0]}-${index}`}>{content}</article>}):<Empty text={empty||"Sem itens para exibir."}/>}</div><NavLink to={to}>Ver mais <ArrowRight/></NavLink></section>}
// Cartão de chamados do painel: lista enxuta (sem tabela) que cabe em qualquer largura.
const ticketPriority:Record<string,string>={URGENT:"Urgente",HIGH:"Alta",MEDIUM:"Média",LOW:"Baixa"};
const ticketStatus:Record<string,string>={OPEN:"Aberto",IN_PROGRESS:"Em andamento",WAITING:"Aguardando cliente"};
function CiTickets({title,number,tickets,empty,to,secondary=false}:{title:string;number:string;tickets:Ticket[];empty:string;to:string;secondary?:boolean}){
  const late=(ticket:Ticket)=>!!ticket.dueAt&&new Date(ticket.dueAt).getTime()<Date.now();
  const sorted=[...tickets].sort((a,b)=>Number(late(b))-Number(late(a))||(a.dueAt||"9").localeCompare(b.dueAt||"9"));
  return <section className={`dk-card ${secondary?"dk-others":""}`}>
    <header><span className="dk-badge">{number}</span><b>{title}</b><em className="dk-count">{tickets.length}</em><NavLink to={to}>Ver todos <ArrowRight/></NavLink></header>
    {sorted.length?<div className="dk-list">{sorted.slice(0,5).map(ticket=>{
      const steps=ticket.steps||[],active=steps.find(step=>step.status==="ACTIVE"),position=active?steps.indexOf(active)+1:0;
      return <NavLink className={`dk-row ${ticket.priority.toLowerCase()}`} to={ticketUrl(ticket)} key={ticket.id}>
        <div className="dk-main"><b title={ticket.title}>{["HIGH","URGENT"].includes(ticket.priority)&&<i className="dk-priority">{ticketPriority[ticket.priority]}</i>}{ticket.title}</b>
          <small><span>{[ticket.clientName||"Interno",active?`${active.name} · ${position}/${steps.length}`:""].filter(Boolean).join(" · ")}</span>{active?.adjustment&&<i className="dk-adjust">Ajustes</i>}</small></div>
        {secondary&&<div className="dk-person" title={ticket.assigneeName}><span>{initials(ticket.assigneeName||"?")}</span><small>{first(ticket.assigneeName||"Sem responsável")}</small></div>}
        <div className="dk-meta"><time className={late(ticket)?"late":""}>{late(ticket)?"Atrasado":ticket.dueAt?formatDate(ticket.dueAt):"Sem prazo"}</time><em className={`dk-status ${ticket.status.toLowerCase()}`}>{ticketStatus[ticket.status]||ticket.status}</em></div>
      </NavLink>})}</div>
    :<div className="dk-empty"><CheckCircle2/><span>{empty}</span></div>}
  </section>}

function GestaoBoard({user,data}:{user:User;data:Data}){
  const can=(permission:string)=>user.profile==="MASTER"||Boolean(user.permissions?.includes(permission));
  const [meetingsData,setMeetingsData]=useState<MeetingsData|null>(null),[meetingsError,setMeetingsError]=useState("");
  useEffect(()=>{
    if(!can("meetings.view"))return;
    const controller=new AbortController();
    fetch("/api/meetings",{signal:controller.signal}).then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||"Não foi possível carregar as reuniões.");setMeetingsData(payload)}).catch(error=>{if(!controller.signal.aborted)setMeetingsError(error.message)});
    return()=>controller.abort();
  },[user.id]);
  const meetings=meetingsData?.meetings||[],today=localDay(),tomorrow=localDay(addDays(new Date(),1));
  const linkedEvents=new Set(meetings.map(item=>item.calendarEventId).filter(Boolean));
  const agenda=[
    ...data.events.filter(event=>(event.ownerId===user.id||event.participantIds?.includes(user.id))&&sameDay(event.startAt)).map(event=>{const meeting=meetings.find(item=>item.calendarEventId===event.id);return{id:event.id,startAt:event.startAt,title:meeting?.clientName||event.title,detail:meeting?(meeting.subject||typeLabels[meeting.type]):event.category||"Compromisso",place:meeting?formatLabels[meeting.format]:event.location||"",to:meeting?`/reunioes/${meeting.id}`:agendaUrl(event),tone:meeting?(meeting.type==="PLANNING"?"orange":meeting.type==="RESULTS"?"red":"green"):"blue"}}),
    ...meetings.filter(item=>item.responsibleId===user.id&&item.status!=="CANCELLED"&&dayOf(item.startAt)===today&&(!item.calendarEventId||!linkedEvents.has(item.calendarEventId)||!data.events.some(event=>event.id===item.calendarEventId))).map(item=>({id:item.id,startAt:item.startAt,title:item.clientName,detail:item.subject||typeLabels[item.type],place:formatLabels[item.format],to:`/reunioes/${item.id}`,tone:"green"})),
  ].sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const myTasks=data.tasks.filter(task=>task.responsibleId===user.id&&!["DONE","CANCELLED"].includes(task.status)).sort((a,b)=>Number(overdue(b))-Number(overdue(a))||(a.dueAt||"").localeCompare(b.dueAt||""));
  const todayTasks=myTasks.filter(task=>sameDay(task.dueAt)||overdue(task)).slice(0,9);
  const myTickets=data.tickets.filter(ticket=>ticket.assigneeId===user.id&&!["RESOLVED","CLOSED"].includes(ticket.status)),teamTickets=data.tickets.filter(ticket=>ticket.assigneeId!==user.id&&!["RESOLVED","CLOSED"].includes(ticket.status));
  const active=meetings.filter(item=>item.status!=="CANCELLED");
  const todays=active.filter(item=>dayOf(item.startAt)===today).sort((a,b)=>a.startAt.localeCompare(b.startAt)),tomorrows=active.filter(item=>dayOf(item.startAt)===tomorrow).sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const summaries=meetings.filter(item=>item.status==="COMPLETED"&&dayOf(item.startAt)===today).sort((a,b)=>a.startAt.localeCompare(b.startAt));
  const latest=new Map<string,Meeting>();
  meetings.filter(item=>item.status==="COMPLETED").sort((a,b)=>a.startAt.localeCompare(b.startAt)).forEach(item=>latest.set(item.clientId,item));
  const portfolio=(meetingsData?.clients||[]).filter(client=>client.status!=="INACTIVE"),month=today.slice(0,7);
  const attention=[...latest.values()].filter(item=>["ATTENTION","NEGATIVE"].includes(overallPerception(item))).length;
  const pendingReturns=meetings.filter(item=>item.status==="COMPLETED"&&item.nextContact.date&&item.nextContact.date<=today&&!meetings.some(next=>next.clientId===item.clientId&&next.startAt>item.startAt&&next.status!=="CANCELLED")).length+meetings.flatMap(item=>item.actions).filter(action=>action.status==="WAITING_CLIENT").length;
  const contactedToday=new Set(summaries.map(item=>item.clientId)).size,plannedToday=new Set(todays.map(item=>item.clientId)).size;
  const meetingStatus=(item:Meeting)=>{const state=displayStatus(item);return <em className={`gb-status ${state.tone}`}>{state.label==="Agendada"&&dayOf(item.startAt)===today?"Pendente":state.label}</em>};
  const firstAction=(item:Meeting)=>item.actions.find(action=>action.status!=="DONE")||item.actions[0];
  const timeOfDay=new Date().getHours()<12?"Bom dia":new Date().getHours()<18?"Boa tarde":"Boa noite";
  return <div className="campaign-intelligence-board ci-reference-board gestao-board">
    <header className="ci-reference-greeting">
      <div className="ci-sun"><Sparkles/></div><div className="ci-greeting-copy"><h1>{timeOfDay}, {first(user.name)}! 👋</h1><b>Hoje é dia {fullDate()}!</b><p>Disciplina hoje, grandes resultados amanhã.</p></div>
      <blockquote><Sparkles/><span>"Relacionamento bem cuidado<br/>vira resultado no longo prazo."</span></blockquote>
      <aside><span><Users/></span><div><small>DEPARTAMENTO</small><b>{user.departmentName||"Gestão"}</b></div>{can("tickets.create")?<NavLink className="gb-ticket-button" to="/chamados/novo"><MessagesSquare/>Abrir chamado</NavLink>:<em>Customer Success</em>}</aside>
    </header>
    {meetingsError&&<p role="alert">{meetingsError}</p>}
    <div className="ci-reference-main">
      <section className="ci-card ci-day-agenda"><CiTitle icon={CalendarDays} title="Sua agenda" action="Abrir agenda" to="/agenda"/>{agenda.length?<div className="ci-timeline gb-agenda">{agenda.slice(0,8).map(item=><NavLink to={item.to} key={item.id} className={`ci-timeline-link gb-tone-${item.tone}`}><article><time>{new Date(item.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><div><b>{item.title}</b><small>{item.detail}{item.place?` · ${item.place}`:""}</small></div></article></NavLink>)}</div>:<Empty text="Nenhum compromisso agendado para hoje."/>}</section>
      <section className="ci-card ci-day-tasks"><CiTitle icon={ClipboardCheck} title={`Suas tarefas do dia · ${new Date().toLocaleDateString("pt-BR")}`} action="Ver todas" to="/tarefas"/><div className="ci-task-list">{todayTasks.map(task=><NavLink to={taskUrl(task)} key={task.id} className="ci-task-row"><span><i className={overdue(task)?"is-late":task.status==="IN_PROGRESS"?"is-progress":""}/>{task.title}</span><em className={overdue(task)?"late":task.status==="IN_PROGRESS"?"progress":""}>{overdue(task)?"Atrasada":taskStatus(task.status)}</em></NavLink>)}{!todayTasks.length&&<Empty text="Nenhuma tarefa prevista para hoje."/>}</div></section>
    </div>
    {can("meetings.view")&&<div className="gb-meetings">
      <section className="gb-block"><h2><Handshake/>Customer Success</h2><div className="gb-pair">
        <GbMeetingTable title="Reuniões do dia" icon={CalendarDays} rows={todays} empty="Nenhuma reunião com clientes hoje." link="Ver todas as reuniões do dia" to="/reunioes/agendadas" status={meetingStatus}/>
        <GbMeetingTable title="Reuniões para amanhã" icon={CalendarDays} rows={tomorrows} empty="Nenhuma reunião marcada para amanhã." link="Ver todas as reuniões de amanhã" to="/reunioes/agendadas" status={meetingStatus}/>
      </div></section>
      <section className="gb-block"><h2><ListChecks/>Resumo reuniões</h2><div className="gb-panel"><header><ClipboardCheck/><b>Resumo das reuniões de hoje</b></header>
        <div className="gb-table summary"><div className="gb-row head"><span>Cliente</span><span>Horário</span><span>Resumo</span><span>Ação necessária</span><span>Responsável</span><span>Status</span></div>
          {summaries.slice(0,5).map(item=>{const action=firstAction(item);return <NavLink className="gb-row" key={item.id} to={`/reunioes/${item.id}`}><b>{item.clientName}</b><span>{timeOf(item.startAt)}</span><span title={item.summary}>{item.summary||item.statements[0]?.text||"—"}</span><span title={action?.title}>{action?.title||"—"}</span><span>{action?.responsibleName.split(" ")[0]||"—"}</span>{action?<em className={`gb-status ${action.status==="DONE"?"green":action.status==="PENDING"?"orange":"blue"}`}>{actionStatusLabels[action.status]}</em>:<em className="gb-status green">Concluída</em>}</NavLink>})}
          {!summaries.length&&<Empty text="Nenhuma reunião concluída hoje ainda."/>}</div>
        <NavLink className="gb-more" to="/reunioes/concluidas">Ver todos os resumos de hoje <ArrowRight/></NavLink></div></section>
    </div>}
    <div className="gb-bottom">
      <section className="gb-block"><h2><MessagesSquare/>Chamados</h2><div className="ci-tickets-grid gb-tickets">
        <CiTickets title="Seus chamados" number="01" tickets={myTickets} empty="Nenhum chamado aberto para você." to="/chamados"/>
        <CiTickets title="Chamados com terceiros" number="02" tickets={teamTickets} empty="Nenhum chamado de terceiros em aberto." to="/chamados?filtro=terceiros" secondary/>
      </div></section>
      <section className="gb-block gb-portfolio"><h2><BriefcaseBusiness/>Visão da carteira<NavLink to="/clientes">Ver carteira <ArrowRight/></NavLink></h2><div className="gb-portfolio-grid">
        <article><Users/><small>Clientes da carteira</small><b>{portfolio.length}</b><em className="green">+{portfolio.filter(client=>client.createdAt?.slice(0,7)===month).length} este mês</em></article>
        <article><UserRoundCheck/><small>Contatados hoje</small><b>{contactedToday}<span>/{plannedToday||0}</span></b><em className="blue">{plannedToday?`${Math.round(contactedToday/plannedToday*100)}% das reuniões do dia`:"Sem reuniões previstas"}</em></article>
        <NavLink to="/reunioes/relatorios"><AlertTriangle className="red"/><small>Clientes em atenção</small><b>{attention}</b><em className="red">Necessitam ação</em></NavLink>
        <NavLink to="/reunioes/relatorios"><AlarmClock className="orange"/><small>Retornos pendentes</small><b>{pendingReturns}</b><em className="orange">Aguardando resposta</em></NavLink>
        <blockquote><span>“</span>Clientes bem atendidos,<br/>crescem com a gente.</blockquote>
      </div></section>
    </div>
  </div>;
}
function GbMeetingTable({title,icon:Icon,rows,empty,link,to,status}:{title:string;icon:typeof Activity;rows:Meeting[];empty:string;link:string;to:string;status:(item:Meeting)=>ReactNode}){return <div className="gb-panel"><header><Icon/><b>{title}</b></header><div className="gb-table"><div className="gb-row head"><span>Cliente</span><span>Horário</span><span>Participante</span><span>Assunto</span><span>Status</span></div>{rows.slice(0,5).map(item=><NavLink className="gb-row" key={item.id} to={`/reunioes/${item.id}`}><b>{item.clientName}</b><span>{timeOf(item.startAt)}</span><span>{item.responsibleName.split(" ")[0]}</span><span title={item.subject}>{item.subject||typeLabels[item.type]}</span>{status(item)}</NavLink>)}{!rows.length&&<Empty text={empty}/>}</div><NavLink className="gb-more" to={to}>{link} <ArrowRight/></NavLink></div>}

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
      <aside className="exec-right-rail"><section className="exec-panel team-performance"><PanelHead title="Performance da equipe" link="Ver equipe" to="/equipe"/>{teamStats.length?teamStats.slice(0,6).map(member=><div className="team-performance-row" key={member.id} style={{"--member-color":userColor(member)} as React.CSSProperties}><span>{initials(member.name)}</span><b>{member.name}</b><small>{member.assigned.length} tarefas</small><em>{member.performance}%</em><i><span style={{width:`${member.performance}%`}}/></i></div>):<Empty text="Nenhum colaborador cadastrado."/>}</section><section className="exec-panel master-agenda"><PanelHead title="Agenda de hoje" link="Ver agenda" to="/agenda"/>{todayEvents.slice(0,5).map(event=><article key={event.id}><time>{new Date(event.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><span><b>{event.title}</b><small>{event.ownerName}</small></span></article>)}{!todayEvents.length&&<Empty text="Nenhum compromisso hoje."/>}</section><section className="exec-panel master-alerts"><PanelHead title="Alertas importantes" link="Ver tarefas" to="/tarefas"/>{late.slice(0,4).map(task=><p key={task.id}><i/> <span><b>{task.title}</b><small>{task.responsibleName||"Sem responsável"} · prazo {formatDate(task.dueAt)}</small></span></p>)}{!late.length&&<p className="master-all-clear"><Check/> Nenhuma tarefa atrasada.</p>}</section></aside>
      <section className="exec-panel collaborator-tasks"><PanelHead title="Gestão de tarefas por colaborador" link="Ver todas as tarefas" to="/tarefas"/>{teamStats.length?<div>{teamStats.slice(0,6).map(member=><article className={!member.assigned.length?"is-empty":""} key={member.id}><header><span>{initials(member.name)}</span><div><b>{member.name}</b><small>{member.assigned.length} tarefas atribuídas</small></div><em>{member.done}/{member.assigned.length}</em></header>{member.assigned.slice(0,4).map(task=><p key={task.id}><i className={overdue(task)?"urgent":task.priority==="HIGH"||task.priority==="URGENT"?"warning":"ok"}/>{task.title}<small>{overdue(task)?"Atrasada":formatDate(task.dueAt)}</small></p>)}{!member.assigned.length&&<div className="collaborator-empty"><ListChecks/><span>Nenhuma tarefa atribuída</span></div>}</article>)}</div>:<Empty text="Cadastre colaboradores para acompanhar a distribuição de tarefas."/>}</section>
    </div>
    <section className="executive-advice ai-council"><header><Sparkles/><b>CONSELHO IA</b><span>Análise inteligente do cenário atual da operação</span></header><div><Advice title="Pontos fortes" tone="green" items={[`${doneToday.length} entregas concluídas hoje`,`${won.length} oportunidades conquistadas`,`${activeClients} clientes ativos`]}/><Advice title="Pontos de atenção" tone="orange" items={[`${late.length} tarefas atrasadas`,`${waiting.length} aguardando cliente`,`${open.filter(item=>!item.responsibleId).length} negociações sem responsável`]}/><Advice title="Oportunidades" tone="blue" items={[`${open.length} negociações podem avançar`,`${proposals} propostas em andamento`,`Revisar os ${tickets.filter(ticket=>!["RESOLVED","CLOSED"].includes(ticket.status)).length} chamados abertos`]}/><Advice title="Ações sugeridas" tone="purple" items={[late.length?"Priorizar entregas vencidas":"Manter ritmo das entregas",open.length?"Atualizar próximas ações comerciais":"Prospectar novas oportunidades",todayEvents.length?"Preparar compromissos de hoje":"Planejar agenda da equipe"]}/><article className="ai-next-action"><b>PRÓXIMA MELHOR AÇÃO</b><p>{late.length?`Resolver a tarefa mais antiga entre as ${late.length} atrasadas.`:open.length?`Avançar a oportunidade ${open[0].company||open[0].name}.`:"Criar a próxima ação comercial prioritária."}</p><NavLink to={late.length?"/tarefas":"/crm"}>Tomar ação agora <ArrowRight/></NavLink></article></div></section>
  </div>
}

function CollaboratorBoard({user,data}:{user:User;data:Data}){
  const can=(permission:string)=>user.profile==="MASTER"||Boolean(user.permissions?.includes(permission));
  const tasks=data.tasks.filter(task=>task.responsibleId===user.id),events=data.events.filter(event=>event.ownerId===user.id||event.participantIds?.includes(user.id));
  const todayEvents=events.filter(event=>sameDay(event.startAt)).sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime()),todayTasks=tasks.filter(task=>sameDay(task.dueAt)).sort((a,b)=>new Date(a.dueAt).getTime()-new Date(b.dueAt).getTime());
  const tickets=data.tickets.filter(ticket=>ticket.assigneeId===user.id&&!["RESOLVED","CLOSED"].includes(ticket.status)),open=data.opportunities.filter(item=>item.responsibleId===user.id&&item.status==="OPEN");
  return <div className="collaborator-board"><header className="collab-greeting"><div><h1>Bom dia, {first(user.name)}! 👋</h1><p>{fullDate()}</p></div><blockquote><b>Seu dia em um só lugar</b><span>Agenda, tarefas, chamados e oportunidades ligados à sua conta.</span></blockquote>{can("tickets.create")&&<NavLink className="primary collab-new-ticket" to="/chamados/novo">+ Novo chamado</NavLink>}</header>
    <section className="collab-agenda real-agenda"><header><div><CalendarDays/><b>Minha agenda de hoje</b></div>{can("calendar.view")&&<NavLink to="/agenda">Abrir agenda completa <ArrowRight/></NavLink>}</header><div className="real-agenda-list">{todayEvents.map(event=><article key={event.id}><time>{new Date(event.startAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><i/><div><b>{event.title}</b><small>{new Date(event.endAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · {event.category||"Evento"}</small></div></article>)}{!todayEvents.length&&<Empty text="Nenhum compromisso na sua agenda hoje."/>}</div></section>
    <div className="collab-grid"><CiTickets title="Meus chamados" number="01" tickets={tickets} empty="Nenhum chamado com você agora." to="/chamados"/><section className="collab-panel daily-activities"><PanelHead title="Minhas tarefas do dia" link={can("tasks.create")?"Nova tarefa":undefined} to="/tarefas"/>{todayTasks.map(task=><label key={task.id} className={task.status==="DONE"?"done":""}><input type="checkbox" checked={task.status==="DONE"} readOnly/><span>{task.title}</span><time>{new Date(task.dueAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><b>{taskStatus(task.status)}</b></label>)}{!todayTasks.length&&<Empty text="Nenhuma tarefa prevista para hoje."/>}</section></div>
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
