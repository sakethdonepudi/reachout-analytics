/* =====================================================================
   Assumed-PIN allocation (optional, deterministic, non-mutating).

   Rules:
   - The original "PIN Code", district fields, party choices and Response IDs
     are never changed.
   - Records that already carry a valid PIN are NOT re-assigned.
   - Records without a PIN use their recorded district, or their estimated
     district when the estimated scenario is enabled; records with no usable
     district are left unassigned.
   - Eligible records are distributed EVENLY across the district's verified
     candidate PINs, separately within each party group, using a stable
     Response-ID ordering — a neutral illustrative allocation, not a recovered
     respondent location and never calibrated to election results.
   - Allocation depends only on Response ID + district + party, so it is
     reproducible and cannot be tuned to party outcomes.
   ===================================================================== */

import { classifyPin, candidatePinsForDistrict, districtForPin, canonicalDistrictKey, referenceAudit } from "./pin";
import { POSTAL_REFERENCE } from "./data/tamil-nadu-pincodes";

export const PIN_ALLOCATION_VERSION = "assumed-pin-v1";

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

export type PinDistrictBasis = "recorded" | "estimated" | "none";

export type AllocInput = {
  responseId: string;
  pin: unknown;
  recordedDistrict: string;
  estimatedDistrict: string;
  scenarioDistrict: string;
  status?: string;
  party?: string;
};

