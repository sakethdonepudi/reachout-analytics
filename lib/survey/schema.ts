import { z } from "zod";
import { SURVEY_STATES } from "./types";

/* Validation for the embedded dashboard payload. The source objects are
   large (the ads campaign list alone is over 1 MB), so the schema checks the
   shape the dashboard needs and leaves the aggregate extras in place. */

const demoRow = z.object({
  g: z.string(),
  n: z.number(),
  v: z.array(z.number()),
});

const demo = z.object({
  label: z.string(),
  cov: z.string().optional(),
  rows: z.array(demoRow),
});

/* The TN Result period publishes district seat rows as an array:
   { d: "Chennai", acs: 22, TVK: 20, "DMK+": 2, "AIADMK+": 0 }. Only the
   parties that won seats in that district are present, and they are numeric. */
const districtSeat = z.object({
  d: z.string(),
  acs: z.number(),
}).catchall(z.number());

const period = z.object({
  label: z.string(),
  n: z.number(),
  nw: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  expected: z.record(z.string(), z.record(z.string(), z.number())),
  seats: z.record(z.string(), z.unknown()),
  demo: z.record(z.string(), demo).optional(),
  actual: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
  last: z.union([z.string(), z.number()]).optional(),
  target: z.union([z.string(), z.number()]).optional(),
  dist: z.array(districtSeat).optional(),
  weighted: z.boolean().optional(),
  /* The source nests month/year and sub-round periods with the same shape. */
  get months() { return z.record(z.string(), period).optional(); },
  get sub() { return z.record(z.string(), period).optional(); },
});

const base = z.object({
  parties: z.array(z.string()).min(1),
  regions: z.array(z.string()).optional(),
  periods: z.record(z.string(), period),
  actual: z.record(z.string(), z.record(z.string(), z.number())),
  base: z.record(z.string(), z.record(z.string(), z.number())).optional(),
  ads: z.record(z.string(), z.unknown()),
  n_total: z.number(),
  meta: z.record(z.string(), z.unknown()).optional(),
  geo: z.unknown().optional(),
  zonelabels: z.record(z.string(), z.string()).optional(),
});

/** Field names on the source survey dashboards, used by the Excel template too. */
export const SURVEY_PERIOD_KEYS: Record<string, string[]> = {
  "tamil-nadu": ["op", "ex", "rs"],
  "andhra-pradesh-2024": ["op", "ex", "rd"],
  karnataka: ["rd"],
  telangana: ["rd"],
};

export function surveySchema(state: string) {
  const required = SURVEY_PERIOD_KEYS[state];
  if (!required) throw new Error(`Unknown survey state: ${state}`);
  return base.superRefine((value, ctx) => {
    for (const key of required) {
      if (!(key in value.periods)) {
        ctx.addIssue({ code: "custom", path: ["periods", key], message: `The ${SURVEY_STATES[state]?.name ?? state} survey needs the ${key} period.` });
      }
    }
    for (const [key, item] of Object.entries(value.periods)) {
      if (!(key in value.periods)) return;
      if (!Object.keys(item.expected).length) {
        ctx.addIssue({ code: "custom", path: ["periods", key, "expected"], message: `Period ${key} has no expected vote shares.` });
      }
      for (const share of Object.values(item.expected)) {
        for (const party of value.parties) {
          if (typeof share[party] !== "number" && share[party] !== undefined) {
            ctx.addIssue({ code: "custom", path: ["periods", key, "expected"], message: `Period ${key} has a non-numeric share for ${party}.` });
            break;
          }
        }
      }
    }
    if (!value.periods.op && !value.periods.ex && !value.periods.rd) {
      ctx.addIssue({ code: "custom", path: ["periods"], message: "The survey needs an opinion, exit or live tracking period." });
    }
  });
}
