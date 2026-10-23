import assert from "node:assert/strict";
import { DATA, PARTIES, NO_DATA_COLOR, PARTY_COLOR, PARTY_LABEL, leaderOf, partyShade, weightedShares, type ShareSet } from "@/lib/telangana/oct26";
import { P7S, P7_COLOR, P7_LABEL } from "@/lib/telangana/round-model";
import rounds from "@/lib/data/telangana/rounds.json";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const near = (a: number, b: number, eps = 5e-4) => Math.abs(a - b) <= eps;
const closeShares = (a: ShareSet, b: ShareSet, eps = 1e-6) => { for (const p of PARTIES) assert.ok(near(a[p], b[p], eps), `${p}: ${a[p]} vs ${b[p]}`); };

console.log("Telangana final workbook snapshot");

check("final workbook contract and provenance", () => {
  assert.equal(DATA.version, "tg-final-2026-10-23-v1");
  assert.equal(DATA.sourceFile, "saketh_TG.xlsx");
  assert.match(DATA.sourceHash, /^[0-9a-f]{64}$/);
  assert.notEqual(DATA.sourceHash, "d250760098e3aeb21f35f3e139a650a97ae014afc8a4aa68aa67955b9ec7c1f8");
  assert.equal(DATA.cutoff, "2026-07-16");
  assert.equal(DATA.shrinkFactor, 30);
  assert.equal(DATA.overrideVersion, "final-no-overrides");
  assert.equal(DATA.overrides.length, 0);
  assert.equal(DATA.overrideMeta.predictionOnly, false);
});

check("final supplied counts and no appended dataset", () => {
  assert.equal(DATA.counts.sourceIds, 5090);
  assert.equal(DATA.counts.cutoffRows, 5090);
  assert.equal(DATA.counts.answered2028, 4659);
  assert.equal(DATA.counts.blank2028, 431);
  assert.equal(DATA.counts.answeredRecall2023, 4139);
  assert.equal(DATA.counts.blankRecall2023, 951);
  assert.equal(DATA.counts.acs, 119);
  assert.equal(DATA.counts.districts, 33);
});

check("119 unique assemblies and 33 district groups", () => {
  assert.deepEqual(DATA.acs.map((a) => a.no).sort((a, b) => a - b), Array.from({ length: 119 }, (_, i) => i + 1));
  assert.equal(new Set(DATA.acs.map((a) => a.district)).size, 33);
  const seen = new Set<number>();
  for (const d of DATA.districts) for (const no of d.acs) { assert.ok(!seen.has(no), `AC ${no} twice`); seen.add(no); }
  assert.equal(seen.size, 119);
});

check("statewide actual 2023 shares", () => {
  closeShares(DATA.statewide.actual, { BRS: 0.373463, Congress: 0.397448, BJP: 0.138973, Others: 0.090115 }, 5e-5);
});

check("final AC prediction produces the required weighted shares", () => {
  closeShares(DATA.statewide.prediction, { BRS: 0.458928, Congress: 0.302082, BJP: 0.149478, Others: 0.089512 }, 5e-5);
  assert.ok(near(PARTIES.reduce((s, p) => s + DATA.statewide.prediction[p], 0), 1, 1e-5));
});

check("final projected leaders reconcile to 68 / 30 / 13 / 8", () => {
  assert.deepEqual(DATA.statewide.leads, { BRS: 68, Congress: 30, BJP: 13, Others: 8 });
  const counts: Record<string, number> = {};
  for (const a of DATA.acs) { const lead = leaderOf(a.prediction); const key = lead.tied.length > 1 ? "Tie" : lead.leader ?? "Tie"; counts[key] = (counts[key] ?? 0) + 1; }
  assert.equal(counts.BRS, 68); assert.equal(counts.Congress, 30); assert.equal(counts.BJP, 13); assert.equal(counts.Others, 8);
});

