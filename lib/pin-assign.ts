/* =====================================================================
   Assumed-geography allocation (optional, deterministic, non-mutating).

   Order of resolution per record:
   1. A valid recorded PIN is preserved (Recorded PIN / Reference-derived)
      and is never re-assigned.
   2. An existing versioned allocation is reused (not allocated twice).
   3. No PIN but a usable district: eligible PINs come from a sourced
      constituency→postal crosswalk when one exists, otherwise from the
      verified district PIN candidates ("District-based assumption").
      Responses are split EVENLY across the eligible PINs, separately within
      each party group, in stable Response-ID order.
   4. Still unassigned but a known zone: a separate, documented COVERAGE
      scenario distributes Responses deterministically across all eligible
      districts (including districts with zero recorded responses).
   5. Otherwise unassigned and explicitly modelled ("Insufficient information").

   Original PINs, district fields, party choices and Response IDs are never
   changed; allocations live only in separate scenario fields. Selection never
   depends on party results, so it cannot be calibrated to outcomes.
   ===================================================================== */

import { classifyPin, normalizePin, isSixDigitPin, candidatePinsForDistrict, districtForPin, canonicalDistrictKey, referenceDistrictNames, referenceAudit } from "./pin";
import { crosswalkPinsForConstituency, AC_CROSSWALK_SOURCE, crosswalkCoverage } from "./data/tamil-nadu-ac-crosswalk";
import { POSTAL_REFERENCE } from "./data/tamil-nadu-pincodes";

export const PIN_ALLOCATION_VERSION = "assumed-pin-v2";

export type PinBasis =
  | "recorded"
  | "reference-derived"
  | "district-assumption"
  | "estimated-district-assumption"
  | "coverage-zone-assumption"
  | "unassigned";

export const PIN_BASIS_LABEL: Record<PinBasis, string> = {
  recorded: "Recorded PIN",
  "reference-derived": "Reference-derived",
  "district-assumption": "District-based assumption",
  "estimated-district-assumption": "Estimated district-based assumption",
  "coverage-zone-assumption": "Coverage/zone-based assumption",
  unassigned: "Unassigned",
};

export type PinDistrictBasis = "recorded" | "estimated" | "coverage" | "none";
export type PinEligibleSource = "recorded-pin" | "reused" | "constituency-crosswalk" | "district-reference" | "coverage-zone" | "none";

const ALLOCATION_BASES = new Set<PinBasis>(["district-assumption", "estimated-district-assumption", "coverage-zone-assumption"]);

export type AllocInput = {
  responseId: string;
  pin: unknown;
  recordedDistrict: string;
  estimatedDistrict: string;
  scenarioDistrict: string;
  assemblyConstituency?: string;
  zone?: string;
  status?: string;
  party?: string;
  /** Existing versioned allocation (reused, not re-allocated). */
  existingAssumedPin?: string;
  existingBasis?: string;
  existingSource?: string;
  existingMethod?: string;
  existingVersion?: string;
  existingDistrictBasis?: string;
  existingDistrict?: string;
};

export type AssignedRecord = {
  responseId: string;
  assumedPin: string;
  basis: PinBasis;
  basisLabel: string;
  source: string;
  method: string;
  allocationVersion: string;
  assignmentSource: PinEligibleSource;
  district: string;
  districtBasis: PinDistrictBasis;
  party: string;
  status: string;
};

export type PinAllocationOptions = { includeEstimated?: boolean };

const canon = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Eligible PINs for a record: constituency crosswalk first, else district. */
export function eligiblePinsForRecord(recordedDistrict: string, ac: string): { pins: string[]; source: "constituency-crosswalk" | "district-reference" } {
  const acPins = crosswalkPinsForConstituency(ac);
  if (acPins.length) {
    const valid = [...new Set(acPins.filter((p) => isSixDigitPin(normalizePin(p))).map((p) => normalizePin(p)))].sort();
    if (valid.length) return { pins: valid, source: "constituency-crosswalk" };
  }
  return { pins: candidatePinsForDistrict(recordedDistrict), source: "district-reference" };
}

function fnv1aOf(s: string) { return fnv1a(s); }

