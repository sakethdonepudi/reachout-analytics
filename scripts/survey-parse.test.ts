/**
 * Survey upload regression tests.
 *
 * The trimmed fixture is committed, so CI covers the district-seat array shape.
 * The two real dashboard files contain ad spend and are never committed: point
 * SURVEY_TN_HTML and SURVEY_AP_HTML at local copies to run the full check.
 * When either variable is missing that file is skipped, which keeps CI green.
 *
 * Run: npm run test:survey
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseSurveyHtml } from "../lib/survey/parse";
import { parseSurveyWorkbook, surveyDataToWorkbook } from "../lib/survey/excel";
import type { SurveyDistrictSeat } from "../lib/survey/types";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

console.log("\n1. Committed fixture (array dist)");
const fixture = readFileSync("tests/fixtures/survey/tn-min.html", "utf8");
const parsed = parseSurveyHtml(fixture, "tamil-nadu");
check("parses the Tamil Nadu fixture", () => {
  assert.deepEqual(Object.keys(parsed.periods), ["op", "ex", "rs"]);
  assert.equal(parsed.n_total, 60);
});
check("Result dist stays an array of district rows", () => {
  const dist = parsed.periods.rs.dist;
  assert.ok(Array.isArray(dist), "dist should be an array");
  assert.equal(dist.length, 2);
  const [first] = dist as SurveyDistrictSeat[];
  assert.equal(first.d, "Chennai");
  assert.equal(first.acs, 3);
  assert.equal(first.TVK, 2);
  assert.equal(first["DMK+"], 1);
});
check("Excel round trip keeps the same dist array shape", () => {
  const workbook = surveyDataToWorkbook(parsed, "tamil-nadu");
  const back = parseSurveyWorkbook(workbook, "tamil-nadu");
  assert.deepEqual(back.periods.rs.dist, parsed.periods.rs.dist);
});

console.log("\n2. Real dashboard files (local paths from env)");
const realFiles: Array<{ state: string; env: string; expectDist: boolean }> = [
  { state: "tamil-nadu", env: "SURVEY_TN_HTML", expectDist: true },
  { state: "andhra-pradesh-2024", env: "SURVEY_AP_HTML", expectDist: false },
];
for (const item of realFiles) {
  const path = process.env[item.env];
  if (!path) {
    console.log(`  - ${item.env} is not set; skipping the ${item.state} real-file check`);
    continue;
  }
  assert.ok(existsSync(path), `${item.env} points at a missing file: ${path}`);
  check(`parses the real ${item.state} dashboard`, () => {
    const data = parseSurveyHtml(readFileSync(path, "utf8"), item.state);
    const required = item.state === "tamil-nadu" ? ["op", "ex", "rs"] : ["op", "ex", "rd"];
    assert.deepEqual(Object.keys(data.periods), required);
    if (item.expectDist) {
      assert.ok(Array.isArray(data.periods.rs.dist));
      assert.equal(data.periods.rs.dist.length, 38);
      assert.equal((data.periods.rs.dist as SurveyDistrictSeat[]).reduce((sum, row) => sum + row.acs, 0), 234);
    }
    if (item.state === "andhra-pradesh-2024") {
      const years = data.periods.rd.months ?? {};
      assert.deepEqual(Object.keys(years), ["2024", "2025", "2026"]);
    }
  });
}

console.log(`\nSURVEY PARSE ${passed} passed`);