check("numeric leaders agree with the final sheet and no stale override is applied", () => {
  for (const a of DATA.acs) assert.equal(a.leader, a.sourceLeader, `AC ${a.no}`);
  const k = DATA.acs.find((a) => a.no === 72)!;
  assert.equal(k.name, "Kodangal");
  assert.equal(k.leader, "Congress");
  assert.equal(k.sourceLeader, "Congress");
  assert.ok(k.prediction.Congress > k.prediction.BRS);
  assert.equal(k.tied.length, 0);
  assert.equal(k.override, null);
});

check("Jubilee Hills follows the final numeric prediction", () => {
  const a = DATA.acs.find((x) => x.no === 61)!;
  assert.equal(a.name, "Jubilee Hills");
  assert.equal(a.sourceLeader, "Congress");
  assert.equal(a.leader, "Congress");
  assert.ok(a.prediction.Congress > a.prediction.BRS);
});

check("raw survey aggregates are excluded from the public snapshot", () => {
  assert.ok(!("raw" in DATA.statewide));
  for (const a of DATA.acs) assert.ok(!("raw" in a));
  for (const d of DATA.districts) assert.ok(!("raw" in d));
});

check("displayed four-group shares sum to one", () => {
  for (const key of ["actual", "prediction"] as const) {
    const total = PARTIES.reduce((s, p) => s + DATA.statewide[key][p], 0);
    assert.ok(near(total, 1, 1e-5), `${key} ${total}`);
  }
  for (const a of DATA.acs) for (const key of ["actual", "prediction"] as const) {
    const total = PARTIES.reduce((s, p) => s + a[key][p], 0);
    assert.ok(near(total, 1, 2e-4), `AC ${a.no} ${key} ${total}`);
  }
});

check("district and state rollups are vote-weighted and reconcile", () => {
  closeShares(weightedShares(DATA.acs, "prediction"), DATA.statewide.prediction, 1e-5);
  closeShares(weightedShares(DATA.acs, "actual"), DATA.statewide.actual, 1e-5);
  assert.equal(DATA.districts.reduce((s, d) => s + d.votes2023, 0), 23_439_945);
});

check("compact prediction remains four-group", () => {
  assert.deepEqual(PARTIES, ["BRS", "Congress", "BJP", "Others"]);
  for (const a of DATA.acs) assert.deepEqual(Object.keys(a.prediction).sort(), ["BJP", "BRS", "Congress", "Others"]);
  assert.equal(PARTY_COLOR.BRS, "#EC4899");
  assert.equal(PARTY_COLOR.Congress, "#2563EB");
  assert.equal(PARTY_COLOR.BJP, "#F97316");
  assert.equal(PARTY_COLOR.Others, "#8B5CF6");
  assert.ok(NO_DATA_COLOR.startsWith("#"));
});

check("expanded tracker still carries seven separate parties", () => {
  assert.deepEqual(P7S, ["BRS", "Congress", "BJP", "AIMIM", "TDP", "JSP", "Others"]);
  assert.deepEqual(rounds.parties, P7S);
  assert.equal(P7_COLOR.AIMIM, "#16A34A");
  assert.equal(P7_COLOR.TDP, "#EAB308");
  assert.equal(P7_LABEL.JSP, "Janasena");
  assert.equal(P7_COLOR.Others, "#8B5CF6");
});

check("2023 actuals are separate from the 2028 prediction", () => {
  for (const a of DATA.acs) assert.notDeepEqual(a.actual, a.prediction);
});

check("final source carries no device or PIN fields", () => {
  assert.equal(DATA.devicesAvailable, false);
  assert.equal(DATA.pinDataAvailable, false);
});

check("no answered-2028 AC has a zero base", () => {
  for (const a of DATA.acs) assert.ok(a.answered2028 > 0, `AC ${a.no}`);
  assert.equal(DATA.acs.reduce((s, a) => s + a.answered2028, 0), 4659);
});

check("party shading keeps each hue and varies with predicted share", () => {
  for (const p of PARTIES) {
    const light = partyShade(p, 0.2), dark = partyShade(p, 0.7);
    assert.match(light, /^#[0-9a-f]{6}$/);
    assert.match(dark, /^#[0-9a-f]{6}$/);
    assert.notEqual(light, dark, p);
  }
});

console.log(`\n${passed} checks passed.`);