/** Classify a record that is not part of the even allocation. */
export function assignPinForRecord(input: Omit<AllocInput, "status" | "party">): {
  assumedPin: string; basis: PinBasis; basisLabel: string; source: string; method: string;
} {
  const recorded = String(input.recordedDistrict ?? "").trim();
  const cls = classifyPin(input.pin);
  if (cls.format === "ok") {
    const refDistrict = districtForPin(cls.normalized);
    if (refDistrict && recorded && canonicalDistrictKey(refDistrict) === canonicalDistrictKey(recorded)) {
      return { assumedPin: cls.normalized, basis: "reference-derived", basisLabel: PIN_BASIS_LABEL["reference-derived"], source: POSTAL_REFERENCE.name, method: "Verified PIN↔district reference match" };
    }
    return { assumedPin: cls.normalized, basis: "recorded", basisLabel: PIN_BASIS_LABEL.recorded, source: "Respondent-supplied", method: "Preserved supplied PIN" };
  }
  return { assumedPin: "", basis: "unassigned", basisLabel: PIN_BASIS_LABEL.unassigned, source: "", method: "None" };
}

export function allocatePinAssignments(rows: AllocInput[], opts: PinAllocationOptions = {}): AssignedRecord[] {
  const includeEstimated = opts.includeEstimated ?? true;
  const base: AssignedRecord[] = new Array(rows.length);

  const make = (r: AllocInput, extra: Partial<AssignedRecord> & { assumedPin: string; basis: PinBasis }): AssignedRecord => ({
    responseId: String(r.responseId ?? ""),
    assumedPin: extra.assumedPin,
    basis: extra.basis,
    basisLabel: PIN_BASIS_LABEL[extra.basis],
    source: extra.source ?? "",
    method: extra.method ?? "None",
    allocationVersion: extra.allocationVersion ?? PIN_ALLOCATION_VERSION,
    assignmentSource: extra.assignmentSource ?? "none",
    district: extra.district ?? "",
    districtBasis: extra.districtBasis ?? "none",
    party: String(r.party ?? ""),
    status: String(r.status ?? ""),
  });

  type Pending = { rowIndex: number; district: string; districtKey: string; districtBasis: "recorded" | "estimated"; source: "constituency-crosswalk" | "district-reference"; pins: string[]; responseId: string };
  const pending = new Map<string, Pending[]>();
  type Coverage = { rowIndex: number; responseId: string };
  const coverage = new Map<string, Coverage[]>();

  rows.forEach((r, i) => {
    const recorded = String(r.recordedDistrict ?? "").trim();
    const estimated = String(r.estimatedDistrict ?? "").trim();
    const scenario = String(r.scenarioDistrict ?? "").trim();
    const ac = String(r.assemblyConstituency ?? "").trim();
    const zone = String(r.zone ?? "").trim();
    const cls = classifyPin(r.pin);

    // 1. recorded PIN
    if (cls.format === "ok") {
      const refDistrict = districtForPin(cls.normalized);
      const confirmed = refDistrict && recorded && canonicalDistrictKey(refDistrict) === canonicalDistrictKey(recorded);
      base[i] = make(r, confirmed
        ? { assumedPin: cls.normalized, basis: "reference-derived", source: POSTAL_REFERENCE.name, method: "Verified PIN↔district reference match", district: recorded, districtBasis: "recorded", assignmentSource: "recorded-pin" }
        : { assumedPin: cls.normalized, basis: "recorded", source: "Respondent-supplied", method: "Preserved supplied PIN", district: recorded, districtBasis: recorded ? "recorded" : "none", assignmentSource: "recorded-pin" });
      return;
    }

    // 2. reuse an existing versioned allocation
    const exPin = String(r.existingAssumedPin ?? "").trim();
    const exBasis = String(r.existingBasis ?? "") as PinBasis;
    if (exPin && ALLOCATION_BASES.has(exBasis) && r.existingVersion) {
      base[i] = make(r, {
        assumedPin: exPin, basis: exBasis,
        source: r.existingSource || POSTAL_REFERENCE.name,
        method: r.existingMethod || "Reused existing versioned assignment",
        allocationVersion: r.existingVersion,
        assignmentSource: "reused",
        district: (r.existingDistrict || scenario || estimated || recorded),
        districtBasis: (r.existingDistrictBasis as PinDistrictBasis) || "none",
      });
      return;
    }

    // 3. district / constituency eligible allocation
    const useEstimated = includeEstimated && !recorded;
    const district = recorded || (useEstimated ? (scenario || estimated) : "");
    if (district) {
      const { pins, source } = eligiblePinsForRecord(district, ac);
      if (pins.length) {
        const districtBasis: "recorded" | "estimated" = recorded ? "recorded" : "estimated";
        const key = `${canonicalDistrictKey(district)}|${districtBasis}|${canon(String(r.party ?? ""))}|${source}|${pins.join(",")}`;
        const list = pending.get(key) ?? [];
        list.push({ rowIndex: i, district, districtKey: canonicalDistrictKey(district), districtBasis, source, pins, responseId: String(r.responseId ?? "") });
        pending.set(key, list);
        return;
      }
    }

    // 4. coverage scenario when a zone is known
    if (zone) {
      const key = `${canon(zone)}|${canon(String(r.party ?? ""))}`;
      const list = coverage.get(key) ?? [];
      list.push({ rowIndex: i, responseId: String(r.responseId ?? "") });
      coverage.set(key, list);
      return;
    }

    // 5. unassigned
    base[i] = make(r, { assumedPin: "", basis: "unassigned", method: district ? "No eligible PINs for the district" : "Insufficient geographic information", district, districtBasis: "none" });
  });

  // 3b. even round-robin within each (district, party, eligible-set) group
  for (const [groupKey, list] of pending) {
    list.sort((a, b) => (a.responseId < b.responseId ? -1 : a.responseId > b.responseId ? 1 : a.rowIndex - b.rowIndex));
    const pins = list[0].pins;
    const offset = fnv1aOf(groupKey) % pins.length;
    list.forEach((item, k) => {
      const basis: PinBasis = item.districtBasis === "estimated" ? "estimated-district-assumption" : "district-assumption";
      base[item.rowIndex] = make(rows[item.rowIndex], {
        assumedPin: pins[(offset + k) % pins.length],
        basis,
        source: item.source === "constituency-crosswalk" ? AC_CROSSWALK_SOURCE.name : POSTAL_REFERENCE.name,
        method: item.source === "constituency-crosswalk"
          ? "Even allocation within party group (constituency crosswalk)"
          : "Even allocation within party group (district reference)",
        assignmentSource: item.source,
        district: item.district,
        districtBasis: item.districtBasis,
      });
    });
  }

  // 4b. coverage scenario: distribute across ALL eligible districts, evenly
  const pool = referenceDistrictNames();
  for (const [groupKey, list] of coverage) {
    list.sort((a, b) => (a.responseId < b.responseId ? -1 : a.responseId > b.responseId ? 1 : a.rowIndex - b.rowIndex));
    const dOffset = fnv1aOf(`coverage:${groupKey}`) % pool.length;
    list.forEach((item, k) => {
      const district = pool[(dOffset + k) % pool.length];
      const pins = candidatePinsForDistrict(district);
      const pin = pins[fnv1aOf(`pin:${groupKey}:${item.responseId}`) % pins.length];
      base[item.rowIndex] = make(rows[item.rowIndex], {
        assumedPin: pin,
        basis: "coverage-zone-assumption",
        source: POSTAL_REFERENCE.name,
        method: "Documented coverage rule: Response-ID order over known zone, distributed across all eligible districts",
        assignmentSource: "coverage-zone",
        district,
        districtBasis: "coverage",
      });
    });
  }

  return base;
}

