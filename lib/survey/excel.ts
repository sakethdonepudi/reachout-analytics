import * as XLSX from "xlsx";
import { surveySchema } from "./schema";
import { SURVEY_STATES, type SurveyData, type SurveyDemoRow, type SurveyPeriod, type SurveyShare } from "./types";

/* Excel round trip for the survey dashboards. The workbook is a flat export
   of the JSON shape so a survey team can rebuild a dashboard without touching
   the HTML. Sheet and column names live in the Read me sheet as well. */

type Row = Record<string, unknown>;

const SHEETS = {
  meta: "Meta",
  periods: "Periods",
  expected: "Expected",
  seats: "Seats",
  seatZones: "SeatZones",
  demographic: "Demographics",
  actual: "Actual",
  ads: "Ads",
} as const;

const TEMPLATE_PARTIES: Record<string, string[]> = {
  "tamil-nadu": ["TVK", "DMK+", "AIADMK+", "NTK", "Others"],
  "andhra-pradesh-2024": ["NDA", "YSRCP", "INC", "Others"],
};

export const SURVEY_EXCEL_COLUMNS: Record<string, string[]> = {
  [SHEETS.meta]: ["key", "value"],
  [SHEETS.periods]: ["period", "label", "n", "nw", "from", "to", "actual", "last", "target", "seat_hit"],
  [SHEETS.expected]: ["period", "region", "party", "pct"],
  [SHEETS.seats]: ["period", "party", "seats"],
  [SHEETS.seatZones]: ["period", "zone", "party", "seats", "acs"],
  [SHEETS.demographic]: ["period", "profile", "profile_label", "coverage", "group", "n", "<party columns>"],
  [SHEETS.actual]: ["region", "party", "pct"],
  [SHEETS.ads]: ["period", "label", "responses", "campaigns", "reach", "impressions", "views", "clicks", "engagement", "spend"],
};

function text(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][value.getUTCMonth()];
    return `${day} ${month} ${value.getUTCFullYear()}`;
  }
  return String(value).trim();
}

function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[,\s%]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flag(value: unknown) {
  const valueText = text(value).toLowerCase();
  return valueText === "true" || valueText === "yes" || valueText === "1";
}

function sheetRows(workbook: XLSX.WorkBook, name: string): Row[] {
  const key = Object.keys(workbook.Sheets).find((sheet) => sheet.toLowerCase() === name.toLowerCase());
  if (!key) return [];
  return XLSX.utils.sheet_to_json<Row>(workbook.Sheets[key], { defval: "" });
}

function requireSheet(rows: Row[], name: string) {
  if (!rows.length) throw new Error(`The workbook needs a ${name} sheet with at least one row.`);
}

