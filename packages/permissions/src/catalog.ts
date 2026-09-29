export const permissionCatalog = [
  { module: "Visão geral", key: "dashboard", actions: ["view", "view_team", "view_executive"] },
  { module: "Clientes", key: "clients", actions: ["view", "create", "edit", "delete", "assign", "create_access"] },
  { module: "CRM", key: "crm", actions: ["view", "create", "edit", "delete", "manage_pipelines"] },
  { module: "Oportunidades", key: "opportunities", actions: ["view", "create", "edit", "delete", "assign", "move_stage", "convert", "reverse_conversion", "view_values", "export"] },
  { module: "Propostas", key: "proposals", actions: ["view", "create", "edit", "delete", "export"] },
  { module: "Tarefas", key: "tasks", actions: ["view", "create", "edit", "delete", "assign", "view_team", "edit_team"] },
  { module: "Creative Ops", key: "creative_ops", actions: ["view", "review", "view_team_demands"] },
  { module: "Agenda", key: "calendar", actions: ["view", "create", "edit", "delete", "view_team", "edit_all"] },
  { module: "Reuniões", key: "meetings", actions: ["view", "create", "edit", "delete", "view_team"] },
  { module: "Financeiro", key: "finance", actions: ["view", "create", "edit", "delete", "settle", "manage_settings", "view_values", "export"] },
  { module: "Mídia paga", key: "media", actions: ["view", "create", "edit", "sync"] },
  { module: "Relatórios", key: "reports", actions: ["view", "view_commercial", "view_operations", "view_finance", "view_team", "create", "share", "download"] },
  { module: "Chamados internos", key: "tickets", actions: ["view", "create", "edit", "delete", "comment", "assign", "view_all", "manage_departments"] },
  { module: "Usuários", key: "users", actions: ["view", "create", "edit", "block", "reset_password"] },
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
