import bundle from "@/lib/data/telangana/history.json";
import {
  PARTIES, PARTY_COLOR, PARTY_LABEL, NO_DATA_COLOR, shadeHex, weightedShares,
  type AcRow, type Party, type ShareSet,
} from "./oct26";

/* =====================================================================
   Telangana 2014 / 2018 / 2023 historical actuals, swing statistics and
   exact-Entry-ID device aggregates from the supplied Excel pack.

   2014/2018 are ECI-derived mirror values, 2023 is the supplied workbook
   result table. They are election results, never exit polls. The 33
   district groups are the current workbook's analytical AC grouping.
   ===================================================================== */

export type HistoricYear = "2014" | "2018" | "2023";
export type ElectionYear = HistoricYear | "2028";
export const ELECTION_YEARS: ElectionYear[] = ["2014", "2018", "2023", "2028"];
export const YEAR_LABEL: Record<ElectionYear, string> = {
  "2014": "2014", "2018": "2018", "2023": "2023", "2028": "2028 Predicted",
};

export type DetailSet = {
  BRS: number; Congress: number; BJP: number; AIMIM: number; TDP: number; JSP: number; Others: number;
};
export type HistoricAc = {
  no: number; name: string; district: string; total: number;
  shares: ShareSet; detail: DetailSet; winnerParty: string; winnerName: string; winnerVotes: number; winnerShare: number;
  aimimVotes: number; aimimShare: number;
};
export type HistoricYearRow = {
  total: number; shares: ShareSet; detail: DetailSet; aimim: number; seats: Record<string, number>; acs: HistoricAc[];
};
export type SwingAssembly = { no: number; changePp: number; outlier: boolean };
export type SwingStat = {
  fromYear: number; toYear: number; party: string;
  medianPp: number; q1Pp: number; q3Pp: number; lowerFencePp: number; upperFencePp: number;
  assemblies: SwingAssembly[];
};
export type DeviceBrand = { brand: string; entries: number; share: number };
export type DeviceAc = { total: number; brands: DeviceBrand[] };
export type HistoryBundle = {
  version: string;
  cutoff: string;
  groups: string[];
  groupLabels: Record<string, string>;
  winnerColours: Record<string, string>;
  sourceAudit: { historical: { year: number; assemblies: number; totalVotes: number; seats: Record<string, number>; source: string }[] };
  years: Record<HistoricYear, HistoricYearRow>;
  stats: SwingStat[];
  devices: { total: number; brands: DeviceBrand[]; byAc: Record<string, DeviceAc>; note: string };
  crosswalk: { no: number; name: string; district: string }[];
};

export const HISTORY = bundle as unknown as HistoryBundle;

const yearMaps: Record<HistoricYear, Map<number, HistoricAc>> = {
  "2014": new Map(HISTORY.years["2014"].acs.map((a) => [a.no, a])),
  "2018": new Map(HISTORY.years["2018"].acs.map((a) => [a.no, a])),
  "2023": new Map(HISTORY.years["2023"].acs.map((a) => [a.no, a])),
};

export const historicalAc = (year: HistoricYear, no: number) => yearMaps[year].get(no) ?? null;

/** Detailed historic winner colour, retaining party identity. */
export function winnerColour(party: string | null | undefined): string {
  if (!party) return NO_DATA_COLOR;
  if (party === "Others") return PARTY_COLOR.Others;
  return HISTORY.winnerColours[party] ?? NO_DATA_COLOR;
}
export function winnerLabel(party: string | null | undefined): string {
  if (!party) return "No data";
  const labels: Record<string, string> = {
    TRS: "TRS", BRS: "BRS", INC: "Congress", BJP: "BJP", AIMIM: "AIMIM", TDP: "TDP",
    BSP: "BSP", YSRCP: "YSRCP", CPI: "CPI", CPM: "CPM", AIFB: "AIFB", IND: "Independent",
    Others: "Others",
  };
  return labels[party] ?? party;
}

/** Winner colour shaded by that winner's vote share. */
export const winnerShade = (party: string, share: number) => shadeHex(winnerColour(party), share);

/** Historical shares with AIMIM extracted from the comparison table's Others. */
export function historicalShares(acs: AcRow[], year: HistoricYear): ShareSet {
  let weight = 0;
  let aimim = 0;
  const out: ShareSet = { BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 };
  for (const a of acs) {
    const rec = yearMaps[year].get(a.no);
    if (!rec || !(rec.total > 0)) continue;
    weight += rec.total;
    for (const p of ["BRS", "Congress", "BJP"] as const) out[p] += rec.shares[p] * rec.total;
    aimim += rec.detail.AIMIM * rec.total;
    out.Others += rec.shares.Others * rec.total;
  }
  if (!weight) return { ...out };
  out.BRS /= weight;
  out.Congress /= weight;
  out.BJP /= weight;
  out.Others = Math.max(0, out.Others / weight - aimim / weight);
  out.AIMIM = aimim / weight;
  return out;
}

/** Detailed historical shares (BRS/INC/BJP/AIMIM/TDP/JSP/Others), weighted by that election's votes. */
export function historicalDetail(acs: AcRow[], year: HistoricYear): DetailSet {
  let weight = 0;
  const out: DetailSet = { BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, TDP: 0, JSP: 0, Others: 0 };
  for (const a of acs) {
    const rec = yearMaps[year].get(a.no);
    if (!rec || !(rec.total > 0)) continue;
    weight += rec.total;
    for (const p of Object.keys(out) as (keyof DetailSet)[]) out[p] += rec.detail[p] * rec.total;
  }
  if (weight) for (const p of Object.keys(out) as (keyof DetailSet)[]) out[p] /= weight;
  return out;
}

