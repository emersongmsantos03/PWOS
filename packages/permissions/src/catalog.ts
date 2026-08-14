export const permissionCatalog = [
  { module: "Visão geral", key: "dashboard", actions: ["view"] },
  { module: "Clientes", key: "clients", actions: ["view", "create", "edit", "delete", "assign"] },
  { module: "CRM", key: "crm", actions: ["view", "create", "edit", "delete", "assign", "move_stage", "convert", "reverse_conversion", "view_values", "export", "manage_pipelines"] },
  { module: "Tarefas", key: "tasks", actions: ["view", "create", "edit", "delete", "assign", "view_all", "edit_all", "review"] },
  { module: "Agenda", key: "calendar", actions: ["view", "create", "edit", "delete", "view_team", "edit_all"] },
  { module: "Financeiro", key: "finance", actions: ["view", "create", "edit", "delete", "settle", "manage_settings", "view_values", "export"] },
  { module: "Mídia paga", key: "media", actions: ["view", "create", "edit", "sync"] },
  { module: "Relatórios", key: "reports", actions: ["view", "create", "share", "download"] },
  { module: "Chamados internos", key: "tickets", actions: ["view", "create", "edit", "delete", "comment", "assign", "view_all", "manage_departments"] },
  { module: "Usuários", key: "users", actions: ["view", "create", "edit", "block"] },
  { module: "Cargos e permissões", key: "roles", actions: ["view", "create", "edit", "delete"] },
  { module: "Central de Conexões", key: "integrations", actions: ["view", "create", "authorize", "edit", "sync", "manage_accounts", "manage_campaigns", "manage_client_access", "view_logs", "revoke", "delete"] },
  { module: "Configurações", key: "settings", actions: ["view", "edit"] },
] as const;

export const allPermissions = permissionCatalog.flatMap(module => module.actions.map(action => `${module.key}.${action}`));

export const isKnownPermission = (permission: unknown): permission is string =>
  typeof permission === "string" && allPermissions.includes(permission as never);

export const sanitizePermissions = (permissions: unknown): string[] =>
  Array.isArray(permissions) ? [...new Set(permissions.filter(isKnownPermission))] : [];

export function effectivePermissions(rolePermissions: string[], overrides: Record<string, "ALLOW" | "DENY">) {
  const keys = new Set([...rolePermissions, ...Object.keys(overrides)]);
  return [...keys].map(permission => ({
    permission,
    allowed: overrides[permission] ? overrides[permission] === "ALLOW" : rolePermissions.includes(permission),
    source: overrides[permission] ? (overrides[permission] === "ALLOW" ? "USER_ALLOW" : "USER_DENY") : "ROLE",
  }));
}
