// Internal OpenFGA/DB relation names -> the friendly 5-role labels.
//   org:     admin -> Tenant Admin, member -> Member
//   project: owner -> Admin, editor -> Developer, viewer -> Viewer
export const ROLE_LABELS: Record<string, string> = {
  admin: "Tenant Admin",
  member: "Member",
  owner: "Admin",
  editor: "Developer",
  viewer: "Viewer",
};

export function roleLabel(role?: string | null): string {
  if (!role) return "";
  return ROLE_LABELS[role] ?? role;
}
