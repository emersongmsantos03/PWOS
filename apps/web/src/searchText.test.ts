import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearch } from "./searchText";

describe("busca do sistema", () => {
  it("ignora acentos, maiúsculas e espaços", () => {
    expect(normalizeSearch("  Dom   Colchões ")).toBe("dom colchoes");
    expect(matchesSearch("colchoes", "Dom Colchões - RJ")).toBe(true);
    expect(matchesSearch("ECOFLEX", "Ecoflex Cambé")).toBe(true);
  });

  it("exige todas as palavras, em qualquer ordem e em qualquer campo", () => {
    expect(matchesSearch("rj dom", "Dom Colchões - RJ")).toBe(true);
    expect(matchesSearch("allita brusque", "Allita Colchões", "Conta Brusque")).toBe(true);
    expect(matchesSearch("allita joinville", "Allita Colchões - Brusque")).toBe(false);
  });

  it("busca vazia não filtra nada", () => {
    expect(matchesSearch("   ", "qualquer coisa")).toBe(true);
    expect(matchesSearch("x", null, undefined)).toBe(false);
  });
});
