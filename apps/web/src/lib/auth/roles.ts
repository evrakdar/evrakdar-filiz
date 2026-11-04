export type AuthRole = "ADMIN" | "EDITOR" | "VIEWER";

const rolePriority: AuthRole[] = ["ADMIN", "EDITOR", "VIEWER"];

const roleLabels: Record<AuthRole, string> = {
  ADMIN: "Yönetici",
  EDITOR: "Düzenleyici",
  VIEWER: "Kullanıcı"
};

export function getHighestRole(roles: string[] = []) {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function getRoleLabel(roles: string[] = []) {
  const role = getHighestRole(roles);
  return role ? roleLabels[role] : "Kullanıcı";
}

export function hasAnyRole(roles: string[] = [], allowedRoles: AuthRole[]) {
  return allowedRoles.some((role) => roles.includes(role));
}
