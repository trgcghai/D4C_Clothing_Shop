export function normalizeRole(role) {
  if (!role || typeof role !== "string") return null;
  return role.startsWith("ROLE_") ? role : `ROLE_${role}`;
}

export function isAdminRole(role) {
  return normalizeRole(role) === "ROLE_ADMIN";
}

