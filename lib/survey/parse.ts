import { readFileSync } from "node:fs";
import { surveySchema } from "./schema";
import type { SurveyData, SurveyPeriod } from "./types";

function balancedJsonAt(source: string, start: number): unknown {
  const first = source.indexOf("{", start);
  if (first < 0) throw new Error("The survey payload does not contain a JSON object.");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = first; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(first, index + 1));
    }
  }
  throw new Error("The survey payload JSON object is not closed.");
}

function parsePayload(source: string, start: number) {
  try {
    return balancedJsonAt(source, start);
  } catch (error) {
    const text = source.slice(start, start + 5000)
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    try {
      return balancedJsonAt(text, 0);
    } catch {
      throw error instanceof Error ? error : new Error("The survey payload is not valid JSON.");
    }
  }
}

function extractTn(source: string): unknown {
  const text = source.replace(/^\uFEFF/, "");
  const marker = /window\.TN_DATA\s*=\s*/.exec(text);
  if (!marker) throw new Error("This HTML does not contain window.TN_DATA. Upload the survey dashboard HTML, not the workbook.");
  return parsePayload(text, marker.index + marker[0].length);
}

function extractAp(source: string): unknown {
  const text = source.replace(/^\uFEFF/, "");
  const end = text.lastIndexOf("</script>");
  const idx = text.lastIndexOf("})(", end);
  if (idx < 0) throw new Error("This HTML does not contain the Andhra Pradesh survey payload. Upload the Andhra Pradesh survey dashboard HTML.");
  return parsePayload(text, idx + 3);
}

function surveyTitle(source: string) {
  return /<title[^>]*>([^<]*)<\/title>/i.exec(source)?.[1]?.trim() ?? "";
}

function assertSurveyState(source: string, state: string) {
  const title = surveyTitle(source);
  const tnMarker = /window\.TN_DATA\s*=/.test(source);
  const tnTitle = /Tamil Nadu/i.test(title);
  const apTitle = /Andhra Pradesh/i.test(title);
  if (state === "tamil-nadu" && !tnMarker) {
    if (apTitle) throw new Error("This is the Andhra Pradesh dashboard. Use the Andhra Pradesh upload card.");
    throw new Error("This HTML does not contain window.TN_DATA. Upload the Tamil Nadu dashboard HTML.");
  }
  if (state === "andhra-pradesh-2024" && tnMarker) {
    throw new Error("This is the Tamil Nadu dashboard. Use the Tamil Nadu upload card.");
  }
  if (state === "andhra-pradesh-2024" && tnTitle && !apTitle) {
    throw new Error("This is the Tamil Nadu dashboard. Use the Tamil Nadu upload card.");
  }
}

export function parseSurveyHtml(source: string, state: string): SurveyData {
  assertSurveyState(source, state);
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
    base: data.base as SurveyData["base"],
    ads: data.ads as SurveyData["ads"],
    n_total: Number(data.n_total ?? 0),
    geo: data.geo,
    zonelabels: data.zonelabels as Record<string, string> | undefined,
  };
}

export function assertAdsSection(data: SurveyData): void {
  const ads = data.ads as Record<string, unknown> | undefined;
  const total = ads?.total as Record<string, unknown> | undefined;
  const accounts = ads?.accounts;
  const camps = ads?.camps;
  const campaigns = Number(total?.n ?? 0);
  const accountRows = Array.isArray(accounts) ? accounts.length : 0;
  if (!ads || !total || !camps || accountRows === 0 || campaigns === 0) {
    throw new Error("This dashboard has no ads section. Upload the full state dashboard HTML that includes the ads report.");
  }
}

/** The owner upload path: parse the state payload, reject the wrong state and require ads. */
export function parseSurveyUpload(source: string, state: string): SurveyData {
  const data = parseSurveyHtml(source, state);
  assertAdsSection(data);
  return data;
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
