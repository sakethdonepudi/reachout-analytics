import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { pinAggregates, assumedPinAggregates, isConfigured } from "@/lib/poll-store";

export const runtime = "nodejs";

/**
 * Public per-PIN survey aggregates for a PUBLISHED case study.
 * Scoped to case study + poll type + the active published dataset + geography
 * basis. Returns aggregates only (never raw records). A PIN resolves to a
 * filter bucket whenever it appears in the imported responses; a marker is
 * only plotted when a reliable postal-location reference exists, so
 * `locationAvailable` is reported per PIN and is false when there are no
 * reliable coordinates.
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
  const assumed = basis === "assumed";
  const agg = assumed ? await assumedPinAggregates(rec.id, pollType) : await pinAggregates(rec.id, pollType, basis === "estimated");

  const pins = agg.pins.map((p) => {
    const district = Object.entries(p.districts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      pin: p.pin,
      total: p.total,
      valid: p.valid,
      parties: p.parties,
      district,
      // No authoritative PIN → coordinate reference is bundled, so markers are
      // never fabricated from districts; the filter row states this explicitly.
      locationAvailable: false,
    };
  });

  const message = pins.length === 0
    ? assumed
      ? "No assumed PINs are available yet — run the Assumed PIN scenario in the admin portal."
      : "This uploaded dataset contains no PIN codes"
    : null;

  return Response.json(
    {
      ok: true, published: true, caseStudyId: rec.id, pollType, basis, assumed,
      scenarioNote: assumed
        ? "Assumed PIN scenario — respondent PINs were assigned from a district-based assumption, not measured local coverage."
        : null,
      pins,
      usablePins: pins.length,
      withPin: agg.withPin,
      withoutPin: agg.withoutPin,
      invalidPinResponses: agg.invalidPinResponses,
      total: agg.total,
      valid: agg.valid,
      message,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
