import AC_GEO from "@/lib/data/tamil-nadu/tn-acs.json";
import DISTRICT_GEO from "@/lib/data/tamil-nadu/tn-districts.json";
import type { TnAc, TnDistrict, TnGroup, TnSeatGroup, TnShares, TnSurvey } from "./model";
import type { SurveyData, SurveyDemo, SurveyPeriod, SurveyShare } from "@/lib/survey/types";
import { canonicalAcName, canonicalDistrictName, splitAcLabel } from "./aliases";

const PARTY_TO_GROUP: Record<string, TnGroup> = {
  TVK: "TVK",
  "DMK+": "DMK+INC+VCK",
  "AIADMK+": "AIADMK+BJP+PMK+AMMK",
  NTK: "NTK",
  Others: "Others",
};

type AcFeature = { properties: { no: number; name: string; district: string } };
type DistrictFeature = { properties: { district: string } };
const AC_FEATURES = (AC_GEO as unknown as { features: AcFeature[] }).features;
const DISTRICT_FEATURES = (DISTRICT_GEO as unknown as { features: DistrictFeature[] }).features;

export const AC_DISTRICT_BY_NO = new Map(AC_FEATURES.map((f) => [f.properties.no, canonicalDistrictName(f.properties.district)]));
export const AC_NAME_BY_NO = new Map(AC_FEATURES.map((f) => [f.properties.no, f.properties.name]));
export const TN_DISTRICTS = DISTRICT_FEATURES.map((f) => canonicalDistrictName(f.properties.district));
export const TN_ACS = AC_FEATURES.map((f) => ({ no: f.properties.no, name: f.properties.name, district: canonicalDistrictName(f.properties.district) }));

const EMPTY_SEATS: Record<TnSeatGroup, number> = { TVK: 0, "AIADMK+BJP+PMK+AMMK": 0, "DMK+INC+VCK": 0 };
const EMPTY_SURVEY: TnSurvey = {
  valid: 0,
  counts: { TVK: 0, "AIADMK+BJP+PMK+AMMK": 0, "DMK+INC+VCK": 0, NTK: 0, NOTA: 0, Others: 0 },
  shares: null,
  leader: null,
  runnerUp: null,
  marginPp: undefined,
};
const EMPTY_HISTORICAL = {
  "2011": { shares: null, available: false, winner: null },
  "2016": { shares: null, available: false, winner: null },
  "2021": { shares: null, available: false, winner: null },
} as TnAc["historical"];

export type SurveyMapRow = {
  name: string;
  n: number;
  shares: TnShares | null;
  leader: TnGroup | null;
  marginPp: number | null;
};

export type SurveyMapSlot = {
  key: string;
  label: string;
  periodKey: string;
  slotKey: string;
  n: number;
  from: string;
  to: string;
  demo: Record<string, SurveyDemo>;
  demoCatalog?: Record<string, { label: string; cov?: string }>;
  expected: Record<string, SurveyShare>;
  seats: Record<string, unknown>;
};

export type SurveyMapBuild = {
  slot: SurveyMapSlot;
  acs: TnAc[];
  districts: TnDistrict[];
  districtRows: Map<string, SurveyMapRow>;
  acRows: Map<number, SurveyMapRow>;
  resultRows: Map<string, { acs: number; seats: Record<string, number>; total: number }>;
};

function sharesFromRow(row: { v: number[] }, parties: string[], n: number): { shares: TnShares | null; leader: TnGroup | null; marginPp: number | null } {
  if (n < 30) return { shares: null, leader: null, marginPp: null };
  const shares: TnShares = {};
  let total = 0;
  for (let index = 0; index < parties.length; index += 1) {
    const group = PARTY_TO_GROUP[parties[index]];
    const value = Number(row.v[index] ?? 0);
    if (!group) continue;
    shares[group] = value / 100;
    total += value;
  }
  if (!total) return { shares: null, leader: null, marginPp: null };
  const ranked = (Object.entries(shares) as Array<[TnGroup, number]>).sort((a, b) => b[1] - a[1]);
  return {
    shares,
    leader: ranked[0]?.[0] ?? null,
    marginPp: ranked.length > 1 ? (ranked[0][1] - ranked[1][1]) * 100 : null,
  };
}

function slotFromPeriod(periodKey: string, period: SurveyPeriod, monthKey: string, subKey: string): SurveyMapSlot {
  const month = monthKey ? period.months?.[monthKey] : null;
  const sub = month?.sub?.[subKey];
  const base = sub ?? month ?? period;
  const label = periodKey === "rs"
    ? period.label
    : sub
      ? `${period.label} · ${month?.label ?? monthKey} · ${sub.label}`
      : month
        ? `${period.label} · ${month.label}`
        : `${period.label} (all ${periodKey === "ex" ? "days" : "months"})`;
  return {
    key: subKey ? `${monthKey}/${subKey}` : monthKey || "all",
    label,
    periodKey,
    slotKey: subKey ? `${monthKey}/${subKey}` : monthKey || "all",
    n: base.n,
    from: base.from ?? period.from ?? "",
    to: base.to ?? period.to ?? "",
    demo: base.demo ?? {},
    demoCatalog: base.demoCatalog,
    expected: base.expected,
    seats: base.seats,
  };
}

