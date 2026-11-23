/**
 * Synthetic 200-row map fixture and alias tests.
 * Run: npm run test:tn-map
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { aggregateRows, mapParty, opinionFilter, rawAcDistrict, trackingRows } from "../lib/tamil-nadu/map-aggregate";
import { canonicalAcName, canonicalDistrictName, resolveAcDistrict } from "../lib/tamil-nadu/aliases";
import { AC_DISTRICT_BY_NO } from "../lib/tamil-nadu/survey-map";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const workbook = XLSX.readFile("tests/fixtures/tn-map/raw-200.xlsx");
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["Raw Data"], { defval: "" });

console.log("\n1. Vote bloc mapping");
check("AIADMK+ (NDA) maps to AIADMK+", () => assert.equal(mapParty("AIADMK+ (NDA)"), "AIADMK+"));
check("DMK+ maps to DMK+", () => assert.equal(mapParty("DMK+INC+VCK"), "DMK+"));
check("Undecided and blank are excluded", () => { assert.equal(mapParty("Undecided"), null); assert.equal(mapParty(""), null); });

console.log("\n2. Name aliases and the Tiruppattur split");
check("Mayiladuturai maps to Mayiladuthurai", () => assert.equal(canonicalDistrictName("Mayiladuturai"), "Mayiladuthurai"));
check("Viluppuram maps to Villupuram", () => assert.equal(canonicalDistrictName("Viluppuram"), "Villupuram"));
check("Thiruvarur maps to Tiruvarur", () => assert.equal(canonicalDistrictName("Thiruvarur"), "Tiruvarur"));
check("Kanyakumari maps to Kanniyakumari", () => assert.equal(canonicalDistrictName("Kanyakumari"), "Kanniyakumari"));
check("Nilgiris maps to The Nilgiris", () => assert.equal(canonicalDistrictName("Nilgiris"), "The Nilgiris"));
check("Tirupattur maps to Tirupathur", () => assert.equal(canonicalDistrictName("Tirupattur"), "Tirupathur"));
check("AC labels drop the number prefix", () => { assert.deepEqual(canonicalAcName("12 Tiruppattur"), "Tiruppattur"); });
check("Tiruppattur is split by Zone, never by name", () => {
  assert.equal(resolveAcDistrict({ name: "Tiruppattur", zone: "North", districtByNo: AC_DISTRICT_BY_NO }), "Tirupathur");
  assert.equal(resolveAcDistrict({ name: "Tiruppattur", zone: "South", districtByNo: AC_DISTRICT_BY_NO }), "Sivaganga");
  assert.equal(rawAcDistrict({ "Assembly Constituency": "Tiruppattur", Zone: "North" }), "Tirupathur");
  assert.equal(rawAcDistrict({ "Assembly Constituency": "Tiruppattur", Zone: "South" }), "Sivaganga");
});

console.log("\n3. Aggregation, threshold and aliases");
const opinion = aggregateRows(opinionFilter(rows, "all"));
check("repeat-device rows are excluded from the verification set", () => assert.equal(opinion.n, 140));
check("groups under 30 responses are hidden", () => { assert.equal(opinion.districts.Ariyalur.n, 20); assert.equal(opinion.districts.Ariyalur.shares, null); });
check("Mayiladuturai rows land in Mayiladuthurai", () => { assert.equal(opinion.districts.Mayiladuthurai.n, 50); assert.ok(opinion.districts.Mayiladuthurai.shares); });
check("tracking months are kept per month", () => {
  assert.equal(aggregateRows(trackingRows(rows, "District Swing", "2025-10")).n, 5);
  assert.equal(aggregateRows(trackingRows(rows, "Tracking Survey", "2026-01")).n, 5);
});

console.log(`\nTN MAP ${passed} passed`);
