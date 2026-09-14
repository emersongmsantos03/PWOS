import { describe, expect, it } from "vitest";
import { googleOAuthReturnPage } from "./oauthCallback";

describe("Google OAuth browser return", () => {
  it("posts the authorization to the same origin and removes the code from browser history", () => {
    const html = googleOAuthReturnPage({ state: "attempt", code: "authorization", error: "" }, "nonce");
    expect(html).toContain('method="post" action="/api/integrations/google_ads/oauth/callback"');
    expect(html).toContain('name="state" value="attempt"');
    expect(html).toContain('name="code" value="authorization"');
    expect(html).toContain('history.replaceState');
    expect(html).toContain('document.forms[0].submit()');
    expect(html).toContain('<button type="submit">');
  });
  it("escapes provider input instead of allowing scripts or form injection", () => {
    const html = googleOAuthReturnPage({ state: '\"><script>alert(1)</script>', code: 'a&b', error: 'access_denied' }, "nonce");
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('value="a&amp;b"');
    expect(html).toContain('name="error" value="access_denied"');
  });
});
