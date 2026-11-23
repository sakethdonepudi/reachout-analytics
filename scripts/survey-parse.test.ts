/**
 * Survey upload regression tests.
 *
 * The trimmed fixture is committed, so CI covers the district-seat array shape
 * and the passthrough rules for new months, sub-periods and profile keys.
 * The two real dashboard files contain ad spend and are never committed: point
 * SURVEY_TN_HTML and SURVEY_AP_HTML at local copies to run the full check.
 * When either variable is missing that file is skipped, which keeps CI green.
 *
 * Run: npm run test:survey
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseSurveyHtml } from "../lib/survey/parse";
import type { SurveyDistrictSeat } from "../lib/survey/types";
import { buildSurveyMap } from "../lib/tamil-nadu/survey-map";
import { surveySlots } from "../lib/survey/tn-shared";
import { canonicalDistrictName, splitAcLabel } from "../lib/tamil-nadu/aliases";

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
check("months and sub-periods are read from the fixture", () => {
  assert.deepEqual(Object.keys(parsed.periods.op.months ?? {}), ["2026-03", "2026-04"]);
  assert.deepEqual(Object.keys(parsed.periods.op.months?.["2026-04"]?.sub ?? {}), ["2026-04a"]);
});
check("renaming a month and adding a profile still parses", () => {
  const source = fixture
    .replace(/"2026-03"/g, '"2099-01"')
    .replace(/"label":"Mar 2026"/g, '"label":"Jan 2099"')
    .replace('"religion":{"label":"Religion"', '"newProfile":{"label":"New profile","rows":[{"g":"Test group","n":10,"v":[40,30,20,5,5]}]},"religion":{"label":"Religion"');
  const next = parseSurveyHtml(source, "tamil-nadu");
  assert.ok(next.periods.op.months?.["2099-01"]);
  assert.ok(next.periods.op.demo?.newProfile);
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
    if (item.state === "tamil-nadu") {
      assert.ok(data.base?.["Tamil Nadu"], "2021 baseline is kept for the swing table");
      for (const period of ["op", "ex"] as const) {
        for (const option of surveySlots(data, period)) {
          const build = buildSurveyMap(data, period, option.key);
          for (const row of build.slot.demo.dist?.rows ?? []) {
            const mapped = build.districtRows.get(canonicalDistrictName(row.g));
            assert.ok(mapped, `${period}/${option.key}: missing district ${row.g}`);
            assert.equal(mapped.n, row.n, `${period}/${option.key}/${row.g} n`);
            for (let index = 0; index < data.parties.length; index += 1) {
              const party = data.parties[index];
              const group = ({ TVK: "TVK", "DMK+": "DMK+INC+VCK", "AIADMK+": "AIADMK+BJP+PMK+AMMK", NTK: "NTK", Others: "Others" } as Record<string, string>)[party];
              assert.ok(Math.abs(((mapped.shares as Record<string, number> | null)?.[group] ?? 0) * 100 - (row.v[index] ?? 0)) < 1e-9, `${period}/${option.key}/${row.g} ${party}`);
            }
          }
          for (const row of build.slot.demo.ac?.rows ?? []) {
            const { no } = splitAcLabel(row.g);
            if (no == null) continue;
            const mapped = build.acRows.get(no);
            assert.ok(mapped, `${period}/${option.key}: missing AC ${row.g}`);
            assert.equal(mapped.n, row.n, `${period}/${option.key}/${row.g} n`);
          }
        }
      }
    }
  });
}

console.log(`\nSURVEY PARSE ${passed} passed`);