export function surveySlots(data: SurveyData, periodKey: string): Array<{ key: string; label: string; monthKey?: string; subKey?: string }> {
  const period = data.periods[periodKey];
  if (!period) return [];
  const list: Array<{ key: string; label: string; monthKey?: string; subKey?: string }> = [{ key: "all", label: periodKey === "ex" ? "All days" : "All months" }];
  for (const [monthKey, month] of Object.entries(period.months ?? {})) {
    list.push({ key: monthKey, label: month.label, monthKey });
    for (const [subKey, sub] of Object.entries(month.sub ?? {})) list.push({ key: subKey, label: sub.label, monthKey, subKey });
  }
  return list;
}

export function resolveSurveySlot(data: SurveyData, periodKey: string, requested?: string | null): SurveyMapSlot | null {
  const period = data.periods[periodKey];
  if (!period) return null;
  if (!requested || requested === "all") return slotFromPeriod(periodKey, period, "", "");
  if (period.months?.[requested]) return slotFromPeriod(periodKey, period, requested, "");
  for (const [monthKey, month] of Object.entries(period.months ?? {})) {
    if (month.sub?.[requested]) return slotFromPeriod(periodKey, period, monthKey, requested);
  }
  return slotFromPeriod(periodKey, period, "", "");
}

function makeSurvey(row: SurveyMapRow | undefined): TnSurvey {
  if (!row || !row.shares || row.n < 30) return { ...EMPTY_SURVEY };
  return { ...EMPTY_SURVEY, valid: row.n, shares: row.shares, leader: row.leader, marginPp: row.marginPp ?? undefined };
}

export function buildSurveyMap(data: SurveyData, periodKey: string, slotKey?: string | null): SurveyMapBuild {
  const slot = resolveSurveySlot(data, periodKey, slotKey);
  if (!slot) throw new Error(`No survey period ${periodKey}.`);
  const districtRows = new Map<string, SurveyMapRow>();
  const acRows = new Map<number, SurveyMapRow>();
  const resultRows = new Map<string, { acs: number; seats: Record<string, number>; total: number }>();

  if (periodKey === "rs") {
    for (const row of (data.periods.rs?.dist ?? [])) {
      const name = canonicalDistrictName(row.d);
      const seats: Record<string, number> = {};
      for (const party of ["TVK", "DMK+", "AIADMK+", "NTK", "Others"]) {
        const value = Number(row[party] ?? 0);
        if (Number.isFinite(value) && value > 0) seats[party] = value;
      }
      const total = Object.values(seats).reduce((sum, value) => sum + value, 0);
      const shares: TnShares = {};
      for (const [party, value] of Object.entries(seats)) {
        const group = PARTY_TO_GROUP[party];
        if (group) shares[group] = total ? value / total : 0;
      }
      const ranked = (Object.entries(shares) as Array<[TnGroup, number]>).sort((a, b) => b[1] - a[1]);
      districtRows.set(name, {
        name,
        n: row.acs,
        shares: total ? shares : null,
        leader: ranked[0]?.[0] ?? null,
        marginPp: ranked.length > 1 ? (ranked[0][1] - ranked[1][1]) * 100 : null,
      });
      resultRows.set(name, { acs: row.acs, seats, total });
    }
  } else {
    const districtDemo = slot.demo.dist;
    for (const row of districtDemo?.rows ?? []) {
      const name = canonicalDistrictName(row.g);
      districtRows.set(name, { name, n: row.n, ...sharesFromRow(row, data.parties, row.n) });
    }
    const acDemo = slot.demo.ac;
    for (const row of acDemo?.rows ?? []) {
      const { no, name } = splitAcLabel(row.g);
      const acNo = no ?? [...AC_NAME_BY_NO.entries()].find(([, acName]) => acName === canonicalAcName(name))?.[0] ?? null;
      if (acNo == null) continue;
      acRows.set(acNo, { name: AC_NAME_BY_NO.get(acNo) ?? canonicalAcName(name), n: row.n, ...sharesFromRow(row, data.parties, row.n) });
    }
  }

  const districts: TnDistrict[] = TN_DISTRICTS.map((name) => {
    const row = districtRows.get(name);
    const acs = TN_ACS.filter((ac) => ac.district === name).map((ac) => ac.no);
    return {
      name,
      acs,
      survey: makeSurvey(row),
      surveyLeader: row?.leader ?? null,
      originalSeats: { ...EMPTY_SEATS },
      modelSeats: { ...EMPTY_SEATS },
      finalSeats: { ...EMPTY_SEATS },
      actualSeats: { ...EMPTY_SEATS },
      historical: JSON.parse(JSON.stringify(EMPTY_HISTORICAL)) as TnDistrict["historical"],
      coverage: { acs: acs.length, responses: row?.n ?? 0 },
    };
  });

  const acs: TnAc[] = TN_ACS.map((ac) => {
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
      historical: JSON.parse(JSON.stringify(EMPTY_HISTORICAL)) as TnAc["historical"],
      match: false,
      noData: !row || row.n < 30,
    };
  });

  return { slot, acs, districts, districtRows, acRows, resultRows };
}

/** Party labels used by the uploaded survey data, in the header card order. */
export function surveyPartyShares(expected: SurveyShare, parties: string[]): Array<{ party: string; share: number }> {
  return parties.map((party) => ({ party, share: Number(expected[party] ?? 0) }));
}

export function accuracyAgainst(expected: SurveyShare, actual: SurveyShare, parties: string[]): number {
  return 100 - parties.reduce((sum, party) => sum + Math.abs((expected[party] ?? 0) - (actual[party] ?? 0)), 0) / 2;
}
