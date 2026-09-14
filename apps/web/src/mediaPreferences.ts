import { createContext } from "react";

export const MediaUserContext = createContext<string>("");
export const mediaPreferenceKey = (userId: string, name: string) =>
  `pw-os-user:${encodeURIComponent(userId)}:${name}`;

// Legacy unscoped values may belong to another person using this browser.
export function readMediaPreference<T>(storage: Pick<Storage, "getItem">, userId: string, name: string, fallback: T): T {
  if (!userId) return fallback;
  try { return JSON.parse(storage.getItem(mediaPreferenceKey(userId, name)) || "null") ?? fallback; }
  catch { return fallback; }
}
