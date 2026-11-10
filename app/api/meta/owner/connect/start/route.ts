import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { safeNextPath } from "@/lib/access";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createMetaFlow, metaAuthUrl, metaConfigured, metaRedirect, setMetaStateCookie } from "@/lib/meta/oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) {
    if (auth.deny.status === 403 && req.headers.get("accept")?.includes("text/html")) {
      return metaRedirect(new URL("/meta-ads/settings?reauth=1", req.nextUrl.origin));
    }
    return auth.deny;
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`meta-connect:${ip}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!metaConfigured()) return Response.json({ ok: false, error: "Meta is not configured" }, { status: 503 });

  const next = safeNextPath(req.nextUrl.searchParams.get("next"), "owner") ?? "/meta-ads/settings";
  const flow = createMetaFlow();
  const response = metaRedirect(metaAuthUrl(req, flow));
  setMetaStateCookie(response, { state: flow.state, verifier: flow.verifier, next });
  return response;
}
