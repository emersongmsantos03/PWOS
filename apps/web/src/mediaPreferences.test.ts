import { describe, expect, it } from "vitest";
import { mediaPreferenceKey, readMediaPreference } from "./mediaPreferences";

describe("personal media preferences on a shared browser", () => {
  it("keeps each person's period and client filter when switching accounts", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    const name = "pw-os-media-context";
    values.set(mediaPreferenceKey("master", name), JSON.stringify({ since: "2026-09-01", client: "A" }));
    expect(readMediaPreference(storage, "collaborator", name, {})).toEqual({});
    values.set(mediaPreferenceKey("collaborator", name), JSON.stringify({ since: "2026-09-04", client: "B" }));
    expect(readMediaPreference(storage, "master", name, {})).toEqual({ since: "2026-09-01", client: "A" });
    expect(readMediaPreference(storage, "collaborator", name, {})).toEqual({ since: "2026-09-04", client: "B" });
  });
  it("does not import another person's legacy preferences and tolerates invalid storage", () => {
    const storage = { getItem: (key: string) => key === "pw-os-media-context" ? '{"client":"private"}' : 'invalid' };
    expect(readMediaPreference(storage, "new-user", "pw-os-media-context", {})).toEqual({});
    expect(readMediaPreference(storage, "", "pw-os-media-context", {})).toEqual({});
  });
});