/** AIMIM's separately available historical share, weighted by that election's votes. */
export function historicalAimim(acs: AcRow[], year: HistoricYear): number {
  let weight = 0;
  let votes = 0;
  for (const a of acs) {
    const rec = yearMaps[year].get(a.no);
    if (!rec || !(rec.total > 0)) continue;
    weight += rec.total;
    votes += rec.aimimShare * rec.total;
  }
  return weight ? votes / weight : 0;
}

/** Scope shares for any election year: 2028 uses the prediction (2023 weights). */
export function yearShares(acs: AcRow[], year: ElectionYear): ShareSet {
  return year === "2028" ? weightedShares(acs, "prediction") : historicalShares(acs, year);
}

/** The baseline shown next to the 2028 prediction. */
export const baselineYear = (year: ElectionYear): HistoricYear => (year === "2028" ? "2023" : year);

export function historicalTotal(acs: AcRow[], year: HistoricYear): number {
  return acs.reduce((sum, a) => sum + (yearMaps[year].get(a.no)?.total ?? 0), 0);
}

/** Actual winner counts in the scope (119 across Telangana). */
export function winnerSeats(acs: AcRow[], year: HistoricYear): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of acs) {
    const rec = yearMaps[year].get(a.no);
    if (rec) out[rec.winnerParty] = (out[rec.winnerParty] ?? 0) + 1;
  }
  return out;
}

/* ---------------- swing statistics ---------------- */
export const SWING_INTERVALS: { from: HistoricYear; to: ElectionYear; label: string }[] = [
  { from: "2014", to: "2018", label: "2014 → 2018" },
  { from: "2018", to: "2023", label: "2018 → 2023" },
  { from: "2023", to: "2028", label: "2023 → 2028" },
];
export const EXTRA_INTERVALS: { from: HistoricYear; to: ElectionYear; label: string }[] = [
  { from: "2014", to: "2028", label: "2014 → 2028" },
  { from: "2018", to: "2028", label: "2018 → 2028" },
];

export function swingStat(from: number, to: number, party: Party): SwingStat | null {
  const group = party === "Congress" ? "Congress+" : party;
  return HISTORY.stats.find((s) => s.fromYear === from && s.toYear === to && s.party === group) ?? null;
}

const percentileInc = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
};

export type CohortStat = {
  n: number; medianPp: number; q1Pp: number; q3Pp: number;
  lowerFencePp: number; upperFencePp: number;
  flags: Map<number, boolean>;
};

/**
 * Median / inclusive quartiles / 1.5×IQR fences for the selected AC cohort.
 * Returns null below 10 comparable assemblies (no invented statistics).
 */
export function cohortStats(acs: AcRow[], from: number, to: number, party: Party): CohortStat | null {
  const stat = swingStat(from, to, party);
  if (!stat) return null;
  const scope = new Set(acs.map((a) => a.no));
  const rows = stat.assemblies.filter((a) => scope.has(a.no));
  if (rows.length < 10) return null;
  if (rows.length === stat.assemblies.length) {
    return {
      n: rows.length, medianPp: stat.medianPp, q1Pp: stat.q1Pp, q3Pp: stat.q3Pp,
      lowerFencePp: stat.lowerFencePp, upperFencePp: stat.upperFencePp,
      flags: new Map(rows.map((r) => [r.no, r.outlier])),
    };
  }
  const values = rows.map((r) => r.changePp).sort((a, b) => a - b);
  const q1 = percentileInc(values, 0.25);
  const median = percentileInc(values, 0.5);
  const q3 = percentileInc(values, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return {
    n: rows.length, medianPp: median, q1Pp: q1, q3Pp: q3,
    lowerFencePp: lower, upperFencePp: upper,
    flags: new Map(rows.map((r) => [r.no, r.changePp < lower || r.changePp > upper])),
  };
}

export function acSwing(acNo: number, from: number, to: number, party: Party): number | null {
  const stat = swingStat(from, to, party);
  return stat?.assemblies.find((a) => a.no === acNo)?.changePp ?? null;
}

/** Outlier assemblies for a party/interval in a scope, largest absolute first. */
export function outlierRows(acs: AcRow[], from: number, to: number, party: Party, limit = 8) {
  const stat = swingStat(from, to, party);
  const cohort = cohortStats(acs, from, to, party);
  if (!stat || !cohort) return [];
  const byNo = new Map(acs.map((a) => [a.no, a]));
  return stat.assemblies
    .filter((a) => cohort.flags.get(a.no))
    .map((a) => ({ ...a, ac: byNo.get(a.no) ?? null }))
    .filter((a) => a.ac)
    .sort((a, b) => Math.abs(b.changePp) - Math.abs(a.changePp))
    .slice(0, limit);
}

/* ---------------- devices ---------------- */
export const DEVICE_AC = (no: number): DeviceAc | null => HISTORY.devices.byAc[String(no)] ?? null;

export function deviceSummary(acs: AcRow[]): { total: number; brands: DeviceBrand[] } {
  const totals = new Map<string, number>();
  let total = 0;
  for (const a of acs) {
    const rec = DEVICE_AC(a.no);
    if (!rec) continue;
    total += rec.total;
    for (const b of rec.brands) totals.set(b.brand, (totals.get(b.brand) ?? 0) + b.entries);
  }
  const brands = [...totals.entries()]
    .map(([brand, entries]) => ({ brand, entries, share: total ? entries / total : 0 }))
    .sort((a, b) => b.entries - a.entries);
  return { total, brands };
}

export const TOP_BRANDS = HISTORY.devices.brands.slice(0, 8).map((b) => b.brand);
export { PARTY_LABEL };
