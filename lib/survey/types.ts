export type SurveyShare = Record<string, number>;

export type SurveyDemoRow = { g: string; n: number; v: number[] };
export type SurveyDemo = { label: string; cov?: string; rows: SurveyDemoRow[] };

/** Labels kept when only one profile's rows are sent to the browser. */
export type SurveyDemoCatalog = Record<string, { label: string; cov?: string }>;

export type SurveyPeriod = {
  label: string;
  n: number;
  nw?: number;
  from?: string;
  to?: string;
  dist?: Record<string, unknown>;
  expected: Record<string, SurveyShare>;
  seats: Record<string, unknown>;
  demo?: Record<string, SurveyDemo>;
  demoCatalog?: SurveyDemoCatalog;
  actual?: boolean;
  weighted?: boolean;
  months?: Record<string, unknown>;
  subperiods?: Record<string, SurveyPeriod>;
  subperiodCatalog?: Array<{ key: string; label: string }>;
  subperiod?: string;
  last?: string;
  target?: string;
};

export type SurveyAdsSummary = {
  label: string;
  range: string;
  asOf?: string;
  note?: string;
  total?: Record<string, number>;
  periods?: Record<string, Record<string, number | string>>;
};

export type SurveyData = {
  parties: string[];
  regions: string[];
  periods: Record<string, SurveyPeriod>;
  periodCatalog?: Array<{ key: string; label: string }>;
  actual: Record<string, SurveyShare>;
  ads: SurveyAdsSummary;
  n_total: number;
  geo?: unknown;
  zonelabels?: Record<string, string>;
};

export const SURVEY_STATES: Record<string, { slug: string; name: string; file: string }> = {
  "tamil-nadu": { slug: "tamil-nadu", name: "Tamil Nadu", file: "TN-2026-Survey-Dashboard-2.html" },
  "andhra-pradesh-2024": { slug: "andhra-pradesh-2024", name: "Andhra Pradesh", file: "AP_2024_Survey_Dashboard-4.html" },
};

/** Ads periods are pre/op/ex/post; the survey-only result periods map to post. */
export function socialPeriodFor(period?: string | null) {
  if (period === "rs" || period === "rd") return "post";
  return period === "pre" || period === "op" || period === "ex" || period === "post" ? period : null;
}
