import { PARTY_COLOR } from "./oct26";
import type { DetailSet } from "./history";

/* =====================================================================
   Reference-style round projection (2023-anchored).

   survey swing[p,r] = 2028 intention[p,r] - recalled 2023[p,r]
   unnormalised[p,r] = actual 2023 election share[p] + swing[p,r]
   then floor negatives, normalise the complete vector to 100%.

   The 2028 intention and 2023 recall use separate answered denominators.
   ===================================================================== */

export type P7 = "BRS" | "Congress" | "BJP" | "AIMIM" | "TDP" | "JSP" | "Others";
export const P7S: P7[] = ["BRS", "Congress", "BJP", "AIMIM", "TDP", "JSP", "Others"];
export const P7_LABEL: Record<P7, string> = {
  BRS: "BRS", Congress: "Congress", BJP: "BJP", AIMIM: "AIMIM", TDP: "TDP", JSP: "Janasena", Others: "Others",
};
export const P7_COLOR: Record<P7, string> = {
  BRS: PARTY_COLOR.BRS,
  Congress: PARTY_COLOR.Congress,
  BJP: PARTY_COLOR.BJP,
  AIMIM: "#16a34a",
  TDP: "#eab308",
  JSP: "#06b6d4",
  Others: PARTY_COLOR.Others,
};
export type Counts7 = Record<P7, number>;
export type Projected = Record<P7, number>;
export const emptyCounts7 = (): Counts7 => Object.fromEntries(P7S.map((p) => [p, 0])) as Counts7;

export type QuestionCounts = {
  entries?: number;
  answered2028: number;
  counts2028: Counts7;
  answered2023: number;
  counts2023: Counts7;
};

/**
 * Returns the seven-party projected 2028 share vector (percent, full precision)
 * or null when either question lacks a usable denominator.
 */
export function projectVector(period: QuestionCounts, actual: DetailSet): Projected | null {
  if (!(period.answered2028 > 0) || !(period.answered2023 > 0)) return null;
  const un = {} as Projected;
  let sum = 0;
  for (const p of P7S) {
    const intention = (period.counts2028[p] / period.answered2028) * 100;
    const recall = (period.counts2023[p] / period.answered2023) * 100;
    const v = Math.max(0, actual[p] * 100 + intention - recall);
    un[p] = v;
    sum += v;
  }
  if (!(sum > 0)) return null;
  for (const p of P7S) un[p] = (un[p] / sum) * 100;
  return un;
}