export function parseSurveyWorkbook(buffer: Buffer, state: string): SurveyData {
  const meta = SURVEY_STATES[state];
  if (!meta) throw new Error(`Unknown survey state: ${state}`);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const metaRows = sheetRows(workbook, SHEETS.meta);
  requireSheet(metaRows, SHEETS.meta);
  const metaMap = new Map(metaRows.map((row) => [text(row.key).toLowerCase(), row.value]));
  const providedParties = text(metaMap.get("parties")).split(",").map((party) => party.trim()).filter(Boolean);
  const regions = text(metaMap.get("regions")).split(",").map((region) => region.trim()).filter(Boolean);

  const periodRows = sheetRows(workbook, SHEETS.periods);
  requireSheet(periodRows, SHEETS.periods);
  const expectedRows = sheetRows(workbook, SHEETS.expected);
  requireSheet(expectedRows, SHEETS.expected);
  const seatRows = sheetRows(workbook, SHEETS.seats);
  const seatZoneRows = sheetRows(workbook, SHEETS.seatZones);
  const demoRows = sheetRows(workbook, SHEETS.demographic);
  const actualRows = sheetRows(workbook, SHEETS.actual);
  requireSheet(actualRows, SHEETS.actual);

  const parties = providedParties.length
    ? providedParties
    : Array.from(new Set(expectedRows.map((row) => text(row.party)).filter(Boolean)));

  const periods: Record<string, SurveyPeriod> = {};
  for (const row of periodRows) {
    const key = text(row.period).toLowerCase();
    if (!key) continue;
    const expected: Record<string, SurveyShare> = {};
    const seats: Record<string, unknown> = {};
    const demo: SurveyPeriod["demo"] = {};
    const period: SurveyPeriod = {
      label: text(row.label) || key,
      n: num(row.n),
      nw: row.nw === "" ? undefined : num(row.nw),
      from: text(row.from),
      to: text(row.to),
      expected,
      seats,
      demo,
    };
    if (text(row.actual) !== "") period.actual = flag(row.actual);
    const last = text(row.last);
    const target = text(row.target);
    if (last) period.last = last;
    if (target) period.target = target;
    const hit = num(row.seat_hit, NaN);
    if (Number.isFinite(hit)) seats.hit = hit;
    periods[key] = period;
  }

  for (const row of expectedRows) {
    const key = text(row.period).toLowerCase();
    const region = text(row.region);
    const party = text(row.party);
    if (!key || !region || !party || row.pct === "") continue;
    if (!periods[key]) throw new Error(`Expected has a row for an unknown period: ${key}.`);
    if (!parties.includes(party)) throw new Error(`Expected has a party that is not in Meta parties: ${party}.`);
    periods[key].expected[region] ??= {};
    periods[key].expected[region][party] = num(row.pct);
  }

  for (const [key, period] of Object.entries(periods)) {
    if (!period.expected[meta.name]) {
      throw new Error(`Period ${key} needs an Expected row for ${meta.name}.`);
    }
  }

  for (const row of seatRows) {
    const key = text(row.period).toLowerCase();
    const party = text(row.party);
    if (!key || !party) continue;
    if (!periods[key]) throw new Error(`Seats has a row for an unknown period: ${key}.`);
    periods[key].seats[party] = num(row.seats);
  }

  for (const row of seatZoneRows) {
    const key = text(row.period).toLowerCase();
    const zone = text(row.zone);
    const party = text(row.party);
    if (!key || !zone || !party) continue;
    if (!periods[key]) throw new Error(`SeatZones has a row for an unknown period: ${key}.`);
    const zones = (periods[key].seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
    zones[zone] ??= {};
    zones[zone][party] = num(row.seats);
    if (row.acs !== "") zones[zone].acs = num(row.acs);
    periods[key].seats.zones = zones;
  }

  for (const row of demoRows) {
    const key = text(row.period).toLowerCase();
    const profile = text(row.profile);
    const group = text(row.group);
    if (!key || !profile || !group) continue;
    if (!periods[key]) throw new Error(`Demographics has a row for an unknown period: ${key}.`);
    const demo = periods[key].demo ?? {};
    demo[profile] ??= { label: text(row.profile_label) || profile, rows: [] };
    if (row.coverage !== "") demo[profile].cov = text(row.coverage);
    const values = parties.map((party) => num(row[party]));
    const demoRow: SurveyDemoRow = { g: group, n: num(row.n), v: values };
    demo[profile].rows.push(demoRow);
    periods[key].demo = demo;
  }

  const actual: Record<string, SurveyShare> = {};
  for (const row of actualRows) {
    const region = text(row.region);
    const party = text(row.party);
    if (!region || !party || row.pct === "") continue;
    actual[region] ??= {};
    actual[region][party] = num(row.pct);
  }

  const adsRows = sheetRows(workbook, SHEETS.ads);
  const adPeriods: Record<string, Record<string, number | string>> = {};
  const adTotal: Record<string, number> = { n: 0, reach: 0, impr: 0, views: 0, clicks: 0, eng: 0, spend: 0, responses: 0 };
  const fieldMap: Record<string, string> = { responses: "responses", campaigns: "n", reach: "reach", impressions: "impr", views: "views", clicks: "clicks", engagement: "eng", spend: "spend" };
  for (const row of adsRows) {
    const key = text(row.period).toLowerCase();
    if (!key) continue;
    const item: Record<string, number | string> = { label: text(row.label) || key };
    for (const [column, field] of Object.entries(fieldMap)) {
      if (row[column] === "" || row[column] == null) continue;
      const value = num(row[column]);
      item[field] = value;
      if (field in adTotal) adTotal[field] += value;
    }
    adPeriods[key] = item;
  }

  const data: SurveyData = {
    parties,
    regions: regions.length ? regions : Object.keys(actual),
    periods,
    actual,
    ads: {
      label: text(metaMap.get("ads_label")) || "Meta ads",
      range: text(metaMap.get("ads_range")),
      asOf: text(metaMap.get("ads_as_of")) || undefined,
      note: text(metaMap.get("ads_note")) || undefined,
      total: adTotal,
      periods: adPeriods,
    },
    n_total: num(metaMap.get("n_total")),
    geo: undefined,
  };

  const parsed = surveySchema(state).safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`The workbook does not match the ${meta.name} survey schema. ${issue?.path.join(".") ?? ""}: ${issue?.message ?? ""}`.trim());
  }
  return data;
}