/* ---- preview summary ------------------------------------------------- */

export type DistrictAllocBlock = {
  district: string;
  districtBasis: "recorded" | "estimated" | "coverage" | "mixed" | "none";
  total: number; valid: number; recordedPin: number; assigned: number; unresolved: number;
  byParty: Record<string, number>;
  byPin: { pin: string; total: number; valid: number; parties: Record<string, number> }[];
};

export type PinAllocationSummary = {
  total: number;
  valid: number;
  recordedPin: number;
  eligible: number;
  assigned: number;
  unresolved: number;
  coverageAssigned: number;
  byBasis: Record<PinBasis, number>;
  byEligibleSource: Record<PinEligibleSource, number>;
  byParty: Record<string, number>;
  byDistrict: DistrictAllocBlock[];
  districtsWithoutCandidates: string[];
  unresolvedGeography: { noDistrict: number; noCandidates: string[] };
  ambiguousPins: string[];
  reference: { name: string; source: string; version: string; note: string };
  crosswalk: { constituencies: number; version: string; source: string };
  allocationVersion: string;
  reconcile: { assignedPlusUnresolved: number; eligible: number; ok: boolean; partyOk: boolean; pinDistrictOk: boolean };
};

const RECORDED_BASES = new Set<PinBasis>(["recorded", "reference-derived"]);

