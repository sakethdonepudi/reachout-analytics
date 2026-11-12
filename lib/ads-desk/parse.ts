import "server-only";

import { createHash } from "node:crypto";
import { parseExpressionAt } from "acorn";
import { z } from "zod";

export const DELIVERY: Record<string, string> = {
  a: "Delivering", l: "Stopped by account spend limit", o: "Off", c: "Completed",
  i: "Ad set switched off", n: "Started today",
};

export type AdsCampaign = {
  id: string; name: string; delivery: string; start: string; end: string;
  spend: number; reach: number; impressions: number; views: number; clicks: number; engagements: number;
  results: number | null; resultLabel: string | null; costPerResult: number | null;
};
export type AdsAccount = { id: string; name: string; business: string; campaigns: AdsCampaign[] };
export type AdsRegion = {
  key: string; label: string; short: string; range: string; note: string; asOf: string; viewsLabel: string | null;
  accounts: AdsAccount[];
  totals: { accounts: number; campaigns: number; active: number; spend: number; reach: number; impressions: number; views: number; clicks: number; engagements: number };
  colors: { band: string; bandSoft: string; bg: string; darkBand: string; darkBandSoft: string; darkBg: string };
};
export type SnapAccount = { id: string; name: string; business: string; status: string; hasPayment: boolean; currency: string; stats: number[] };
export type SnapPage = { id: string; name: string };
export type AdsParse = {
  sha256: string; takenAt: string; asOf: string; regionKeys: string[];
  regions: AdsRegion[];
  snap: { accounts: SnapAccount[]; pages: SnapPage[]; days: string[]; daily: Record<string, number[]> };
};

const RegionSchema = z.object({
  label: z.string().min(1), short: z.string().optional().default(""), range: z.string().optional().default(""),
  note: z.string().optional().default(""), asOf: z.string().optional().default(""), viewsLabel: z.string().optional(),
  accounts: z.record(z.string(), z.object({ name: z.string(), business: z.string().optional().default("") })),
  camps: z.record(z.string(), z.array(z.array(z.any()))),
  res: z.record(z.string(), z.array(z.any())).optional().default({}),
  adsets: z.record(z.string(), z.any()).optional().default({}),
});

function literal(node: any): unknown {
  switch (node.type) {
    case "Literal": return node.value;
    case "ArrayExpression": return node.elements.map((element: any) => { if (!element) throw new Error("Unsupported content"); return literal(element); });
    case "ObjectExpression": {
      const out: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (property.type !== "Property" || property.computed) throw new Error("Unsupported content");
        const key = property.key.type === "Identifier" ? property.key.name : property.key.type === "Literal" ? String(property.key.value) : null;
        if (key == null) throw new Error("Unsupported content");
        out[key] = literal(property.value);
      }
      return out;
    }
    case "TemplateLiteral": {
      if (node.expressions.length) throw new Error("Unsupported content");
      return node.quasis.map((quasi: any) => quasi.value.cooked ?? quasi.value.raw).join("");
    }
    case "UnaryExpression": {
      if (node.operator !== "-" || node.argument.type !== "Literal" || typeof node.argument.value !== "number") throw new Error("Unsupported content");
      return -node.argument.value;
    }
    default: throw new Error("Unsupported content");
  }
}

function expressionAfter(source: string, marker: string): unknown {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing ${marker.trim()}`);
  const start = index + marker.length;
  try {
    const node = parseExpressionAt(source, start, { ecmaVersion: 2024 });
    return literal(node);
  } catch (error) {
    if (error instanceof Error && error.message === "Unsupported content") throw error;
    throw new Error(`Could not parse ${marker.trim()}`);
  }
}

function jsonAfter(source: string, marker: string): unknown {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing ${marker.trim()}`);
  const start = index + marker.length;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") { depth -= 1; if (depth === 0) return JSON.parse(source.slice(start, i + 1)); }
  }
  throw new Error(`Unclosed JSON for ${marker.trim()}`);
}

