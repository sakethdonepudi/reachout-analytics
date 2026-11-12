import { NextResponse, type NextRequest } from "next/server";
import { rolesForPath, roleHome, type Role } from "@/lib/access";
import { CSRF_COOKIE, createCsrfToken } from "@/lib/csrf";
import { PROTECTED_HEADERS, securityHeaders } from "@/lib/security";

const PROD_COOKIE = "__Host-ro_session";
const DEV_COOKIE = "ro_session";

function base64UrlBytes(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sessionFromCookie(token: string | undefined, secret: string): Promise<{ role: Role; exp: number } | null> {
  if (!token || !secret) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlBytes(signature), new TextEncoder().encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(body))) as { exp?: number; role?: string };
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    const role: Role | null = payload.role === "owner" || payload.role === "client" ? payload.role : payload.role === "admin" ? "owner" : null;
    return role ? { role, exp: payload.exp } : null;
  } catch {
    return null;
  }
}

function applyCommon(response: Response, nonce: string, protectedPath: boolean, turnstile = false) {
  for (const [key, value] of Object.entries(securityHeaders(nonce, { turnstile }))) response.headers.set(key, value);
  if (protectedPath) for (const [key, value] of Object.entries(PROTECTED_HEADERS)) response.headers.set(key, value);
  if (!response.headers.get("Set-Cookie")?.includes(`${CSRF_COOKIE}=`)) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    response.headers.append("Set-Cookie", `${CSRF_COOKIE}=${createCsrfToken()}; Path=/; SameSite=Lax; Max-Age=43200${secure}`);
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const turnstilePage = pathname === "/login" || pathname === "/setup" || pathname.startsWith("/account/security") || pathname.startsWith("/account/password");
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const target = request.nextUrl.clone();
    target.pathname = pathname.replace(/^\/admin/, "/dashboard/case-studies");
    return applyCommon(NextResponse.redirect(target, 301), nonce, false, turnstilePage);
  }
  const isProduction = process.env.NODE_ENV === "production";
  const token = request.cookies.get(isProduction ? PROD_COOKIE : DEV_COOKIE)?.value
    ?? request.cookies.get(DEV_COOKIE)?.value;
  const session = await sessionFromCookie(token, process.env.ADMIN_SESSION_SECRET || "");
  const roles = rolesForPath(pathname);
  const protectedPath = roles !== null;

  const deny = (status: 401 | 403, message: string) => {
    if (pathname.startsWith("/api/")) {
      return applyCommon(
        NextResponse.json({ ok: false, error: message }, { status }),
        nonce,
        protectedPath,
        turnstilePage,
      );
    }
    const target = status === 401
      ? (() => {
          const login = request.nextUrl.clone();
          login.pathname = "/login";
          login.search = "";
          login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
          return login;
        })()
      : new URL(roleHome(session?.role ?? "client"), request.url);
    return applyCommon(NextResponse.redirect(target), nonce, protectedPath, turnstilePage);
  };

  if (roles) {
    if (!session) return deny(401, "Not authenticated");
    if (!roles.includes(session.role)) return deny(403, "Forbidden");
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applyCommon(response, nonce, protectedPath, turnstilePage);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|css|js|map|geojson|json|txt|xml)$).*)",
  ],
};
