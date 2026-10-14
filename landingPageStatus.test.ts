import { describe, expect, it } from "vitest";
import { landingPageResponseStatus } from "./landingPageStatus";

describe("landingPageResponseStatus", () => {
  it("considera online o site que responde normalmente ou exige login", () => {
    expect(landingPageResponseStatus(200, new Headers())).toBe("ACTIVE");
    expect(landingPageResponseStatus(206, new Headers())).toBe("ACTIVE");
    expect(landingPageResponseStatus(401, new Headers())).toBe("ACTIVE");
    expect(landingPageResponseStatus(403, new Headers())).toBe("ACTIVE");
  });

  it("considera online o site que bloqueia o monitor com proteção contra robôs", () => {
    expect(landingPageResponseStatus(429, new Headers({ server: "Vercel", "x-vercel-mitigated": "challenge" }))).toBe("ACTIVE");
    expect(landingPageResponseStatus(429, new Headers())).toBe("ACTIVE");
    expect(landingPageResponseStatus(503, new Headers({ "cf-mitigated": "challenge" }))).toBe("ACTIVE");
  });

  it("considera offline a página inexistente ou com erro no servidor", () => {
    expect(landingPageResponseStatus(404, new Headers())).toBe("INACTIVE");
    expect(landingPageResponseStatus(410, new Headers())).toBe("INACTIVE");
    expect(landingPageResponseStatus(500, new Headers())).toBe("INACTIVE");
    expect(landingPageResponseStatus(503, new Headers())).toBe("INACTIVE");
  });
});
