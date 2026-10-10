import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { pinAggregates, isConfigured } from "@/lib/poll-store";

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
  const basis = sp.get("basis") === "estimated" ? "estimated" : "recorded";
  const agg = await pinAggregates(rec.id, pollType, basis === "estimated");

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

  return Response.json(
    {
      ok: true, published: true, caseStudyId: rec.id, pollType, basis,
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
