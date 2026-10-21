import assert from "node:assert/strict";
import { DATA, PARTIES, leaderOf, weightedShares } from "@/lib/telangana/oct26";
import {
  HISTORY, SWING_INTERVALS, baselineYear, cohortStats, historicalAc, historicalAimim, historicalShares,
  historicalTotal, outlierRows, swingStat, winnerColour, winnerLabel, winnerSeats,
} from "@/lib/telangana/history";

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed += 1; console.log(`  ✓ ${name}`); };
const near = (a: number, b: number, eps = 5e-5) => Math.abs(a - b) <= eps;

console.log("Telangana 2014–2028 history, swing and device snapshot");

check("2014/2018/2023 each have 119 assemblies and the supplied vote totals", () => {
  assert.equal(HISTORY.years["2014"].acs.length, 119);
  assert.equal(HISTORY.years["2018"].acs.length, 119);
  assert.equal(HISTORY.years["2023"].acs.length, 119);
  assert.equal(HISTORY.years["2014"].total, 19_448_279);
  assert.equal(HISTORY.years["2018"].total, 20_695_458);
  assert.equal(HISTORY.years["2023"].total, 23_439_945);
  assert.equal(new Set(HISTORY.years["2014"].acs.map((a) => a.no)).size, 119);
  assert.equal(new Set(HISTORY.years["2018"].acs.map((a) => a.no)).size, 119);
  assert.equal(new Set(HISTORY.years["2023"].acs.map((a) => a.no)).size, 119);
});

check("statewide four-group historical shares reconcile", () => {
  assert.deepEqual(HISTORY.years["2014"].shares, { BRS: 0.340407, Congress: 0.259078, BJP: 0.070344, Others: 0.330171 });
  assert.deepEqual(HISTORY.years["2018"].shares, { BRS: 0.468738, Congress: 0.288292, BJP: 0.070086, Others: 0.172885 });
  assert.deepEqual(HISTORY.years["2023"].shares, { BRS: 0.373463, Congress: 0.397448, BJP: 0.138973, Others: 0.090115 });
  for (const [year, expected] of [["2014", HISTORY.years["2014"]], ["2018", HISTORY.years["2018"]], ["2023", HISTORY.years["2023"]]] as const) {
    const shares = historicalShares(DATA.acs, year);
    for (const p of PARTIES) assert.ok(near(shares[p], expected.shares[p]), `${year} ${p}: ${shares[p]} vs ${expected.shares[p]}`);
  }
});

check("historical winner counts match the source audit", () => {
  assert.deepEqual(HISTORY.years["2014"].seats, { BSP: 2, TRS: 63, INC: 21, TDP: 15, BJP: 5, AIMIM: 7, CPI: 1, IND: 1, YSRCP: 3, CPM: 1 });
  assert.deepEqual(HISTORY.years["2018"].seats, { TRS: 88, INC: 19, AIFB: 1, AIMIM: 7, BJP: 1, IND: 1, TDP: 2 });
  assert.deepEqual(HISTORY.years["2023"].seats, { BJP: 8, INC: 64, BRS: 39, AIMIM: 7, CPI: 1 });
  for (const year of ["2014", "2018", "2023"] as const) {
    assert.deepEqual(winnerSeats(DATA.acs, year), HISTORY.years[year].seats);
    assert.equal(Object.values(winnerSeats(DATA.acs, year)).reduce((s, n) => s + n, 0), 119);
  }
});

check("2028 numeric leads and Kodangal tie are unchanged", () => {
  assert.deepEqual(DATA.statewide.leads, { BJP: 13, Congress: 27, BRS: 70, Others: 8, Tie: 1 });
  const k = DATA.acs.find((a) => a.no === 72)!;
  assert.equal(k.leader, "Tie");
  assert.deepEqual(k.tied.sort(), ["BRS", "Congress"]);
});

check("Kodangal keeps its historical winners across 2014, 2018 and 2023", () => {
  assert.equal(historicalAc("2014", 72)?.winnerParty, "TDP");
  assert.equal(historicalAc("2018", 72)?.winnerParty, "TRS");
  assert.equal(historicalAc("2023", 72)?.winnerParty, "INC");
  assert.equal(historicalAc("2014", 72)?.winnerName, "ANUMULA REVANTH REDDY");
});

check("baseline is 2023 for 2028 and the selected year otherwise", () => {
  assert.equal(baselineYear("2028"), "2023");
  assert.equal(baselineYear("2014"), "2014");
  assert.equal(baselineYear("2018"), "2018");
  assert.equal(baselineYear("2023"), "2023");
  assert.ok(near(weightedShares(DATA.acs, "prediction").BRS, DATA.statewide.prediction.BRS, 1e-5));
  assert.equal(historicalTotal(DATA.acs, "2014"), 19_448_279);
});

check("AIMIM historical results stay named separately by year", () => {
  assert.ok(near(HISTORY.years["2014"].aimim, 0.037366, 1e-6));
  assert.ok(near(HISTORY.years["2018"].aimim, 0.027112, 1e-6));
  assert.ok(near(HISTORY.years["2023"].aimim, 0.022158, 1e-6));
  assert.ok(near(historicalAimim(DATA.acs, "2014"), 0.037366, 1e-6));
  assert.ok(near(historicalAimim(DATA.acs, "2018"), 0.027112, 1e-6));
  assert.ok(near(historicalAimim(DATA.acs, "2023"), 0.022158, 1e-6));
  assert.equal(HISTORY.years["2014"].seats.AIMIM, 7);
  assert.equal(HISTORY.years["2018"].seats.AIMIM, 7);
  assert.equal(HISTORY.years["2023"].seats.AIMIM, 7);
});

