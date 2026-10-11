import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDisplayBasis, setDisplayBasis, isConfigured, type DisplayBasis } from "@/lib/poll-store";

export const runtime = "nodejs";

/** Admin-configured case display settings (currently the district dataset basis). */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const caseStudyId = (new URL(req.url).searchParams.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  return Response.json({ ok: true, caseStudyId, displayBasis: await getDisplayBasis(caseStudyId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  let body: { caseStudyId?: string; displayBasis?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
  const caseStudyId = String(body.caseStudyId ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const displayBasis: DisplayBasis = body.displayBasis === "estimated" ? "estimated" : "recorded";
  await setDisplayBasis(caseStudyId, displayBasis);
  return Response.json({ ok: true, caseStudyId, displayBasis });
}
