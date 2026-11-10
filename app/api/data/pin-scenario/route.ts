import type { NextRequest } from "next/server";
import { requireAdmin, requireRecentAuth } from "@/lib/auth";
import { z } from "zod";
import { requireCsrf } from "@/lib/csrf";
import { previewPinAssignment, applyPinAssignment, getPinScenario, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Preview the assumed-PIN assignment totals (read-only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const caseStudyId = (sp.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const includeEstimated = sp.get("includeEstimated") !== "0";

  const [preview, scenario] = await Promise.all([
    previewPinAssignment(caseStudyId, pollType, includeEstimated),
    getPinScenario(caseStudyId, pollType),
  ]);
  return Response.json({ ok: preview.ok, preview, scenario }, { headers: { "Cache-Control": "no-store" } });
}

/** Commit the assumed-PIN scenario to storage + the embedded export row. */
export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const parsed = z.object({ caseStudyId: z.string().min(1).max(80), pollType: z.enum(["opinion", "exit"]).optional(), includeEstimated: z.boolean().optional(), confirm: z.literal(true) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const caseStudyId = parsed.data.caseStudyId;
  const pollType = parsed.data.pollType === "opinion" ? "opinion" : "exit";
  const includeEstimated = parsed.data.includeEstimated !== false;

  const preview = await applyPinAssignment(caseStudyId, pollType, includeEstimated);
  return Response.json({ ok: preview.ok, preview }, { status: preview.ok ? 200 : 500 });
}
