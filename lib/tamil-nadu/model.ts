export const TN_GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA", "Others"] as const;
export const TN_SURVEY_GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"] as const;
export const TN_SEAT_GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK"] as const;
export type TnGroup = (typeof TN_GROUPS)[number];
export type TnSeatGroup = (typeof TN_SEAT_GROUPS)[number];
export type TnYear = "2011" | "2016" | "2021";
export type TnYearOrCurrent = TnYear | "2026";
export const TN_HISTORICAL_YEARS: TnYear[] = ["2011", "2016", "2021"];
export const TN_COLOR: Record<TnGroup, string> = {
  TVK: "#EAB308",
  "AIADMK+BJP+PMK+AMMK": "#16A34A",
  "DMK+INC+VCK": "#DC2626",
  NTK: "#7C3AED",
  NOTA: "#64748B",
  Others: "#0F766E",
};
export const TN_LABEL: Record<TnGroup, string> = {
  TVK: "TVK",
  "AIADMK+BJP+PMK+AMMK": "AIADMK+",
  "DMK+INC+VCK": "DMK+",
  NTK: "NTK",
  NOTA: "NOTA",
  Others: "Others",
};
export const TN_FULL: Record<TnGroup, string> = {
  TVK: "TVK",
  "AIADMK+BJP+PMK+AMMK": "AIADMK+BJP+PMK+AMMK",
  "DMK+INC+VCK": "DMK+INC+VCK",
  NTK: "NTK",
  NOTA: "NOTA",
  Others: "Others",
};
export const TN_SHORT = TN_LABEL;
export const TN_NO_DATA = "#94A3B8";

export type TnShares = Partial<Record<TnGroup, number>>;
export type TnCounts = Record<TnGroup, number>;
export type TnLeader = TnGroup | null;
export type TnCall = { leader: TnLeader; party?: string; probability?: number; confidence?: string; correct?: boolean; changedVsSaket?: boolean };

export type TnActualYear = { shares: TnShares | null; available: boolean; winner: TnLeader; total?: number };
export type TnSurvey = { valid: number; counts: TnCounts; shares: TnShares | null; leader?: TnLeader; runnerUp?: TnLeader; marginPp?: number };
export type TnAc = {
  no: number; name: string; district: string; districtEci: string;
  survey: TnSurvey; surveyLeader: TnLeader;
  original: TnCall; model: TnCall; final: TnCall;
  actual2026: { alliance: string; party: string; winner: TnLeader };
  historical: Record<TnYear, TnActualYear>;
  match: boolean; noData: boolean;
};
export type TnDistrict = {
  name: string; acs: number[];
  survey: TnSurvey; surveyLeader: TnLeader;
  originalSeats: Record<TnSeatGroup, number>; modelSeats: Record<TnSeatGroup, number>;
  finalSeats: Record<TnSeatGroup, number>; actualSeats: Record<TnSeatGroup, number>;
  historical: Record<TnYear, TnActualYear>;
  coverage: { acs: number; responses: number };
};
export type TnMetrics = {
  originalCorrect: number; surveyLeaderCorrect: number; modelCorrect: number; modelCvCorrect: number;
  finalCorrect: number; finalCvCorrect: number; baselineTVK: number; districtsTopMatch: number;
  districtsTied: number; districtsMissed: number; districtSeatError: number; finalDistrictError: number;
};
export type TnCalibration = {
  weights: Partial<Record<TnGroup, number>>; tolerance: number; withinTolerance: string;
  coefficients: { alliance: string; values: number[] }[];
  notes: string[];
};
export type TnAggregates = {
  version: string;
  sourceFile: string;
  sourceHash: string;
  sourceImportId: string;
  source: {
    type: string; totalResponses: number; withAc: number; noAc: number; constituencies: number; districts: number; sourceImportId: string;
    audit: { sheet: string; rows: number; used: string }[];
    notes: string[]; archive: string; districtPolicy: string;
  };
  groups: TnGroup[];
  seatGroups: TnSeatGroup[];
  labels: Record<string, string>;
  fullLabels: Record<string, string>;
  colors: Record<string, string>;
  years: TnYear[];
  presence: Record<TnYear, Record<TnGroup, boolean>>;
  reference: null;
  allocation: null;
  statewide: {
    name: string;
    survey: TnSurvey; surveyLeader: TnLeader;
    calibrated: { valid: number; shares: TnShares; counts: null; note: string };
    actualVoteShares: { valid: number; shares: TnShares; counts: null; note: string };
    counts: { total: number; withAc: number; noAc: number };
    originalSeats: Record<TnSeatGroup, number>; modelSeats: Record<TnSeatGroup, number>;
    finalSeats: Record<TnSeatGroup, number>; actualSeats: Record<TnSeatGroup, number>;
    accuracy: number; originalAccuracy: number; modelAccuracy: number;
    historical: Record<TnYear, TnActualYear>;
  };
  districts: TnDistrict[];
  acs: TnAc[];
  calibration: TnCalibration;
  metrics: TnMetrics;
};

export type TnScope = { kind: "state" } | { kind: "district"; name: string } | { kind: "ac"; no: number };
export function tnPct(v: number | null | undefined): string { return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`; }
export function tnPp(v: number | null | undefined): string { return v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`; }
export function tnLeader(shares: TnShares | null | undefined, groups: readonly TnGroup[] = TN_GROUPS): TnLeader {
  if (!shares) return null;
  let best: TnLeader = null; let bestV = -1;
  for (const g of groups) { const v = shares[g] ?? 0; if (v > bestV) { best = g; bestV = v; } }
  return best;
}
export function tnScopeKey(scope: TnScope): string { return scope.kind === "state" ? "state" : scope.kind === "district" ? `d:${scope.name}` : `a:${scope.no}`; }
export function tnScopeFromInitial(initialScope: string): TnScope {
  if (initialScope === "state") return { kind: "state" };
  if (initialScope.startsWith("d:")) return { kind: "district", name: initialScope.slice(2) };
  return { kind: "ac", no: Number(initialScope.slice(2)) };
}
