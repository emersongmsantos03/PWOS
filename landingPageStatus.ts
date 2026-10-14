// Interpreta a resposta da verificação de uma landing page. Proteções contra robôs (Vercel,
// Cloudflare) e limites de acesso bloqueiam o monitor, mas mostram que o site está no ar.
export type LandingPageResponseStatus = "ACTIVE" | "INACTIVE";

const botChallenge = (headers: Headers) =>
  /challenge/i.test(headers.get("x-vercel-mitigated") || "") || /challenge/i.test(headers.get("cf-mitigated") || "");

export function landingPageResponseStatus(status: number, headers: Headers): LandingPageResponseStatus {
  if (status >= 200 && status < 300) return "ACTIVE";
  if (status === 401 || status === 403 || status === 429) return "ACTIVE";
  if (botChallenge(headers)) return "ACTIVE";
  return "INACTIVE";
}
