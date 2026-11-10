import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { roleHome, safeNextPath } from "@/lib/access";
import { createSession, setSessionCookie, subjectForRole } from "@/lib/auth";
import { beginLoginAttempt, loginRateLimitResponse, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { roleForPassword } from "@/lib/passwords";
import { turnstileEnabled, verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Body = z.object({
  password: z.string().min(1).max(500),
  next: z.string().max(2048).optional(),
  turnstileToken: z.string().max(4000).optional(),
});

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

  const attempt = beginLoginAttempt(ip);
  if (!attempt.ok) {
    await audit({ action: "login_failed", ip, meta: { method: "password", stage: "rate-limit" } });
    return loginRateLimitResponse(attempt.retryAfter);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  }

  if (turnstileEnabled()) {
    const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip);
    if (!captcha.ok) {
      await audit({ action: "login_failed", ip, meta: { method: "password", stage: "turnstile" } });
      return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400, headers });
    }
  }

  const role = roleForPassword(parsed.data.password, process.env.ADMIN_PASSWORD, process.env.CLIENT_PASSWORD);
  if (!role) {
    const failure = recordLoginFailure(ip);
    await audit({ action: "login_failed", ip, meta: { method: "password" } });
    if (failure.locked) return loginRateLimitResponse(failure.retryAfter);
    return Response.json({ ok: false, error: "Incorrect password" }, { status: 401, headers });
  }

  recordLoginSuccess(ip);
  const subject = subjectForRole(role);
  let token: string;
  try {
    token = await createSession(subject, role);
  } catch {
    await audit({ action: "login_failed", role, ip, meta: { method: "password", stage: "session-store" } });
    return Response.json({ ok: false, error: "Session store unavailable" }, { status: 503, headers });
  }
  const destination = safeNextPath(parsed.data.next ?? null, role) ?? roleHome(role);
  await audit({ action: "login_success", role, ip, meta: { method: "password" } });

  const response = Response.json({ ok: true, redirect: destination }, { headers });
  setSessionCookie(response, token);
  return response;
}
