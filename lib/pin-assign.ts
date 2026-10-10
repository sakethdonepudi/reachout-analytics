/* =====================================================================
   Assumed-PIN scenario (optional, deterministic, non-mutating).

   - The original "PIN Code" field and every party response are preserved.
   - A verified postal reference (lib/data/tamil-nadu-pincodes.ts) supplies
     candidate PINs per district.
   - A supplied PIN that the reference confirms for the stated district is
     recorded as a reference-derived mapping (with its source).
   - District-only records get a representative PIN chosen deterministically
     from the district's candidates — a SCENARIO assignment, not a recovered
     respondent location.
   - Records with no usable district stay unassigned.
   - Selection depends only on the response ID and the district — never on
     party or results — so party counts can never be forced to agree.
   ===================================================================== */

import { classifyPin, candidatePinsForDistrict, districtForPin } from "./pin";
import { POSTAL_REFERENCE } from "./data/tamil-nadu-pincodes";

export type PinBasis =
  | "recorded"
  | "reference-derived"
  | "district-assumption"
  | "estimated-district-assumption"
  | "unassigned";

export const PIN_BASIS_LABEL: Record<PinBasis, string> = {
  recorded: "Recorded PIN",
  "reference-derived": "Reference-derived",
  "district-assumption": "District-based assumption",
  "estimated-district-assumption": "Estimated district-based assumption",
  unassigned: "Unassigned",
};

export const PIN_ASSIGNED_BASES: PinBasis[] = [
  "recorded", "reference-derived", "district-assumption", "estimated-district-assumption",
];

export type PinAssignment = {
  /** "Assumed PIN Code" — empty when unassigned. */
  assumedPin: string;
  /** "PIN Geography Basis" */
  basis: PinBasis;
  basisLabel: string;
  /** "PIN Mapping Source" */
  source: string;
  /** "PIN Assignment Method" */
  method: string;
};

export type PinAssignInput = {
  responseId: string;
  pin: unknown;
  recordedDistrict: string;
  estimatedDistrict: string;
  scenarioDistrict: string;
};

/** Deterministic FNV-1a hash — stable across runs, servers and re-imports. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function assignPinForRecord(input: PinAssignInput): PinAssignment {
  const responseId = String(input.responseId ?? "");
  const recorded = String(input.recordedDistrict ?? "").trim();
  const estimated = String(input.estimatedDistrict ?? "").trim();
  const scenario = String(input.scenarioDistrict ?? "").trim();

  const cls = classifyPin(input.pin);
  if (cls.format === "ok") {
    const refDistrict = districtForPin(cls.normalized);
    if (refDistrict && recorded && refDistrict.toLowerCase() === recorded.toLowerCase()) {
      return {
        assumedPin: cls.normalized,
        basis: "reference-derived",
        basisLabel: PIN_BASIS_LABEL["reference-derived"],
        source: POSTAL_REFERENCE.name,
        method: "Verified PIN↔district reference match",
      };
    }
    return {
      assumedPin: cls.normalized,
      basis: "recorded",
      basisLabel: PIN_BASIS_LABEL.recorded,
      source: "Respondent-supplied",
      method: "Preserved supplied PIN",
    };
  }

  // District-only: choose a representative PIN deterministically.
  const useDistrict = recorded || scenario || estimated;
  const candidates = candidatePinsForDistrict(useDistrict);
  if (useDistrict && candidates.length > 0) {
    const idx = fnv1a(`${responseId}|${useDistrict}`) % candidates.length;
    const basis: PinBasis = recorded ? "district-assumption" : "estimated-district-assumption";
    return {
      assumedPin: candidates[idx],
      basis,
      basisLabel: PIN_BASIS_LABEL[basis],
      source: POSTAL_REFERENCE.name,
      method: recorded
        ? "Deterministic district candidate selection"
        : "Deterministic estimated-district candidate selection",
    };
  }

  return {
    assumedPin: "",
    basis: "unassigned",
    basisLabel: PIN_BASIS_LABEL.unassigned,
    source: "",
    method: "None",
  };
}

export type PinAssignmentRow = PinAssignInput & { status?: string; party?: string };

export type PinAssignmentSummary = {
  total: number;
  valid: number;
  byBasis: Record<PinBasis, number>;
  byParty: Record<string, number>;
  /** Distinct districts that have records but no candidates in the reference. */
  districtsWithoutCandidates: string[];
  reference: { name: string; source: string; note: string };
};

/**
 * Pure preview/commit planner. Party counts are derived from the same rows and
 * are invariant — assignment only adds fields.
 */
export function summarizeAssignments(rows: PinAssignmentRow[]): PinAssignmentSummary {
  const byBasis: Record<PinBasis, number> = {
    recorded: 0, "reference-derived": 0, "district-assumption": 0, "estimated-district-assumption": 0, unassigned: 0,
  };
  let total = 0, valid = 0;
  const byParty: Record<string, number> = {};
  const noCandidates = new Set<string>();

  for (const r of rows) {
    total += 1;
    const a = assignPinForRecord(r);
    byBasis[a.basis] += 1;
    if (a.basis === "unassigned") {
      const d = String(r.recordedDistrict || r.scenarioDistrict || r.estimatedDistrict || "").trim();
      if (d && candidatePinsForDistrict(d).length === 0) noCandidates.add(d);
    }
    if (r.status === "valid") {
      valid += 1;
      const p = r.party || "Unknown";
      byParty[p] = (byParty[p] ?? 0) + 1;
    }
  }
  return {
    total,
    valid,
    byBasis,
    byParty,
    districtsWithoutCandidates: [...noCandidates].sort(),
    reference: { name: POSTAL_REFERENCE.name, source: POSTAL_REFERENCE.source, note: POSTAL_REFERENCE.note },
  };
}