export function surveyWorkbookTemplate(state: string): Buffer {
  const meta = SURVEY_STATES[state];
  if (!meta) throw new Error(`Unknown survey state: ${state}`);
  const parties = TEMPLATE_PARTIES[state] ?? [];
  const workbook = XLSX.utils.book_new();

  const readme = [
    ["Survey dashboard Excel template"],
    ["State", meta.name],
    ["How to use", "Fill every sheet below. Leave Meta parties and regions as comma separated names."],
    ["Meta", "key / value pairs: state, n_total, parties, regions, ads_label, ads_range, ads_as_of, ads_note"],
    ["Periods", "One row per period: op (Opinion), ex (Exit) and rs for Tamil Nadu or rd for Andhra Pradesh. Seat_hit is optional."],
    ["Expected", "One row per period, region and party. Use the state name for the statewide row and percentage points (40.0, not 0.40)."],
    ["Seats", "One row per period and party with the projected seat total."],
    ["SeatZones", "One row per period, zone and party. Repeat acs on any party row for that zone."],
    ["Demographics", "One row per period, profile and group. Add one column per party, named exactly as in Meta parties."],
    ["Actual", "One row per region and party with the actual vote share in percentage points."],
    ["Ads", "One row per ads period (pre, op, ex, post or the state's own keys). Spend is owner-only and is stripped for clients."],
    ["Note", "The importer validates the workbook with the same schema as the HTML dashboard."],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(readme), "Read me");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([SURVEY_EXCEL_COLUMNS[SHEETS.meta], ["state", meta.slug], ["n_total", ""], ["parties", parties.join(", ")], ["regions", ""], ["ads_label", ""], ["ads_range", ""], ["ads_as_of", ""], ["ads_note", ""]]), SHEETS.meta);
  for (const [key, headers] of Object.entries(SURVEY_EXCEL_COLUMNS)) {
    if (key === SHEETS.meta) continue;
    const columns = key === SHEETS.demographic ? ["period", "profile", "profile_label", "coverage", "group", "n", ...parties] : headers;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([columns]), key);
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Export the current dashboard to the same workbook shape the importer reads. */
export function surveyDataToWorkbook(data: SurveyData, state: string): Buffer {
  const meta = SURVEY_STATES[state];
  if (!meta) throw new Error(`Unknown survey state: ${state}`);
  const workbook = XLSX.utils.book_new();
  const metaRows: Array<[string, unknown]> = [
    ["state", meta.slug],
    ["n_total", data.n_total],
    ["parties", data.parties.join(", ")],
    ["regions", data.regions.join(", ")],
    ["ads_label", data.ads.label],
    ["ads_range", data.ads.range],
    ["ads_as_of", data.ads.asOf ?? ""],
    ["ads_note", data.ads.note ?? ""],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["key", "value"], ...metaRows]), SHEETS.meta);

  const periodRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.periods]];
  const expectedRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.expected]];
  const seatRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.seats]];
  const zoneRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.seatZones]];
  const demoRows: unknown[][] = [["period", "profile", "profile_label", "coverage", "group", "n", ...data.parties]];
  for (const [key, period] of Object.entries(data.periods)) {
    periodRows.push([key, period.label, period.n, period.nw ?? "", period.from ?? "", period.to ?? "", period.actual === undefined ? "" : period.actual ? "TRUE" : "FALSE", period.last ?? "", period.target ?? "", typeof period.seats.hit === "number" ? period.seats.hit : ""]);
    for (const [region, share] of Object.entries(period.expected)) {
      for (const party of data.parties) {
        if (typeof share[party] === "number") expectedRows.push([key, region, party, share[party]]);
      }
    }
    for (const party of data.parties) {
      if (typeof period.seats[party] === "number") seatRows.push([key, party, period.seats[party]]);
    }
    const zones = (period.seats.zones as Record<string, Record<string, unknown>> | undefined) ?? {};
    for (const [zone, row] of Object.entries(zones)) {
      for (const party of data.parties) {
        if (typeof row[party] !== "number") continue;
        zoneRows.push([key, zone, party, row[party], party === data.parties.find((item) => typeof row[item] === "number") ? row.acs ?? "" : ""]);
      }
    }
    for (const [profile, demo] of Object.entries(period.demo ?? {})) {
      for (const row of demo.rows) {
        demoRows.push([key, profile, demo.label, demo.cov ?? "", row.g, row.n, ...data.parties.map((_party, index) => row.v[index] ?? "")]);
      }
    }
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(periodRows), SHEETS.periods);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(expectedRows), SHEETS.expected);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(seatRows), SHEETS.seats);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(zoneRows), SHEETS.seatZones);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(demoRows), SHEETS.demographic);

  const actualRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.actual]];
  for (const [region, share] of Object.entries(data.actual)) {
    for (const party of data.parties) {
      if (typeof share[party] === "number") actualRows.push([region, party, share[party]]);
    }
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(actualRows), SHEETS.actual);

  const adsRows: unknown[][] = [SURVEY_EXCEL_COLUMNS[SHEETS.ads]];
  for (const [key, period] of Object.entries(data.ads.periods ?? {})) {
    adsRows.push([
      key,
      period.label ?? "",
      period.responses ?? "",
      period.n ?? "",
      period.reach ?? "",
      period.impr ?? "",
      period.views ?? "",
      period.clicks ?? "",
      period.eng ?? "",
      period.spend ?? "",
    ]);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(adsRows), SHEETS.ads);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
