import { describe, expect, it } from "vitest";
import { allPermissions, effectivePermissions } from "./catalog";

describe("catálogo e exceções individuais", () => {
  it("possui permissões específicas dentro dos módulos", () => {
    expect(allPermissions).toContain("clients.view");
    expect(allPermissions).toContain("clients.delete");
    expect(allPermissions).toContain("integrations.sync");
    expect(allPermissions).toContain("crm.manage_pipelines");
    expect(allPermissions).toContain("crm.convert");
  });
  it("negação individual prevalece sobre o cargo", () => {
    expect(effectivePermissions(["clients.delete"], { "clients.delete": "DENY" })[0]).toMatchObject({ allowed: false, source: "USER_DENY" });
  });
  it("concessão individual adiciona acesso fora do cargo", () => {
    expect(effectivePermissions([], { "reports.share": "ALLOW" })[0]).toMatchObject({ allowed: true, source: "USER_ALLOW" });
  });
});
