import assert from "node:assert/strict";
import rounds from "@/lib/data/telangana/rounds.json";
import { DATA } from "@/lib/telangana/oct26";
import { historicalDetail } from "@/lib/telangana/history";
import { P7S, projectVector, type Counts7 } from "@/lib/telangana/round-model";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
type P = { index: number; start: string; end: string; entries: number; partial?: boolean; answered2028: number; counts2028: Counts7; answered2023: number; counts2023: Counts7 };
type D = { date: string; entries: number; answered2028: number; counts2028: Counts7; answered2023: number; counts2023: Counts7 };
type S = { name: string; entries: number; dateMin: string; dateMax: string; rounds388: P[]; rounds688: P[]; daily: D[]; blocks50: P[] };
const state = rounds.scopes.state as unknown as S;
const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);
const near = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;
const countSum = (c: Counts7) => P7S.reduce((s, p) => s + c[p], 0);

console.log("Telangana round model");

check("all 5,090 entries are included, including blank answers", () => {
  assert.equal(rounds.entries, 5090);
  assert.equal(state.entries, 5090);
  assert.equal(rounds.dateMin, "2026-07-16");
  assert.equal(rounds.dateMax, "2026-10-19");
});

check("388 rounds: twelve full rounds and a final 434-entry round", () => {
  assert.equal(state.rounds388.length, 13);
  assert.equal(sum(state.rounds388.map((r) => r.entries)), 5090);
  assert.equal(state.rounds388[11].entries, 388);
  assert.equal(state.rounds388[12].entries, 434);
  assert.equal(state.rounds388[12].partial, true);
});

check("688 rounds: seven full rounds and a final 274-entry round", () => {
  assert.equal(state.rounds688.length, 8);
  assert.equal(sum(state.rounds688.map((r) => r.entries)), 5090);
  assert.equal(state.rounds688[6].entries, 688);
  assert.equal(state.rounds688[7].entries, 274);
  assert.equal(state.rounds688[7].partial, true);
});

check("R1 has separate 2028 and 2023 denominators and matches the reference BRS values", () => {
  const r1 = state.rounds388[0];
  assert.equal(r1.entries, 388);
  assert.equal(r1.answered2028, 312);
  assert.equal(r1.answered2023, 250);
  assert.ok(near((r1.counts2028.BRS / r1.answered2028) * 100, 49.04));
  assert.ok(near((r1.counts2023.BRS / r1.answered2023) * 100, 42.4));
  assert.equal(countSum(r1.counts2028), r1.answered2028);
  assert.equal(countSum(r1.counts2023), r1.answered2023);
});

check("reference projection: R1 BRS = 37.35 + (49.04 − 42.40) = 43.99%", () => {
  const actual = historicalDetail(DATA.acs, "2023");
  const proj = projectVector(state.rounds388[0], actual);
  assert.ok(proj);
  assert.ok(near(proj!.BRS, 43.99, 0.02), `${proj!.BRS}`);
  assert.ok(near(sum(P7S.map((p) => proj![p])), 100, 1e-6));
});

check("688 R1 also reproduces the reference projection", () => {
  const actual = historicalDetail(DATA.acs, "2023");
  const r1 = state.rounds688[0];
  assert.equal(r1.entries, 688);
  assert.equal(r1.answered2028, 587);
  const proj = projectVector(r1, actual);
  assert.ok(proj);
  assert.ok(near(proj!.BRS, 43.82, 0.03), `${proj!.BRS}`);
  assert.ok(near(sum(P7S.map((p) => proj![p])), 100, 1e-6));
});

check("every available round projects to a 100% seven-party vector", () => {
  const actual = historicalDetail(DATA.acs, "2023");
  for (const r of state.rounds388) {
    const proj = projectVector(r, actual);
    assert.ok(proj, `R${r.index}`);
    assert.ok(near(sum(P7S.map((p) => proj![p])), 100, 1e-6), `R${r.index}`);
    for (const p of P7S) assert.ok(proj![p] >= 0, `${p} R${r.index}`);
  }
});

check("blank denominators are excluded per question", () => {
  const r1 = state.rounds388[0];
  assert.ok(r1.answered2028 < r1.entries);
  assert.ok(r1.answered2023 < r1.entries);
  assert.equal(sum(state.rounds388.map((r) => r.answered2028)), 4659);
  assert.equal(sum(state.rounds388.map((r) => r.answered2023)), 4139);
});

check("daily and 50-response periods reconcile", () => {
  assert.equal(state.daily.length, 28);
  assert.equal(sum(state.daily.map((d) => d.entries)), 5090);
  assert.equal(sum(state.daily.map((d) => d.answered2028)), 4659);
  assert.equal(state.blocks50.length, 102);
  assert.equal(sum(state.blocks50.map((b) => b.entries)), 5090);
  assert.equal(state.blocks50.at(-1)?.entries, 40);
  assert.equal(state.blocks50.at(-1)?.partial, true);
});

check("district and assembly scopes retain the global round membership", () => {
  const scopes = Object.entries(rounds.scopes as unknown as Record<string, S>);
  assert.equal(scopes.length, 153);
  for (const [key, s] of scopes) {
    assert.equal(sum(s.rounds388.map((r) => r.entries)), s.entries, `${key} 388`);
    assert.equal(sum(s.rounds688.map((r) => r.entries)), s.entries, `${key} 688`);
    assert.equal(s.rounds388.length, 13, `${key} rounds`);
    assert.equal(sum(s.daily.map((d) => d.entries)), s.entries, `${key} daily`);
    assert.equal(sum(s.blocks50.map((b) => b.entries)), s.entries, `${key} blocks`);
  }
});

check("TDP and JSP recall assumptions are recorded and not inferred", () => {
  assert.deepEqual(rounds.modelAssumptions.absentRecallParties, ["TDP", "JSP"]);
  const total23 = state.rounds388.reduce((s, r) => s + r.counts2023.TDP + r.counts2023.JSP, 0);
  assert.equal(total23, 0);
  const total28 = state.rounds388.reduce((s, r) => s + r.counts2028.TDP + r.counts2028.JSP, 0);
  assert.equal(total28, 82 + 58);
});

check("no Entry IDs or raw rows are present", () => {
  const text = JSON.stringify(rounds);
  assert.equal(text.includes("Entry ID"), false);
  assert.equal(text.includes("entryId"), false);
});

check("latest-round summaries are calculated per scope, not hardcoded", () => {
  const hyd = rounds.scopes["d:Hyderabad"] as unknown as S;
  const hydActual = historicalDetail(DATA.acs.filter((a) => a.district === "Hyderabad"), "2023");
  const hydR13 = projectVector(hyd.rounds388.at(-1)!, hydActual);
  assert.ok(hydR13);
  const expected = { BRS: 25.35, Congress: 22.66, BJP: 21.47, AIMIM: 22.09, TDP: 0, JSP: 8.33, Others: 0.09 };
  for (const p of P7S) assert.ok(near(hydR13![p], expected[p], 0.01), `${p}: ${hydR13![p]}`);
  const stateR13 = projectVector(state.rounds388.at(-1)!, historicalDetail(DATA.acs, "2023"));
  assert.ok(stateR13);
  assert.ok(near(stateR13!.BRS, 45.65, 0.01));
  assert.notEqual(Number(hydR13!.BRS.toFixed(2)), Number(stateR13!.BRS.toFixed(2)));
});

console.log(`\n${passed} checks passed.`);
