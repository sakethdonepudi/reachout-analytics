import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { refreshSessionAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { beginLoginAttempt, loginRateLimitResponse, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { getUser, markTotpStep, verifyPasswordHash } from "@/lib/users";
import { openSecret } from "@/lib/secure-box";
import { verifyTotp } from "@/lib/totp";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1).max(500), totp: z.string().max(16).optional() });
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const attempt = beginLoginAttempt(ip);
  if (!attempt.ok) return loginRateLimitResponse(attempt.retryAfter);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });

  const user = auth.session.userId ? await getUser(auth.session.userId) : null;
  if (!user || !(await verifyPasswordHash(user.passwordHash, parsed.data.password))) {
    const failure = recordLoginFailure(ip);
    await audit({ action: "login_failed", role: "owner", ip, meta: { stage: "reauth" } });
    if (failure.locked) return loginRateLimitResponse(failure.retryAfter);
    return Response.json({ ok: false, error: "Incorrect password" }, { status: 401, headers });
  }

  if (user.totpEnabled) {
    const secret = openSecret(user.totpSecret);
    const check = secret ? verifyTotp(secret, parsed.data.totp ?? "", user.lastTotpStep) : { ok: false, step: 0 };
    if (!check.ok) {
      await audit({ action: "totp_failed", role: "owner", ip, meta: { stage: "reauth" } });
      return Response.json({ ok: false, error: "That code is not valid" }, { status: 401, headers });
    }
    await markTotpStep(user._id, check.step);
  }

  const refreshed = await refreshSessionAuth(auth.session.sid);
  if (!refreshed) return Response.json({ ok: false, error: "Session expired" }, { status: 401, headers });
  recordLoginSuccess(ip);
  await audit({ action: "reauth", role: "owner", ip, meta: { userId: user._id } });
  return Response.json({ ok: true }, { headers });
}
