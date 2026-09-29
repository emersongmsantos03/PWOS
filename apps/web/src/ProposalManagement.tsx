import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SearchableSelect } from "./SearchableSelect";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  FileSignature,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import "./ProposalManagement.css";

type Proposal = {
  id: string;
  opportunityId: string;
  opportunityName: string;
  companyName: string;
  responsibleName: string;
  pipelineName: string;
  stageName: string;
  title: string;
  value: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  validUntil: string;
  publicToken?: string;
  customer?: { name: string; email: string; phone: string; document: string };
  signedAt?: string;
  createdAt: string;
  services?: Array<{ id: string; name: string; quantity: number; unitValue: number }>;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabel: Record<Proposal["status"], string> = {
  DRAFT: "Rascunho",
  SENT: "Aguardando assinatura",
  ACCEPTED: "Assinada",
  REJECTED: "Recusada",
};

export function ProposalManagement({
  permissions,
  profile,
}: {
  permissions: string[];
  profile: string;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [deleting, setDeleting] = useState<Proposal | null>(null);
  const [password, setPassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const canDelete = profile === "MASTER" || permissions.includes("proposals.delete");
  const canExport = profile === "MASTER" || permissions.includes("proposals.export");
  const load = async () => {
    const response = await fetch("/api/proposals"),
      data = await response.json();
    if (!response.ok) {
      setError(data.message || "Não foi possível carregar as propostas.");
      setLoading(false);
      return;
    }
    setProposals(data.proposals || []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const filtered = useMemo(
    () =>
      proposals.filter((proposal) => {
        const matchesStatus = status === "ALL" || proposal.status === status;
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          [
            proposal.title,
            proposal.companyName,
            proposal.opportunityName,
            proposal.customer?.name,
            proposal.responsibleName,
          ].some((value) => value?.toLowerCase().includes(query));
        return matchesStatus && matchesSearch;
      }),
    [proposals, search, status],
  );
  const total = proposals.reduce((sum, proposal) => sum + proposal.value, 0),
    signed = proposals.filter((proposal) => proposal.status === "ACCEPTED"),
    waiting = proposals.filter((proposal) => proposal.status === "SENT");
  const copyLink = async (proposal: Proposal) => {
    if (!proposal.publicToken) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/proposta/${proposal.publicToken}`,
    );
    setCopied(proposal.id);
    window.setTimeout(() => setCopied(""), 1800);
  };
  const remove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleting) return;
    setDeleteLoading(true);
    setError("");
    const response = await fetch(
        `/api/crm/opportunities/${deleting.opportunityId}/proposals/${deleting.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      ),
      data = await response.json();
    setDeleteLoading(false);
    if (!response.ok) return setError(data.message);
    setDeleting(null);
    setPassword("");
    await load();
  };

  return (
    <div className="page proposal-page">
      <header className="proposal-page-head">
        <div>
          <small>CENTRAL COMERCIAL</small>
          <h1>Propostas</h1>
          <p>Acompanhe propostas enviadas, aceites e documentos pendentes.</p>
        </div>
        <span>{proposals.length} documentos</span>
      </header>
      <section className="proposal-kpis">
        <article><span><FileSignature /></span><div><small>TOTAL DE PROPOSTAS</small><b>{proposals.length}</b><p>{money(total)} em propostas</p></div></article>
        <article><span className="waiting"><Clock3 /></span><div><small>AGUARDANDO ASSINATURA</small><b>{waiting.length}</b><p>{money(waiting.reduce((sum, item) => sum + item.value, 0))}</p></div></article>
        <article><span className="signed"><CheckCircle2 /></span><div><small>ASSINADAS</small><b>{signed.length}</b><p>{money(signed.reduce((sum, item) => sum + item.value, 0))}</p></div></article>
        <article><span className="rate"><CircleDollarSign /></span><div><small>TAXA DE ACEITE</small><b>{proposals.length ? Math.round((signed.length / proposals.length) * 100) : 0}%</b><p>sobre propostas emitidas</p></div></article>
      </section>
      <section className="proposal-list-panel">
        <header>
          <div className="proposal-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar proposta, empresa ou cliente..." /></div>
          <div className="proposal-status-filter">
            <SearchableSelect
              value={status}
              onChange={setStatus}
              searchable={false}
              options={[
                { value: "ALL", label: "Todos os status" },
                { value: "DRAFT", label: "Rascunhos" },
                { value: "SENT", label: "Aguardando assinatura" },
                { value: "ACCEPTED", label: "Assinadas" },
                { value: "REJECTED", label: "Recusadas" },
              ]}
            />
          </div>
        </header>
        {loading ? (
          <div className="proposal-empty">Carregando propostas…</div>
        ) : filtered.length ? (
          <div className="proposal-table">
            <div className="proposal-table-head"><span>Proposta</span><span>Oportunidade</span><span>Status</span><span>Valor</span><span>Data</span><span>Ações</span></div>
            {filtered.map((proposal) => (
              <article key={proposal.id}>
                <div className="proposal-main"><span><FileSignature /></span><div><b>{proposal.title}</b><small>{proposal.companyName || "Sem empresa"}</small>{proposal.services?.length ? <em>{proposal.services.length} {proposal.services.length === 1 ? "serviço" : "serviços"}</em> : null}</div></div>
                <div className="proposal-opportunity"><b>{proposal.opportunityName}</b><small>{proposal.pipelineName} · {proposal.stageName}</small><em>{proposal.responsibleName || "Sem responsável"}</em></div>
                <div><span className={`proposal-status ${proposal.status.toLowerCase()}`}>{proposal.status === "ACCEPTED" ? <CheckCircle2 /> : <Clock3 />}{statusLabel[proposal.status]}</span>{proposal.customer?.name && <small className="proposal-signer">{proposal.customer.name}</small>}</div>
                <strong className="proposal-value">{money(proposal.value)}</strong>
                <div className="proposal-date"><b>{new Date(proposal.createdAt).toLocaleDateString("pt-BR")}</b><small>{proposal.signedAt ? `Assinada em ${new Date(proposal.signedAt).toLocaleDateString("pt-BR")}` : proposal.validUntil ? `Válida até ${new Date(`${proposal.validUntil}T12:00:00`).toLocaleDateString("pt-BR")}` : "Sem validade"}</small></div>
                <div className="proposal-row-actions">
                  {proposal.publicToken && <button onClick={() => void copyLink(proposal)} title="Copiar link"><Copy />{copied === proposal.id && <small>Copiado</small>}</button>}
                  {proposal.publicToken && canExport && <button onClick={() => window.open(`/proposta/${proposal.publicToken}`, "_blank")} title="Abrir e baixar PDF"><Download /></button>}
                  {proposal.publicToken && <button onClick={() => window.open(`/proposta/${proposal.publicToken}`, "_blank")} title="Abrir proposta"><Send /></button>}
                  {canDelete && <button className="delete" onClick={() => { setError(""); setPassword(""); setDeleting(proposal); }} title="Excluir proposta"><Trash2 /></button>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="proposal-empty"><FileSignature /><b>Nenhuma proposta encontrada</b><p>Ajuste os filtros ou gere uma proposta em uma oportunidade do CRM.</p></div>
        )}
      </section>
      {error && !deleting && <div className="proposal-page-error"><AlertTriangle />{error}</div>}
      {deleting && (
        <div className="proposal-delete-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteLoading) setDeleting(null); }}>
          <form onSubmit={remove}>
            <header><span><Trash2 /></span><button type="button" onClick={() => setDeleting(null)}><X /></button></header>
            <h2>Excluir proposta?</h2>
            <p>Digite sua senha para excluir permanentemente <b>“{deleting.title}”</b>. O link público será invalidado.</p>
            {deleting.signedAt && <div className="proposal-delete-alert">Esta proposta já foi assinada pelo cliente.</div>}
            <label>Sua senha<input type="password" required autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <div className="form-error"><AlertTriangle />{error}</div>}
            <footer><button type="button" className="secondary" onClick={() => setDeleting(null)}>Cancelar</button><button className="danger-confirm" disabled={!password || deleteLoading}>{deleteLoading ? "Excluindo…" : "Confirmar exclusão"}</button></footer>
          </form>
        </div>
      )}
    </div>
  );
}
