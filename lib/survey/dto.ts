import { surveyAdsSummary } from "./parse";
import type { SurveyData, SurveyPeriod } from "./types";

export function pickSurveyPeriod(data: SurveyData, requested?: string | null) {
  if (requested && data.periods[requested]) return requested;
  if (data.periods.op) return "op";
  if (data.periods.ex) return "ex";
  return Object.keys(data.periods)[0] ?? "";
}

export function surveySubperiods(data: SurveyData, periodKey: string) {
  const period = data.periods[periodKey];
  const months = period?.months as Record<string, SurveyPeriod> | undefined;
  if (!months) return [];
  return Object.entries(months).map(([key, value]) => ({ key, label: value.label }));
}

export function pickSurveyYear(data: SurveyData, periodKey: string, requested?: string | null) {
  const list = surveySubperiods(data, periodKey);
  if (requested && list.some((item) => item.key === requested)) return requested;
  return list[list.length - 1]?.key ?? "";
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
  options?: { period?: string | null; profile?: string | null; year?: string | null },
): SurveyData {
  const ads = surveyAdsSummary(data, owner);
  if (!options?.period && !options?.profile && !options?.year) return { ...data, ads } as SurveyData;

  const activePeriod = pickSurveyPeriod(data, options?.period);
  const source = data.periods[activePeriod];
  if (!source) return { ...data, ads } as SurveyData;

  // Andhra Pradesh post-poll tracking is split by year. Show the latest year
  // by default, matching the source dashboard, and keep the year tabs.
  let view = source;
  if (activePeriod === "rd") {
    const years = source.months as Record<string, SurveyPeriod> | undefined;
    if (years) {
      const subperiodCatalog = Object.entries(years).map(([key, value]) => ({ key, label: value.label }));
      const year = pickSurveyYear(data, activePeriod, options?.year);
      const base = years[year];
      if (base) {
        const { months: _months, sub: _sub, ...rest } = base as SurveyPeriod & { sub?: unknown };
        view = { ...rest, label: `${source.label} · ${base.label}`, subperiodCatalog, subperiod: year };
      }
    }
  }

  const demos = view.demo ?? {};
  const activeProfile = pickSurveyProfile(view, options?.profile);
  const demoCatalog = Object.fromEntries(Object.entries(demos).map(([key, value]) => [key, { label: value.label, cov: value.cov }]));
  const demo = activeProfile && demos[activeProfile] ? { [activeProfile]: demos[activeProfile] } : {};
  const periodCatalog = Object.entries(data.periods).map(([key, period]) => ({ key, label: period.label }));

  return {
    ...data,
    periods: { [activePeriod]: { ...view, demo, demoCatalog } },
    periodCatalog,
    ads,
  } as SurveyData;
}
