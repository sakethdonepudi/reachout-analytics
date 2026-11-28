/**
 * Survey upload regression tests.
 *
 * The trimmed fixture is committed, so CI covers the district-seat array shape
 * and the passthrough rules for new months, sub-periods and profile keys.
 * The real dashboard files contain ad spend and are never committed: point
 * SURVEY_TN_HTML, SURVEY_AP_HTML, SURVEY_KA_HTML and SURVEY_TG_HTML at local
 * copies to run the full check.
 * When either variable is missing that file is skipped, which keeps CI green.
 *
 * Run: npm run test:survey
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { assertAdsSection, parseSurveyHtml, parseSurveyUpload } from "../lib/survey/parse";
import type { SurveyData, SurveyDistrictSeat } from "../lib/survey/types";
import type { TnSlotModel } from "../lib/survey/tn-view-model";
import { latestMonthFromData, latestMonthFromSlots } from "../lib/survey/post-poll";
import { buildSurveyMap } from "../lib/tamil-nadu/survey-map";
import { surveySlots } from "../lib/survey/tn-shared";
import { canonicalDistrictName, splitAcLabel } from "../lib/tamil-nadu/aliases";
import { TN_2021_BASE } from "../lib/tamil-nadu/baseline";

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
check("swing rows exist for every slot even without a stored baseline", () => {
  for (const period of ["op", "ex"] as const) {
    for (const option of surveySlots(parsed, period)) {
      const build = buildSurveyMap(parsed, period, option.key);
      const rows = parsed.regions.filter((region) => (parsed.base?.[region] ?? TN_2021_BASE[region]) && build.slot.expected[region]);
      assert.ok(rows.length > 0, `${period}/${option.key} has no swing rows`);
    }
  }
});
check("messy spacing around window.TN_DATA still parses", () => {
  const messy = fixture.replace("window.TN_DATA=", "window.TN_DATA = ").replace("};\n</script>", "};\n\n</script>");
  const next = parseSurveyHtml(messy, "tamil-nadu");
  assert.equal(next.periods.op.n, 40);
});
check("a file without the payload gets a clear error", () => {
  assert.throws(() => parseSurveyHtml("<html><body>No dashboard here</body></html>", "tamil-nadu"), /does not contain window\.TN_DATA/);
});
check("a dashboard without ads is rejected before publish", () => {
  assert.throws(() => assertAdsSection(parsed), /no ads section/i);
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
  { state: "karnataka", env: "SURVEY_KA_HTML", expectDist: false },
  { state: "telangana", env: "SURVEY_TG_HTML", expectDist: false },
];
for (const item of realFiles) {
  const path = process.env[item.env];
  if (!path) {
    console.log(`  - ${item.env} is not set; skipping the ${item.state} real-file check`);
    continue;
  }
  assert.ok(existsSync(path), `${item.env} points at a missing file: ${path}`);
  check(`parses and validates the real ${item.state} dashboard`, () => {
    const source = readFileSync(path, "utf8");
    const data = parseSurveyUpload(source, item.state);
    const required = item.state === "tamil-nadu" ? ["op", "ex", "rs"] : item.state === "karnataka" || item.state === "telangana" ? ["rd"] : ["op", "ex", "rd"];
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
    if (item.state === "karnataka") {
      assert.deepEqual(data.parties, ["INC", "BJP", "JDS", "Others"]);
      assert.equal(data.n_total, 8489);
      const rd = data.periods.rd;
      assert.equal(rd.n, 6595);
      assert.equal(rd.nw, 5124);
      assert.equal(rd.from, "27 Oct 2026");
      assert.equal(rd.to, "28 Nov 2026");
      assert.deepEqual(Object.keys(rd.months ?? {}), ["2026-10", "2026-11"]);
      assert.equal(rd.months?.["2026-10"]?.n, 1927);
      assert.equal(rd.months?.["2026-11"]?.n, 4668);
      assert.deepEqual(Object.keys(rd.months?.["2026-11"]?.sub ?? {}), ["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
      assert.deepEqual(rd.expected.Karnataka, { INC: 38.42, BJP: 37.29, JDS: 16.14, Others: 8.15 });
      assert.deepEqual(data.actual.Karnataka, { INC: 42.97, BJP: 35.98, JDS: 13.19, Others: 7.87 });
      assert.deepEqual(rd.seats, { INC: 88, BJP: 93, JDS: 35, Others: 8, zones: { "Kittur Karnataka": { acs: 50, INC: 17, BJP: 31, JDS: 2, Others: 0 }, "Kalyana Karnataka": { acs: 41, INC: 19, BJP: 14, JDS: 5, Others: 3 }, Central: { acs: 25, INC: 14, BJP: 8, JDS: 2, Others: 1 }, Coastal: { acs: 19, INC: 3, BJP: 14, JDS: 1, Others: 1 }, Bengaluru: { acs: 32, INC: 11, BJP: 20, JDS: 1, Others: 0 }, "Old Mysore": { acs: 57, INC: 24, BJP: 6, JDS: 24, Others: 3 } } });
      assert.deepEqual(data.meta?.seats23, { INC: 135, BJP: 66, JDS: 19, Others: 4 });
      const summary = data.meta?.summary as { latestEntry: string; pastVote: Record<string, { INC: number; BJP: number; JDS: number; Others: number; seats: number[]; majority: string | null }> };
      assert.equal(summary.latestEntry, "28 Nov at 06:17");
      assert.deepEqual(summary.pastVote["2026-11"], { INC: 36.6, BJP: 38.9, JDS: 17.4, Others: 7.1, seats: [69, 110, 39, 6], majority: null });
      assert.deepEqual(summary.pastVote["2026-10"], { INC: 36.8, BJP: 44.1, JDS: 13.9, Others: 5.2, seats: [51, 137, 30, 6], majority: "BJP" });
      assert.deepEqual(summary.pastVote.all, { INC: 36.7, BJP: 40.4, JDS: 16.4, Others: 6.5, seats: [62, 119, 37, 6], majority: "BJP" });
      const kaMonths = rd.months ?? {};
      assert.deepEqual(kaMonths["2026-10"]?.expected.Karnataka, { INC: 39.36, BJP: 39.37, JDS: 13.76, Others: 7.51 });
      assert.deepEqual(kaMonths["2026-11"]?.expected.Karnataka, { INC: 38.02, BJP: 36.49, JDS: 17.09, Others: 8.4 });
      assert.deepEqual({ INC: kaMonths["2026-10"]?.seats.INC, BJP: kaMonths["2026-10"]?.seats.BJP, JDS: kaMonths["2026-10"]?.seats.JDS, Others: kaMonths["2026-10"]?.seats.Others }, { INC: 90, BJP: 104, JDS: 24, Others: 6 });
      assert.deepEqual({ INC: kaMonths["2026-11"]?.seats.INC, BJP: kaMonths["2026-11"]?.seats.BJP, JDS: kaMonths["2026-11"]?.seats.JDS, Others: kaMonths["2026-11"]?.seats.Others }, { INC: 92, BJP: 88, JDS: 36, Others: 8 });
      assert.deepEqual(Object.keys(rd.demo ?? {}), ["zone", "area", "dist", "ac", "month", "v23", "caste", "age", "cm", "issue"]);
      assert.equal(rd.demo?.ac?.rows.length, 31);
      assert.equal(rd.demo?.dist?.rows.length, 31);
      const geo = data.geo as { dist: Record<string, string[]>; zone: Record<string, string[]>; area: Record<string, string[]> };
      assert.equal(Object.keys(geo.dist).length, 31);
      assert.equal(Object.values(geo.dist).flat().length, 224);
      assert.equal(new Set(Object.values(geo.dist).flat()).size, 224);
      assert.deepEqual(Object.fromEntries(Object.entries(geo.zone).map(([name, names]) => [name, names.length])), { "Kittur Karnataka": 50, "Kalyana Karnataka": 41, Central: 25, Coastal: 19, Bengaluru: 32, "Old Mysore": 57 });
      assert.deepEqual(Object.fromEntries(Object.entries(geo.area).map(([name, names]) => [name, names.length])), { "North Karnataka": 91, "South Karnataka": 89, Coastal: 19, Central: 25 });
      const ads = data.ads as unknown as { total: Record<string, number>; accounts: unknown[]; camps: Record<string, unknown[]> };
      assert.equal(ads.total.n, 1);
      assert.equal(ads.total.reach, 867185);
      assert.equal(ads.total.impr, 1978908);
      assert.equal(ads.total.clicks, 115474);
      assert.equal(ads.total.views, 0);
      assert.equal(ads.total.eng, 0);
      assert.equal(ads.accounts.length, 1);
      assert.equal(ads.camps.screenshot?.length, 1);
      return;
    }
    if (item.state === "telangana") {
      assert.deepEqual(data.parties, ["BRS", "INC", "BJP", "AIMIM", "Others"]);
      assert.equal(data.n_total, 5453);
      const rd = data.periods.rd;
      assert.equal(rd.n, 4744);
      assert.equal(rd.nw, 4044);
      assert.equal(rd.from, "17 Jul 2026");
      assert.equal(rd.to, "28 Nov 2026");
      assert.deepEqual(Object.keys(rd.months ?? {}), ["2026-10", "2026-11"]);
      assert.equal(rd.months?.["2026-10"]?.n, 3694);
      assert.equal(rd.months?.["2026-11"]?.n, 869);
      assert.deepEqual(Object.keys(rd.months?.["2026-11"]?.sub ?? {}), ["2026-11-09", "2026-11-16", "2026-11-23"]);
      assert.deepEqual(rd.expected.Telangana, { BRS: 50.55, INC: 22.85, BJP: 17.26, AIMIM: 2.22, Others: 7.13 });
      assert.deepEqual(data.actual.Telangana, { BRS: 37.35, INC: 39.4, BJP: 13.9, AIMIM: 2.22, Others: 7.13 });
      assert.deepEqual({ BRS: rd.seats.BRS, INC: rd.seats.INC, BJP: rd.seats.BJP, AIMIM: rd.seats.AIMIM, Others: rd.seats.Others }, { BRS: 102, INC: 4, BJP: 5, AIMIM: 7, Others: 1 });
      assert.deepEqual(data.meta?.seats23, { BRS: 39, INC: 64, BJP: 8, AIMIM: 7, Others: 1 });
      assert.deepEqual(Object.keys(rd.demo ?? {}), ["zone", "area", "dist", "ac", "v23", "age"]);
      assert.match(rd.demo?.age?.cov ?? "", /does not ask|has no age/i);
      const ads = data.ads as unknown as { total: Record<string, number>; accounts: unknown[]; camps: Record<string, unknown[]> };
      assert.equal(ads.total.n, 3);
      assert.equal(ads.total.reach, 3371375);
      assert.equal(ads.total.impr, 9907704);
      assert.equal(ads.total.clicks, 128490);
      assert.equal(ads.total.views, 0);
      assert.equal(ads.total.eng, 0);
      assert.equal(ads.accounts.length, 1);
      assert.equal(ads.camps.screenshot?.length, 3);
      return;
    }
    if (item.state === "tamil-nadu") {
      assert.ok(data.base?.["Tamil Nadu"], "2021 baseline is kept for the swing table");
      for (const period of ["op", "ex"] as const) {
        for (const option of surveySlots(data, period)) {
          const build = buildSurveyMap(data, period, option.key);
          const rows = data.regions.filter((region) => (data.base?.[region] ?? TN_2021_BASE[region]) && build.slot.expected[region]);
          assert.ok(rows.length > 0, `${period}/${option.key} has no swing rows`);
        }
      }
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
    for (const wrong of ["tamil-nadu", "andhra-pradesh-2024", "karnataka", "telangana"].filter((state) => state !== item.state)) {
      assert.throws(() => parseSurveyUpload(source, wrong), /dashboard|payload/);
    }
  });
}

console.log("\n3. Post-poll default follows the newest month");
const synthetic = {
  parties: [],
  regions: [],
  actual: {},
  ads: { label: "", range: "" },
  n_total: 50,
  periods: {
    rd: {
      label: "Post-poll",
      n: 50,
      expected: {},
      seats: {},
      months: {
        "2025": { label: "2025", n: 10, expected: {}, seats: {}, sub: { "2025-12": { label: "Dec 2025", n: 10, expected: {}, seats: {} } } },
        "2026": { label: "2026 (till date)", n: 40, expected: {}, seats: {}, sub: { "2026-01": { label: "Jan 2026", n: 5, expected: {}, seats: {} }, "2026-11": { label: "Nov 2026", n: 35, expected: {}, seats: {} } } },
      },
    },
  },
} as unknown as SurveyData;
check("latest month from data is the newest month key", () => {
  assert.equal(latestMonthFromData(synthetic, "rd"), "2026-11");
});
const syntheticSlots = [
  { key: "all", label: "All years", buttonLabel: "All years", n: 50 },
  { key: "2025", label: "2025", buttonLabel: "2025", monthKey: "2025", n: 10 },
  { key: "2025-12", label: "Dec 2025", buttonLabel: "Dec 2025", monthKey: "2025", subKey: "2025-12", n: 10 },
  { key: "2026", label: "2026 (till date)", buttonLabel: "2026 (till date)", monthKey: "2026", n: 40 },
  { key: "2026-11", label: "Nov 2026", buttonLabel: "Nov 2026", monthKey: "2026", subKey: "2026-11", n: 35 },
].map((slot) => ({ ...slot, from: "", to: "", expected: {}, seats: {}, demoCatalog: {}, profiles: {}, lazyProfiles: [] })) as TnSlotModel[];
check("latest serialized slot is the newest month key", () => {
  assert.equal(latestMonthFromSlots(syntheticSlots), "2026-11");
});
check("a later synthetic month moves the default", () => {
  const later = structuredClone(synthetic);
  later.periods.rd.months!["2026"].sub!["2026-12"] = { label: "Dec 2026", n: 2, expected: {}, seats: {} };
  assert.equal(latestMonthFromData(later, "rd"), "2026-12");
});

console.log(`\nSURVEY PARSE ${passed} passed`);
