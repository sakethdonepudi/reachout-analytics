import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { requireCsrf } from "@/lib/csrf";
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
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const parsed = z.object({ caseStudyId: z.string().min(1).max(80), displayBasis: z.enum(["recorded", "estimated"]).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const caseStudyId = parsed.data.caseStudyId;
  const displayBasis: DisplayBasis = parsed.data.displayBasis === "estimated" ? "estimated" : "recorded";
  await setDisplayBasis(caseStudyId, displayBasis);
  return Response.json({ ok: true, caseStudyId, displayBasis });
}
