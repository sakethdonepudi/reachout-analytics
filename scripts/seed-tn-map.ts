/**
 * Build Tamil Nadu map aggregates from the raw workbook.
 *
 *   npm run seed:tn-map -- --file "/path/TN_2026_Raw_Data.xlsx"
 *
 * Opinion slots are a verification check only: the page's opinion and exit
 * maps use the uploaded HTML's demo.dist / demo.ac rows. This script compares
 * the raw shares (excluding Repeat Device = Yes) with those rows and fails if
 * any share differs by more than 0.1 point. Tracking and district-swing months
 * are stored as hidden aggregates. No respondent fields are stored.
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { getActiveSurvey } from "../lib/survey/store";
import { buildSurveyMap } from "../lib/tamil-nadu/survey-map";
import { publishTnMap, type TnMapSlot, type TnMapVerification } from "../lib/tamil-nadu/map-store";
import {
  OPINION_SLOTS, TRACKING_MONTHS, acDistrictMapFromGeo, acNameNoMapFromSurvey, aggregateRows, compareShares, opinionFilter, trackingRows, type RawRow,
} from "../lib/tamil-nadu/map-aggregate";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function rowsOf(file: string): RawRow[] {
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets["Raw Data"] ?? workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The workbook has no data sheet.");
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
}

(async () => {
  const file = arg("file");
  if (!file) throw new Error("Usage: npm run seed:tn-map -- --file <xlsx>");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required to store the map aggregates.");
  const record = await getActiveSurvey("tamil-nadu");
  if (!record) throw new Error("Upload the Tamil Nadu survey dashboard first; the HTML rows are needed for the verification and the AC to district mapping.");
  const rows = rowsOf(file);
  const parties = record.data.parties;
  const acToDistrict = acDistrictMapFromGeo(record.data);
  const acNameToNo = acNameNoMapFromSurvey(record.data);
  const groupToParty: Record<string, string> = { TVK: "TVK", "DMK+INC+VCK": "DMK+", "AIADMK+BJP+PMK+AMMK": "AIADMK+", NTK: "NTK", Others: "Others", NOTA: "Others" };
  const slots: Record<string, TnMapSlot> = {};
  const verification: TnMapVerification[] = [];
  let failed = false;

  console.log(`Raw rows: ${rows.length.toLocaleString("en-IN")}`);
  console.log("\nOpinion verification (raw repeat-device-clean shares vs uploaded HTML rows)");
  console.log("slot | HTML n | raw n | district max diff | AC max diff | result");
  for (const item of OPINION_SLOTS) {
    const raw = aggregateRows(opinionFilter(rows, item.key), 30, acToDistrict, acNameToNo);
    const html = buildSurveyMap(record.data, "op", item.key);
    const htmlDistricts = Object.fromEntries([...html.districtRows].map(([name, row]) => [name, { n: row.n, shares: row.shares ? Object.fromEntries(Object.entries(row.shares).map(([group, value]) => [groupToParty[group] ?? group, value * 100])) : null }]));
    const htmlAcs = Object.fromEntries([...html.acRows].map(([no, row]) => [String(no), { n: row.n, shares: row.shares ? Object.fromEntries(Object.entries(row.shares).map(([group, value]) => [groupToParty[group] ?? group, value * 100])) : null }]));
    const districtCheck = compareShares(raw.districts, htmlDistricts, parties);
    const acCheck = compareShares(raw.acs, htmlAcs, parties);
    const max = Math.max(districtCheck.max, acCheck.max);
    const passed = max <= 0.1 + 1e-9;
    if (!passed) failed = true;
    verification.push({ slot: item.key, label: item.label, htmlN: html.slot.n, rawN: raw.n, maxShareDiff: Number(max.toFixed(3)), passed });
    console.log(`${item.key} | ${html.slot.n.toLocaleString("en-IN")} | ${raw.n.toLocaleString("en-IN")} | ${districtCheck.max.toFixed(3)} | ${acCheck.max.toFixed(3)} | ${passed ? "PASS" : "FAIL"}`);
    slots[`opinion:${item.key}`] = { key: `opinion:${item.key}`, label: item.label, kind: "opinion-verification", period: "op", n: raw.n, districts: raw.districts, acs: raw.acs };
  }

  console.log("\nTracking months (stored hidden)");
  for (const type of ["District Swing", "Tracking Survey"] as const) {
    const all = aggregateRows(trackingRows(rows, type, null), 30, acToDistrict, acNameToNo);
    const key = type === "District Swing" ? "district-swing:all" : "tracking:all";
    slots[key] = { key, label: `${type} · all months`, kind: type === "District Swing" ? "district-swing" : "tracking", n: all.n, districts: all.districts, acs: all.acs };
    for (const month of TRACKING_MONTHS) {
      const aggregate = aggregateRows(trackingRows(rows, type, month.key), 30, acToDistrict, acNameToNo);
      const slotKey = `${type === "District Swing" ? "district-swing" : "tracking"}:${month.key}`;
      slots[slotKey] = { key: slotKey, label: `${type} · ${month.label}`, kind: type === "District Swing" ? "district-swing" : "tracking", n: aggregate.n, districts: aggregate.districts, acs: aggregate.acs };
      console.log(`${type} ${month.label}: ${aggregate.n.toLocaleString("en-IN")} rows`);
    }
  }

  const version = await publishTnMap(file.split("/").pop() ?? file, slots, verification);
  console.log(`\nStored tn_map_aggregates version ${version} (${Object.keys(slots).length} hidden slots, aggregates only).`);
  if (failed) {
    console.error("Map verification failed: at least one raw share differs from the uploaded HTML by more than 0.1 point.");
    process.exit(1);
  }
  console.log("Map verification passed.");
  process.exit(0);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
