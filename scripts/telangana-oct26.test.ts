import assert from "node:assert/strict";
import { DATA, PARTIES, NO_DATA_COLOR, PARTY_COLOR, leaderOf, partyShade, rawShares, weightedShares, type ShareSet } from "@/lib/telangana/oct26";

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const near = (a: number, b: number, eps = 5e-4) => Math.abs(a - b) <= eps;
const closeShares = (a: ShareSet, b: ShareSet, eps = 1e-6) => {
  for (const p of PARTIES) assert.ok(near(a[p], b[p], eps), `${p}: ${a[p]} vs ${b[p]}`);
};

console.log("Telangana October workbook snapshot");

check("workbook contract and cutoff", () => {
  assert.equal(DATA.version, "tg-oct20-v1");
  assert.equal(DATA.sourceHash, "d250760098e3aeb21f35f3e139a650a97ae014afc8a4aa68aa67955b9ec7c1f8");
  assert.equal(DATA.cutoff, "2026-10-01");
  assert.equal(DATA.shrinkFactor, 30);
  assert.equal(DATA.overrideVersion, "tg-oct20-v1");
});

check("supplied counts replace the retired 30,000-row scenario", () => {
  assert.equal(DATA.counts.sourceIds, 5090);
  assert.equal(DATA.counts.cutoffRows, 4768);
  assert.equal(DATA.counts.answered2028, 4401);
  assert.equal(DATA.counts.blank2028, 367);
  assert.equal(DATA.counts.answeredRecall2023, 3940);
  assert.equal(DATA.counts.blankRecall2023, 828);
  assert.equal(DATA.counts.acs, 119);
  assert.equal(DATA.counts.districts, 33);
  assert.equal(DATA.acs.length, 119);
  assert.equal(DATA.districts.length, 33);
});

check("119 unique assembly numbers", () => {
  const nos = DATA.acs.map((a) => a.no).sort((a, b) => a - b);
  assert.deepEqual(nos, Array.from({ length: 119 }, (_, i) => i + 1));
});

check("district membership is complete and unique", () => {
  const seen = new Set<number>();
  for (const d of DATA.districts) for (const no of d.acs) { assert.ok(!seen.has(no), `AC ${no} twice`); seen.add(no); }
  assert.equal(seen.size, 119);
  for (const a of DATA.acs) assert.ok(DATA.districts.some((d) => d.name === a.district), a.district);
});

check("statewide actual 2023 shares", () => {
  closeShares(DATA.statewide.actual, { BRS: 0.373463, Congress: 0.397448, BJP: 0.138973, Others: 0.090115 }, 5e-5);
});

check("statewide 2028 prediction after overrides", () => {
  closeShares(DATA.statewide.prediction, { BRS: 0.466894, Congress: 0.293983, BJP: 0.148877, Others: 0.090246 }, 5e-5);
});

check("statewide raw 2028 survey shares", () => {
  closeShares(DATA.statewide.raw, { BRS: 0.581913, Congress: 0.205408, BJP: 0.187003, Others: 0.025676 }, 5e-5);
});

check("displayed shares sum to one", () => {
  for (const key of ["actual", "prediction", "raw"] as const) {
    const total = PARTIES.reduce((s, p) => s + DATA.statewide[key][p], 0);
    assert.ok(near(total, 1, 1e-5), `${key} ${total}`);
  }
  for (const a of DATA.acs) {
    for (const key of ["actual", "prediction", "raw"] as const) {
      const total = PARTIES.reduce((s, p) => s + a[key][p], 0);
      assert.ok(near(total, 1, 2e-4), `AC ${a.no} ${key} ${total}`);
    }
  }
});

check("re-weighting the AC predictions by 2023 votes reproduces the statewide snapshot", () => {
  closeShares(weightedShares(DATA.acs, "prediction"), DATA.statewide.prediction, 1e-5);
  closeShares(weightedShares(DATA.acs, "actual"), DATA.statewide.actual, 1e-5);
});

check("re-weighting raw answers reproduces the statewide raw shares", () => {
  closeShares(rawShares(DATA.acs), DATA.statewide.raw, 1e-5);
});

check("district rollup is vote-weighted and reconciles", () => {
  const acs = DATA.districts.flatMap((d) => DATA.acs.filter((a) => a.district === d.name));
  assert.equal(acs.length, 119);
  closeShares(weightedShares(acs, "prediction"), DATA.statewide.prediction, 1e-5);
  const weight = DATA.districts.reduce((s, d) => s + d.votes2023, 0);
  assert.equal(weight, 23_439_945);
});

