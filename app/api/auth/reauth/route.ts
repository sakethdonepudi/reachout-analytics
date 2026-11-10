import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { refreshSessionAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { beginLoginAttempt, loginRateLimitResponse, recordLoginFailure, recordLoginSuccess } from "@/lib/login-guard";
import { ownerPasswordMatches } from "@/lib/passwords";

export const runtime = "nodejs";

const Body = z.object({ password: z.string().min(1).max(500) });
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const attempt = beginLoginAttempt(ip);
  if (!attempt.ok) {
    await audit({ action: "login_failed", role: "owner", ip, meta: { stage: "reauth-rate-limit" } });
    return loginRateLimitResponse(attempt.retryAfter);
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  }

  if (!ownerPasswordMatches(parsed.data.password)) {
    const failure = recordLoginFailure(ip);
    await audit({ action: "login_failed", role: "owner", ip, meta: { stage: "reauth" } });
    if (failure.locked) return loginRateLimitResponse(failure.retryAfter);
    return Response.json({ ok: false, error: "Incorrect password" }, { status: 401, headers });
  }

  const refreshed = await refreshSessionAuth(auth.session.sid);
  if (!refreshed) {
    return Response.json({ ok: false, error: "Session expired" }, { status: 401, headers });
  }

  recordLoginSuccess(ip);
  await audit({ action: "reauth", role: "owner", ip });
  return Response.json({ ok: true }, { headers });
}
