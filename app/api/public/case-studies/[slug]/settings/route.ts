import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { getDisplayBasis, isConfigured } from "@/lib/poll-store";
import type { DisplayBasis } from "@/lib/poll-store";
import { requireRole } from "@/lib/auth";
import { denyCase } from "@/lib/session-scope";

export const runtime = "nodejs";

/**
 * Public display settings for a case study. Currently the district dataset basis
 * (recorded / estimated), configured by an admin. Not sensitive; carries no
 * survey figures. The dashboard uses it instead of a public basis control.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const { slug } = await params;
  const denied = denyCase(auth.session, slug);
  if (denied) return denied;
  const rec = await getCase(slug);
  if (!rec) return Response.json({ ok: false, error: "Unknown case study" }, { status: 404 });
  const displayBasis: DisplayBasis = (await isConfigured()) ? await getDisplayBasis(rec.id) : "recorded";
  return Response.json({ ok: true, caseStudyId: rec.id, displayBasis }, { headers: { "Cache-Control": "no-store" } });
}
