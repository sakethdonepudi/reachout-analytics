import type { TgParty } from "@/lib/telangana/parties";

/* =====================================================================
   Telangana aggregates — types and pure calculation helpers.

   Contract:
   - shares come from unrounded counts / denominator (never a mean of
     already-rounded percentages);
   - a zero denominator yields `null`, rendered as "No answered survey
     responses" (never 0%);
   - historical shares use candidate votes + NOTA in the same scope;
   - 2028 scenario shares use answered 2028 questions in the same scope;
   - the 2023→2028 figure is a "Survey difference vs 2023", not a swing.
   ===================================================================== */

export type Counts = Record<string, number>;

export type AcRecord = {
  no: number;
  name: string;
  group: string;
  reservation: string;
  scenarioRows: number;
  a2028: Counts;
  o2028: Counts;
  v2018: Counts;
  v2023: Counts;
  device: Record<string, number>;
  total2023: number;
  total2018: number;
  answered2028: number;
  originalAnswered2028: number;
  deviceTotal: number;
};

export type DistrictRecord = {
  group: string;
  acs: number[];
  a2028: Counts;
  o2028: Counts;
  v2018: Counts;
  v2023: Counts;
  device: Record<string, number>;
  answered2028: number;
  total2023: number;
  total2018: number;
};

export type StatewideRow = {
  party: string;
  v2018: number; s2018: number; seats2018: number;
  v2023: number; s2023: number; seats2023: number;
  answered2028: number; share2028: number;
  swing2018to2023: number; diff2023to2028: number;
  originalAnswered2028: number; originalShare2028: number;
};

export type AgeRow = { band: string; answered: number; parties: Counts };
export type BrandRow = { brand: string; entries: number };
export type RoundRow = {
  batchSize: number; batch: number; from: string; to: string; party: string;
  entries: number; answered: number; answers: number; share: number; diffPp: number;
};
export type DailyRow = {
  date: string; party: string; entries: number; answered: number; answers: number; share: number | null;
};
export type CrosswalkRow = { no: number; name: string; uploaded: string; wikipedia: string; match: boolean };

export type Baseline = {
  version: string;
  generatedAt: string;
  basis: string;
  pollType: "opinion";
  surveyCollectionYear: number;
  surveyQuestionYear: number;
  historicalPeriods: number[];
  totals: {
    scenarioRows: number; answered2028: number; blank2028: number; sourceEntries: number;
    acs: number; groups: number; conflictRows: number; districtMismatch: number; geometryPoints: number;
  };
  partyOrder: string[];
  statewide: StatewideRow[];
  districts: DistrictRecord[];
  acs: AcRecord[];
  age: AgeRow[];
  brands: BrandRow[];
  rounds: RoundRow[];
  daily: DailyRow[];
  crosswalk: CrosswalkRow[];
};

/* ------------------------------------------------------------------ *
 *  Identifier helpers
 * ------------------------------------------------------------------ */

/** `"57. ముషీరాబాద్"` → 57; `"57"` → 57; anything else → null. */
export function parseAcNumber(cell: unknown): number | null {
  const s = String(cell ?? "").trim();
  const m = /^(\d{1,3})(?!\d)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 119 ? n : null;
}

/** The constituency name part of an `"N. name"` cell, trimmed. */
export function acNameFromCell(cell: unknown): string {
  return String(cell ?? "").replace(/^\s*\d{1,3}\s*[.)-]?\s*/, "").trim();
}

/* ------------------------------------------------------------------ *
 *  Shares / differences
 * ------------------------------------------------------------------ */

