import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/access";
import { beginLoginAttempt, loginRateLimitResponse, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { findUserByUsername, needsEnrollment, recordFailedLogin, touchLogin, verifyPasswordHash } from "@/lib/users";
import { setPendingCookie } from "@/lib/pending-auth";
import { alertNewDevice } from "@/lib/sign-in-alerts";
import { turnstileConfigured, turnstileRequired, verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Body = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(500),
  next: z.string().max(2048).optional(),
  turnstileToken: z.string().max(4000).optional(),
});

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function deviceFrom(req: NextRequest): string {
  const ua = req.headers.get("user-agent") ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const attempt = beginLoginAttempt(ip);
  if (!attempt.ok) {
    await audit({ action: "login_failed", ip, meta: { stage: "rate-limit" } });
    return loginRateLimitResponse(attempt.retryAfter);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });

  if (turnstileRequired() && !turnstileConfigured()) {
    return Response.json({ ok: false, error: "Sign-in unavailable" }, { status: 503, headers });
  }
  if (turnstileRequired()) {
    const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip, {
      action: "login",
      hostname: req.headers.get("host")?.split(":")[0] ?? null,
    });
    if (!captcha.ok) {
      await audit({ action: "login_failed", ip, meta: { stage: "turnstile" } });
      return Response.json({ ok: false, error: captcha.error === "Sign-in unavailable" ? "Sign-in unavailable" : "CAPTCHA verification failed" }, { status: 400, headers });
    }
  }

  const user = await findUserByUsername(parsed.data.username);
  const valid = user ? await verifyPasswordHash(user.passwordHash, parsed.data.password) : false;
  if (!user || !valid || user.status !== "active") {
    const failure = recordLoginFailure(ip);
    if (user) await recordFailedLogin(user._id);
    await audit({ action: "login_failed", ip, meta: { stage: "password" } });
    if (failure.locked) return loginRateLimitResponse(failure.retryAfter);
    return Response.json({ ok: false, error: "Incorrect username or password" }, { status: 401, headers });
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000));
    return loginRateLimitResponse(retryAfter);
  }

  const next = safeNextPath(parsed.data.next ?? null, user.role);

  if (user.mustChangePassword) {
    const response = Response.json({ ok: true, step: "password", redirect: "/account/password?first=1" }, { headers });
    setPendingCookie(response, { userId: user._id, purpose: "password", next });
    return response;
  }

  if (needsEnrollment(user)) {
    const response = Response.json({ ok: true, step: "enroll", redirect: "/account/security/enroll?first=1" }, { headers });
    setPendingCookie(response, { userId: user._id, purpose: "enroll", next });
    return response;
  }

  if (user.totpEnabled || user.totpRequired) {
    const response = Response.json({ ok: true, step: "totp" }, { headers });
    setPendingCookie(response, { userId: user._id, purpose: "totp", next });
    return response;
  }

  recordLoginSuccess(ip);
  await touchLogin(user._id, deviceFrom(req));
  let token: string;
  try {
    token = await createSession(
      { userId: user._id, role: user.role, displayName: user.displayName },
      { device: deviceFrom(req), ip },
    );
  } catch {
    return Response.json({ ok: false, error: "Session store unavailable" }, { status: 503, headers });
  }
  await alertNewDevice(user, req).catch(() => {});
  await audit({ action: "login_success", role: user.role, ip, meta: { userId: user._id } });
  const response = Response.json({ ok: true, redirect: next ?? roleHome(user.role) }, { headers });
  setSessionCookie(response, token);
  return response;
}
