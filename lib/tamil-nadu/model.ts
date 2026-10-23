export const TN_GROUPS = ["TVK", "DMK+INC+VCK", "AIADMK+BJP+PMK+AMMK", "NTK", "NOTA", "Others"] as const;
export type TnGroup = (typeof TN_GROUPS)[number];
export type TnYear = "2011" | "2016" | "2021";
export type TnYearOrCurrent = TnYear | "2026";
export const TN_HISTORICAL_YEARS: TnYear[] = ["2011", "2016", "2021"];
export const TN_COLOR: Record<TnGroup, string> = {
  TVK: "#EAB308",
  "DMK+INC+VCK": "#DC2626",
  "AIADMK+BJP+PMK+AMMK": "#16A34A",
  NTK: "#7C3AED",
  NOTA: "#94A3B8",
  Others: "#64748B",
};
export const TN_LABEL: Record<TnGroup, string> = {
  TVK: "TVK",
  "DMK+INC+VCK": "DMK+INC+VCK",
  "AIADMK+BJP+PMK+AMMK": "AIADMK+BJP+PMK+AMMK",
  NTK: "NTK",
  NOTA: "NOTA",
  Others: "Others",
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

export type TnAc = {
  no: number; name: string; district: string;
  actual: Record<TnYear, TnActualYear>;
  survey: TnSurvey;
  surveyLeader: TnLeader;
};
export type TnDistrict = {
  name: string; acs: number[];
  actual: Record<TnYear, TnActualYear>;
  survey: TnSurvey;
  seats: Record<TnYear, Record<TnGroup, number>>;
  coverage: Record<TnYear, number>;
};
export type TnAggregates = {
  version: string;
  source: Record<string, unknown>;
  groups: TnGroup[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  years: TnYear[];
  presence: Record<TnYear, Record<TnGroup, boolean>>;
  statewide: {
    name: string;
    actual: Record<TnYear, TnActualYear>;
    seats: Record<TnYear, Record<TnGroup, number>>;
    coverage: Record<TnYear, number>;
    survey: TnSurvey;
    surveyLeaders: Record<TnGroup, number>;
  };
  districts: TnDistrict[];
  acs: TnAc[];
};

export type TnRoundPeriod = {
  i: number; start: string; end: string;
  entries: number; answered: number; counts: TnCounts; partial: boolean;
};
export type TnDailyPeriod = {
  date: string; entries: number; answered: number; counts: TnCounts;
};
export type TnScopeRounds = {
  name: string; entries: number; dateMin: string; dateMax: string;
  rounds388: TnRoundPeriod[]; rounds688: TnRoundPeriod[];
  daily: TnDailyPeriod[]; blocks50: TnRoundPeriod[];
};
export type TnRoundBundle = {
  version: string; parties: TnGroup[]; entries: number; dateMin: string; dateMax: string;
  roundPolicy: string;
  model: { kind: "survey-only"; reason: string; projection: false };
  scope: string;
  name: string; scopeEntries: number; scopeDateMin: string | null; scopeDateMax: string | null;
  rounds388: TnRoundPeriod[]; rounds688: TnRoundPeriod[];
  daily: TnDailyPeriod[]; blocks50: TnRoundPeriod[];
};

export type TnScope =
  | { kind: "state" }
  | { kind: "district"; name: string }
  | { kind: "ac"; no: number };

export function tnShares(shares: TnShares | null | undefined): TnShares {
  return shares ?? {};
}
export function tnPct(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`;
}
export function tnPp(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`;
}
export function tnLeader(shares: TnShares | null | undefined, groups: readonly TnGroup[] = TN_GROUPS): TnLeader {
  if (!shares) return null;
  let best: TnLeader = null; let bestV = -1;
  for (const g of groups) {
    const v = shares[g] ?? 0;
    if (v > bestV) { best = g; bestV = v; }
  }
  return best;
}
export function tnShareTotal(shares: TnShares | null | undefined): number {
  return TN_GROUPS.reduce((s, g) => s + (shares?.[g] ?? 0), 0);
}
export function tnScopeKey(scope: TnScope): string {
  return scope.kind === "state" ? "state" : scope.kind === "district" ? `d:${scope.name}` : `a:${scope.no}`;
}
export function tnScopeFromInitial(initialScope: string): TnScope {
  if (initialScope === "state") return { kind: "state" };
  if (initialScope.startsWith("d:")) return { kind: "district", name: initialScope.slice(2) };
  return { kind: "ac", no: Number(initialScope.slice(2)) };
}
