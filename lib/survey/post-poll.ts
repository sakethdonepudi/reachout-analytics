import type { SurveyData } from "./types";
import type { TnSlotModel } from "./tn-view-model";

/** Newest month with data in a period. A year aggregate is used only when it has no month rows. */
export function latestMonthFromData(data: SurveyData, periodKey: string, preferSub = true): string {
  const period = data.periods[periodKey];
  if (!period?.months) return "all";
  const months = Object.entries(period.months)
    .filter(([, month]) => month.n > 0 || Object.values(month.sub ?? {}).some((sub) => sub.n > 0))
    .map(([key]) => key)
    .sort();
  const monthKey = months.at(-1);
  if (!monthKey) return "all";
  if (!preferSub) return monthKey;
  const subs = Object.entries(period.months[monthKey]?.sub ?? {})
    .filter(([, sub]) => sub.n > 0)
    .map(([key]) => key)
    .sort();
  return subs.at(-1) ?? monthKey;
}

/** Client-side equivalent using the serialized slot list. */
export function latestMonthFromSlots(slots: TnSlotModel[], preferSub = true): string {
  const months = slots.filter((slot) => slot.monthKey && slot.n > 0);
  const monthKeys = [...new Set(months.map((slot) => slot.monthKey as string))].sort();
  const monthKey = monthKeys.at(-1);
  if (!monthKey) return "all";
  if (!preferSub) return monthKey;
  const subs = months.filter((slot) => slot.monthKey === monthKey && slot.subKey).map((slot) => slot.key).sort();
  return subs.at(-1) ?? monthKey;
}
