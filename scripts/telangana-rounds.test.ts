import assert from "node:assert/strict";
import rounds from "@/lib/data/telangana/rounds.json";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
type P = { index: number; n: number; counts: Record<string, number>; partial?: boolean; start: string; end: string };
type D = { date: string; n: number; counts: Record<string, number> };
const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);
const state = rounds.scopes.state as { eligible: number; rounds388: P[]; rounds688: P[]; daily: D[]; blocks50: P[] };
const totalCounts = (counts: Record<string, number>) => Object.values(counts).reduce((s, n) => s + n, 0);

console.log("Telangana survey period aggregates");

check("all July–October answered records are eligible", () => {
  assert.equal(rounds.eligible, 4659);
  assert.equal(rounds.dateMin, "2026-07-17");
  assert.equal(rounds.dateMax, "2026-10-19");
  assert.equal(state.eligible, 4659);
});

check("388/688 rounds cover every eligible record exactly once", () => {
  assert.equal(state.rounds388.length, 13);
  assert.equal(sum(state.rounds388.map((r) => r.n)), 4659);
  assert.equal(state.rounds388.at(-1)?.partial, true);
  assert.equal(state.rounds388.at(-1)?.n, 3);
  assert.equal(state.rounds688.length, 7);
  assert.equal(sum(state.rounds688.map((r) => r.n)), 4659);
  assert.equal(state.rounds688.at(-1)?.partial, true);
  assert.equal(state.rounds688.at(-1)?.n, 531);
  for (const r of [...state.rounds388, ...state.rounds688]) assert.equal(totalCounts(r.counts), r.n, `round ${r.index}`);
});

check("calendar-day groups and 50-response blocks reconcile", () => {
  assert.equal(state.daily.length, 27);
  assert.equal(sum(state.daily.map((d) => d.n)), 4659);
  for (const d of state.daily) assert.equal(totalCounts(d.counts), d.n, d.date);
  assert.equal(state.blocks50.length, 94);
  assert.equal(sum(state.blocks50.map((b) => b.n)), 4659);
  assert.equal(state.blocks50.at(-1)?.partial, true);
  assert.equal(state.blocks50.at(-1)?.n, 9);
  for (const b of state.blocks50) assert.equal(totalCounts(b.counts), b.n, `block ${b.index}`);
});

check("raw answer mix is BRS 2687, Congress 969, BJP 852, AIMIM 11, Others 140", () => {
  const totals = { BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 };
  for (const d of state.daily) for (const [k, v] of Object.entries(d.counts)) totals[k as keyof typeof totals] += v;
  assert.deepEqual(totals, { BRS: 2687, Congress: 969, BJP: 852, AIMIM: 11, Others: 140 });
});

check("every district and assembly scope reconciles to its own records", () => {
  const scopes = Object.entries(rounds.scopes);
  assert.equal(scopes.length, 153);
  for (const [key, raw] of scopes) {
    const s = raw as { eligible: number; rounds388: P[]; rounds688: P[]; daily: D[]; blocks50: P[] };
    assert.equal(sum(s.rounds388.map((r) => r.n)), s.eligible, `${key} 388`);
    assert.equal(sum(s.rounds688.map((r) => r.n)), s.eligible, `${key} 688`);
    assert.equal(sum(s.daily.map((d) => d.n)), s.eligible, `${key} daily`);
    assert.equal(sum(s.blocks50.map((b) => b.n)), s.eligible, `${key} blocks`);
  }
  assert.equal((rounds.scopes as Record<string, unknown>)["d:Hyderabad"] != null, true);
  assert.equal((rounds.scopes as Record<string, unknown>)["a:61"] != null, true);
});

check("no Entry IDs or raw rows are present", () => {
  const text = JSON.stringify(rounds);
  assert.equal(text.includes("Entry ID"), false);
  assert.equal(text.includes("entryId"), false);
});

console.log(`\n${passed} checks passed.`);
