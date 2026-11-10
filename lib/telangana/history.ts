import "server-only";
import bundle from "@/lib/data/telangana/history.json";
import { PARTIES, type AcRow, type Party } from "./constants";
import { setHistoryBundle, type ClientHistoryBundle, type DeviceAc, type DeviceBrand, type HistoricYear } from "./history-runtime";

/* Server-only history bundle. The client receives the same data without the
   device breakdown from /api/public/case-studies/telangana/history. */

export type SwingAssembly = { no: number; changePp: number; outlier: boolean };
export type SwingStat = {
  fromYear: number; toYear: number; party: string;
  medianPp: number; q1Pp: number; q3Pp: number; lowerFencePp: number; upperFencePp: number;
  assemblies: SwingAssembly[];
};

export type ServerHistoryBundle = Omit<ClientHistoryBundle, "stats" | "cw" | "sa"> & {
  sourceAudit: { historical: { year: number; assemblies: number; totalVotes: number; seats: Record<string, number>; source: string }[] };
  stats: SwingStat[];
  crosswalk: { no: number; name: string; district: string }[];
  devices: { total: number; brands: DeviceBrand[]; byAc: Record<string, DeviceAc>; note: string };
};

export const HISTORY = bundle as unknown as ServerHistoryBundle;

// Make the pure client model usable on the server without shipping devices.
setHistoryBundle({
  version: HISTORY.version,
  cutoff: HISTORY.cutoff,
  groups: HISTORY.groups,
  groupLabels: HISTORY.groupLabels,
  winnerColours: HISTORY.winnerColours,
  sa: HISTORY.sourceAudit,
  years: HISTORY.years,
  stats: [],
  cw: HISTORY.crosswalk.map((c) => ({ n: c.no, name: c.name, district: c.district })),
});

export * from "./history-runtime";

/* Server-only swing statistics, retained for admin exports and tests. */
export type CohortStat = {
  n: number; medianPp: number; q1Pp: number; q3Pp: number;
  lowerFencePp: number; upperFencePp: number;
  flags: Map<number, boolean>;
};

export const SWING_INTERVALS: { from: HistoricYear; to: string; label: string }[] = [
  { from: "2014", to: "2018", label: "2014 → 2018" },
  { from: "2018", to: "2023", label: "2018 → 2023" },
  { from: "2023", to: "2028", label: "2023 → 2028" },
];
export const EXTRA_INTERVALS: { from: HistoricYear; to: string; label: string }[] = [
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

export { PARTIES };
