import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { Building2, CheckCircle2, Download, FileSignature, ShieldCheck } from "lucide-react";
import { isValidDocument, maskDocument, maskPhone } from "./inputMasks";
import "./PublicProposal.css";

type PublicProposalData = {
  reference: string;
  title: string;
  value: number;
  status: string;
  validUntil: string;
  notes: string;
  opportunityName: string;
  companyName: string;
  signedAt?: string;
  customer?: { name: string; email: string; phone: string; document: string };
  signatureDataUrl?: string;
  services: Array<{
    id: string;
    name: string;
    description: string;
    quantity: number;
    unitValue: number;
    billingType: "RECURRING" | "ONE_TIME";
  }>;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const privateDocument = (value: string) => {
  const raw = value.replace(/\D/g, "");
  return raw.length === 14
    ? `${raw.slice(0, 2)}.***.***/****-${raw.slice(-2)}`
    : `${raw.slice(0, 3)}.***.***-${raw.slice(-2)}`;
};
const privateEmail = (value: string) => {
  const [name, domain = ""] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};
const privatePhone = (value: string) => {
  const raw = value.replace(/\D/g, "");
  return raw.length >= 10
    ? `(${raw.slice(0, 2)}) *****-${raw.slice(-4)}`
    : `*****${raw.slice(-2)}`;
};

export function PublicProposal() {
  const token = window.location.pathname.split("/").filter(Boolean).at(-1) || "";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [proposal, setProposal] = useState<PublicProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/proposals/${token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        setProposal(data.proposal);
      })
      .catch((reason) => setError(reason.message || "Não foi possível abrir a proposta."))
      .finally(() => setLoading(false));
  }, [token]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget,
      rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget,
      context = canvas.getContext("2d"),
      position = point(event);
    if (!context) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    context.beginPath();
    context.moveTo(position.x, position.y);
  };
  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    const context = event.currentTarget.getContext("2d"),
      position = point(event);
    if (!context) return;
    context.strokeStyle = "#17263a";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineTo(position.x, position.y);
    context.stroke();
  };
  const stopDrawing = (event?: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    event?.currentTarget.getContext("2d")?.closePath();
    if (event?.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setHasSignature(true);
  };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidDocument(document)) return setError("Informe um CPF ou CNPJ válido.");
    if (!hasSignature) return setError("Faça sua assinatura no campo indicado.");
    setSaving(true);
    setError("");
    const raw = Object.fromEntries(new FormData(event.currentTarget)),
      response = await fetch(`/api/public/proposals/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...raw,
          document,
          phone,
          signatureDataUrl: canvasRef.current?.toDataURL("image/png"),
        }),
      }),
      data = await response.json();
    setSaving(false);
    if (!response.ok) return setError(data.message);
    const signatureDataUrl = canvasRef.current?.toDataURL("image/png") || "";
    setProposal((current) => current ? {
      ...current,
      status: "ACCEPTED",
      signedAt: data.signedAt,
      signatureDataUrl,
      customer: {
        name: String(raw.name),
        email: privateEmail(String(raw.email)),
        phone: privatePhone(phone),
        document: privateDocument(document),
      },
      reference: data.reference,
    } : current);
    setSigned(true);
  };

  if (loading) return <main className="public-proposal-state">Carregando proposta…</main>;
  if (!proposal)
    return <main className="public-proposal-state"><b>Proposta indisponível</b><p>{error}</p></main>;
  const accepted = signed || Boolean(proposal.signedAt);

  return (
    <main className="public-proposal-page">
      <header>
        <img src="/logo-pw-os.png" alt="PW Mídia" />
        <div>
          <span><ShieldCheck /> Documento seguro</span>
          <button onClick={() => window.print()}><Download /> Baixar em PDF</button>
        </div>
      </header>
      <section className="public-proposal-document">
        {accepted && <div className="public-proposal-accepted"><CheckCircle2 /><span><b>Proposta aceita e assinada</b><small>A PW Mídia já recebeu a confirmação.</small></span></div>}
        <div className="public-proposal-heading">
          <small>PROPOSTA COMERCIAL</small>
          <h1>{proposal.title}</h1>
          <p>{proposal.companyName || proposal.opportunityName} · Ref. {proposal.reference}</p>
          {proposal.validUntil && (
            <span>Válida até {new Date(`${proposal.validUntil}T12:00:00`).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
        <div className="public-proposal-parties">
          <article>
            <Building2 />
            <div><small>PROPONENTE</small><b>PW Mídia</b><span>CNPJ 44.692.354/0001-10</span></div>
          </article>
          <article>
            <Building2 />
            <div><small>CLIENTE</small><b>{proposal.customer?.name || proposal.companyName || "A identificar"}</b><span>{proposal.customer?.document || proposal.opportunityName}</span></div>
          </article>
        </div>
        <section className="public-proposal-introduction">
          <h2>Uma parceria orientada a resultados</h2>
          <p>
            A PW Mídia apresenta esta proposta com o objetivo de estruturar uma parceria
            transparente, estratégica e focada no crescimento sustentável da sua empresa.
            Nosso trabalho combina planejamento, execução, acompanhamento contínuo e
            decisões apoiadas por dados.
          </p>
          <p>
            O escopo abaixo consolida os serviços, investimentos e condições comerciais
            acordados. Durante a execução, nossa equipe manterá comunicação ativa sobre
            prioridades, entregas e oportunidades de melhoria.
          </p>
        </section>
        <div className="public-proposal-services">
          <header><b>Serviços</b><span>Investimento</span></header>
          {proposal.services.map((service) => (
            <article key={service.id}>
              <div>
                <b>{service.name}</b>
                {service.description && <p>{service.description}</p>}
                <small>
                  {service.quantity} × {money(service.unitValue)} · {service.billingType === "RECURRING" ? "Recorrente" : "Pagamento único"}
                </small>
              </div>
              <strong>{money(service.quantity * service.unitValue)}</strong>
            </article>
          ))}
          <footer><span>Total da proposta</span><strong>{money(proposal.value)}</strong></footer>
        </div>
        <div className="public-proposal-commercial-summary">
          <article><small>INVESTIMENTO TOTAL</small><b>{money(proposal.value)}</b></article>
          <article><small>MODELO DE COBRANÇA</small><b>{proposal.services.some((service) => service.billingType === "RECURRING") ? "Recorrente / conforme escopo" : "Pagamento único"}</b></article>
          <article><small>VALIDADE</small><b>{proposal.validUntil ? new Date(`${proposal.validUntil}T12:00:00`).toLocaleDateString("pt-BR") : "A combinar"}</b></article>
        </div>
        {proposal.notes && <div className="public-proposal-notes"><b>Observações e condições</b><p>{proposal.notes}</p></div>}
        <section className="public-proposal-terms">
          <h2>Condições gerais</h2>
          <ol>
            <li>Os serviços serão executados conforme o escopo descrito nesta proposta e as prioridades alinhadas entre as partes.</li>
            <li>Prazos de início e entrega dependem do envio, pelo cliente, dos acessos, materiais e aprovações necessários.</li>
            <li>Demandas adicionais ou alterações relevantes de escopo poderão ser avaliadas e orçadas separadamente.</li>
            <li>Nos serviços recorrentes, o acompanhamento e os ajustes acontecem durante a vigência da contratação.</li>
            <li>O aceite eletrônico abaixo registra data, identificação do cliente e assinatura vinculada a este documento.</li>
          </ol>
        </section>
        {!accepted ? <form className="public-proposal-sign no-print" onSubmit={submit}>
          <div className="public-proposal-sign-title">
            <FileSignature />
            <div><h2>Aceite e assinatura</h2><p>Preencha seus dados e assine abaixo para aceitar esta proposta.</p></div>
          </div>
          <div className="public-proposal-fields">
            <label>Nome completo *<input name="name" required minLength={3} autoComplete="name" /></label>
            <label>E-mail *<input name="email" type="email" required autoComplete="email" /></label>
            <label>CPF ou CNPJ *<input required value={document} onChange={(event) => setDocument(maskDocument(event.target.value))} inputMode="numeric" /></label>
            <label>Telefone *<input required value={phone} onChange={(event) => setPhone(maskPhone(event.target.value))} inputMode="tel" autoComplete="tel" /></label>
          </div>
          <label className="public-signature-label">
            Assinatura *
            <canvas
              ref={canvasRef}
              width="900"
              height="220"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
            />
            {!hasSignature && <span className="public-signature-hint">Desenhe sua assinatura aqui</span>}
            <button type="button" onClick={clearSignature}>Limpar assinatura</button>
          </label>
          <label className="public-proposal-consent"><input type="checkbox" required /> Confirmo que li e aceito os serviços, valores e condições desta proposta.</label>
          {error && <div className="public-proposal-error">{error}</div>}
          <button className="public-proposal-submit" disabled={saving}>{saving ? "Enviando assinatura…" : "Assinar e aceitar proposta"}</button>
        </form> : (
          <section className="public-proposal-receipt">
            <div><CheckCircle2 /><span><small>ACEITE ELETRÔNICO · {proposal.reference}</small><b>{proposal.customer?.name}</b><p>{proposal.customer?.document} · {proposal.customer?.email} · {proposal.customer?.phone}</p><time>Assinado em {proposal.signedAt ? new Date(proposal.signedAt).toLocaleString("pt-BR") : "agora"}</time><em>Dados pessoais parcialmente ocultos neste link público.</em></span></div>
            {proposal.signatureDataUrl && <img src={proposal.signatureDataUrl} alt={`Assinatura de ${proposal.customer?.name || "cliente"}`} />}
          </section>
        )}
        <footer className="public-proposal-legal">
          <b>PW Mídia</b><span>CNPJ 44.692.354/0001-10</span><p>Proposta comercial emitida eletronicamente. O aceite registrado neste documento confirma a concordância com o escopo, os valores e as condições apresentados.</p>
        </footer>
      </section>
    </main>
  );
}
