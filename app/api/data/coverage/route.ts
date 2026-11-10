import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { requireCsrf } from "@/lib/csrf";
import { previewCoverageAllocation, applyCoverageAllocation, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Preview the missing-geography coverage allocation (read-only). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const caseStudyId = (sp.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const preview = await previewCoverageAllocation(caseStudyId, pollType);
  return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
}

/** Apply the coverage allocation (no-op when there are no zero-response districts). */
export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const parsed = z.object({ caseStudyId: z.string().min(1).max(80), pollType: z.enum(["opinion", "exit"]).optional(), confirm: z.literal(true) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const caseStudyId = parsed.data.caseStudyId;
  const pollType = parsed.data.pollType === "opinion" ? "opinion" : "exit";
  const preview = await applyCoverageAllocation(caseStudyId, pollType);
  return Response.json(preview, { status: preview.ok ? 200 : 500 });
}
