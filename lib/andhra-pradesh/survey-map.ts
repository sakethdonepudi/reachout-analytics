import AC_GEO from "@/lib/data/andhra-pradesh/ap-acs.json";
import DISTRICT_GEO from "@/lib/data/andhra-pradesh/ap-districts.json";
import type { SurveyData, SurveyDemo, SurveyShare } from "@/lib/survey/types";
import type { SurveyMapBuild, SurveyMapRow, SurveyMapSlot } from "@/lib/tamil-nadu/survey-map";
import type { TnAc, TnDistrict, TnGroup, TnShares } from "@/lib/tamil-nadu/model";
import { canonicalApAcName, canonicalApDistrict, splitApAcLabel } from "./aliases";

type AcFeature = { properties: { no: number; name: string; district: string; centroid?: [number, number] } };
type DistrictFeature = { properties: { district: string; centroid?: [number, number]; acs?: number } };
const AC_FEATURES = (AC_GEO as unknown as { features: AcFeature[] }).features;
const DISTRICT_FEATURES = (DISTRICT_GEO as unknown as { features: DistrictFeature[] }).features;

export const AP_AC_DISTRICT_BY_NO = new Map(AC_FEATURES.map((feature) => [feature.properties.no, canonicalApDistrict(feature.properties.district)]));
export const AP_AC_NAME_BY_NO = new Map(AC_FEATURES.map((feature) => [feature.properties.no, feature.properties.name]));
export const AP_DISTRICTS = DISTRICT_FEATURES.map((feature) => canonicalApDistrict(feature.properties.district));
export const AP_ACS = AC_FEATURES.map((feature) => ({ no: feature.properties.no, name: feature.properties.name, district: canonicalApDistrict(feature.properties.district) }));

const EMPTY_COUNTS = { TVK: 0, "AIADMK+BJP+PMK+AMMK": 0, "DMK+INC+VCK": 0, NTK: 0, NOTA: 0, Others: 0 } as Record<TnGroup, number>;
const EMPTY_SEATS = { TVK: 0, "AIADMK+BJP+PMK+AMMK": 0, "DMK+INC+VCK": 0 } as const;

function sharesFromRow(row: { v: number[] }, parties: string[], n: number): { shares: TnShares | null; leader: TnGroup | null; marginPp: number | null } {
  if (n < 30) return { shares: null, leader: null, marginPp: null };
  const shares: TnShares = {};
  let total = 0;
  for (let index = 0; index < parties.length; index += 1) {
    const value = Number(row.v[index] ?? 0);
    if (!Number.isFinite(value)) continue;
    shares[parties[index] as TnGroup] = value / 100;
    total += value;
  }
  if (!total) return { shares: null, leader: null, marginPp: null };
  const ranked = (Object.entries(shares) as Array<[TnGroup, number]>).sort((a, b) => b[1] - a[1]);
  return { shares, leader: ranked[0]?.[0] ?? null, marginPp: ranked.length > 1 ? (ranked[0][1] - ranked[1][1]) * 100 : null };
}

function slotFromPeriod(periodKey: string, period: SurveyData["periods"][string], monthKey: string, subKey: string): SurveyMapSlot {
  const month = monthKey ? period.months?.[monthKey] : null;
  const sub = month?.sub?.[subKey];
  const base = sub ?? month ?? period;
  const label = sub ? `${period.label} · ${month?.label ?? monthKey} · ${sub.label}` : month ? `${period.label} · ${month.label}` : `${period.label} (all ${periodKey === "rd" ? "years" : "months"})`;
  return { key: subKey ? `${monthKey}/${subKey}` : monthKey || "all", label, periodKey, slotKey: subKey ? `${monthKey}/${subKey}` : monthKey || "all", n: base.n, from: base.from ?? period.from ?? "", to: base.to ?? period.to ?? "", demo: base.demo ?? {}, demoCatalog: base.demoCatalog, expected: base.expected, seats: base.seats };
}

function emptySurvey() {
  return { valid: 0, counts: { ...EMPTY_COUNTS }, shares: null, leader: null, runnerUp: null, marginPp: undefined };
}

