import { describe, expect, it } from "vitest";
import { canAccessClient, resolvePermission } from "./index";

describe("permissões efetivas", () => {
  it("negação individual prevalece sobre cargo", () => {
    expect(resolvePermission({ userOverride: "DENY", roleAllows: true })).toEqual({ allowed: false, source: "USER_DENY" });
  });
  it("concessão individual prevalece quando não há negação", () => {
    expect(resolvePermission({ userOverride: "ALLOW" })).toEqual({ allowed: true, source: "USER_ALLOW" });
  });
  it("ausência de permissão nega", () => expect(resolvePermission({}).allowed).toBe(false));
  it("isola organizações e clientes não vinculados", () => {
    expect(canAccessClient("pw", "pw", ["a"], "a")).toBe(true);
    expect(canAccessClient("pw", "outra", ["a"], "a")).toBe(false);
    expect(canAccessClient("pw", "pw", ["a"], "b")).toBe(false);
  });
});