type Color = { band: string; bandSoft: string; bg: string };
function colorFor(css: string, region: string, dark: boolean): Color {
  const pattern = new RegExp(`\\[data-region="${region}"\\]\\s*\\{([^}]*)\\}`, "g");
  let match: RegExpExecArray | null;
  const found: Color[] = [];
  while ((match = pattern.exec(css))) {
    const body = match[1];
    const band = /--band\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
    const bandSoft = /--band-soft\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
    const bg = /--bg\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
    if (band && bandSoft && bg) found.push({ band, bandSoft, bg });
  }
  const fallback = dark ? { band: "#9aa4b2", bandSoft: "#2a313b", bg: "#10151b" } : { band: "#64748b", bandSoft: "#e2e8f0", bg: "#f8fafc" };
  return dark ? found[1] ?? found[0] ?? fallback : found[0] ?? fallback;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseAdsDeskHtml(html: string): AdsParse {
  if (!html || html.length > 15 * 1024 * 1024) throw new Error("The file must be 15 MB or smaller.");
  const sha256 = createHash("sha256").update(html).digest("hex");
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join("\n");
  const regionsRaw = jsonAfter(html, "window.REGIONS = ") as Record<string, unknown>;
  const snap = expressionAfter(html, "const SNAP = ") as Record<string, unknown>;
  const snap2 = jsonAfter(html, "const SNAP2 = ") as { takenAt?: string };
  // Literal-only assignments (res, resLife, adsets, ads, pages and any future field).
  const assignments: Record<string, unknown> = {};
  for (const match of scripts.matchAll(/SNAP\.([A-Za-z0-9_]+)\s*=\s*/g)) {
    const key = match[1];
    if (key in snap) continue;
    try { assignments[key] = expressionAfter(scripts, `SNAP.${key} = `); } catch { /* assignment may be a function or DOM write */ }
  }
  const merged = { ...snap, ...assignments };
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");

  const regionKeys = Object.keys(regionsRaw);
  const regions: AdsRegion[] = regionKeys.map((key) => {
    const parsed = RegionSchema.safeParse((regionsRaw as Record<string, unknown>)[key]);
    if (!parsed.success) throw new Error(`Region ${key}: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join(", ")}`);
    const region = parsed.data;
    const accounts: AdsAccount[] = Object.entries(region.accounts).map(([accountId, account]) => {
      const rows = region.camps[accountId] ?? [];
      const campaigns: AdsCampaign[] = rows.map((row) => {
        const result = region.res[row[0] as string] as unknown[] | undefined;
        return {
          id: String(row[0] ?? ""), name: String(row[1] ?? ""), delivery: DELIVERY[String(row[2] ?? "")] ?? "Unknown",
          start: String(row[3] ?? ""), end: String(row[4] ?? ""), spend: num(row[5]), reach: num(row[6]),
          impressions: num(row[7]), views: num(row[8]), clicks: num(row[9]), engagements: num(row[10]),
          results: result ? num(result[0]) : null, resultLabel: result ? String(result[1] ?? "") : null,
          costPerResult: result && result[2] != null ? num(result[2]) : null,
        };
      });
      return { id: accountId, name: account.name, business: account.business ?? "", campaigns };
    });
    const all = accounts.flatMap((account) => account.campaigns);
    const totals = {
      accounts: accounts.length, campaigns: all.length,
      active: all.filter((campaign) => campaign.delivery === "Delivering" || campaign.delivery === "Started today").length,
      spend: all.reduce((sum, item) => sum + item.spend, 0), reach: all.reduce((sum, item) => sum + item.reach, 0),
      impressions: all.reduce((sum, item) => sum + item.impressions, 0), views: all.reduce((sum, item) => sum + item.views, 0),
      clicks: all.reduce((sum, item) => sum + item.clicks, 0), engagements: all.reduce((sum, item) => sum + item.engagements, 0),
    };
    const light = colorFor(css, key, false), dark = colorFor(css, key, true);
    return {
      key, label: region.label, short: region.short, range: region.range, note: region.note,
      asOf: region.asOf || String(snap.takenAt ?? ""), viewsLabel: region.viewsLabel ?? null, accounts, totals,
      colors: { ...light, darkBand: dark.band, darkBandSoft: dark.bandSoft, darkBg: dark.bg },
    };
  });

  const snapAccountsRaw = Array.isArray(merged.accounts) ? merged.accounts as unknown[][] : [];
  const stats = (merged.stats ?? {}) as Record<string, number[]>;
  const accounts: SnapAccount[] = snapAccountsRaw.map((row) => ({
    id: String(row[0] ?? ""), name: String(row[1] ?? ""), business: String(row[2] ?? ""), status: String(row[3] ?? ""),
    hasPayment: Boolean(row[5]), currency: String(row[6] ?? ""), stats: stats[String(row[0] ?? "")] ?? [],
  }));
  const pagesRaw = Array.isArray(merged.pages) ? merged.pages as unknown[][] : [];
  const pages: SnapPage[] = pagesRaw.map((row) => ({ id: String(row[0] ?? ""), name: String(row[1] ?? "") }));
  const dailyRaw = (merged.daily ?? {}) as Record<string, Record<string, number[]>>;
  const daily: Record<string, number[]> = {};
  for (const [accountId, campaigns] of Object.entries(dailyRaw)) {
    const sum = (merged.days as string[] | undefined)?.map((_day, index) => Object.values(campaigns).reduce((total, row) => total + num(row[index]), 0)) ?? [];
    daily[accountId] = sum;
  }

  return {
    sha256, takenAt: String(snap.takenAt ?? snap2.takenAt ?? ""), asOf: String(regions[0]?.asOf ?? snap.takenAt ?? ""),
    regionKeys, regions,
    snap: { accounts, pages, days: Array.isArray(merged.days) ? merged.days as string[] : [], daily },
  };
}
