import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listRecords } from "@/lib/poll-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  const sp = new URL(req.url).searchParams;
  const caseStudyId = (sp.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 50)));
  const skip = Math.max(0, Number(sp.get("skip") ?? 0));
  const filters = {
    party: sp.get("party") ?? "", status: sp.get("status") ?? "", geographyBasis: sp.get("geographyBasis") ?? "",
    district: sp.get("district") ?? "", q: sp.get("q") ?? "",
  };
  const { records, total } = await listRecords(caseStudyId, pollType, filters, limit, skip);
  return Response.json({ ok: true, total, limit, skip, records });
}