function makeSurvey(row: SurveyMapRow | undefined) {
  if (!row || !row.shares || row.n < 30) return emptySurvey();
  return { ...emptySurvey(), valid: row.n, shares: row.shares, leader: row.leader, marginPp: row.marginPp ?? undefined };
}

export function buildApSurveyMap(data: SurveyData, periodKey: string, slotKey?: string | null): SurveyMapBuild {
  const period = data.periods[periodKey];
  if (!period) throw new Error(`No survey period ${periodKey}.`);
  const monthKey = slotKey && slotKey !== "all" && period.months?.[slotKey] ? slotKey : "";
  const subKey = monthKey ? "" : slotKey && slotKey !== "all" ? Object.entries(period.months ?? {}).find(([, month]) => month.sub?.[slotKey])?.[0] ?? "" : "";
  const slot = slotFromPeriod(periodKey, period, monthKey, subKey ? slotKey ?? "" : "");
  const districtRows = new Map<string, SurveyMapRow>();
  const acRows = new Map<number, SurveyMapRow>();
  const resultRows = new Map<string, { acs: number; seats: Record<string, number>; total: number }>();
  for (const row of slot.demo.dist?.rows ?? []) {
    const name = canonicalApDistrict(row.g);
    districtRows.set(name, { name, n: row.n, ...sharesFromRow(row, data.parties, row.n) });
  }
  for (const row of slot.demo.ac?.rows ?? []) {
    const { no } = splitApAcLabel(row.g);
    if (no == null) continue;
    acRows.set(no, { name: AP_AC_NAME_BY_NO.get(no) ?? canonicalApAcName(row.g), n: row.n, ...sharesFromRow(row, data.parties, row.n) });
  }
  const districts: TnDistrict[] = AP_DISTRICTS.map((name) => {
    const row = districtRows.get(name);
    const acs = AP_ACS.filter((ac) => ac.district === name).map((ac) => ac.no);
    return {
      name,
      acs,
      survey: makeSurvey(row),
      surveyLeader: row?.leader ?? null,
      originalSeats: { ...EMPTY_SEATS },
      modelSeats: { ...EMPTY_SEATS },
      finalSeats: { ...EMPTY_SEATS },
      actualSeats: { ...EMPTY_SEATS },
      historical: {} as TnDistrict["historical"],
      coverage: { acs: acs.length, responses: row?.n ?? 0 },
    };
  });
  const acs: TnAc[] = AP_ACS.map((ac) => {
    const row = acRows.get(ac.no);
    return {
      no: ac.no,
      name: ac.name,
      district: ac.district,
      districtEci: ac.district,
      survey: makeSurvey(row),
      surveyLeader: row?.leader ?? null,
      original: { leader: null },
      model: { leader: null },
      final: { leader: null },
      actual2026: { alliance: "", party: "", winner: null },
      historical: {} as TnAc["historical"],
      match: false,
      noData: !row || row.n < 30,
    };
  });
  return { slot, acs, districts, districtRows, acRows, resultRows };
}

export function apSurveyForClient(data: SurveyData): SurveyData {
  return {
    parties: data.parties,
    regions: data.regions,
    periods: data.periods,
    periodCatalog: Object.entries(data.periods).map(([key, period]) => ({ key, label: period.label })),
    actual: data.actual,
    n_total: data.n_total,
    geo: data.geo,
    zonelabels: data.zonelabels,
    ads: { label: data.ads?.label ?? "Meta ads", range: data.ads?.range ?? "", asOf: data.ads?.asOf, note: data.ads?.note ?? "", total: {}, periods: {} },
  };
}

export function apDemoLeader(demo: SurveyDemo | undefined, parties: string[]): string | null {
  if (!demo?.rows.length) return null;
  const total = demo.rows.reduce((sum, row) => sum + row.n, 0);
  if (!total) return null;
  const weighted = parties.map((party, index) => ({ party, value: demo.rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total }));
  weighted.sort((a, b) => b.value - a.value);
  return weighted[0]?.party ?? null;
}
