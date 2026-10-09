import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { districtAggregates, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

/**
 * Public per-district survey aggregates for a PUBLISHED case study.
 * Recorded geography by default; estimated scenario on request. Aggregates only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = await getCase(slug);
  if (!rec) return Response.json({ ok: false, error: "Unknown case study" }, { status: 404 });
  if (!rec.published) return Response.json({ ok: true, published: false, districts: [] });
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const basis = sp.get("basis") === "estimated" ? "estimated" : "recorded";
  const agg = await districtAggregates(rec.id, pollType, basis === "estimated");
  return Response.json(
    { ok: true, published: true, caseStudyId: rec.id, pollType, basis, total: agg.total, valid: agg.valid, districts: agg.districts, byParty: agg.byParty },
    { headers: { "Cache-Control": "no-store" } },
  );
}
