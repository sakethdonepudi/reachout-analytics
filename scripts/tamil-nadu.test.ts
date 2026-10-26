import assert from "node:assert/strict";
import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import acGeo from "@/lib/data/tamil-nadu/tn-acs.json";
import districtGeo from "@/lib/data/tamil-nadu/tn-districts.json";
import { TN_COLOR, TN_GROUPS, TN_SEAT_GROUPS } from "@/lib/tamil-nadu/model";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const near = (a: number, b: number, e = 1e-5) => Math.abs(a - b) <= e;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
type Group = (typeof TN_GROUPS)[number];
type SeatGroup = (typeof TN_SEAT_GROUPS)[number];
const countsSum = (c: Record<Group, number>) => sum(TN_GROUPS.map((g) => c[g] ?? 0));
const seatsSum = (o: Record<SeatGroup, number>) => sum(TN_SEAT_GROUPS.map((g) => o[g] ?? 0));

console.log("Tamil Nadu 2026 final calibrated workbook");

check("final source counts and six-sheet audit", () => {
  assert.equal(aggregates.version, "tn-2026-saket-v3");
  assert.equal(aggregates.source.totalResponses, 31_672);
  assert.equal(aggregates.source.withAc, 10_923);
  assert.equal(aggregates.source.noAc, 20_749);
  assert.equal(aggregates.source.constituencies, 234);
  assert.equal(aggregates.source.districts, 38);
  assert.match(aggregates.sourceImportId, /^tn-saket-v3-[a-f0-9]{16}$/);
  assert.match(aggregates.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(aggregates.source.audit.length, 6);
  assert.ok(aggregates.source.audit.some((s) => s.sheet === "Sheet1" && s.used.includes("ignored")));
  assert.ok(aggregates.source.archive.includes("previous-allocation"));
  assert.equal(aggregates.allocation, null);
  assert.equal(aggregates.reference, null);
});

check("statewide survey counts and shares are from all responses", () => {
  const s = aggregates.statewide.survey;
  assert.equal(s.valid, 31_672);
  assert.deepEqual(aggregates.statewide.counts, { total: 31_672, withAc: 10_923, noAc: 20_749 });
  assert.deepEqual(s.counts, { TVK: 10_866, "AIADMK+BJP+PMK+AMMK": 8_866, "DMK+INC+VCK": 9_518, NTK: 2_173, NOTA: 249, Others: 0 });
  assert.ok(near(s.shares?.TVK ?? 0, 0.343079, 1e-5));
  assert.ok(near(s.shares?.["AIADMK+BJP+PMK+AMMK"] ?? 0, 0.279932, 1e-5));
  assert.ok(near(s.shares?.["DMK+INC+VCK"] ?? 0, 0.300518, 1e-5));
  assert.ok(near(s.shares?.NTK ?? 0, 0.068609, 1e-5));
  assert.ok(near(s.shares?.NOTA ?? 0, 0.007862, 1e-5));
  assert.ok(near(sum(TN_GROUPS.map((g) => s.shares?.[g] ?? 0)), 1, 1e-5));
});

check("result-calibrated and Actual 2026 statewide shares are separate series", () => {
  const c = aggregates.statewide.calibrated.shares;
  const a = aggregates.statewide.actualVoteShares.shares;
  assert.ok(near(c.TVK ?? 0, 0.3502, 1e-6));
  assert.ok(near(c["DMK+INC+VCK"] ?? 0, 0.314, 1e-6));
  assert.ok(near(c["AIADMK+BJP+PMK+AMMK"] ?? 0, 0.2721, 1e-6));
  assert.ok(near(c.NTK ?? 0, 0.04, 1e-6));
  assert.ok(near(c.NOTA ?? 0, 0.0041, 1e-6));
  assert.ok(near(c.Others ?? 0, 0.0196, 1e-6));
  for (const g of TN_GROUPS) assert.ok(near(c[g] ?? 0, a[g] ?? 0, 1e-6), g);
  assert.ok(near(sum(TN_GROUPS.map((g) => c[g] ?? 0)), 1, 1e-5));
  assert.ok(aggregates.statewide.calibrated.note.includes("not an observed survey response"));
  assert.notDeepEqual(aggregates.statewide.survey.shares, aggregates.statewide.calibrated.shares);
  assert.notDeepEqual(aggregates.statewide.survey.shares, aggregates.statewide.actualVoteShares.shares);
});

check("concise labels, full alliance labels and palette distinct", () => {
  assert.equal(aggregates.labels["AIADMK+BJP+PMK+AMMK"], "AIADMK+");
  assert.equal(aggregates.labels["DMK+INC+VCK"], "DMK+");
  assert.equal(aggregates.fullLabels["AIADMK+BJP+PMK+AMMK"], "AIADMK+BJP+PMK+AMMK");
  assert.equal(aggregates.fullLabels["DMK+INC+VCK"], "DMK+INC+VCK");
  assert.equal(TN_GROUPS.length, 6);
  assert.deepEqual([...TN_SEAT_GROUPS], ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK"]);
  assert.equal(new Set(TN_GROUPS.map((g) => TN_COLOR[g])).size, TN_GROUPS.length);
  assert.equal(TN_COLOR.TVK, "#EAB308");
  assert.equal(TN_COLOR["AIADMK+BJP+PMK+AMMK"], "#16A34A");
  assert.equal(TN_COLOR["DMK+INC+VCK"], "#DC2626");
  assert.equal(TN_COLOR.NTK, "#7C3AED");
  assert.equal(TN_COLOR.NOTA, "#64748B");
});

check("234 ACs and 38 districts reconcile to recorded survey counts", () => {
  assert.equal(aggregates.acs.length, 234);
  assert.equal(aggregates.districts.length, 38);
  assert.equal(new Set(aggregates.acs.map((a) => a.no)).size, 234);
  assert.equal(new Set(aggregates.acs.map((a) => a.district)).size, 38);
  assert.equal(sum(aggregates.acs.map((a) => a.survey.valid)), 10_923);
  assert.equal(sum(aggregates.districts.map((d) => d.survey.valid)), 10_923);
  for (const a of aggregates.acs) {
    assert.equal(a.survey.valid, countsSum(a.survey.counts));
    assert.ok(near(sum(TN_GROUPS.map((g) => a.survey.shares?.[g] ?? 0)), 1, 1e-5), a.name);
    assert.equal(a.surveyLeader, a.survey.leader);
  }
  for (const d of aggregates.districts) {
    assert.equal(d.survey.valid, countsSum(d.survey.counts));
    assert.equal(d.survey.valid, sum(d.acs.map((no) => aggregates.acs.find((a) => a.no === no)!.survey.valid)));
    assert.ok(near(sum(TN_GROUPS.map((g) => d.survey.shares?.[g] ?? 0)), 1, 1e-5), d.name);
  }
  assert.equal(aggregates.statewide.survey.valid, 10_923 + 20_749);
});

check("original, final calibrated and actual seat totals are separate and reconcile", () => {
  assert.deepEqual(aggregates.statewide.originalSeats, { TVK: 106, "AIADMK+BJP+PMK+AMMK": 51, "DMK+INC+VCK": 77 });
  assert.deepEqual(aggregates.statewide.finalSeats, { TVK: 108, "AIADMK+BJP+PMK+AMMK": 53, "DMK+INC+VCK": 73 });
  assert.deepEqual(aggregates.statewide.modelSeats, { TVK: 108, "AIADMK+BJP+PMK+AMMK": 53, "DMK+INC+VCK": 73 });
  assert.deepEqual(aggregates.statewide.actualSeats, { TVK: 108, "AIADMK+BJP+PMK+AMMK": 53, "DMK+INC+VCK": 73 });
  assert.equal(seatsSum(aggregates.statewide.originalSeats), 234);
  assert.equal(seatsSum(aggregates.statewide.finalSeats), 234);
  assert.equal(seatsSum(aggregates.statewide.actualSeats), 234);
  for (const g of TN_SEAT_GROUPS) {
    const original = aggregates.acs.filter((a) => a.original.leader === g).length;
    const final = aggregates.acs.filter((a) => a.final.leader === g).length;
    const actual = aggregates.acs.filter((a) => a.actual2026.winner === g).length;
    assert.equal(original, aggregates.statewide.originalSeats[g], g);
    assert.equal(final, aggregates.statewide.finalSeats[g], g);
    assert.equal(actual, aggregates.statewide.actualSeats[g], g);
  }
  assert.notEqual(aggregates.metrics.originalCorrect, aggregates.metrics.finalCorrect);
  assert.equal(aggregates.metrics.originalCorrect, 104);
  assert.equal(aggregates.metrics.finalCorrect, 164);
  assert.equal(aggregates.metrics.modelCorrect, 134);
  assert.equal(aggregates.metrics.modelCvCorrect, 126);
  assert.equal(aggregates.metrics.finalCvCorrect, 161);
  assert.equal(aggregates.calibration.withinTolerance, "38 of 38");
  assert.equal("shares" in aggregates.statewide.actualVoteShares, true);
  for (const d of aggregates.districts) assert.equal("shares" in (d as unknown as { actual2026?: unknown }), false);
});

check("district seat rollups reconcile to AC calls, not a separate colour source", () => {
  for (const d of aggregates.districts) {
    const members = d.acs.map((no) => aggregates.acs.find((a) => a.no === no)!);
    for (const g of TN_SEAT_GROUPS) {
      assert.equal(d.originalSeats[g], members.filter((a) => a.original.leader === g).length, `${d.name} original ${g}`);
      assert.equal(d.finalSeats[g], members.filter((a) => a.final.leader === g).length, `${d.name} final ${g}`);
      assert.equal(d.actualSeats[g], members.filter((a) => a.actual2026.winner === g).length, `${d.name} actual ${g}`);
    }
    assert.equal(seatsSum(d.finalSeats), members.length);
    assert.equal(seatsSum(d.actualSeats), members.length);
  }
  assert.deepEqual(TN_SEAT_GROUPS.map((g) => sum(aggregates.districts.map((d) => d.modelSeats[g]))), TN_SEAT_GROUPS.map((g) => aggregates.statewide.modelSeats[g]));
  assert.deepEqual(TN_SEAT_GROUPS.map((g) => sum(aggregates.districts.map((d) => d.finalSeats[g]))), TN_SEAT_GROUPS.map((g) => aggregates.statewide.finalSeats[g]));
  assert.deepEqual(TN_SEAT_GROUPS.map((g) => sum(aggregates.districts.map((d) => d.actualSeats[g]))), TN_SEAT_GROUPS.map((g) => aggregates.statewide.actualSeats[g]));
});

check("original, final and actual calls stay distinguishable per AC", () => {
  for (const a of aggregates.acs) {
    assert.ok(a.original.leader);
    assert.ok(a.final.leader);
    assert.ok(a.actual2026.winner);
    assert.equal(a.original.correct, a.original.leader === a.actual2026.winner);
    assert.equal(a.final.correct, a.final.leader === a.actual2026.winner);
    assert.equal(a.match, a.final.correct);
    assert.equal("shares" in a.actual2026, false);
  }
  assert.equal(aggregates.acs.filter((a) => a.original.correct).length, 104);
  assert.equal(aggregates.acs.filter((a) => a.final.correct).length, 164);
});

check("historical data retains six groups and does not fold Others into DMK+", () => {
  for (const y of ["2011", "2016", "2021"] as const) {
    const s = aggregates.statewide.historical[y];
    assert.ok(s.available);
    assert.ok(near(sum(TN_GROUPS.map((g) => s.shares?.[g] ?? 0)), 1, 1e-5), y);
    assert.ok(s.shares?.Others != null);
    assert.equal(aggregates.presence[y].TVK, false);
    for (const d of aggregates.districts) assert.equal(d.historical[y].available, true, `${d.name} ${y}`);
  }
  assert.equal(aggregates.presence["2011"].NTK, false);
  assert.equal(aggregates.presence["2011"].NOTA, false);
  assert.equal(aggregates.acs.find((a) => a.no === 134)!.historical["2016"].available, false);
  assert.equal(aggregates.acs.find((a) => a.no === 174)!.historical["2016"].available, false);
  assert.equal(aggregates.acs.filter((a) => a.historical["2016"].available).length, 232);
});

check("all 234 AC and 38 district geometry mappings resolve to configured colours", () => {
  const aliases: Record<string, string> = { Kanyakumari: "Kanniyakumari", Nilgiris: "The Nilgiris", Thiruvarur: "Tiruvarur", Thoothukkudi: "Thoothukudi", Viluppuram: "Villupuram" };
  const acMap = new Map(aggregates.acs.map((a) => [a.no, a]));
  for (const f of acGeo.features) {
    const a = acMap.get(f.properties.no);
    assert.ok(a, `unmatched AC geometry ${f.properties.no}`);
    assert.ok(a!.surveyLeader, `no survey leader AC ${a!.no}`);
    const acLeader = a!.surveyLeader as Group;
    assert.ok(TN_COLOR[acLeader], `no colour AC ${a!.no}`);
    assert.notEqual(TN_COLOR[acLeader], "#94A3B8", `grey AC ${a!.no}`);
  }
  const dMap = new Map(aggregates.districts.map((d) => [d.name, d]));
  for (const f of districtGeo.features) {
    const current = aliases[f.properties.district] ?? f.properties.district;
    const d = dMap.get(current);
    assert.ok(d, `unmatched district geometry ${f.properties.district} -> ${current}`);
    assert.ok(d!.surveyLeader, `no survey leader district ${current}`);
    const districtLeader = d!.surveyLeader as Group;
    assert.ok(TN_COLOR[districtLeader], `no colour district ${current}`);
    assert.notEqual(TN_COLOR[districtLeader], "#94A3B8", `grey district ${current}`);
  }
  assert.equal(acMap.size, 234);
  assert.equal(dMap.size, 38);
});

check("no old allocation or old statewide reference is active", () => {
  const text = JSON.stringify(aggregates);
  assert.equal(text.includes("34.80"), false);
  assert.equal(text.includes("34.78"), false);
  assert.equal(text.includes("tn-geographic-allocation"), false);
  assert.equal(text.includes("31,316"), false);
  assert.equal(text.includes("31672"), true);
  assert.equal(text.includes("19867"), false);
  assert.equal(text.includes("20749"), true);
});

check("no unsupported time, round or raw-response structures", () => {
  const text = JSON.stringify(aggregates);
  assert.equal(text.includes("rounds388"), false);
  assert.equal(text.includes("blocks50"), false);
  assert.equal(text.includes("entryId"), false);
  assert.equal(text.includes("Response ID"), false);
  assert.equal("rounds" in aggregates, false);
  assert.equal("dateMin" in aggregates, false);
  assert.equal("smoothing" in aggregates, false);
});

console.log(`\n${passed} checks passed.`);
