import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireCsrf } from "@/lib/csrf";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { BREAKGLASS_EMAIL, breakglassRateLimited, createSession, ensureBreakglassAdmin, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getMongo } from "@/lib/mongodb";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
const Body = z.object({ password: z.string().min(1).max(500), turnstileToken: z.string().max(4000).optional() });

export async function POST(req: NextRequest) {
  if (process.env.BREAKGLASS_LOGIN_ENABLED !== "true") return Response.json({ ok: false, error: "Not available" }, { status: 404 });
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (breakglassRateLimited(ip)) return rateLimitResponse(3600);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip);
  if (!captcha.ok && (process.env.NODE_ENV === "production" || captcha.configured)) {
    await audit({ action: "login_failed", ip, meta: { provider: "breakglass", stage: "turnstile" } });
    return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400 });
  }
  const ready = await ensureBreakglassAdmin();
  if (!ready.ok) return Response.json({ ok: false, error: "Sign-in is not configured" }, { status: 503 });

  const p = getMongo();
  if (!p) return Response.json({ ok: false, error: "Sign-in is not configured" }, { status: 503 });
  const client = await p;
  const user = await client.db(process.env.MONGODB_DB || "reachout").collection<{ email: string; role: "owner"; passwordHash: string }>("users").findOne({ email: BREAKGLASS_EMAIL });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    await audit({ action: "login_failed", ip, meta: { provider: "breakglass" } });
    return Response.json({ ok: false, error: "Incorrect credentials" }, { status: 401 });
  }
  const token = await createSession(BREAKGLASS_EMAIL, "owner");
  await audit({ action: "login_success", email: BREAKGLASS_EMAIL, role: "owner", ip, meta: { provider: "breakglass" } });
  const res = Response.json({ ok: true, role: "owner" });
  setSessionCookie(res, token);
  return res;
}
