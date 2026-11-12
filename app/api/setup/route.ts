import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { countOwners, createUser } from "@/lib/users";
import { setPendingCookie } from "@/lib/pending-auth";
import { constantTimeEqual } from "@/lib/passwords";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { turnstileConfigured, turnstileRequired, verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const Body = z.object({
  setupToken: z.string().min(1).max(500),
  username: z.string().min(3).max(32),
  displayName: z.string().min(2).max(80),
  password: z.string().min(12).max(256),
  confirm: z.string().max(256),
  turnstileToken: z.string().max(4000).optional(),
});

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`setup:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  const setupToken = process.env.SETUP_TOKEN;
  if (!setupToken || (await countOwners()) > 0) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404, headers });
  }
  if (turnstileRequired() && !turnstileConfigured()) {
    return Response.json({ ok: false, error: "Setup unavailable" }, { status: 503, headers });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Check the form and try again." }, { status: 400, headers });
  if (parsed.data.password !== parsed.data.confirm) return Response.json({ ok: false, error: "The passwords do not match." }, { status: 400, headers });

  if (turnstileRequired()) {
    const captcha = await verifyTurnstile(parsed.data.turnstileToken ?? "", ip, { action: "setup", hostname: req.headers.get("host")?.split(":")[0] ?? null });
    if (!captcha.ok) return Response.json({ ok: false, error: "CAPTCHA verification failed" }, { status: 400, headers });
  }
  if (!constantTimeEqual(parsed.data.setupToken, setupToken)) {
    await audit({ action: "owner_bootstrap", ip, meta: { ok: false } });
    return Response.json({ ok: false, error: "Invalid setup token." }, { status: 401, headers });
  }

  const created = await createUser({
    username: parsed.data.username,
    displayName: parsed.data.displayName,
    role: "owner",
    password: parsed.data.password,
    totpRequired: true,
    createdBy: null,
  });
  if (!created.ok) return Response.json({ ok: false, error: created.error }, { status: 400, headers });

  await audit({ action: "owner_bootstrap", role: "owner", ip, meta: { userId: created.user._id } });
  const response = Response.json({ ok: true, redirect: "/account/security/enroll?first=1" }, { headers });
  setPendingCookie(response, { userId: created.user._id, purpose: "enroll", next: "/dashboard" });
  return response;
}
