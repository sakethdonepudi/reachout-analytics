import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { summary, partyShares, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const caseStudyId = (sp.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });
  const scenario = sp.get("view") === "scenario";

  const [opinion, exit] = await Promise.all([summary(caseStudyId, "opinion"), summary(caseStudyId, "exit")]);
  const [opinionShares, exitShares] = await Promise.all([partyShares(caseStudyId, "opinion", scenario), partyShares(caseStudyId, "exit", scenario)]);
  return Response.json({ ok: true, caseStudyId, view: scenario ? "scenario" : "recorded", opinion, exit, opinionShares, exitShares });
}
