import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, refreshSessionAuth, requireRole, setSessionCookie } from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/access";
import { clearPendingCookie, readPending, setPendingCookie } from "@/lib/pending-auth";
import { getUser, needsEnrollment, setPassword, verifyPasswordHash } from "@/lib/users";
import { turnstileConfigured, turnstileRequired, verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Body = z.object({
  current: z.string().max(500).optional(),
  password: z.string().min(12).max(256),
  confirm: z.string().max(256),
  turnstileToken: z.string().max(4000).optional(),
});

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Check the form and try again." }, { status: 400, headers });
  if (parsed.data.password !== parsed.data.confirm) return Response.json({ ok: false, error: "The passwords do not match." }, { status: 400, headers });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (turnstileRequired() && !turnstileConfigured()) return Response.json({ ok: false, error: "Password change unavailable" }, { status: 503, headers });
  if (turnstileRequired()) {
    const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip, { action: "password", hostname: req.headers.get("host")?.split(":")[0] ?? null });
    if (!captcha.ok) return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400, headers });
  }

  const pending = readPending(req);
  if (!pending) {
    const current = await requireRole(req, ["owner", "client"]);
    if ("deny" in current) {
      return Response.json({ ok: false, code: "pending_expired", error: "This sign-in step timed out. Sign in again with your temporary password." }, { status: 401, headers });
    }
  }
  if (pending?.purpose === "password") {
    const user = await getUser(pending.userId);
    if (!user) return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
    const result = await setPassword(user._id, parsed.data.password, user.username, { mustChange: false });
    if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400, headers });
    await audit({ action: "password_reset", role: user.role, ip, meta: { userId: user._id, firstLogin: true } });

    if (needsEnrollment(user)) {
      const response = Response.json({ ok: true, redirect: "/account/security/enroll?first=1" }, { headers });
      setPendingCookie(response, { userId: user._id, purpose: "enroll", next: pending.next });
      return response;
    }
    const fresh = (await getUser(user._id))!;
    const token = await createSession({ userId: fresh._id, role: fresh.role, displayName: fresh.displayName, scope: fresh.clientScope }, { device: req.headers.get("user-agent")?.slice(0, 200) ?? undefined, ip });
    const response = Response.json({ ok: true, redirect: safeNextPath(pending.next ?? null, fresh.role) ?? (fresh.role === "owner" ? "/dashboard" : "/") }, { headers });
    setSessionCookie(response, token);
    clearPendingCookie(response);
    return response;
  }

  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  if (!auth.session.userId) return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
  const user = await getUser(auth.session.userId);
  if (!user) return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
  if (!(await verifyPasswordHash(user.passwordHash, parsed.data.current ?? ""))) {
    await audit({ action: "login_failed", role: user.role, ip, meta: { stage: "password-change" } });
    return Response.json({ ok: false, error: "The current password is incorrect." }, { status: 401, headers });
  }
  const result = await setPassword(user._id, parsed.data.password, user.username, { mustChange: false });
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 400, headers });
  await refreshSessionAuth(auth.session.sid);
  await audit({ action: "password_reset", role: user.role, ip, meta: { userId: user._id } });
  return Response.json({ ok: true }, { headers });
}