check("statewide projected leads: BRS 70, Congress 27, BJP 13, Others 8, Tie 1", () => {
  assert.deepEqual(DATA.statewide.leads, { BJP: 13, Congress: 27, BRS: 70, Others: 8, Tie: 1 });
  const counts: Record<string, number> = {};
  for (const a of DATA.acs) {
    const lead = leaderOf(a.prediction);
    const key = lead.tied.length > 1 ? "Tie" : lead.leader ?? "Tie";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  assert.equal(counts.BRS, 70);
  assert.equal(counts.Congress, 27);
  assert.equal(counts.BJP, 13);
  assert.equal(counts.Others, 8);
  assert.equal(counts.Tie, 1);
});

check("Kodangal is an exact prediction-only 50–50 tie", () => {
  const k = DATA.acs.find((a) => a.no === 72);
  assert.ok(k);
  assert.equal(k.name, "Kodangal");
  assert.equal(k.prediction.BRS, 0.5);
  assert.equal(k.prediction.Congress, 0.5);
  assert.deepEqual(k.tied.sort(), ["BRS", "Congress"]);
  assert.equal(k.leader, "Tie");
  assert.ok(k.override?.basis.toLowerCase().includes("override"));
  assert.equal(DATA.overrides.length, 1);
  assert.equal(DATA.overrides[0].acNo, 72);
  assert.equal(DATA.overrideMeta.historicalKodangalWinner, "Congress");
  assert.equal(DATA.overrideMeta.predictionOnly, true);
  assert.deepEqual(DATA.overrideMeta.congressLeadAssertions, [24, 85, 89, 92, 93]);
});

check("five requested Congress leads hold numerically", () => {
  for (const no of [24, 85, 89, 92, 93]) {
    const a = DATA.acs.find((x) => x.no === no);
    assert.equal(a?.leader, "Congress", `AC ${no}`);
    assert.ok((a?.prediction.Congress ?? 0) > (a?.prediction.BRS ?? 0));
  }
});

check("Jubilee Hills derives its leader from numbers, not the text label", () => {
  const a = DATA.acs.find((x) => x.no === 61);
  assert.ok(a);
  assert.equal(a.name, "Jubilee Hills");
  assert.equal(a.sourceLeader, "Congress");
  assert.equal(a.leader, "BRS");
  assert.ok(a.prediction.BRS > a.prediction.Congress);
});

check("prediction and raw survey are distinct measures", () => {
  assert.ok(DATA.statewide.raw.BRS > DATA.statewide.prediction.BRS + 0.1);
  assert.ok(DATA.statewide.prediction.Congress > DATA.statewide.raw.Congress + 0.05);
  for (const a of DATA.acs) assert.notDeepEqual(a.raw, a.prediction);
});

check("2023 actuals are separate from every 2028 series", () => {
  for (const a of DATA.acs) {
    assert.notDeepEqual(a.actual, a.prediction);
    assert.notDeepEqual(a.actual, a.raw);
  }
});

check("devices and PINs are declared unavailable, not zero-filled", () => {
  assert.equal(DATA.devicesAvailable, false);
  assert.equal(DATA.pinDataAvailable, false);
});

check("no answered-2028 AC has a zero base", () => {
  for (const a of DATA.acs) assert.ok(a.answered2028 > 0, `AC ${a.no}`);
  assert.equal(DATA.acs.reduce((s, a) => s + a.answered2028, 0), 4401);
});

check("raw answer counts reconcile with answered rows", () => {
  for (const a of DATA.acs) {
    const total = PARTIES.reduce((s, p) => s + a.raw[p], 0);
    assert.ok(near(total, 1, 2e-4), `AC ${a.no} ${total}`);
  }
});

check("map colours have a leading party for every assembly and no invented AIMIM prediction", () => {
  for (const a of DATA.acs) {
    assert.deepEqual(Object.keys(a.prediction).sort(), ["BJP", "BRS", "Congress", "Others"]);
    assert.ok(!("AIMIM" in a.prediction));
    const lead = leaderOf(a.prediction);
    assert.ok(lead.tied.length > 1 || lead.leader !== null, `AC ${a.no}`);
  }
  assert.equal(PARTY_COLOR.BRS, "#e5007d");
  assert.equal(PARTY_COLOR.Congress, "#1f6fd0");
  assert.equal(PARTY_COLOR.BJP, "#e87511");
  assert.ok(NO_DATA_COLOR.startsWith("#"));
});

check("party shading keeps each hue and varies with predicted share", () => {
  for (const p of PARTIES) {
    const light = partyShade(p, 0.2);
    const dark = partyShade(p, 0.7);
    assert.match(light, /^#[0-9a-f]{6}$/);
    assert.match(dark, /^#[0-9a-f]{6}$/);
    assert.notEqual(light, dark, p);
  }
  const kodangal = DATA.acs.find((a) => a.no === 72)!;
  const tie = leaderOf(kodangal.prediction).tied;
  assert.deepEqual(tie, ["BRS", "Congress"]);
  assert.notEqual(partyShade(tie[0], 0.5), partyShade(tie[1], 0.5));
});

console.log(`\n${passed} checks passed.`);
