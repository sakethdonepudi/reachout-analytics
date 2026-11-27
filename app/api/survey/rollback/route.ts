import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { rollbackSurvey } from "@/lib/survey/store";
import { SURVEY_STATES } from "@/lib/survey/types";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`survey-rollback:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  const body = await req.json().catch(() => null) as { state?: string; version?: number } | null;
  const state = String(body?.state ?? "");
  const version = Number(body?.version ?? 0);
  if (!SURVEY_STATES[state]) return Response.json({ ok: false, error: "Choose Tamil Nadu or Andhra Pradesh." }, { status: 400, headers });
  if (!Number.isInteger(version) || version < 1) return Response.json({ ok: false, error: "Choose a survey version." }, { status: 400, headers });
  try {
    await rollbackSurvey(state, version);
    await audit({ action: "survey_rolled_back", role: "owner", meta: { state, version } });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "That version could not be restored." }, { status: 400, headers });
  }
}
