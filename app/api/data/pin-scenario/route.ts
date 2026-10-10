import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
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

  const [preview, scenario] = await Promise.all([
    previewPinAssignment(caseStudyId, pollType),
    getPinScenario(caseStudyId, pollType),
  ]);
  return Response.json({ ok: preview.ok, preview, scenario }, { headers: { "Cache-Control": "no-store" } });
}

/** Commit the assumed-PIN scenario to storage + the embedded export row. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  let body: { caseStudyId?: string; pollType?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  const caseStudyId = String(body.caseStudyId ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const pollType = body.pollType === "opinion" ? "opinion" : "exit";

  const preview = await applyPinAssignment(caseStudyId, pollType);
  return Response.json({ ok: preview.ok, preview }, { status: preview.ok ? 200 : 500 });
}
