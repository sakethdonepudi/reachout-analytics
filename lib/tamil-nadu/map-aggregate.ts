import { canonicalAcName, canonicalDistrictName, resolveAcDistrict, splitAcLabel } from "./aliases";
import { AC_DISTRICT_BY_NO, AC_NAME_BY_NO, TN_ACS } from "./survey-map";

export type RawRow = Record<string, unknown>;
export type MapRow = { n: number; shares: Record<string, number> | null };

const PARTIES = ["TVK", "DMK+", "AIADMK+", "NTK", "Others"] as const;
export type MapParty = (typeof PARTIES)[number];

const AC_BY_KEY = new Map<string, { no: number; district: string }>();
const AC_BY_NAME_DISTRICT = new Map<string, number>();
for (const ac of TN_ACS) {
  const key = canonicalAcName(ac.name).toLowerCase();
  if (!AC_BY_KEY.has(key)) AC_BY_KEY.set(key, { no: ac.no, district: ac.district });
  AC_BY_NAME_DISTRICT.set(`${key}|${canonicalDistrictName(ac.district)}`, ac.no);
}

export function mapParty(value: unknown): MapParty | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^undecided$/i.test(text)) return null;
  if (/^AIADMK\+/i.test(text) || /^AIDMK\+/i.test(text)) return "AIADMK+";
  if (/^DMK\+/i.test(text)) return "DMK+";
  if (/^TVK$/i.test(text)) return "TVK";
  if (/^NTK$/i.test(text)) return "NTK";
  if (/^Others$/i.test(text)) return "Others";
  return null;
}

export function rawAcDistrict(row: RawRow, acToDistrict?: Map<string, string>): string | null {
  const name = canonicalAcName(row["Assembly Constituency"]);
  const key = name.toLowerCase();
  if (key === "tiruppattur") return resolveAcDistrict({ name, zone: row["Zone"], districtByNo: AC_DISTRICT_BY_NO });
  if (acToDistrict?.has(key)) return canonicalDistrictName(acToDistrict.get(key));
  const match = AC_BY_KEY.get(key);
  if (match) return canonicalDistrictName(match.district);
  const no = Number(row["Assembly Constituency No"] ?? NaN);
  if (Number.isFinite(no) && AC_DISTRICT_BY_NO.has(no)) return canonicalDistrictName(AC_DISTRICT_BY_NO.get(no));
  return resolveAcDistrict({ name, zone: row["Zone"], districtByNo: AC_DISTRICT_BY_NO });
}

function blank(value: unknown) {
  const text = String(value ?? "").trim();
  return !text || /^(blank|undecided|none|nota)$/i.test(text);
}

export function aggregateRows(rows: RawRow[], threshold = 30, acToDistrict?: Map<string, string>, acNameToNo?: Map<string, number>): { n: number; districts: Record<string, MapRow>; acs: Record<string, MapRow> } {
  const districts = new Map<string, { n: number; votes: Record<MapParty, number> }>();
  const acs = new Map<string, { n: number; name: string; votes: Record<MapParty, number> }>();
  let total = 0;
  for (const row of rows) {
    const party = mapParty(row["Vote 2026 Bloc"] ?? row["Vote 2026 (raw)"]);
    const district = rawAcDistrict(row, acToDistrict);
    const acName = canonicalAcName(row["Assembly Constituency"]);
    const acKey = acName
      ? String(AC_BY_NAME_DISTRICT.get(`${acName.toLowerCase()}|${district}`) ?? acNameToNo?.get(`${acName.toLowerCase()}|${district}`) ?? AC_BY_KEY.get(acName.toLowerCase())?.no ?? acName)
      : "";
    total += 1;
    if (!district) continue;
    const d = districts.get(district) ?? { n: 0, votes: { TVK: 0, "DMK+": 0, "AIADMK+": 0, NTK: 0, Others: 0 } };
    d.n += 1;
    if (party) d.votes[party] += 1;
    districts.set(district, d);
    if (acKey) {
      const a = acs.get(acKey) ?? { n: 0, name: acName, votes: { TVK: 0, "DMK+": 0, "AIADMK+": 0, NTK: 0, Others: 0 } };
      a.n += 1;
      if (party) a.votes[party] += 1;
      acs.set(acKey, a);
    }
  }
  const rowOf = (n: number, votes: Record<MapParty, number>): MapRow => {
    const valid = PARTIES.reduce((sum, party) => sum + votes[party], 0);
    if (n < threshold || !valid) return { n, shares: null };
    return { n, shares: Object.fromEntries(PARTIES.map((party) => [party, Number(((votes[party] / valid) * 100).toFixed(2))])) };
  };
  return {
    n: total,
    districts: Object.fromEntries([...districts].map(([key, value]) => [canonicalDistrictName(key), rowOf(value.n, value.votes)])),
    acs: Object.fromEntries([...acs].map(([key, value]) => [key, rowOf(value.n, value.votes)])),
  };
}

