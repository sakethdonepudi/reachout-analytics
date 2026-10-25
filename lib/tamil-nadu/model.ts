export const TN_GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"] as const;
export type TnGroup = (typeof TN_GROUPS)[number];
export type TnYear = "2011" | "2016" | "2021";
export type TnYearOrCurrent = TnYear | "2026";
export const TN_HISTORICAL_YEARS: TnYear[] = ["2011", "2016", "2021"];
export const TN_COLOR: Record<TnGroup, string> = {
  TVK: "#EAB308",
  "AIADMK+BJP+PMK+AMMK": "#16A34A",
  "DMK+INC+VCK": "#DC2626",
  NTK: "#7C3AED",
  NOTA: "#94A3B8",
};
export const TN_LABEL: Record<TnGroup, string> = {
  TVK: "TVK",
  "AIADMK+BJP+PMK+AMMK": "AIADMK+BJP+PMK+AMMK",
  "DMK+INC+VCK": "DMK+INC+VCK",
  NTK: "NTK",
  NOTA: "NOTA",
};
export const TN_SHORT = TN_LABEL;
export const TN_NO_DATA = "#94A3B8";

export type TnShares = Partial<Record<TnGroup, number>>;
export type TnCounts = Record<TnGroup, number>;
export type TnLeader = TnGroup | null;

export type TnActualYear = {
  shares: TnShares | null;
  available: boolean;
  winner: TnLeader;
  total?: number;
};
export type TnSurvey = { valid: number; counts: TnCounts; shares: TnShares | null };
export type TnProjected = { leader: TnLeader; marginPp: number; confidence: string; winner?: TnLeader };
export type TnActual2026 = { alliance: string; party: string; winner: TnLeader };

export type TnAc = {
  no: number; name: string; district: string; districtEci: string;
  actual: Record<TnYear, TnActualYear>;
  survey: TnSurvey;
  surveyLeader: TnLeader;
  projected: TnProjected;
  actual2026: TnActual2026;
  match: boolean;
  noData: boolean;
};
export type TnDistrict = {
  name: string; acs: number[];
  actual: Record<TnYear, TnActualYear>;
  survey: TnSurvey;
  projectedSeats: Record<TnGroup, number>;
  actualSeats: Record<TnGroup, number>;
  seatProjection: { leader: string; marginPp: number };
  coverage: { acs: number; responses: number };
};
export type TnAggregates = {
  version: string;
  sourceFile: string;
  sourceHash: string;
  source: {
    type: string; totalResponses: number; locatedResponses: number; unlocatedResponses: number; assemblyScopedResponses: number;
    constituencies: number; districts: number; reference: unknown; audit: { sheet: string; rows: number; used: string; detail: string }[];
    normalisation: { ac: { count: number; total: number; maxDeviationPp: number; policy: string }; district: { count: number; total: number; maxDeviationPp: number; policy: string } };
    crosswalk: { matched: number; unresolved: number; method: string; duplicateNames: string[] };
    districtPolicy: string;
  };
  groups: TnGroup[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  years: TnYear[];
  presence: Record<TnYear, Record<TnGroup, boolean>>;
  referenceShare: { party: TnGroup; value: number; label: string; workbookValue: number; note: string };
  statewide: {
    name: string;
    actual: Record<TnYear, TnActualYear>;
    survey: TnSurvey;
    surveyLeader: TnLeader;
    counts: { total: number; located: number; unlocated: number };
    projectedSeats: Record<TnGroup, number>;
    actualSeats: Record<TnGroup, number>;
    accuracy: number;
  };
  districts: TnDistrict[];
  acs: TnAc[];
};

export type TnScope =
  | { kind: "state" }
  | { kind: "district"; name: string }
  | { kind: "ac"; no: number };

export function tnShares(shares: TnShares | null | undefined): TnShares { return shares ?? {}; }
export function tnPct(v: number | null | undefined): string { return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`; }
export function tnPp(v: number | null | undefined): string { return v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`; }
export function tnLeader(shares: TnShares | null | undefined, groups: readonly TnGroup[] = TN_GROUPS): TnLeader {
  if (!shares) return null;
  let best: TnLeader = null; let bestV = -1;
  for (const g of groups) { const v = shares[g] ?? 0; if (v > bestV) { best = g; bestV = v; } }
  return best;
}
export function tnShareTotal(shares: TnShares | null | undefined): number { return TN_GROUPS.reduce((s, g) => s + (shares?.[g] ?? 0), 0); }
export function tnScopeKey(scope: TnScope): string { return scope.kind === "state" ? "state" : scope.kind === "district" ? `d:${scope.name}` : `a:${scope.no}`; }
export function tnScopeFromInitial(initialScope: string): TnScope {
  if (initialScope === "state") return { kind: "state" };
  if (initialScope.startsWith("d:")) return { kind: "district", name: initialScope.slice(2) };
  return { kind: "ac", no: Number(initialScope.slice(2)) };
}
