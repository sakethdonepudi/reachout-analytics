import type { SurveyData, SurveyShare } from "@/lib/survey/types";

export const PROFILE_ORDER: Record<string, string[]> = {
  op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app"],
  ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"],
};

export type SurveySlotOption = { key: string; label: string; monthKey?: string; subKey?: string };

export function surveySlots(data: SurveyData, periodKey: string): SurveySlotOption[] {
  const period = data.periods[periodKey];
  if (!period) return [];
  const list: SurveySlotOption[] = [{ key: "all", label: periodKey === "ex" ? "All days" : "All months" }];
  for (const [monthKey, month] of Object.entries(period.months ?? {})) {
    list.push({ key: monthKey, label: month.label, monthKey });
    for (const [subKey, sub] of Object.entries(month.sub ?? {})) list.push({ key: subKey, label: sub.label, monthKey, subKey });
  }
  return list;
}

export function accuracyAgainst(expected: SurveyShare, actual: SurveyShare, parties: string[]): number {
  return 100 - parties.reduce((sum, party) => sum + Math.abs((expected[party] ?? 0) - (actual[party] ?? 0)), 0) / 2;
}
