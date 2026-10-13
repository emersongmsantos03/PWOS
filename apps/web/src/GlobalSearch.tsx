import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, ClipboardList, LayoutGrid, ListTodo, Megaphone, MessagesSquare, Search } from "lucide-react";
import { matchesSearch } from "./searchText";

// Busca do topo do sistema. Na Inteligência de Campanha ela filtra a lista da própria tela
// (parâmetro `busca` da URL, lido pela Gestão de Mídia); nas demais telas mostra resultados de
// clientes, chamados, demandas do Creative Ops e páginas, e oferece buscar nas campanhas.
type NavItem = { to: string; label: string };
type Result = { key: string; group: string; icon: typeof Search; title: string; detail?: string; to: string };
type Sources = { clients: { id: string; name: string; segment?: string }[]; tickets: { id: string; code: string; title: string; clientName?: string; status: string }[]; tasks: { id: string; title: string; responsibleName?: string; status: string }[] };

async function list<T>(path: string, key: string): Promise<T[]> {
  const response = await fetch(`/api${path}`).catch(() => null);
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => ({}));
  return Array.isArray(payload[key]) ? payload[key] : [];
}

export function GlobalSearch({ nav, can }: { nav: NavItem[]; can: (permission: string) => boolean }) {
  const navigate = useNavigate(), location = useLocation();
  const onMedia = location.pathname.startsWith("/midia");
  const urlQuery = onMedia ? new URLSearchParams(location.search).get("busca") || "" : "";
  const [value, setValue] = useState(urlQuery), [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [sources, setSources] = useState<Sources | null>(null);
  const input = useRef<HTMLInputElement>(null), box = useRef<HTMLDivElement>(null);

  // A busca acompanha a URL ao entrar na Gestão de Mídia e é limpa ao sair dela.
  useEffect(() => { setValue(urlQuery); }, [location.pathname, urlQuery]);
  // Cmd/Ctrl + K coloca o cursor na busca.
  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const load = () => {
    if (sources) return;
    void Promise.all([
      can("clients.view") ? list<Sources["clients"][number]>("/clients", "clients") : Promise.resolve([]),
      can("tickets.view") ? list<Sources["tickets"][number]>("/tickets", "tickets") : Promise.resolve([]),
      can("tasks.view") || can("creative_ops.view") ? list<Sources["tasks"][number]>("/tasks", "tasks") : Promise.resolve([]),
    ]).then(([clients, tickets, tasks]) => setSources({ clients, tickets, tasks }));
  };

  const results = useMemo<Result[]>(() => {
    const term = value.trim();
    if (onMedia || term.length < 2) return [];
    const found: Result[] = [];
    if (can("media.view"))
      found.push({ key: "media", group: "Campanhas", icon: Megaphone, title: `Buscar “${term}” nas campanhas`, detail: "Gestão de Mídia", to: `/midia/gestao?busca=${encodeURIComponent(term)}` });
    (sources?.clients || []).filter((item) => matchesSearch(term, item.name, item.segment)).slice(0, 5)
      .forEach((item) => found.push({ key: `client:${item.id}`, group: "Clientes", icon: BriefcaseBusiness, title: item.name, detail: item.segment, to: `/clientes?client=${encodeURIComponent(item.id)}` }));
    (sources?.tickets || []).filter((item) => item.status !== "CLOSED" && matchesSearch(term, item.code, item.title, item.clientName)).slice(0, 5)
      .forEach((item) => found.push({ key: `ticket:${item.id}`, group: "Chamados", icon: MessagesSquare, title: `${item.code} · ${item.title}`, detail: item.clientName, to: `/chamados?ticket=${encodeURIComponent(item.id)}` }));
    (sources?.tasks || []).filter((item) => !["DONE", "CANCELLED"].includes(item.status) && matchesSearch(term, item.title, item.responsibleName)).slice(0, 5)
      .forEach((item) => found.push({ key: `task:${item.id}`, group: "Creative Ops", icon: ListTodo, title: item.title, detail: item.responsibleName, to: `/tarefas?task=${encodeURIComponent(item.id)}` }));
    nav.filter((item) => matchesSearch(term, item.label)).slice(0, 4)
      .forEach((item) => found.push({ key: `page:${item.to}`, group: "Páginas", icon: LayoutGrid, title: item.label, to: item.to }));
    return found;
  }, [value, onMedia, sources, nav, can]);

  const change = (next: string) => {
    setValue(next); setActive(0);
    if (onMedia) {
      // Filtra a lista da Gestão de Mídia sem empilhar o histórico do navegador.
      const params = new URLSearchParams(location.search);
      if (next) params.set("busca", next); else params.delete("busca");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true });
    } else setOpen(true);
  };
  const go = (result: Result) => { setOpen(false); setValue(""); navigate(result.to); };
  const groups = [...new Set(results.map((item) => item.group))];

  return <div className="search global-search" ref={box}>
    <Search />
    <input
      ref={input}
      aria-label="Buscar no sistema"
      placeholder={onMedia ? "Buscar cliente ou campanha nesta tela..." : "Buscar cliente, campanha, chamado ou demanda..."}
      value={value}
      role="combobox"
      aria-expanded={open && results.length > 0}
      aria-controls="global-search-results"
      onFocus={() => { load(); if (!onMedia) setOpen(true); }}
      onChange={(event) => change(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); if (onMedia && value) change(""); return; }
        if (!results.length) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % results.length); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + results.length) % results.length); }
        if (event.key === "Enter") { event.preventDefault(); go(results[Math.min(active, results.length - 1)]); }
      }}
    />
    <kbd>⌘ K</kbd>
    {open && !onMedia && value.trim().length >= 2 && <div className="global-search-results" id="global-search-results" role="listbox">
      {!sources && <p className="global-search-empty">Buscando…</p>}
      {sources && !results.length && <p className="global-search-empty">Nada encontrado para “{value.trim()}”.</p>}
      {groups.map((group) => <section key={group}><small>{group}</small>
        {results.filter((item) => item.group === group).map((item) => {
          const index = results.indexOf(item);
          return <button type="button" role="option" aria-selected={index === active} key={item.key} className={index === active ? "active" : ""} onMouseEnter={() => setActive(index)} onClick={() => go(item)}>
            <item.icon /><span><b>{item.title}</b>{item.detail && <em>{item.detail}</em>}</span>
          </button>;
        })}
      </section>)}
      {sources && <footer><ClipboardList />Use ↑ ↓ para navegar e Enter para abrir</footer>}
    </div>}
  </div>;
}
