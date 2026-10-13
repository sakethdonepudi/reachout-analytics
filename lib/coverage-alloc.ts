/* =====================================================================
   Missing-geography coverage allocation.

   Rule (fixed, not a fallback):
     1. Canonicalise district names and count VALID party responses per district.
     2. Zero-response districts = reference districts with 0 valid responses.
     3. Eligible records = valid responses where BOTH the original District and
        Assembly Constituency are blank, and which have NO existing allocation /
        estimate in the same displayed dataset (never reused).
     4. Distribute eligible records EVENLY across the zero-response districts,
        preserving known survey-zone restrictions where a zone→district map
        exists, balanced per party group, deterministic by Response ID, integer
        remainder allocated deterministically.
     5. If there are NO zero-response districts, make NO allocation (records stay
        statewide-only). This rule never fills low-sample districts.

   Assignment only records a destination ("Allocated District"); the original
   blank District/AC are preserved and no constituency is invented.
   ===================================================================== */

import { canonicalDistrictName, referenceDistrictNames } from "./pin";
import { POSTAL_REFERENCE } from "./data/tamil-nadu-pincodes";

export const COVERAGE_METHOD = "even-distribution-over-zero-response-districts";
/** v2: estimate-bearing blank-geography records are INCLUDED (replacement pool). */
export const COVERAGE_VERSION = "coverage-v2";

export type CoverageRow = {
  responseId: string;
  district: string;
  ac: string;
  party: string;
  zone: string;
  status: string;
  /** Existing allocation/estimate already present in the displayed dataset. */
  allocatedDistrict?: string;
  estimatedDistrict?: string;
};

export type CoverageAllocation = {
  zeroDistricts: string[];
  eligible: number;
  /** Eligible records that previously carried an estimate (replacement pool). */
  replacesEstimated: number;
  allocated: number;
  unassigned: number;
  byDistrict: { district: string; count: number }[];
  byParty: Record<string, number>;
  /** Per-record destination for the write path. */
  assignments: { responseId: string; district: string }[];
  note: string;
  method: string;
  version: string;
  source: string;
};

const fnv1a = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

/**
 * Zero-response-district target pool for a zone. No bundled zone→district map is
 * available, so every zero-response district is eligible (documented); supply a
 * map to restrict.
 */
export function zoneEligibleDistricts(zone: string, zeroDistricts: string[]): string[] {
  void zone;
  return zeroDistricts;
}

export function allocateMissingGeography(
  rows: CoverageRow[],
  opts: { referenceDistricts?: string[] } = {},
): CoverageAllocation {
  const refs = opts.referenceDistricts ?? referenceDistrictNames();

  const validByDistrict = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "valid") continue;
    const d = canonicalDistrictName(r.district);
    if (d) validByDistrict.set(d, (validByDistrict.get(d) ?? 0) + 1);
  }
  const zeroDistricts = refs.filter((d) => (validByDistrict.get(d) ?? 0) === 0).sort();

  // Eligible = valid responses with BOTH original district and AC blank, that
  // do NOT already carry a coverage allocation (never reused). Records with a
  // previous ESTIMATE are INCLUDED — a replacement version supersedes it rather
  // than silently excluding them.
  const eligible = rows.filter((r) =>
    r.status === "valid" &&
    !String(r.district ?? "").trim() &&
    !String(r.ac ?? "").trim() &&
    !String(r.allocatedDistrict ?? "").trim(),
  );
  const replacesEstimated = eligible.filter((r) => String(r.estimatedDistrict ?? "").trim() !== "").length;

  const base: CoverageAllocation = {
    zeroDistricts,
    eligible: eligible.length,
    replacesEstimated,
    allocated: 0,
    unassigned: eligible.length,
    byDistrict: [],
    byParty: {},
    assignments: [],
    note: "",
    method: COVERAGE_METHOD,
    version: COVERAGE_VERSION,
    source: POSTAL_REFERENCE.name,
  };

  // No zero-response districts → make NO allocation (statewide-only).
  if (zeroDistricts.length === 0) {
    return { ...base, note: "No zero-response districts found" };
  }

  // Group eligible records by (zone, party) and distribute evenly.
  const groups = new Map<string, CoverageRow[]>();
  for (const r of eligible) {
    const key = `${r.zone ?? ""}|${r.party ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const byDistrict = new Map<string, number>();
  const byParty: Record<string, number> = {};
  const assignments: { responseId: string; district: string }[] = [];
  let allocated = 0;
  for (const [key, list] of groups) {
    list.sort((a, b) => (a.responseId < b.responseId ? -1 : a.responseId > b.responseId ? 1 : 0));
    const pool = zoneEligibleDistricts(list[0].zone ?? "", zeroDistricts);
    if (pool.length === 0) continue;
    const offset = fnv1a(key) % pool.length;
    list.forEach((r, i) => {
      const district = pool[(offset + i) % pool.length];
      byDistrict.set(district, (byDistrict.get(district) ?? 0) + 1);
      byParty[r.party] = (byParty[r.party] ?? 0) + 1;
      assignments.push({ responseId: r.responseId, district });
      allocated++;
    });
  }

  return {
    ...base,
    allocated,
    unassigned: eligible.length - allocated,
    byDistrict: [...byDistrict.entries()].map(([district, count]) => ({ district, count })).sort((a, b) => a.district.localeCompare(b.district)),
    byParty,
    assignments,
    note: allocated === 0 ? "No allocation produced" : "",
  };
}
