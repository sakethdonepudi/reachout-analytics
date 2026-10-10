import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { districtAggregates, scenarioDistrictCounts, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

/**
 * Public per-district survey aggregates for a PUBLISHED case study.
 * Recorded geography by default; estimated scenario on request; the combined
 * assumed-PIN scenario (`basis=assumed`) returns scenario counts per district
 * split into recorded vs allocated. Aggregates only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = await getCase(slug);
  if (!rec) return Response.json({ ok: false, error: "Unknown case study" }, { status: 404 });
  if (!rec.published) return Response.json({ ok: true, published: false, districts: [] });
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const basisRaw = sp.get("basis");
  const basis = basisRaw === "estimated" ? "estimated" : basisRaw === "assumed" ? "assumed" : "recorded";

  if (basis === "assumed") {
    const sc = await scenarioDistrictCounts(rec.id, pollType);
    return Response.json(
      {
        ok: true, published: true, caseStudyId: rec.id, pollType, basis, assumed: true,
        districts: sc.districts.map((d) => ({ district: d.district, total: d.total, valid: d.total, recorded: d.recorded, allocated: d.allocated })),
        total: sc.total, valid: sc.total,
        recordedTotal: sc.recordedTotal, allocatedTotal: sc.allocatedTotal, unassigned: sc.unassigned,
        allocationVersion: sc.allocationVersion,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const agg = await districtAggregates(rec.id, pollType, basis === "estimated");
  return Response.json(
    { ok: true, published: true, caseStudyId: rec.id, pollType, basis, districts: agg.districts, total: agg.total, valid: agg.valid, byParty: agg.byParty },
    { headers: { "Cache-Control": "no-store" } },
  );
}
