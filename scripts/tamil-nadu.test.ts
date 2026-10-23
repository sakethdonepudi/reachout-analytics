import assert from "node:assert/strict";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import rounds from "@/lib/data/tamil-nadu/rounds.json";
import acGeo from "@/lib/data/tamil-nadu/tn-acs.json";
import districtGeo from "@/lib/data/tamil-nadu/tn-districts.json";
import { TN_COLOR, TN_GROUPS } from "@/lib/tamil-nadu/model";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const near = (a: number, b: number, e = 1e-5) => Math.abs(a - b) <= e;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
type Group = (typeof TN_GROUPS)[number];
type Round = { i: number; start: string; end: string; entries: number; answered: number; counts: Record<Group, number>; partial: boolean };
type Scope = { name: string; entries: number; dateMin: string; dateMax: string; rounds388: Round[]; rounds688: Round[]; daily: { entries: number; answered: number; counts: Record<Group, number> }[]; blocks50: Round[] };
const state = (rounds.scopes as Record<string, Scope>).state;

console.log("Tamil Nadu 2026 exit-poll snapshot");

check("active workbook counts and source dates", () => {
  assert.equal(aggregates.source.survey.total, 32736);
  assert.equal(aggregates.source.survey.valid, 31302);
  assert.equal(aggregates.source.survey.blank, 1421);
  assert.equal(aggregates.source.survey.invalid, 13);
  assert.equal(aggregates.source.survey.duplicateIds, 0);
  assert.equal(aggregates.source.survey.dateMin, "2026-04-21T18:17:00");
  assert.equal(aggregates.source.survey.dateMax, "2026-10-06T09:14:00");
  assert.equal(aggregates.source.survey.recordedDistrictValid, 11443);
  assert.equal(aggregates.source.survey.estimatedDistrictValid, 19859);
  assert.equal(aggregates.source.survey.acScopedValid, 10563);
  assert.equal(aggregates.source.survey.missingAcValid, 20739);
  assert.equal(aggregates.source.survey.inferredAcRows, 4);
});

check("six source groups are present and labelled", () => {
  assert.deepEqual(TN_GROUPS, ["TVK", "DMK+INC+VCK", "AIADMK+BJP+PMK+AMMK", "NTK", "NOTA", "Others"]);
  assert.deepEqual(aggregates.groups, [...TN_GROUPS]);
  assert.ok(TN_GROUPS.every((g) => TN_COLOR[g]));
  assert.equal(new Set(TN_GROUPS.map((g) => TN_COLOR[g].toLowerCase())).size, TN_GROUPS.length);
});

check("statewide 2026 exit-poll shares match the active import", () => {
  const s = aggregates.statewide.survey;
  assert.equal(s.valid, 31302);
  const expected: Record<string, number> = { TVK: 0.347965, "DMK+INC+VCK": 0.284391, "AIADMK+BJP+PMK+AMMK": 0.282921, NTK: 0.06942, NOTA: 0.007923, Others: 0.00738 };
  for (const g of TN_GROUPS) assert.ok(near(s.shares?.[g] ?? 0, expected[g], 1e-5), g);
  assert.ok(near(sum(TN_GROUPS.map((g) => s.shares?.[g] ?? 0)), 1, 1e-5));
});

check("historical years have verified coverage and 100% group shares", () => {
  assert.equal(aggregates.statewide.coverage["2011"], 234);
  assert.equal(aggregates.statewide.coverage["2016"], 232);
  assert.equal(aggregates.statewide.coverage["2021"], 234);
  for (const y of ["2011", "2016", "2021"] as const) {
    const s = aggregates.statewide.actual[y];
    assert.ok(s.available);
    assert.ok(near(sum(TN_GROUPS.map((g) => s.shares?.[g] ?? 0)), 1, 1e-5), y);
  }
  const a134 = aggregates.acs.find((a) => a.no === 134)!;
  const a174 = aggregates.acs.find((a) => a.no === 174)!;
  assert.equal(a134.actual["2016"].available, false);
  assert.equal(a174.actual["2016"].available, false);
  assert.equal(a134.actual["2016"].shares, null);
});

check("historical seats are actual winners and total available seats", () => {
  assert.equal(sum(Object.values(aggregates.statewide.seats["2011"])), 234);
  assert.equal(sum(Object.values(aggregates.statewide.seats["2016"])), 232);
  assert.equal(sum(Object.values(aggregates.statewide.seats["2021"])), 234);
  assert.deepEqual(aggregates.statewide.seats["2021"], { TVK: 0, "DMK+INC+VCK": 155, "AIADMK+BJP+PMK+AMMK": 75, NTK: 0, NOTA: 0, Others: 4 });
  assert.equal("2026" in aggregates.statewide.seats, false);
});

