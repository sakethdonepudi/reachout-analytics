import assert from "node:assert/strict";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import acGeo from "@/lib/data/tamil-nadu/tn-acs.json";
import districtGeo from "@/lib/data/tamil-nadu/tn-districts.json";
import { TN_COLOR, TN_GROUPS, tnLeader } from "@/lib/tamil-nadu/model";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const near = (a: number, b: number, e = 1e-5) => Math.abs(a - b) <= e;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
type Group = (typeof TN_GROUPS)[number];
const seatsSum = (o: Record<Group, number>) => sum(TN_GROUPS.map((g) => o[g] ?? 0));

console.log("Tamil Nadu 2026 aggregate workbook");

check("final workbook counts and all-response statewide denominator", () => {
  assert.equal(aggregates.source.totalResponses, 31_316);
  assert.equal(aggregates.source.locatedResponses, 11_449);
  assert.equal(aggregates.source.unlocatedResponses, 19_867);
  assert.equal(aggregates.source.constituencies, 234);
  assert.equal(aggregates.source.districts, 38);
  assert.deepEqual(aggregates.source.crosswalk, { matched: 234, unresolved: 0, method: "assembly name + District (2026 ECI grouping)", duplicateNames: ["Tiruppattur"] });
  assert.deepEqual(aggregates.statewide.counts, { total: 31_316, located: 11_449, unlocated: 19_867 });
  assert.equal(aggregates.statewide.survey.valid, 31_316);
  assert.equal(aggregates.source.assemblyScopedResponses, 10_567);
  assert.equal(sum(TN_GROUPS.map((g) => aggregates.statewide.survey.counts[g])), 31_316);
});

