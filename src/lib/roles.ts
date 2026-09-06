export const STUDIO_ROLES = ["owner", "manager", "desk", "specialist"] as const;
export type StudioRole = (typeof STUDIO_ROLES)[number];

export const ROLE_LABEL: Record<StudioRole, string> = {
  owner: "Owner",
  manager: "Manager",
  desk: "Front desk",
  specialist: "Specialist",
};

export const ROLE_BLURB: Record<StudioRole, string> = {
  owner: "Full studio, payments, and who can sign in.",
  manager: "Floor, book, stock, hours, and reports. Not payments or who is on the desk.",
  desk: "The book, the client file, and the register.",
  specialist: "Your chair and today's visits.",
};

export type StudioPermission =
  | "today"
  | "calendar"
  | "clients"
  | "menu"
  | "pos"
  | "payments"
  | "inventory"
  | "hours"
  | "reports"
  | "access"
  | "reset";

const PERMS: Record<StudioRole, readonly StudioPermission[]> = {
  owner: [
    "today",
    "calendar",
    "clients",
    "menu",
    "pos",
    "payments",
    "inventory",
    "hours",
    "reports",
    "access",
    "reset",
  ],
  manager: ["today", "calendar", "clients", "menu", "pos", "inventory", "hours", "reports"],
  desk: ["today", "calendar", "clients", "pos"],
  specialist: ["today", "calendar"],
};

export function isStudioRole(value: unknown): value is StudioRole {
  return typeof value === "string" && (STUDIO_ROLES as readonly string[]).includes(value);
}

export function parseStudioRole(value: unknown, fallback: StudioRole = "specialist"): StudioRole {
  return isStudioRole(value) ? value : fallback;
}

export function can(role: StudioRole | null | undefined, perm: StudioPermission): boolean {
  if (!role) return false;
  return PERMS[role].includes(perm);
}

/** Least-privilege permission required to open a studio path. */
export function permissionForPath(pathname: string): StudioPermission {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/studio/payments")) return "payments";
  if (path.startsWith("/studio/access")) return "access";
  if (path.startsWith("/studio/inventory")) return "inventory";
  if (path.startsWith("/studio/reports")) return "reports";
  if (path === "/studio/hours" || path.startsWith("/studio/hours/")) return "hours";
  if (path.startsWith("/studio/menu")) return "menu";
  if (path.startsWith("/studio/pos")) return "pos";
  if (path.startsWith("/studio/clients")) return "clients";
  if (path.startsWith("/studio/calendar")) return "calendar";
  return "today";
}
