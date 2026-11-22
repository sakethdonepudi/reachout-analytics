import { surveyAdsSummary } from "./parse";
import type { SurveyData, SurveyPeriod } from "./types";

export function pickSurveyPeriod(data: SurveyData, requested?: string | null) {
  if (requested && data.periods[requested]) return requested;
  if (data.periods.op) return "op";
  if (data.periods.ex) return "ex";
  return Object.keys(data.periods)[0] ?? "";
}

export function pickSurveyProfile(period: SurveyPeriod | undefined, requested?: string | null) {
  const demos = period?.demo ?? {};
  if (requested && demos[requested]) return requested;
  if (demos.age) return "age";
  return Object.keys(demos)[0] ?? "";
}

/**
 * Role DTO. Only the aggregate ads numbers leave the server, and when a period
 * is selected only that period and one profile section are serialized. The
 * profile labels stay as a small catalog so the tabs still work; switching a
 * tab asks the server (URL state) for the next slice.
 */
export function surveyForRole(
  data: SurveyData,
  owner: boolean,
  options?: { period?: string | null; profile?: string | null },
): SurveyData {
  const ads = surveyAdsSummary(data, owner);
  if (!options?.period && !options?.profile) return { ...data, ads } as SurveyData;

  const activePeriod = pickSurveyPeriod(data, options?.period);
  const source = data.periods[activePeriod];
  if (!source) return { ...data, ads } as SurveyData;
  const demos = source.demo ?? {};
  const activeProfile = pickSurveyProfile(source, options?.profile);
  const demoCatalog = Object.fromEntries(Object.entries(demos).map(([key, value]) => [key, { label: value.label, cov: value.cov }]));
  const demo = activeProfile && demos[activeProfile] ? { [activeProfile]: demos[activeProfile] } : {};
  const periodCatalog = Object.entries(data.periods).map(([key, period]) => ({ key, label: period.label }));

  return {
    ...data,
    periods: { [activePeriod]: { ...source, demo, demoCatalog } },
    periodCatalog,
    ads,
  } as SurveyData;
}
