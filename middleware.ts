import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "ro_session";

function base64UrlBytes(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Edge-safe session check. The page and API guards still validate the
 * server-side session record; this middleware gives logged-out visitors an
 * exact-path login redirect before any protected markup is rendered.
 */
async function hasValidSessionCookie(token: string | undefined, secret: string) {
  if (!token || !secret) return false;
  const [body, signature] = token.split(".");
  if (!body || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlBytes(signature), new TextEncoder().encode(body));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(body))) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const authenticated = await hasValidSessionCookie(
    request.cookies.get(COOKIE)?.value,
    process.env.ADMIN_SESSION_SECRET || "",
  );
  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/case-studies", "/case-studies/:path*", "/api/public/case-studies/:path*"],
};
