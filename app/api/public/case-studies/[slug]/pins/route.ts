import type { NextRequest } from "next/server";
import { getCase } from "@/lib/case-registry";
import { pinAggregates, assumedPinDetails, isConfigured } from "@/lib/poll-store";
import { coordinatesForPin, candidatePinsForDistrict, referenceDistrictNames, pointInDistrict } from "@/lib/pin";
import { PIN_COORDINATE_COVERAGE } from "@/lib/data/tamil-nadu-pin-coordinates";

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
    const allocated = new Map(res.pins.map((p) => [p.pin, p]));

    const buildPin = (pin: string, district: string | null) => {
      const a = allocated.get(pin);
      const coord = coordinatesForPin(pin);
      const dName = a?.district ?? district ?? "";
      // A postal coordinate that falls outside its assigned district geometry is
      // flagged for review and kept in the list (never forced onto the map).
      const inDistrict = coord ? pointInDistrict(coord.lng, coord.lat, dName) : false;
      return {
        pin,
        district: a?.district ?? district ?? null,
        total: a?.total ?? 0,
        valid: a?.valid ?? 0,
        parties: a?.parties ?? {},
        districtBasis: a?.districtBasis ?? "",
        basis: a?.basisLabel ?? "",
        basisKey: a?.basis ?? "",
        source: a?.source ?? "",
        method: a?.method ?? "",
        allocationVersion: a?.allocationVersion ?? null,
        allocated: !!a && a.total > 0,
        // Postal-area reference coordinate (post-office locality), not a respondent location.
        locationAvailable: !!coord && inDistrict,
        coordinateReview: !!coord && !inDistrict,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        postalPlace: coord?.place ?? null,
        coordSource: coord?.src ?? null,
      };
    };

    // Every bundled reference PIN appears in its district list, including
    // zero-allocation ones (the bundled set is a subset, not the full directory).
    const pins: ReturnType<typeof buildPin>[] = [];
    const seen = new Set<string>();
    if (rec.id === "tamil-nadu") {
      for (const district of referenceDistrictNames()) {
        for (const pin of candidatePinsForDistrict(district)) {
          if (seen.has(pin)) continue;
          seen.add(pin);
          pins.push(buildPin(pin, district));
        }
      }
    }
    for (const p of res.pins) if (!seen.has(p.pin)) pins.push(buildPin(p.pin, p.district));

    const allocatedPins = pins.filter((p) => p.allocated).length;
    const withCoordinates = pins.filter((p) => p.locationAvailable).length;
    const s = res.scenario;
    const committed = !!s;
    return Response.json(
      {
        ok: true, published: true, caseStudyId: rec.id, pollType, basis, assumed: true,
        committed,
        // The list contains every bundled reference PIN; usablePins counts only
        // those with allocated/recorded responses; allocatedPins is the same.
        usablePins: allocatedPins,
        allocatedPins,
        referencePinsTotal: pins.length,
        referenceComplete: false,
        withCoordinates,
        coordinateCoverage: PIN_COORDINATE_COVERAGE,
        reference: s?.summary?.reference ?? null,
        allocationVersion: s?.allocationVersion ?? null,
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
        total: res.total,
        valid: res.valid,
        message: !committed && allocatedPins === 0 ? "PIN breakdown not generated yet." : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const agg = await pinAggregates(rec.id, pollType, basis === "estimated");
  const pins = agg.pins.map((p) => {
    const district = Object.entries(p.districts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const coord = coordinatesForPin(p.pin);
    const inDistrict = coord ? pointInDistrict(coord.lng, coord.lat, district ?? "") : false;
    return { pin: p.pin, total: p.total, valid: p.valid, parties: p.parties, district, locationAvailable: !!coord && inDistrict, coordinateReview: !!coord && !inDistrict, lat: coord?.lat ?? null, lng: coord?.lng ?? null, postalPlace: coord?.place ?? null };
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
