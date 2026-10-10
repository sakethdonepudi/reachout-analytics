import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { pinAggregates, assumedPinDetails, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

/**
 * Public per-PIN survey aggregates for a PUBLISHED case study.
 * Scoped to case study + poll type + the active published dataset + geography
 * basis. Returns aggregates only (never raw records). A marker is only plotted
 * when a reliable postal-location reference exists, so `locationAvailable` is
 * reported per PIN and is false when there are no reliable coordinates.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rec = await getCase(slug);
  if (!rec) return Response.json({ ok: false, error: "Unknown case study" }, { status: 404 });
  if (!rec.published) return Response.json({ ok: true, published: false, pins: [], usablePins: 0 });
  if (!(await isConfigured())) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const sp = new URL(req.url).searchParams;
  const pollType = sp.get("pollType") === "opinion" ? "opinion" : "exit";
  const basisParam = sp.get("basis");
  const basis = basisParam === "estimated" ? "estimated" : basisParam === "assumed" ? "assumed" : "recorded";

  if (basis === "assumed") {
    const res = await assumedPinDetails(rec.id, pollType);
    const pins = res.pins.map((p) => ({
      pin: p.pin,
      total: p.total,
      valid: p.valid,
      parties: p.parties,
      district: p.district,
      districtBasis: p.districtBasis,
      basis: p.basisLabel,
      basisKey: p.basis,
      source: p.source,
      method: p.method,
      allocationVersion: p.allocationVersion,
      // Verified coordinates are not bundled, so no markers are fabricated.
      locationAvailable: false,
    }));
    const s = res.scenario;
    return Response.json(
      {
        ok: true, published: true, caseStudyId: rec.id, pollType, basis, assumed: true,
        scenarioNote:
          "PIN locations are assumed from district information. These figures illustrate an allocation scenario and do not measure actual PIN-level voting patterns.",
        reference: s?.summary?.reference ?? null,
        allocationVersion: s?.allocationVersion ?? res.pins[0]?.allocationVersion ?? null,
        scenario: s
          ? {
              appliedAt: s.appliedAt,
              importId: s.importId,
              includeEstimated: s.includeEstimated,
              eligible: s.summary?.eligible ?? 0,
              assigned: s.summary?.assigned ?? 0,
              unresolved: s.summary?.unresolved ?? 0,
              recordedPin: s.summary?.recordedPin ?? 0,
            }
          : null,
        pins,
        usablePins: pins.length,
        total: res.total,
        valid: res.valid,
        message: pins.length === 0 ? "No assumed PINs are available yet — run the Assumed PIN scenario in the admin portal." : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const agg = await pinAggregates(rec.id, pollType, basis === "estimated");
  const pins = agg.pins.map((p) => {
    const district = Object.entries(p.districts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { pin: p.pin, total: p.total, valid: p.valid, parties: p.parties, district, locationAvailable: false };
  });

  return Response.json(
    {
      ok: true, published: true, caseStudyId: rec.id, pollType, basis, assumed: false,
      scenarioNote: null,
      pins,
      usablePins: pins.length,
      withPin: agg.withPin,
      withoutPin: agg.withoutPin,
      invalidPinResponses: agg.invalidPinResponses,
      total: agg.total,
      valid: agg.valid,
      message: pins.length === 0 ? "This uploaded dataset contains no PIN codes" : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