/** count / denominator; `null` when there is nothing to divide by. */
export function share(count: number, denominator: number): number | null {
  if (!Number.isFinite(count) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (count / denominator) * 100;
}

/** Percentage-point difference; `null` if either side is unknown. */
export function ppDiff(from: number | null, to: number | null): number | null {
  if (from === null || to === null || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  return to - from;
}

export type PartyShare = { party: string; count: number; share: number | null };

/**
 * Shares for one scope. Counts are summed first, then divided, so
 * multi-selection never averages percentages.
 */
export function partyShares(counts: Counts, parties: string[], denominator?: number): PartyShare[] {
  const total = denominator ?? parties.reduce((s, p) => s + (counts[p] ?? 0), 0);
  return parties
    .map((p) => ({ party: p, count: counts[p] ?? 0, share: share(counts[p] ?? 0, total) }))
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || a.party.localeCompare(b.party));
}

export type Lead = { party: TgParty | null; share: number | null; tie: string[] };

/** Leading party in a scope (NOTA excluded); ties are reported explicitly. */
export function leadingParty(counts: Counts, parties: string[]): Lead {
  const eligible = parties.filter((p) => p !== "NOTA");
  const total = eligible.reduce((s, p) => s + (counts[p] ?? 0), 0);
  if (total <= 0) return { party: null, share: null, tie: [] };
  let best = -1;
  for (const p of eligible) best = Math.max(best, counts[p] ?? 0);
  const winners = eligible.filter((p) => (counts[p] ?? 0) === best);
  return {
    party: (winners[0] as TgParty) ?? null,
    share: share(best, total),
    tie: winners.length > 1 ? winners : [],
  };
}

/** Sum several AC records into one scope (counts, not percentages). */
export function combineAcs(acs: AcRecord[]): {
  a2028: Counts; o2028: Counts; v2018: Counts; v2023: Counts; device: Record<string, number>;
  answered2028: number; total2023: number; total2018: number; deviceTotal: number;
} {
  const out = {
    a2028: {} as Counts, o2028: {} as Counts, v2018: {} as Counts, v2023: {} as Counts,
    device: {} as Record<string, number>,
    answered2028: 0, total2023: 0, total2018: 0, deviceTotal: 0,
  };
  for (const a of acs) {
    for (const [p, n] of Object.entries(a.a2028)) out.a2028[p] = (out.a2028[p] ?? 0) + n;
    for (const [p, n] of Object.entries(a.o2028)) out.o2028[p] = (out.o2028[p] ?? 0) + n;
    for (const [p, n] of Object.entries(a.v2018)) out.v2018[p] = (out.v2018[p] ?? 0) + n;
    for (const [p, n] of Object.entries(a.v2023)) out.v2023[p] = (out.v2023[p] ?? 0) + n;
    for (const [b, n] of Object.entries(a.device)) out.device[b] = (out.device[b] ?? 0) + n;
    out.answered2028 += a.answered2028;
    out.total2023 += a.total2023;
    out.total2018 += a.total2018;
    out.deviceTotal += a.deviceTotal;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  Formatting
 * ------------------------------------------------------------------ */

export function fmtPct(v: number | null, digits = 2): string {
  return v === null ? "—" : `${v.toFixed(digits)}%`;
}

export function fmtPp(v: number | null, digits = 2): string {
  if (v === null) return "—";
  const s = v.toFixed(digits);
  return `${v > 0 ? "+" : ""}${s} pp`;
}

export function fmtInt(v: number): string {
  return new Intl.NumberFormat("en-IN").format(v);
}

/**
 * Documented sparse-coverage threshold (answered 2028 rows in a scope).
 * Below it the UI marks the scope as a low sample instead of hiding it.
 */
export const SMALL_SAMPLE = 30;

/* ------------------------------------------------------------------ *
 *  Scope resolution
 * ------------------------------------------------------------------ */

export type ScopeState = {
  district: string | null;
  acs: number[];
};

/** ACs in scope: explicit AC selection wins, else the district group. */
export function acsInScope(base: Baseline, scope: ScopeState): AcRecord[] {
  if (scope.acs.length) {
    const set = new Set(scope.acs);
    return base.acs.filter((a) => set.has(a.no));
  }
  if (scope.district) return base.acs.filter((a) => a.group === scope.district);
  return base.acs;
}

/** Statewide historical rows keyed by party (2018/2023 actual). */
export function statewideByParty(base: Baseline): Record<string, StatewideRow> {
  const m: Record<string, StatewideRow> = {};
  for (const r of base.statewide) m[r.party] = r;
  return m;
}