export function isOpinionRow(row: RawRow) {
  return /^TN Opinion Poll 2026/i.test(String(row["Survey"] ?? ""));
}

export function isRepeat(row: RawRow) {
  return String(row["Repeat Device (same form)"] ?? "").toLowerCase() === "yes";
}

export function opinionFilter(rows: RawRow[], slot: string) {
  const base = rows.filter((row) => isOpinionRow(row) && !isRepeat(row));
  if (slot === "all") return base;
  if (slot === "2026-03") return base.filter((row) => String(row["Survey Month"] ?? "").startsWith("2026-03"));
  if (slot === "2026-04") return base.filter((row) => String(row["Survey Month"] ?? "").startsWith("2026-04"));
  if (slot === "2026-04a") return base.filter((row) => String(row["Survey Month"] ?? "").startsWith("2026-04") && Number(row["Entry Date"] ?? 0) < 46128);
  if (slot === "2026-04b") return base.filter((row) => String(row["Survey Month"] ?? "").startsWith("2026-04") && Number(row["Entry Date"] ?? 0) >= 46128);
  return base;
}

/** Build the AC to district map from the uploaded HTML's D.geo.dist rows. */
export function acDistrictMapFromGeo(data: { geo?: unknown }): Map<string, string> {
  const geo = (data.geo && typeof data.geo === "object" ? data.geo : {}) as { dist?: Record<string, string[]> };
  const map = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const [district, acs] of Object.entries(geo.dist ?? {})) {
    for (const ac of acs) {
      const key = canonicalAcName(ac).toLowerCase();
      if (map.has(key) && map.get(key) !== district) conflicts.add(key);
      else map.set(key, canonicalDistrictName(district));
    }
  }
  for (const key of conflicts) map.delete(key);
  return map;
}

/** Build an AC name to number map from the HTML demo.ac rows ("12 Tiruppattur"). */
export function acNameNoMapFromSurvey(data: { periods: Record<string, { demo?: Record<string, { rows?: Array<{ g: string }> }> }> }): Map<string, number> {
  const map = new Map<string, number>();
  for (const period of Object.values(data.periods)) {
    for (const demo of Object.values(period.demo ?? {})) {
      for (const row of demo.rows ?? []) {
        const { no, name } = splitAcLabel(row.g);
        if (no == null) continue;
        const district = AC_DISTRICT_BY_NO.get(no);
        map.set(`${canonicalAcName(name).toLowerCase()}|${canonicalDistrictName(district)}`, no);
      }
    }
  }
  return map;
}

export function trackingRows(rows: RawRow[], type: "District Swing" | "Tracking Survey", month: string | null) {
  return rows.filter((row) => {
    if (String(row["Survey Type"] ?? "") !== type) return false;
    if (!month) return true;
    return String(row["Survey Month"] ?? "").startsWith(month);
  });
}

export const TRACKING_MONTHS = [
  { key: "2025-10", label: "Oct 2025" },
  { key: "2025-11", label: "Nov 2025" },
  { key: "2025-12", label: "Dec 2025" },
  { key: "2026-01", label: "Jan 2026" },
];

export const OPINION_SLOTS = [
  { key: "all", label: "Opinion poll · all months" },
  { key: "2026-03", label: "Opinion poll · Mar 2026" },
  { key: "2026-04", label: "Opinion poll · Apr 2026" },
  { key: "2026-04a", label: "Opinion poll · 1-15 Apr 2026" },
  { key: "2026-04b", label: "Opinion poll · 16-30 Apr 2026" },
];

export function compareShares(raw: Record<string, MapRow>, html: Record<string, { n: number; shares: Record<string, number> | null }>, parties: string[]) {
  let max = 0;
  let compared = 0;
  for (const [key, source] of Object.entries(html)) {
    const target = raw[key];
    if (!target?.shares || !source.shares) continue;
    for (const party of parties) {
      const diff = Math.abs((target.shares[party] ?? 0) - (source.shares[party] ?? 0));
      max = Math.max(max, diff);
      compared += 1;
    }
  }
  return { max, compared };
}

export { PARTIES as MAP_PARTIES, blank as isBlankVote, AC_NAME_BY_NO };
