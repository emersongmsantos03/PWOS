export const permissionCatalog = [
  { module: "Visão geral", key: "dashboard", actions: ["view"] },
  { module: "Clientes", key: "clients", actions: ["view", "create", "edit", "delete", "assign"] },
  { module: "Mídia paga", key: "media", actions: ["view", "create", "edit", "sync"] },
  { module: "Relatórios", key: "reports", actions: ["view", "create", "share", "download"] },
  { module: "Chamados internos", key: "tickets", actions: ["view", "create", "edit", "delete", "comment", "assign", "view_all", "manage_departments"] },
  { module: "Usuários", key: "users", actions: ["view", "create", "edit", "block"] },
  { module: "Cargos e permissões", key: "roles", actions: ["view", "create", "edit", "delete"] },
  { module: "Central de Conexões", key: "integrations", actions: ["view", "create", "authorize", "edit", "sync", "manage_accounts", "manage_campaigns", "manage_client_access", "view_logs", "revoke", "delete"] },
  { module: "Configurações", key: "settings", actions: ["view", "edit"] },
] as const;

export const allPermissions = permissionCatalog.flatMap(module => module.actions.map(action => `${module.key}.${action}`));

export function effectivePermissions(rolePermissions: string[], overrides: Record<string, "ALLOW" | "DENY">) {
  const keys = new Set([...rolePermissions, ...Object.keys(overrides)]);
  return [...keys].map(permission => ({
    permission,
    allowed: overrides[permission] ? overrides[permission] === "ALLOW" : rolePermissions.includes(permission),
    source: overrides[permission] ? (overrides[permission] === "ALLOW" ? "USER_ALLOW" : "USER_DENY") : "ROLE",
  }));
}