export type AssignedRecord = {
  responseId: string;
  assumedPin: string;
  basis: PinBasis;
  basisLabel: string;
  source: string;
  method: string;
  allocationVersion: string;
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

/** Assign one record's PIN. Kept for the recorded/unassigned classification. */
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

/**
 * Deterministic even allocation across each district's candidate PINs,
 * separately per (district, party) group. Same input ⇒ identical output.
 */
export function allocatePinAssignments(rows: AllocInput[], opts: PinAllocationOptions = {}): AssignedRecord[] {
  const includeEstimated = opts.includeEstimated ?? true;
  const base: AssignedRecord[] = new Array(rows.length);

  type Pending = { rowIndex: number; district: string; districtKey: string; districtBasis: "recorded" | "estimated"; responseId: string };
  const pending = new Map<string, Pending[]>();

  const make = (r: AllocInput, extra: Partial<AssignedRecord> & { assumedPin: string; basis: PinBasis }): AssignedRecord => ({
    responseId: String(r.responseId ?? ""),
    assumedPin: extra.assumedPin,
    basis: extra.basis,
    basisLabel: PIN_BASIS_LABEL[extra.basis],
    source: extra.source ?? "",
    method: extra.method ?? "None",
    allocationVersion: PIN_ALLOCATION_VERSION,
    district: extra.district ?? "",
    districtBasis: extra.districtBasis ?? "none",
    party: String(r.party ?? ""),
    status: String(r.status ?? ""),
  });

  rows.forEach((r, i) => {
    const recorded = String(r.recordedDistrict ?? "").trim();
    const estimated = String(r.estimatedDistrict ?? "").trim();
    const scenario = String(r.scenarioDistrict ?? "").trim();
    const cls = classifyPin(r.pin);

    if (cls.format === "ok") {
      const refDistrict = districtForPin(cls.normalized);
      const confirmed = refDistrict && recorded && canonicalDistrictKey(refDistrict) === canonicalDistrictKey(recorded);
      base[i] = make(r, confirmed
        ? { assumedPin: cls.normalized, basis: "reference-derived", source: POSTAL_REFERENCE.name, method: "Verified PIN↔district reference match", district: recorded, districtBasis: "recorded" }
        : { assumedPin: cls.normalized, basis: "recorded", source: "Respondent-supplied", method: "Preserved supplied PIN", district: recorded, districtBasis: recorded ? "recorded" : "none" });
      return;
    }

    const useEstimated = includeEstimated && !recorded;
    const district = recorded || (useEstimated ? (scenario || estimated) : "");
    if (!district) {
      base[i] = make(r, { assumedPin: "", basis: "unassigned" });
      return;
    }
    const districtBasis: "recorded" | "estimated" = recorded ? "recorded" : "estimated";
    const key = `${canonicalDistrictKey(district)}|${canon(districtBasis)}|${canon(String(r.party ?? ""))}`;
    const list = pending.get(key) ?? [];
    list.push({ rowIndex: i, district, districtKey: canonicalDistrictKey(district), districtBasis, responseId: String(r.responseId ?? "") });
    pending.set(key, list);
  });

  for (const [groupKey, list] of pending) {
    const candidates = candidatePinsForDistrict(list[0].districtKey);
    if (candidates.length === 0) {
      for (const item of list) base[item.rowIndex] = make(rows[item.rowIndex], { assumedPin: "", basis: "unassigned", district: item.district, districtBasis: item.districtBasis });
      continue;
    }
    list.sort((a, b) => (a.responseId < b.responseId ? -1 : a.responseId > b.responseId ? 1 : a.rowIndex - b.rowIndex));
    const offset = fnv1a(groupKey) % candidates.length;
    list.forEach((item, k) => {
      const basis: PinBasis = item.districtBasis === "estimated" ? "estimated-district-assumption" : "district-assumption";
      base[item.rowIndex] = make(rows[item.rowIndex], {
        assumedPin: candidates[(offset + k) % candidates.length],
        basis,
        source: POSTAL_REFERENCE.name,
        method: "Even round-robin allocation by Response ID within party group",
        district: item.district,
        districtBasis: item.districtBasis,
      });
    });
  }

  return base;
}

/* ---- preview summary ------------------------------------------------- */

export type DistrictAllocBlock = {
  district: string;
  districtBasis: "recorded" | "estimated" | "mixed" | "none";
  total: number;
  valid: number;
  recordedPin: number;
  assigned: number;
  unresolved: number;
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
  byBasis: Record<PinBasis, number>;
  byParty: Record<string, number>;
  byDistrict: DistrictAllocBlock[];
  districtsWithoutCandidates: string[];
  ambiguousPins: string[];
  reference: { name: string; source: string; version: string; note: string };
  allocationVersion: string;
  reconcile: { assignedPlusUnresolved: number; eligible: number; ok: boolean; partyOk: boolean };
};

const RECORDED_BASES = new Set<PinBasis>(["recorded", "reference-derived"]);

export function summarizeAllocation(records: AssignedRecord[]): PinAllocationSummary {
  const byBasis: Record<PinBasis, number> = { recorded: 0, "reference-derived": 0, "district-assumption": 0, "estimated-district-assumption": 0, unassigned: 0 };
  let total = 0, valid = 0, recordedPin = 0, assigned = 0, unresolved = 0;
  const byParty: Record<string, number> = {};
  const districts = new Map<string, DistrictAllocBlock>();
  const noCandidates = new Set<string>();

  for (const r of records) {
    total += 1;
    byBasis[r.basis] += 1;
    if (RECORDED_BASES.has(r.basis)) recordedPin += 1;
    else if (r.basis === "unassigned") unresolved += 1;
    else assigned += 1;

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
    if (r.district) {
      block.districtBasis = block.districtBasis === "none" || block.districtBasis === r.districtBasis
        ? r.districtBasis
        : "mixed";
    }
    if (r.assumedPin && block.byPin) {
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

  // Party reconciliation: the sum of recorded valid parties must equal `valid`.
  const partySum = Object.values(byParty).reduce((a, b) => a + b, 0);
  const districtPartySum = byDistrict.reduce((a, b) => a + Object.values(b.byParty).reduce((x, y) => x + y, 0), 0);

  return {
    total, valid, recordedPin, eligible, assigned, unresolved,
    byBasis, byParty, byDistrict,
    districtsWithoutCandidates: [...noCandidates].sort(),
    ambiguousPins: referenceAudit().ambiguousPins,
    reference: { name: POSTAL_REFERENCE.name, source: POSTAL_REFERENCE.source, version: POSTAL_REFERENCE.version, note: POSTAL_REFERENCE.note },
    allocationVersion: PIN_ALLOCATION_VERSION,
    reconcile: { assignedPlusUnresolved: assigned + unresolved, eligible, ok: assigned + unresolved === eligible, partyOk: partySum === valid && districtPartySum === valid },
  };
}
