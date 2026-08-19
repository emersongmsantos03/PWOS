import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { CheckCircle2, FileSignature, ShieldCheck } from "lucide-react";
import { isValidDocument, maskDocument, maskPhone } from "./inputMasks";
import "./PublicProposal.css";

type PublicProposalData = {
  title: string;
  value: number;
  status: string;
  validUntil: string;
  notes: string;
  opportunityName: string;
  companyName: string;
  signedAt?: string;
  customer?: { name: string; email: string; phone: string; document: string };
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
    const context = event.currentTarget.getContext("2d"),
      position = point(event);
    if (!context) return;
    context.strokeStyle = "#17263a";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineTo(position.x, position.y);
    context.stroke();
    setHasSignature(true);
  };
  const stopDrawing = () => {
    drawing.current = false;
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
    setSigned(true);
  };

  if (loading) return <main className="public-proposal-state">Carregando proposta…</main>;
  if (!proposal)
    return <main className="public-proposal-state"><b>Proposta indisponível</b><p>{error}</p></main>;
  if (signed || proposal.signedAt)
    return (
      <main className="public-proposal-state success">
        <CheckCircle2 />
        <h1>Proposta assinada com sucesso</h1>
        <p>A equipe responsável já recebeu sua confirmação.</p>
      </main>
    );

  return (
    <main className="public-proposal-page">
      <header>
        <img src="/logo-pw-os.png" alt="PW OS" />
        <span><ShieldCheck /> Documento seguro</span>
      </header>
      <section className="public-proposal-document">
        <div className="public-proposal-heading">
          <small>PROPOSTA COMERCIAL</small>
          <h1>{proposal.title}</h1>
          <p>{proposal.companyName || proposal.opportunityName}</p>
          {proposal.validUntil && (
            <span>Válida até {new Date(`${proposal.validUntil}T12:00:00`).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
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
        {proposal.notes && <div className="public-proposal-notes"><b>Observações e condições</b><p>{proposal.notes}</p></div>}
        <form className="public-proposal-sign" onSubmit={submit}>
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
              onPointerLeave={stopDrawing}
            />
            <button type="button" onClick={clearSignature}>Limpar assinatura</button>
          </label>
          <label className="public-proposal-consent"><input type="checkbox" required /> Confirmo que li e aceito os serviços, valores e condições desta proposta.</label>
          {error && <div className="public-proposal-error">{error}</div>}
          <button className="public-proposal-submit" disabled={saving}>{saving ? "Enviando assinatura…" : "Assinar e aceitar proposta"}</button>
        </form>
      </section>
    </main>
  );
}
