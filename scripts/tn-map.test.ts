/**
 * Synthetic 200-row map fixture and alias tests.
 * Run: npm run test:tn-map
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { aggregateRows, mapParty, opinionFilter, rawAcDistrict, trackingRows } from "../lib/tamil-nadu/map-aggregate";
import { canonicalAcName, canonicalDistrictName, resolveAcDistrict } from "../lib/tamil-nadu/aliases";
import { AC_DISTRICT_BY_NO } from "../lib/tamil-nadu/survey-map";
import { projectedMajority } from "../lib/tamil-nadu/majority";
import { swingLabel, swingTone } from "../lib/tamil-nadu/swing";

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

console.log("\n4. Projection and swing formatting");
const parties = ["TVK", "DMK+", "AIADMK+", "NTK", "Others"];
check("a projected majority uses projected seats, not actual seats", () => {
  const result = projectedMajority({ TVK: 162, "DMK+": 2, "AIADMK+": 62, NTK: 0, Others: 8 }, parties);
  assert.equal(result.leader, "TVK");
  assert.equal(result.seats, 162);
  assert.equal(result.status, "majority");
});
check("the actual 108 seats remain hung", () => {
  const result = projectedMajority({ TVK: 108, "DMK+": 73, "AIADMK+": 53, NTK: 0, Others: 0 }, parties);
  assert.equal(result.status, "hung");
});
check("a tied projection is hung", () => {
  const result = projectedMajority({ TVK: 117, "DMK+": 117, "AIADMK+": 0, NTK: 0, Others: 0 }, parties);
  assert.equal(result.status, "hung");
  assert.equal(result.tie, true);
});
check("negative zero and rounded zero render one zero", () => {
  assert.equal(swingLabel(-0), "(0.0pp)");
  assert.equal(swingLabel(0), "(0.0pp)");
  assert.equal(swingLabel(-0.04), "(0.0pp)");
  assert.equal(swingLabel(0.04), "(0.0pp)");
  assert.equal(swingTone(-0.04), "flat");
});
check("positive and negative swing keep their sign", () => {
  assert.equal(swingLabel(3.24), "(+3.2pp)");
  assert.equal(swingLabel(-3.26), "(-3.3pp)");
  assert.equal(swingTone(3.2), "up");
  assert.equal(swingTone(-3.2), "down");
});

console.log(`\nTN MAP ${passed} passed`);