export function summarizeAllocation(records: AssignedRecord[]): PinAllocationSummary {
  const byBasis: Record<PinBasis, number> = { recorded: 0, "reference-derived": 0, "district-assumption": 0, "estimated-district-assumption": 0, "coverage-zone-assumption": 0, unassigned: 0 };
  const byEligibleSource: Record<PinEligibleSource, number> = { "recorded-pin": 0, reused: 0, "constituency-crosswalk": 0, "district-reference": 0, "coverage-zone": 0, none: 0 };
  let total = 0, valid = 0, recordedPin = 0, assigned = 0, unresolved = 0, coverageAssigned = 0, noDistrict = 0;
  const byParty: Record<string, number> = {};
  const districts = new Map<string, DistrictAllocBlock>();
  const noCandidates = new Set<string>();

  for (const r of records) {
    total += 1;
    byBasis[r.basis] += 1;
    byEligibleSource[r.assignmentSource] += 1;
    if (RECORDED_BASES.has(r.basis)) recordedPin += 1;
    else if (r.basis === "unassigned") { unresolved += 1; if (!r.district) noDistrict += 1; }
    else { assigned += 1; if (r.basis === "coverage-zone-assumption") coverageAssigned += 1; }

    const isValid = r.status === "valid";
    if (isValid) {
      valid += 1;
      const p = r.party || "Unknown";
      byParty[p] = (byParty[p] ?? 0) + 1;
    }

    const dName = r.district || "Unassigned";
    const block = districts.get(dName) ?? { district: r.district, districtBasis: "none", total: 0, valid: 0, recordedPin: 0, assigned: 0, unresolved: 0, byParty: {}, byPin: [] };
    block.total += 1;
    if (isValid) { block.valid += 1; const p = r.party || "Unknown"; block.byParty[p] = (block.byParty[p] ?? 0) + 1; }
    if (RECORDED_BASES.has(r.basis)) block.recordedPin += 1;
    else if (r.basis === "unassigned") block.unresolved += 1;
    else block.assigned += 1;
    if (r.district) block.districtBasis = block.districtBasis === "none" || block.districtBasis === r.districtBasis ? r.districtBasis : "mixed";
    if (r.assumedPin) {
      let pinBlock = block.byPin.find((b) => b.pin === r.assumedPin);
      if (!pinBlock) { pinBlock = { pin: r.assumedPin, total: 0, valid: 0, parties: {} }; block.byPin.push(pinBlock); }
      pinBlock.total += 1;
      if (isValid) { pinBlock.valid += 1; const p = r.party || "Unknown"; pinBlock.parties[p] = (pinBlock.parties[p] ?? 0) + 1; }
    }
    if (r.basis === "unassigned" && r.district && candidatePinsForDistrict(r.district).length === 0) noCandidates.add(r.district);
    districts.set(dName, block);
  }

  const eligible = total - recordedPin;
  const byDistrict = [...districts.values()].sort((a, b) => a.district.localeCompare(b.district));
  for (const b of byDistrict) b.byPin.sort((a, c) => a.pin.localeCompare(c.pin));

  const partySum = Object.values(byParty).reduce((a, b) => a + b, 0);
  const districtPartySum = byDistrict.reduce((a, b) => a + Object.values(b.byParty).reduce((x, y) => x + y, 0), 0);
  // PIN totals reconcile with district totals when, per district, the sum of its
  // PIN buckets equals the district's assigned + recorded-PIN rows (its total
  // minus unresolved). This holds for every district.
  const pinDistrictOk = byDistrict.every((b) => {
    const pinSum = b.byPin.reduce((x, p) => x + p.total, 0);
    return pinSum === b.total - b.unresolved;
  });
  const cw = crosswalkCoverage();

  return {
    total, valid, recordedPin, eligible, assigned, unresolved, coverageAssigned,
    byBasis, byEligibleSource, byParty, byDistrict,
    districtsWithoutCandidates: [...noCandidates].sort(),
    unresolvedGeography: { noDistrict, noCandidates: [...noCandidates].sort() },
    ambiguousPins: referenceAudit().ambiguousPins,
    reference: { name: POSTAL_REFERENCE.name, source: POSTAL_REFERENCE.source, version: POSTAL_REFERENCE.version, note: POSTAL_REFERENCE.note },
    crosswalk: { constituencies: cw.constituencies, version: cw.version, source: AC_CROSSWALK_SOURCE.source },
    allocationVersion: PIN_ALLOCATION_VERSION,
    reconcile: {
      assignedPlusUnresolved: assigned + unresolved,
      eligible,
      ok: assigned + unresolved === eligible,
      partyOk: partySum === valid && districtPartySum === valid,
      pinDistrictOk,
    },
  };
}