check("absent parties are not misrepresented as zero", () => {
  assert.equal(aggregates.presence["2011"].TVK, false);
  assert.equal(aggregates.presence["2016"].TVK, false);
  assert.equal(aggregates.presence["2021"].TVK, false);
  assert.equal(aggregates.presence["2011"].NTK, false);
  assert.equal(aggregates.presence["2011"].NOTA, false);
  assert.equal(aggregates.presence["2016"].NTK, true);
  assert.equal(aggregates.presence["2016"].NOTA, true);
});

check("234 assemblies and 38 districts are covered", () => {
  assert.equal(aggregates.acs.length, 234);
  assert.equal(aggregates.districts.length, 38);
  assert.equal(new Set(aggregates.acs.map((a) => a.no)).size, 234);
  assert.ok(aggregates.acs.every((a) => a.district));
  assert.ok(aggregates.acs.every((a) => a.survey.valid > 0));
  // Statewide totals include responses without recorded geography; local scopes do not.
  assert.equal(aggregates.acs.reduce((s, a) => s + a.survey.valid, 0), 10563);
  assert.equal(aggregates.districts.reduce((s, d) => s + d.survey.valid, 0), 11443);
  assert.equal(aggregates.statewide.survey.valid, 31302);
});

check("map geometry is complete and has no invented assembly prediction", () => {
  assert.equal((acGeo as { features: unknown[] }).features.length, 234);
  assert.equal((districtGeo as { features: unknown[] }).features.length, 38);
  for (const f of (acGeo as unknown as { features: { properties: { no: number; district: string; centroid?: [number, number] } }[] }).features) {
    assert.ok(f.properties.no >= 1 && f.properties.no <= 234);
    assert.ok(f.properties.district);
    assert.ok(Array.isArray(f.properties.centroid) && f.properties.centroid.length === 2);
  }
  for (const a of aggregates.acs) {
    assert.ok("surveyLeader" in a);
    assert.equal("prediction" in a, false);
  }
});

check("round membership is derived, exhaustive and chronological", () => {
  assert.equal(rounds.entries, 32736);
  assert.equal(rounds.model.projection, false);
  assert.equal(rounds.model.kind, "survey-only");
  assert.equal(state.rounds388.length, 85);
  assert.equal(state.rounds688.length, 48);
  assert.equal(sum(state.rounds388.map((r) => r.entries)), 32736);
  assert.equal(sum(state.rounds388.map((r) => r.answered)), 31302);
  assert.equal(sum(state.rounds688.map((r) => r.entries)), 32736);
  assert.equal(state.rounds388.at(-1)?.entries, 144);
  assert.equal(state.rounds688.at(-1)?.entries, 400);
  assert.equal(state.rounds388.at(-1)?.partial, true);
  assert.equal(state.rounds388[0].start <= state.rounds388[1].start, true);
  assert.equal(sum(state.daily.map((d) => d.entries)), 32736);
  assert.equal(sum(state.blocks50.map((b) => b.entries)), 32736);
  assert.equal(state.daily.length, 34);
  assert.equal(state.blocks50.length, 655);
  assert.equal(state.blocks50.at(-1)?.entries, 36);
});

check("every geographic scope reconciles and uses the global round boundaries", () => {
  const scopes = Object.entries(rounds.scopes as Record<string, Scope>);
  assert.equal(scopes.length, 273);
  for (const [key, s] of scopes) {
    assert.equal(sum(s.rounds388.map((r) => r.entries)), s.entries, key);
    assert.equal(sum(s.rounds688.map((r) => r.entries)), s.entries, key);
    assert.equal(sum(s.daily.map((d) => d.entries)), s.entries, key);
    assert.equal(sum(s.blocks50.map((b) => b.entries)), s.entries, key);
    assert.equal(s.rounds388.length, 85, key);
    assert.equal(s.rounds688.length, 48, key);
  }
  assert.equal((rounds.scopes as Record<string, Scope>)["a:149"]?.name, "Ariyalur");
  assert.equal((rounds.scopes as Record<string, Scope>)["d:Chennai"]?.entries, 1373);
});

check("2026 survey leaders are derived per assembly, not projected seats", () => {
  const counts: Record<string, number> = {};
  for (const a of aggregates.acs) if (a.surveyLeader) counts[a.surveyLeader] = (counts[a.surveyLeader] ?? 0) + 1;
  assert.equal(sum(Object.values(counts)), 234);
  for (const g of TN_GROUPS) assert.equal(counts[g] ?? 0, aggregates.statewide.surveyLeaders[g] ?? 0, g);
  assert.equal("2026" in aggregates.statewide.seats, false);
});

check("no raw rows or response IDs are exposed", () => {
  const text = JSON.stringify({ aggregates, rounds });
  assert.equal(text.includes("Response ID"), false);
  assert.equal(text.includes("entryId"), false);
});

console.log(`\n${passed} checks passed.`);
