import type { NextRequest } from "next/server";

export const CSRF_COOKIE = "ro_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function createCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function csrfCheck(input: {
  method: string;
  origin: string | null;
  siteOrigin: string;
  headerToken: string | null;
  cookieToken: string | null;
}): boolean {
  const method = input.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return true;
  if (!input.origin || !input.siteOrigin || input.origin !== input.siteOrigin) return false;
  if (!input.headerToken || !input.cookieToken) return false;
  if (input.headerToken.length < 20 || input.cookieToken.length < 20) return false;
  return input.headerToken === input.cookieToken;
}

export function siteOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try { return new URL(configured).origin; } catch { /* fall through */ }
  }
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
  const host = req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}`;
}

export function requireCsrf(req: NextRequest): Response | null {
  const ok = csrfCheck({
    method: req.method,
    origin: req.headers.get("origin"),
    siteOrigin: siteOrigin(req),
    headerToken: req.headers.get(CSRF_HEADER),
    cookieToken: req.cookies.get(CSRF_COOKIE)?.value ?? null,
  });
  if (ok) return null;
  return Response.json({ ok: false, error: "Invalid request" }, { status: 403, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export function issueCsrfCookie(response: Response, token = createCsrfToken()): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=43200${secure}`);
  return token;
}
