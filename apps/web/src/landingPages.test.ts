import { describe, expect, it } from "vitest";
import { landingPageGroups, landingPageKey } from "./landingPages";

describe("landing pages da linha do cliente", () => {
  it("trata variações do mesmo endereço como uma página só", () => {
    const key = landingPageKey("https://domcolchoes.com.br/");
    expect(landingPageKey("https://www.domcolchoes.com.br/")).toBe(key);
    expect(landingPageKey("https://domcolchoes.com.br")).toBe(key);
    expect(landingPageKey("https://DomColchoes.com.br/?utm_source=google&gclid=1#topo")).toBe(key);
    expect(landingPageKey("https://domcolchoes.com.br/nilopolis")).not.toBe(key);
  });

  it("Dom Colchões – RJ: duas campanhas ativas com www e sem www viram um ícone", () => {
    const groups = landingPageGroups([
      { status: "ACTIVE", landingPageUrl: "https://www.domcolchoes.com.br/", landingPageStatus: "ACTIVE" },
      { status: "ACTIVE", landingPageUrl: "https://domcolchoes.com.br/?utm_source=google", landingPageStatus: "ACTIVE" },
      { status: "PAUSED", landingPageUrl: "https://domcolchoes.com.br/madureira", landingPageStatus: "UNKNOWN" },
    ]);
    expect(groups).toEqual([{ url: "https://www.domcolchoes.com.br/", status: "ACTIVE" }]);
  });

  it("sem campanha ativa, mostra as páginas das pausadas", () => {
    expect(landingPageGroups([{ status: "PAUSED", landingPageUrl: "https://a.com/x", landingPageStatus: "UNKNOWN" }])).toEqual([{ url: "https://a.com/x", status: "UNKNOWN" }]);
    expect(landingPageGroups([{ status: "ACTIVE", landingPageUrl: null }])).toEqual([]);
  });

  it("uma variação inativa marca a página como inativa", () => {
    expect(landingPageGroups([
      { status: "ACTIVE", landingPageUrl: "https://a.com/", landingPageStatus: "ACTIVE" },
      { status: "ACTIVE", landingPageUrl: "https://www.a.com", landingPageStatus: "INACTIVE" },
    ])[0].status).toBe("INACTIVE");
  });
});