check("five groups, no Others bucket, distinct colours", () => {
  assert.deepEqual(TN_GROUPS, ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"]);
  assert.deepEqual(aggregates.groups, [...TN_GROUPS]);
  assert.equal((TN_GROUPS as readonly string[]).includes("Others"), false);
  assert.ok(TN_GROUPS.every((g) => TN_COLOR[g]));
  assert.equal(new Set(TN_GROUPS.map((g) => TN_COLOR[g].toLowerCase())).size, TN_GROUPS.length);
  assert.ok(aggregates.source.audit.every((a) => !/Others/.test(a.sheet)));
});

check("statewide shares are workbook-derived and total 100%", () => {
  const s = aggregates.statewide.survey.shares;
  assert.ok(s);
  assert.equal(aggregates.statewide.survey.counts.TVK, 10_892);
  assert.equal(aggregates.statewide.survey.counts["AIADMK+BJP+PMK+AMMK"], 8_856);
  assert.equal(aggregates.statewide.survey.counts["DMK+INC+VCK"], 9_146);
  assert.equal(aggregates.statewide.survey.counts.NTK, 2_173);
  assert.equal(aggregates.statewide.survey.counts.NOTA, 249);
  assert.ok(near(s.TVK, 0.347809, 1e-5));
  assert.ok(near(s["AIADMK+BJP+PMK+AMMK"], 0.282795, 1e-5));
  assert.ok(near(s["DMK+INC+VCK"], 0.292055, 1e-5));
  assert.ok(near(s.NTK, 0.069389, 1e-5));
  assert.ok(near(s.NOTA, 0.007951, 1e-5));
  assert.ok(near(sum(TN_GROUPS.map((g) => s[g] ?? 0)), 1, 1e-5));
});

check("TVK reference 34.80 is stored separately from the 34.78 workbook value", () => {
  assert.equal(aggregates.referenceShare.party, "TVK");
  assert.equal(aggregates.referenceShare.label, "Reference share");
  assert.ok(near(aggregates.referenceShare.value, 0.348, 1e-12));
  assert.ok(near(aggregates.referenceShare.workbookValue, 0.347809, 1e-5));
  assert.notEqual(aggregates.referenceShare.value, aggregates.referenceShare.workbookValue);
  assert.equal(aggregates.statewide.survey.counts.TVK, 10_892);
});

check("234 assemblies, 38 districts and complete geometry", () => {
  assert.equal(aggregates.acs.length, 234);
  assert.equal(aggregates.districts.length, 38);
  assert.equal(new Set(aggregates.acs.map((a) => a.no)).size, 234);
  assert.equal(new Set(aggregates.acs.map((a) => a.no)).size, acGeo.features.length);
  assert.equal(aggregates.districts.length, districtGeo.features.length);
  assert.ok(aggregates.acs.every((a) => a.district && a.districtEci));
  assert.ok(aggregates.acs.every((a) => a.survey.valid > 0));
  assert.ok(aggregates.districts.every((d) => d.coverage.acs > 0));
  for (const f of acGeo.features) {
    assert.ok(f.properties.no >= 1 && f.properties.no <= 234);
    assert.ok(f.properties.district);
    assert.ok(Array.isArray(f.properties.centroid) && f.properties.centroid.length === 2);
  }
});

check("district and assembly totals reconcile to the workbook geography", () => {
  assert.equal(sum(aggregates.acs.map((a) => a.survey.valid)), 10_567);
  assert.equal(sum(aggregates.districts.map((d) => d.survey.valid)), 11_449);
  assert.equal(aggregates.statewide.counts.located, 11_449);
  assert.equal(aggregates.statewide.counts.unlocated, 19_867);
  assert.equal(11_449 - 10_567, 882);
  for (const d of aggregates.districts) {
    assert.equal(d.coverage.acs, d.acs.length);
    assert.equal(d.coverage.responses, d.survey.valid);
    assert.equal(sum(TN_GROUPS.map((g) => d.survey.counts[g])), d.survey.valid);
  }
});

check("adjusted AC and district shares each sum to 100% after documented normalisation", () => {
  for (const a of aggregates.acs) assert.ok(near(sum(TN_GROUPS.map((g) => a.survey.shares?.[g] ?? 0)), 1, 1e-5), `${a.no} ${a.name}`);
  for (const d of aggregates.districts) assert.ok(near(sum(TN_GROUPS.map((g) => d.survey.shares?.[g] ?? 0)), 1, 1e-5), d.name);
  assert.equal(aggregates.source.normalisation.ac.count, 22);
  assert.equal(aggregates.source.normalisation.ac.total, 234);
  assert.ok(aggregates.source.normalisation.ac.maxDeviationPp > 0.8);
  assert.equal(aggregates.source.normalisation.district.count, 0);
  for (const a of aggregates.acs) assert.equal(tnLeader(a.survey.shares), a.projected.leader, a.name);
});

check("historical numeric shares are present and use the same five groups", () => {
  for (const y of ["2011", "2016", "2021"] as const) {
    const s = aggregates.statewide.actual[y];
    assert.ok(s.available);
    assert.ok(s.shares);
    assert.ok(near(sum(TN_GROUPS.map((g) => s.shares?.[g] ?? 0)), 1, 1e-5), y);
    for (const g of TN_GROUPS) assert.ok(g in s.shares!);
  }
  assert.equal(aggregates.presence["2011"].TVK, false);
  assert.equal(aggregates.presence["2016"].TVK, false);
  assert.equal(aggregates.presence["2021"].TVK, false);
  assert.equal(aggregates.presence["2011"].NTK, false);
  assert.equal(aggregates.presence["2011"].NOTA, false);
  assert.equal(aggregates.presence["2016"].NTK, true);
  assert.equal(aggregates.presence["2016"].NOTA, true);
});

check("2016 no-data assemblies remain no data, never zero", () => {
  const a134 = aggregates.acs.find((a) => a.no === 134)!;
  const a174 = aggregates.acs.find((a) => a.no === 174)!;
  assert.equal(a134.actual["2016"].available, false);
  assert.equal(a174.actual["2016"].available, false);
  assert.equal(a134.actual["2016"].shares, null);
  assert.equal(a174.actual["2016"].shares, null);
  assert.equal(aggregates.acs.filter((a) => !a.actual["2016"].available).length, 2);
  for (const d of aggregates.districts) for (const y of ["2011", "2016", "2021"] as const) assert.equal(d.actual[y].available, true, `${d.name} ${y}`);
});

check("projected and Actual 2026 seat totals are derived and complete", () => {
  assert.deepEqual(aggregates.statewide.projectedSeats, { TVK: 115, "AIADMK+BJP+PMK+AMMK": 60, "DMK+INC+VCK": 56, NTK: 3, NOTA: 0 });
  assert.deepEqual(aggregates.statewide.actualSeats, { TVK: 108, "AIADMK+BJP+PMK+AMMK": 53, "DMK+INC+VCK": 73, NTK: 0, NOTA: 0 });
  assert.equal(seatsSum(aggregates.statewide.projectedSeats), 234);
  assert.equal(seatsSum(aggregates.statewide.actualSeats), 234);
  assert.equal(aggregates.statewide.accuracy, 110);
  assert.equal(aggregates.acs.filter((a) => a.match).length, 110);
  assert.equal(aggregates.acs.every((a) => a.projected.leader), true);
  assert.equal(aggregates.acs.every((a) => a.actual2026.winner), true);
  assert.equal(aggregates.acs.filter((a) => a.actual2026.winner === "TVK").length, 108);
  assert.equal(aggregates.acs.filter((a) => a.actual2026.winner === "DMK+INC+VCK").length, 73);
  assert.equal(aggregates.acs.filter((a) => a.actual2026.winner === "AIADMK+BJP+PMK+AMMK").length, 53);
});

check("district seat totals reconcile with the statewide totals", () => {
  const projected = TN_GROUPS.map((g) => sum(aggregates.districts.map((d) => d.projectedSeats[g] ?? 0)));
  const actual = TN_GROUPS.map((g) => sum(aggregates.districts.map((d) => d.actualSeats[g] ?? 0)));
  assert.deepEqual(projected, TN_GROUPS.map((g) => aggregates.statewide.projectedSeats[g]));
  assert.deepEqual(actual, TN_GROUPS.map((g) => aggregates.statewide.actualSeats[g]));
  assert.equal(sum(aggregates.districts.map((d) => seatsSum(d.projectedSeats))), 234);
  assert.equal(sum(aggregates.districts.map((d) => seatsSum(d.actualSeats))), 234);
});

check("actual 2026 is a seat result, not a fabricated vote share", () => {
  const text = JSON.stringify(aggregates);
  assert.equal(text.includes('"actual2026Votes"'), false);
  for (const a of aggregates.acs) {
    assert.equal(typeof a.actual2026.alliance, "string");
    assert.ok(a.actual2026.winner === "TVK" || a.actual2026.winner === "DMK+INC+VCK" || a.actual2026.winner === "AIADMK+BJP+PMK+AMMK");
    assert.equal("shares" in a.actual2026, false);
  }
  assert.equal(tnLeader(aggregates.statewide.survey.shares!) !== null, true);
});

check("all nine workbook sheets were read and private sheets are not public sections", () => {
  const names = aggregates.source.audit.map((a) => a.sheet);
  assert.deepEqual(names, ["Summary", "Statewide Votes", "AC Results", "District Results", "AC vs Actual 2026", "District vs Actual 2026", "Who Voted How", "Model Validation", "Significant Variables"]);
  for (const s of ["Who Voted How", "Model Validation", "Significant Variables"]) {
    assert.ok(aggregates.source.audit.find((a) => a.sheet === s)?.used.includes("private"));
  }
  const text = JSON.stringify(aggregates);
  assert.equal(text.includes("Religion"), false);
  assert.equal(text.includes("campaign"), false);
});

check("no survey rounds, dates or respondent-level rows are invented", () => {
  const text = JSON.stringify(aggregates);
  assert.equal(text.includes("rounds388"), false);
  assert.equal(text.includes("blocks50"), false);
  assert.equal(text.includes("Response ID"), false);
  assert.equal(text.includes("entryId"), false);
  assert.equal("rounds" in aggregates, false);
  assert.equal("dateMin" in aggregates.source, false);
  assert.equal("smoothing" in aggregates, false);
});

check("current 38-district grouping is used and ECI grouping is retained for audit", () => {
  assert.equal(new Set(aggregates.acs.map((a) => a.district)).size, 38);
  assert.equal(new Set(aggregates.acs.map((a) => a.districtEci)).size, 38);
  assert.ok(aggregates.acs.every((a) => a.district && a.districtEci));
  assert.ok(aggregates.source.districtPolicy.includes("Current 38-district"));
  assert.ok(aggregates.source.districtPolicy.includes("ECI"));
  const duplicateNames = new Set(aggregates.acs.map((a) => a.name));
  assert.equal(duplicateNames.size, 233);
  assert.equal(aggregates.acs.filter((a) => a.name === "Tiruppattur").length, 2);
});

check("prediction-vs-result rows carry a projected and actual side", () => {
  for (const a of aggregates.acs) {
    assert.ok(a.projected.leader);
    assert.ok(a.actual2026.winner);
    assert.equal(typeof a.match, "boolean");
    assert.equal(typeof a.projected.marginPp, "number");
    assert.ok(a.projected.confidence);
  }
  assert.equal(aggregates.acs.filter((a) => !a.match).length, 124);
});

console.log(`\n${passed} checks passed.`);
