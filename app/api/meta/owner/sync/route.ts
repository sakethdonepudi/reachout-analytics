import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { syncMeta } from "@/lib/meta/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`meta-sync:${ip}`, 1, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  const result = await syncMeta();
  const status = result.ok ? 200 : result.skipped === "locked" ? 409 : 503;
  return Response.json(result, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
