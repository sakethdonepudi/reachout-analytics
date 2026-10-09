import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { history } from "@/lib/poll-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const caseStudyId = new URL(req.url).searchParams.get("caseStudyId");
  const rows = await history(caseStudyId && caseStudyId.trim() ? caseStudyId.trim() : null, 50);
  return Response.json({ ok: true, history: rows });
}
