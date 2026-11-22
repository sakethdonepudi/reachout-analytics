import { readFileSync } from "node:fs";
import { surveySchema } from "./schema";
import type { SurveyData, SurveyPeriod } from "./types";

function extractTn(source: string): unknown {
  const marker = "window.TN_DATA=";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("This HTML does not contain window.TN_DATA.");
  const stop = source.indexOf("</script>", start);
  return JSON.parse(source.slice(start + marker.length, stop).replace(/;\s*$/, ""));
}

function extractAp(source: string): unknown {
  const end = source.lastIndexOf("</script>");
  const idx = source.lastIndexOf("})(", end);
  if (idx < 0) throw new Error("This HTML does not contain the Andhra Pradesh survey payload.");
  const stop = source.lastIndexOf(");", end);
  return JSON.parse(source.slice(idx + 3, stop));
}

export function parseSurveyHtml(source: string, state: string): SurveyData {
  const raw = state === "tamil-nadu" ? extractTn(source) : extractAp(source);
  if (!raw || typeof raw !== "object") throw new Error("The survey payload is empty.");
  const parsed = surveySchema(state).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    throw new Error(`The survey dashboard does not match the ${state} schema. ${path}${issue?.message ?? ""}`.trim());
  }
  const data = raw as Record<string, unknown>;
  const periods = data.periods as Record<string, SurveyPeriod>;
  for (const period of Object.values(periods)) {
    if (!period.demo) period.demo = {};
    if (!period.from) period.from = "";
    if (!period.to) period.to = "";
  }
  return {
    parties: data.parties as string[],
    regions: Array.isArray(data.regions) ? data.regions as string[] : Object.keys((data.actual as Record<string, unknown>) ?? {}),
    periods,
    actual: data.actual as SurveyData["actual"],
    ads: data.ads as SurveyData["ads"],
    n_total: Number(data.n_total ?? 0),
    geo: data.geo,
    zonelabels: data.zonelabels as Record<string, string> | undefined,
  };
}

export function parseSurveyFile(path: string, state: string): SurveyData {
  return parseSurveyHtml(readFileSync(path, "utf8"), state);
}

/** Keep only aggregate ads numbers in the dashboard payload. The full campaign list is never sent. */
export function surveyAdsSummary(data: SurveyData, includeSpend: boolean) {
  const ads = data.ads as Record<string, unknown>;
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (!includeSpend && /spend|cost|cpm|cpc|cpr|billing/i.test(key)) continue;
      if (key === "camps" || key === "accounts" || key === "adsets") continue;
      out[key] = clean(item);
    }
    return out;
  };
  return clean({
    label: ads.label,
    range: ads.range,
    asOf: ads.asOf,
    note: ads.note,
    total: ads.total,
    periods: ads.periods,
  }) as SurveyData["ads"];
}
