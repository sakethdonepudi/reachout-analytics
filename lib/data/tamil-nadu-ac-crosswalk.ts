/* =====================================================================
   Constituency → postal-area crosswalk (optional, sourced).

   Postal and electoral boundaries overlap but are NOT identical, so
   constituency membership must never be inferred from district membership.
   A record only gets a constituency-narrowed PIN set when a reliable
   crosswalk entry exists for its assembly constituency.

   No authoritative crosswalk data file is bundled with this repository, so
   the table below is intentionally EMPTY and the allocation falls back to the
   verified district PIN candidates (labelled "District-based assumption").
   Supply a signed crosswalk (assembly constituency → PIN list) to enable the
   narrower path; the mechanism, source and version are already wired through.
   ===================================================================== */

export const AC_CROSSWALK_SOURCE = {
  name: "Assembly-constituency → postal-area crosswalk",
  source: "Election Commission of India AC list + India Post PIN directory (crosswalk to be supplied)",
  version: "ac-crosswalk-2026-02.0 (not bundled)",
  note:
    "No authoritative AC→PIN crosswalk is bundled. Constituency membership is never inferred from " +
    "district membership alone; when a constituency has no crosswalk entry the allocation uses the " +
    "verified district PIN candidates and is labelled 'District-based assumption'.",
} as const;

/** Canonical (lowercased, alphanumerics-only) assembly-constituency → PIN codes. */
export const CONSTITUENCY_CROSSWALK: Record<string, string[]> = {};

const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function crosswalkPinsForConstituency(ac: string): string[] {
  const key = canon(String(ac ?? ""));
  if (!key) return [];
  return CONSTITUENCY_CROSSWALK[key] ?? [];
}

export function crosswalkCoverage(): { constituencies: number; version: string } {
  return { constituencies: Object.keys(CONSTITUENCY_CROSSWALK).length, version: AC_CROSSWALK_SOURCE.version };
}
