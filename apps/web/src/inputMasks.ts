export const digits=(value:string)=>value.replace(/\D/g,"");

export function maskDocument(value:string){
  const raw=digits(value).slice(0,14);
  if(raw.length<=11)return raw.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
  return raw.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d{1,2})$/,"$1-$2");
}

export function maskPhone(value:string){
  const raw=digits(value).slice(0,11);
  if(!raw)return "";
  if(raw.length<=10)return raw.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})/,(_,ddd,first,last)=>`${ddd?`(${ddd}`:""}${ddd.length===2?") ":""}${first}${last?`-${last}`:""}`);
  return raw.replace(/^(\d{2})(\d{5})(\d{0,4})/,"($1) $2-$3");
}

export function parseCurrency(value:string|number){
  if(typeof value==="number")return Number.isFinite(value)?value:0;
  const clean=value.replace(/[^\d,.-]/g,"").trim();
  if(!clean)return 0;
  if(clean.includes(","))return Number(clean.replace(/\./g,"").replace(",","."))||0;
  return Number(clean)||0;
}

export function maskCurrency(value:string|number){
  if(value==="")return "";
  const amount=parseCurrency(value);
  return amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2});
}

function repeated(value:string){return /^(\d)\1+$/.test(value)}
export function isValidCPF(value:string){
  const raw=digits(value);if(raw.length!==11||repeated(raw))return false;
  const check=(length:number)=>{let sum=0;for(let i=0;i<length;i++)sum+=Number(raw[i])*(length+1-i);const mod=(sum*10)%11;return (mod===10?0:mod)===Number(raw[length])};
  return check(9)&&check(10);
}
export function isValidCNPJ(value:string){
  const raw=digits(value);if(raw.length!==14||repeated(raw))return false;
  const calc=(base:string)=>{let factor=base.length-7,sum=0;for(const digit of base){sum+=Number(digit)*factor--;if(factor===1)factor=9}const mod=sum%11;return mod<2?0:11-mod};
  return calc(raw.slice(0,12))===Number(raw[12])&&calc(raw.slice(0,13))===Number(raw[13]);
}
export const isValidDocument=(value:string)=>{const raw=digits(value);return raw.length===11?isValidCPF(raw):raw.length===14?isValidCNPJ(raw):false};
