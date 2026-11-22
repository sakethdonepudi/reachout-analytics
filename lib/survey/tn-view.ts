import type { SurveyData, SurveyPeriod } from "./types";
import type { TnExitPollView, TnOpinionPollView } from "@/lib/tamil-nadu/view-data";
import type { TnSeatGroup, TnShares } from "@/lib/tamil-nadu/model";

/* Maps the survey dashboard's five parties onto the case-study rail groups so
   the Opinion and Exit tabs use the same numbers as the expanded dashboard. */

const GROUP: Record<string, string> = {
  TVK: "TVK",
  "DMK+": "DMK+INC+VCK",
  "AIADMK+": "AIADMK+BJP+PMK+AMMK",
  NTK: "NTK",
  Others: "Others",
  NOTA: "NOTA",
};

function sharesOf(period: SurveyPeriod, stateName: string) {
  const expected = period.expected[stateName] ?? {};
  const shares: Record<string, number> = {};
  for (const [party, value] of Object.entries(expected)) {
    const group = GROUP[party];
    if (!group) continue;
    shares[group] = (shares[group] ?? 0) + value / 100;
  }
  return shares as TnShares;
}

function seatsOf(period: SurveyPeriod) {
  const seats: Record<string, number> = {};
  for (const [party, value] of Object.entries(period.seats)) {
    if (typeof value !== "number") continue;
    const group = GROUP[party];
    if (!group) continue;
    seats[group] = (seats[group] ?? 0) + value;
  }
  return seats as Record<TnSeatGroup, number>;
}

function rangeNote(period: SurveyPeriod) {
  return period.from && period.to ? `Survey dashboard, ${period.from} to ${period.to}.` : "Survey dashboard.";
}

export function surveyOpinionView(data: SurveyData, periodKey: string, stateName: string): TnOpinionPollView | null {
  const period = data.periods[periodKey];
  if (!period) return null;
  return {
    label: period.label,
    sourceFile: null,
    sha256: null,
    denominator: period.n,
    weighting: period.weighted ? "weighted" : "unweighted",
    note: rangeNote(period),
    available: true,
    counts: {} as TnShares,
    shares: sharesOf(period, stateName),
    seats: seatsOf(period),
    seatSource: "Survey dashboard seats by zone",
  };
}

export function surveyExitView(data: SurveyData, periodKey: string, stateName: string): TnExitPollView | null {
  const period = data.periods[periodKey];
  if (!period) return null;
  return {
    label: period.label,
    shortLabel: "Exit poll",
    source: "",
    sourceName: "Survey dashboard",
    note: rangeNote(period),
    shares: sharesOf(period, stateName),
  };
}
