import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableOption = { value: string; label: string; description?: string };

export function SearchableSelect({name,options,value,defaultValue="",onChange,placeholder="Selecione...",searchPlaceholder="Pesquisar...",emptyMessage="Nenhum resultado encontrado.",disabled=false,required=false,searchable=true}:{name?:string;options:SearchableOption[];value?:string;defaultValue?:string;onChange?:(value:string)=>void;placeholder?:string;searchPlaceholder?:string;emptyMessage?:string;disabled?:boolean;required?:boolean;searchable?:boolean}){
  const [internalValue,setInternalValue]=useState(defaultValue),[open,setOpen]=useState(false),[query,setQuery]=useState("");
  const rootRef=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null),selectedValue=value??internalValue;
  const selected=options.find(option=>option.value===selectedValue);
  const filtered=useMemo(()=>{const term=query.trim().toLocaleLowerCase("pt-BR");return term?options.filter(option=>`${option.label} ${option.description||""}`.toLocaleLowerCase("pt-BR").includes(term)):options},[options,query]);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(!rootRef.current?.contains(event.target as Node))setOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);
  useEffect(()=>{if(open&&searchable)window.setTimeout(()=>searchRef.current?.focus(),0);else setQuery("")},[open,searchable]);
  const choose=(next:string)=>{if(value===undefined)setInternalValue(next);onChange?.(next);setOpen(false)};
  return <div className={`searchable-select ${open?"open":""}`} ref={rootRef}>
    {name&&<input type="hidden" name={name} value={selectedValue}/>}
    <button type="button" className="searchable-select-trigger" onClick={()=>setOpen(current=>!current)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-required={required}><span className={selected?"":"placeholder"}><b>{selected?.label||placeholder}</b>{selected?.description&&<small>{selected.description}</small>}</span><ChevronDown/></button>
    {open&&<div className={`searchable-select-popover ${searchable?"":"without-search"}`}>{searchable&&<div className="searchable-select-search"><Search/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>event.key==="Escape"&&setOpen(false)} placeholder={searchPlaceholder}/>{query&&<button type="button" onClick={()=>setQuery("")} aria-label="Limpar pesquisa"><X/></button>}</div>}<div className="searchable-select-options" role="listbox">{filtered.length?filtered.map(option=><button type="button" role="option" aria-selected={option.value===selectedValue} className={option.value===selectedValue?"selected":""} onClick={()=>choose(option.value)} key={option.value}><span><b>{option.label}</b>{option.description&&<small>{option.description}</small>}</span>{option.value===selectedValue&&<Check/>}</button>):<p>{emptyMessage}</p>}</div></div>}
  </div>
}
