export type Decision = "ALLOW" | "DENY";
export type PermissionSource = "USER_DENY" | "USER_ALLOW" | "ROLE" | "HIERARCHY" | "DEFAULT";

export interface PermissionInput {
  userOverride?: Decision;
  roleAllows?: boolean;
  hierarchyAllows?: boolean;
}

export function resolvePermission(input: PermissionInput): { allowed: boolean; source: PermissionSource } {
  if (input.userOverride === "DENY") return { allowed: false, source: "USER_DENY" };
  if (input.userOverride === "ALLOW") return { allowed: true, source: "USER_ALLOW" };
  if (input.roleAllows) return { allowed: true, source: "ROLE" };
  if (input.hierarchyAllows) return { allowed: true, source: "HIERARCHY" };
  return { allowed: false, source: "DEFAULT" };
}

export function canAccessClient(userOrganizationId: string, resourceOrganizationId: string, linkedClientIds: string[], clientId: string) {
  return userOrganizationId === resourceOrganizationId && linkedClientIds.includes(clientId);
}
