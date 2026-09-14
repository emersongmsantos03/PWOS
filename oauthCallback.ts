const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]!));

// Commit a first-party document before posting back so session cookies are
// available even when the browser omitted them on the redirect from Google.
export function googleOAuthReturnPage(fields: { state: string; code: string; error: string }, nonce: string) {
  const inputs = Object.entries(fields).map(([name, value]) =>
    `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`,
  ).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conectando Google — PW OS</title></head><body><p>Concluindo a conexão com o Google…</p><form method="post" action="/api/integrations/google_ads/oauth/callback">${inputs}<button type="submit">Continuar conexão</button></form><script nonce="${escapeHtml(nonce)}">history.replaceState(null, "", "/api/integrations/google_ads/oauth/callback");document.forms[0].submit();</script></body></html>`;
}
