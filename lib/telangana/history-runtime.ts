import {
  PARTIES, PARTY_COLOR, PARTY_LABEL, NO_DATA_COLOR, shadeHex, weightedShares,
  type AcRow, type Party, type ShareSet,
} from "./constants";

/* =====================================================================
   Client-safe Telangana historical model.

   The historical bundle is loaded from the protected history API at
   runtime. No JSON is imported here, so no per-assembly historical rows
   can be bundled into a static page chunk.
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


/** The client-safe subset of the server history bundle. */
export type ClientHistoryBundle = {
  version: string;
  cutoff: string;
  groups: string[];
  groupLabels: Record<string, string>;
  winnerColours: Record<string, string>;
  sa: { historical: { year: number; assemblies: number; totalVotes: number; seats: Record<string, number>; source: string }[] };
  years: Record<HistoricYear, HistoricYearRow>;
  stats: unknown[];
  cw: { n: number; name: string; district: string }[];
};

let HISTORY: ClientHistoryBundle | null = null;
let yearMaps: Record<HistoricYear, Map<number, HistoricAc>> = {
  "2014": new Map(), "2018": new Map(), "2023": new Map(),
};

export function setHistoryBundle(bundle: ClientHistoryBundle) {
  HISTORY = bundle;
  yearMaps = {
    "2014": new Map(bundle.years["2014"].acs.map((a) => [a.no, a])),
    "2018": new Map(bundle.years["2018"].acs.map((a) => [a.no, a])),
    "2023": new Map(bundle.years["2023"].acs.map((a) => [a.no, a])),
  };
}

export function historyReady(): boolean {
  return HISTORY !== null;
}

export function historyBundle(): ClientHistoryBundle | null {
  return HISTORY;
}

export const historicalAc = (year: HistoricYear, no: number) => yearMaps[year].get(no) ?? null;

/** Detailed historic winner colour, retaining party identity. */
export function winnerColour(party: string | null | undefined): string {
  if (!party) return NO_DATA_COLOR;
  if (party === "Others") return PARTY_COLOR.Others;
  return HISTORY?.winnerColours[party] ?? NO_DATA_COLOR;
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

/* The device data is intentionally not part of the client model. The old
   map layer is no longer reachable from the UI, so these stubs keep any
   remaining call sites safe without shipping the breakdown. */
export type DeviceBrand = { brand: string; entries: number; share: number };
export type DeviceAc = { total: number; brands: DeviceBrand[] };
export const DEVICE_AC = (_no: number): DeviceAc | null => null;
export function deviceSummary(_acs: AcRow[]): { total: number; brands: DeviceBrand[] } {
  return { total: 0, brands: [] };
}

export { PARTY_LABEL };
