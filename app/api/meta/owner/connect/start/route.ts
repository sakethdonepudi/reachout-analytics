import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createMetaFlow, metaAuthUrl, metaConfigured, metaRedirect, setMetaStateCookie } from "@/lib/meta/oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`meta-connect:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!metaConfigured()) return Response.json({ ok: false, error: "Meta is not configured" }, { status: 503 });

  const flow = createMetaFlow();
  const response = metaRedirect(metaAuthUrl(req, flow));
  setMetaStateCookie(response, { state: flow.state, verifier: flow.verifier, next: "/meta-ads/settings" });
  return response;
}
