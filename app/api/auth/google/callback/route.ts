import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { clearGoogleStateCookie, exchangeGoogleCode, googleConfigured, readGoogleStateCookie, verifyGoogleIdToken } from "@/lib/google-oauth";
import { createSession, roleForEmail, setSessionCookie } from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/access";

export const runtime = "nodejs";

function loginRedirect(path: string) {
  const res = Response.redirect(path, 302);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Vary", "Cookie");
  return res;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`google-callback:${ip}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!googleConfigured()) return loginRedirect("/login?error=config");

  const query = z.object({ code: z.string().min(1).max(4000), state: z.string().min(1).max(2000) }).safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return loginRedirect("/login?error=oauth");
  const code = query.data.code;
  const state = query.data.state;
  const stored = readGoogleStateCookie(req);
  if (!code || !state || !stored || stored.state !== state) {
    await audit({ action: "login_failed", ip, meta: { provider: "google", stage: "state" } });
    const res = loginRedirect("/login?error=oauth");
    clearGoogleStateCookie(res);
    return res;
  }

  try {
    const tokens = await exchangeGoogleCode(req, code, stored.verifier);
    const profile = await verifyGoogleIdToken(req, tokens.id_token!, stored.nonce);
    const role = await roleForEmail(profile.email);
    if (!role) {
      await audit({ action: "login_denied", email: profile.email, ip, meta: { provider: "google" } });
      const res = loginRedirect("/no-access");
      clearGoogleStateCookie(res);
      return res;
    }
    const sessionToken = await createSession(profile.email, role);
    const destination = safeNextPath(stored.next ?? null, role) ?? roleHome(role);
    await audit({ action: "login_success", email: profile.email, role, ip, meta: { provider: "google" } });
    const res = loginRedirect(destination);
    setSessionCookie(res, sessionToken);
    clearGoogleStateCookie(res);
    return res;
  } catch {
    await audit({ action: "login_failed", ip, meta: { provider: "google", stage: "exchange" } });
    const res = loginRedirect("/login?error=oauth");
    clearGoogleStateCookie(res);
    return res;
  }
}