check("20 swing tables: five intervals × four parties, 119 assemblies each", () => {
  assert.equal(HISTORY.stats.length, 20);
  for (const s of HISTORY.stats) {
    assert.equal(s.assemblies.length, 119, `${s.fromYear}-${s.toYear} ${s.party}`);
    assert.ok(s.lowerFencePp < s.q1Pp && s.q1Pp <= s.medianPp && s.medianPp <= s.q3Pp && s.q3Pp < s.upperFencePp);
  }
  assert.deepEqual(SWING_INTERVALS.map((i) => `${i.from}-${i.to}`), ["2014-2018", "2018-2023", "2023-2028"]);
});

check("statewide cohort statistics match the supplied inclusive quartiles and fences", () => {
  const cases: [number, number, "BRS" | "Congress" | "BJP" | "Others"][] = [
    [2014, 2018, "BRS"], [2018, 2023, "Congress"], [2023, 2028, "BJP"], [2014, 2028, "Others"],
  ];
  for (const [from, to, party] of cases) {
    const source = swingStat(from, to, party)!;
    const cohort = cohortStats(DATA.acs, from, to, party)!;
    assert.equal(cohort.n, 119);
    assert.ok(near(cohort.medianPp, source.medianPp));
    assert.ok(near(cohort.q1Pp, source.q1Pp));
    assert.ok(near(cohort.q3Pp, source.q3Pp));
    assert.ok(near(cohort.lowerFencePp, source.lowerFencePp));
    assert.ok(near(cohort.upperFencePp, source.upperFencePp));
    assert.equal([...cohort.flags.values()].filter(Boolean).length, source.assemblies.filter((a) => a.outlier).length);
  }
});

check("district cohort recomputes medians and flags low/high outliers", () => {
  const hyderabad = DATA.acs.filter((a) => a.district === "Hyderabad");
  assert.equal(hyderabad.length, 15);
  const cohort = cohortStats(hyderabad, 2023, 2028, "BRS")!;
  assert.equal(cohort.n, 15);
  assert.ok(near(cohort.medianPp, 14.27, 1e-2));
  assert.ok(near(cohort.lowerFencePp, 7.16, 1e-2));
  assert.ok(near(cohort.upperFencePp, 21.04, 1e-2));
  assert.equal(cohort.flags.get(65), true); // Goshamahal is a low outlier
  assert.equal(cohort.flags.get(71), true); // Secunderabad Cantt is a high outlier
  assert.equal(cohort.flags.get(61), false); // Jubilee Hills is inside the fences
  const rows = outlierRows(hyderabad, 2023, 2028, "BRS");
  assert.ok(rows.some((r) => r.no === 65));
  assert.ok(rows.some((r) => r.no === 71));
});

check("cohorts below 10 assemblies return no invented statistics", () => {
  const one = DATA.acs.filter((a) => a.no === 72);
  assert.equal(cohortStats(one, 2023, 2028, "BRS"), null);
  assert.deepEqual(outlierRows(one, 2023, 2028, "BRS"), []);
});

check("device metadata is the exact 4,768-entry October aggregate", () => {
  assert.equal(HISTORY.devices.total, 4768);
  assert.equal(HISTORY.devices.brands.length, 28);
  assert.equal(Object.keys(HISTORY.devices.byAc).length, 119);
  assert.equal(HISTORY.devices.byAc["1"].total, 1121);
  const vivo = HISTORY.devices.byAc["1"].brands.find((b) => b.brand === "Vivo")!;
  assert.equal(vivo.entries, 291);
  assert.ok(near(vivo.share, 0.2596, 1e-3));
  for (const rec of Object.values(HISTORY.devices.byAc)) {
    const share = rec.brands.reduce((s, b) => s + b.share, 0);
    assert.ok(near(share, 1, 1e-5));
    assert.equal(rec.brands.reduce((s, b) => s + b.entries, 0), rec.total);
  }
  assert.equal(Object.values(HISTORY.devices.byAc).reduce((s, r) => s + r.total, 0), 4768);
});

check("every historical winner has a distinct party colour and label", () => {
  const winners = new Set<string>();
  for (const y of ["2014", "2018", "2023"] as const) for (const a of HISTORY.years[y].acs) winners.add(a.winnerParty);
  const colours = new Set<string>();
  for (const p of winners) {
    const c = winnerColour(p);
    assert.match(c, /^#[0-9a-fA-F]{6}$/, p);
    colours.add(c.toLowerCase());
    assert.notEqual(winnerLabel(p), "");
  }
  assert.equal(winners.size, 12);
  assert.equal(winnerColour("TRS"), winnerColour("BRS"));
  assert.equal(new Set([...colours]).size, winners.size - 1);
  assert.equal(winnerColour("AIMIM").toLowerCase(), "#16a34a");
  assert.equal(winnerColour("Others").toLowerCase(), "#7c6f9a");
  assert.equal(winnerLabel("Others"), "Others");
});

check("no AIMIM 2028 prediction is invented", () => {
  for (const a of DATA.acs) {
    assert.equal(Object.keys(a.prediction).includes("AIMIM"), false);
    assert.equal(leaderOf(a.prediction).leader === "Others" || leaderOf(a.prediction).leader !== null, true);
  }
});

console.log(`\n${passed} checks passed.`);
