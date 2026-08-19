import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PickerProps={name?:string;value?:string;defaultValue?:string;onChange?:(value:string)=>void;mode?:"date"|"datetime";required?:boolean;placeholder?:string};
const pad=(value:number)=>String(value).padStart(2,"0");
const parse=(value:string)=>value?new Date(`${value}${value.length===10?"T12:00":""}`):new Date();
const encode=(date:Date,mode:"date"|"datetime")=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}${mode==="datetime"?`T${pad(date.getHours())}:${pad(date.getMinutes())}`:""}`;
const display=(value:string,mode:"date"|"datetime")=>{if(!value)return "";const date=parse(value);return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()}${mode==="datetime"?` às ${pad(date.getHours())}:${pad(date.getMinutes())}`:""}`};
const months=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function DateTimePicker({name,value,defaultValue="",onChange,mode="datetime",required=false,placeholder="Selecione a data"}:PickerProps){
  const [internal,setInternal]=useState(defaultValue),[open,setOpen]=useState(false);
  const selectedValue=value??internal,selected=parse(selectedValue),[cursor,setCursor]=useState(()=>new Date(selected.getFullYear(),selected.getMonth(),1));
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
  useEffect(()=>{if(open){const date=parse(selectedValue);setCursor(new Date(date.getFullYear(),date.getMonth(),1))}},[open,selectedValue]);
  const days=useMemo(()=>{const first=new Date(cursor.getFullYear(),cursor.getMonth(),1),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return date})},[cursor]);
  const update=(date:Date)=>{const next=encode(date,mode);if(value===undefined)setInternal(next);onChange?.(next)};
  const chooseDay=(day:Date)=>{const next=new Date(day);next.setHours(selected.getHours(),selected.getMinutes(),0,0);update(next);if(mode==="date")setOpen(false)};
  const updateTime=(part:"hour"|"minute",nextValue:string)=>{const next=parse(selectedValue||encode(new Date(),"datetime"));if(part==="hour")next.setHours(Number(nextValue));else next.setMinutes(Number(nextValue));update(next)};
  return <div className={`date-time-picker ${open?"open":""}`} ref={root}>
    {name&&<input type="hidden" name={name} value={selectedValue}/>}<button type="button" className="date-time-trigger" onClick={()=>setOpen(current=>!current)} aria-haspopup="dialog" aria-expanded={open} aria-required={required}><CalendarDays/><span className={selectedValue?"":"placeholder"}>{display(selectedValue,mode)||placeholder}</span>{mode==="datetime"&&<Clock3/>}</button>
    {open&&<div className="date-time-popover" role="dialog" aria-label="Escolher data e horário"><header><button type="button" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()-1,1))}><ChevronLeft/></button><b>{months[cursor.getMonth()]} <span>{cursor.getFullYear()}</span></b><button type="button" onClick={()=>setCursor(new Date(cursor.getFullYear(),cursor.getMonth()+1,1))}><ChevronRight/></button></header><div className="date-time-week"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div><div className="date-time-days">{days.map(day=>{const active=selectedValue&&day.toDateString()===selected.toDateString(),outside=day.getMonth()!==cursor.getMonth(),today=day.toDateString()===new Date().toDateString();return <button type="button" className={`${active?"active ":""}${outside?"outside ":""}${today?"today":""}`} onClick={()=>chooseDay(day)} key={day.toISOString()}>{day.getDate()}</button>})}</div>{mode==="datetime"&&<footer><span><Clock3/> Horário</span><div><select aria-label="Hora" value={pad(selected.getHours())} onChange={event=>updateTime("hour",event.target.value)}>{Array.from({length:24},(_,hour)=><option value={pad(hour)} key={hour}>{pad(hour)}</option>)}</select><b>:</b><select aria-label="Minutos" value={pad(selected.getMinutes())} onChange={event=>updateTime("minute",event.target.value)}>{[0,5,10,15,20,25,30,35,40,45,50,55].map(minute=><option value={pad(minute)} key={minute}>{pad(minute)}</option>)}</select></div><button type="button" onClick={()=>setOpen(false)}>Concluir</button></footer>}</div>}
  </div>
}
