/* Pure role/route rules. Safe to import from middleware, pages and tests. */

export type Role = "owner" | "client";

export const ROLE_HOME: Record<Role, string> = {
  owner: "/dashboard",
  client: "/case-studies",
};

type Rule = { prefixes: string[]; roles: Role[] };

const RULES: Rule[] = [
  { prefixes: ["/case-studies", "/api/public/case-studies"], roles: ["owner", "client"] },
  { prefixes: ["/dashboard", "/account/users", "/api/account/users"], roles: ["owner"] },
  { prefixes: ["/account", "/api/account", "/api/auth/heartbeat"], roles: ["owner", "client"] },
  { prefixes: ["/api/admin", "/api/data"], roles: ["owner"] },
];

/** Returns the roles allowed at a path, or null for public routes. */
export function rolesForPath(pathname: string): Role[] | null {
  const path = pathname.split("?")[0].split("#")[0];
  // The blank template is the explicit exception under /api/data.
  if (path === "/api/data/template") return null;
  // Pending first-login flows have no session yet; the pages and routes check
  // their short-lived signed pending cookie themselves.
  if (path === "/account/password" || path === "/account/security/enroll") return null;
  if (path === "/api/account/password" || path === "/api/account/totp") return null;
  for (const rule of RULES) {
    if (rule.prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return rule.roles;
  }
  return null;
}

export function canAccess(role: Role, pathname: string): boolean {
  const roles = rolesForPath(pathname);
  return roles === null || roles.includes(role);
}

export function roleHome(role: Role): string {
  return ROLE_HOME[role];
}

/** Clients may open published case studies; drafts stay owner-only. */
export function canOpenCase(role: Role, published: boolean): boolean {
  return role === "owner" || published;
}

/**
 * Validate a post-login return path.
 *
 * Only same-origin relative paths starting with exactly one "/" are allowed.
 * Backslashes, schemes, protocol-relative URLs, encoded slashes and control
 * characters are rejected before the path is matched against the role rules.
 */
export function safeNextPath(value: string | null | undefined, role: Role): string | null {
  if (!value || typeof value !== "string") return null;
  if (value.length > 2048) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;

  const url = new URL(value, "https://internal.invalid");
  if (url.origin !== "https://internal.invalid") return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (path.startsWith("/login")) return null;
  if (path.startsWith("/api/")) return null;
  if (!canAccess(role, url.pathname)) return null;
  return path;
}
