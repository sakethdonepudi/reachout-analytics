import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, setSessionCookie } from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/access";
import { beginLoginAttempt, loginRateLimitResponse, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { clearFailedLogins, getUser, markTotpStep, recordFailedLogin, touchLogin, verifyPasswordHash, consumeRecoveryCode } from "@/lib/users";
import { clearPendingCookie, readPending } from "@/lib/pending-auth";
import { openSecret } from "@/lib/secure-box";
import { normaliseRecoveryCode, verifyTotp } from "@/lib/totp";
import { turnstileConfigured, turnstileRequired, verifyTurnstile } from "@/lib/turnstile";
import { alertNewDevice } from "@/lib/sign-in-alerts";

export const runtime = "nodejs";

const Body = z.object({
  code: z.string().max(32).optional(),
  recoveryCode: z.string().max(64).optional(),
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
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const pending = readPending(req);
  if (!pending || pending.purpose !== "totp") {
    return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
  }
  const user = await getUser(pending.userId);
  if (!user || user.status !== "active") {
    const response = Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
    clearPendingCookie(response);
    return response;
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return loginRateLimitResponse(Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)));
  }
  const attempt = beginLoginAttempt(ip);
  if (!attempt.ok) return loginRateLimitResponse(attempt.retryAfter);

  if (turnstileRequired() && !turnstileConfigured()) {
    return Response.json({ ok: false, error: "Sign-in unavailable" }, { status: 503, headers });
  }
  if (turnstileRequired()) {
    const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip, {
      action: "totp",
      hostname: req.headers.get("host")?.split(":")[0] ?? null,
    });
    if (!captcha.ok) {
      await audit({ action: "login_failed", role: user.role, ip, meta: { stage: "totp-turnstile" } });
      return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400, headers });
    }
  }

  let verified = false;
  let usedRecovery = false;
  const secret = openSecret(user.totpSecret);
  if (parsed.data.code && secret) {
    const check = verifyTotp(secret, parsed.data.code, user.lastTotpStep);
    if (check.ok) {
      await markTotpStep(user._id, check.step);
      verified = true;
    }
  }
  if (!verified && parsed.data.recoveryCode) {
    const code = normaliseRecoveryCode(parsed.data.recoveryCode);
    for (let index = 0; index < user.recoveryCodes.length; index += 1) {
      if (await verifyPasswordHash(user.recoveryCodes[index], code)) {
        await consumeRecoveryCode(user._id, index);
        verified = true;
        usedRecovery = true;
        break;
      }
    }
  }

  if (!verified) {
    const failure = await recordFailedLogin(user._id);
    recordLoginFailure(ip);
    await audit({ action: "totp_failed", role: user.role, ip, meta: { userId: user._id, recovery: Boolean(parsed.data.recoveryCode) } });
    if (failure.locked) return loginRateLimitResponse(failure.retryAfter);
    return Response.json({ ok: false, error: "That code is not valid" }, { status: 401, headers });
  }

  recordLoginSuccess(ip);
  await clearFailedLogins(user._id);
  await touchLogin(user._id, deviceFrom(req));
  let token: string;
  try {
    token = await createSession(
      { userId: user._id, role: user.role, displayName: user.displayName, scope: user.clientScope },
      { device: deviceFrom(req), ip },
    );
  } catch {
    return Response.json({ ok: false, error: "Session store unavailable" }, { status: 503, headers });
  }
  await alertNewDevice(user, req).catch(() => {});
  await audit({ action: usedRecovery ? "recovery_code_used" : "login_success", role: user.role, ip, meta: { userId: user._id } });
  const response = Response.json({ ok: true, redirect: safeNextPath(pending.next ?? null, user.role) ?? roleHome(user.role) }, { headers });
  clearPendingCookie(response);
  setSessionCookie(response, token);
  return response;
}
