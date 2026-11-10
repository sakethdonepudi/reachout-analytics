import type { NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { audit } from "@/lib/audit";
import { createGoogleFlow, googleAuthUrl, googleConfigured, setGoogleStateCookie } from "@/lib/google-oauth";
import { safeNextPath } from "@/lib/access";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`google-start:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  const query = z.object({ turnstile: z.string().max(4000).optional(), next: z.string().max(2048).optional() }).safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!query.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  if (!googleConfigured()) {
    return Response.json({ ok: false, error: "Google sign-in is not configured" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }

  const turnstileToken = query.data.turnstile ?? "";
  const captcha = await verifyTurnstile(turnstileToken, ip);
  const allowUnconfigured = process.env.NODE_ENV !== "production" && !captcha.configured;
  if (!captcha.ok && !allowUnconfigured) {
    await audit({ action: "login_failed", ip, meta: { provider: "google", stage: "turnstile" } });
    return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }

  const nextParam = query.data.next ?? null;
  const next = nextParam && (safeNextPath(nextParam, "owner") || safeNextPath(nextParam, "client")) ? nextParam : null;

  const flow = createGoogleFlow();
  const response = Response.redirect(googleAuthUrl(req, flow), 302);
  setGoogleStateCookie(response, { state: flow.state, nonce: flow.nonce, verifier: flow.verifier, next });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}
