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
const countsSum = (c: Record<Group, number>) => sum(TN_GROUPS.map((g) => c[g] ?? 0));
const seatsSum = (o: Record<Group, number>) => sum(TN_GROUPS.map((g) => o[g] ?? 0));

console.log("Tamil Nadu 2026 aggregate workbook + geographic allocation");

check("final workbook counts and all-response statewide denominator", () => {
  assert.equal(aggregates.source.totalResponses, 31_316);
  assert.equal(aggregates.source.locatedResponses, 11_449);
  assert.equal(aggregates.source.unlocatedResponses, 19_867);
  assert.equal(aggregates.source.constituencies, 234);
  assert.equal(aggregates.source.districts, 38);
  assert.deepEqual(aggregates.source.crosswalk, { matched: 234, unresolved: 0, method: "assembly name + District (2026 ECI grouping)", duplicateNames: ["Tiruppattur"] });
  assert.deepEqual(aggregates.statewide.counts, { total: 31_316, located: 11_449, unlocated: 19_867 });
  assert.equal(aggregates.statewide.recorded.valid, 31_316);
  assert.equal(aggregates.statewide.combined.valid, 31_316);
  assert.equal(countsSum(aggregates.statewide.combined.counts), 31_316);
});

check("five groups, no Others bucket, distinct colours", () => {
  assert.deepEqual(TN_GROUPS, ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"]);
  assert.deepEqual(aggregates.groups, [...TN_GROUPS]);
  assert.equal((TN_GROUPS as readonly string[]).includes("Others"), false);
  assert.ok(TN_GROUPS.every((g) => TN_COLOR[g]));
  assert.equal(new Set(TN_GROUPS.map((g) => TN_COLOR[g].toLowerCase())).size, TN_GROUPS.length);
});

check("statewide shares are workbook-derived and total 100%", () => {
  const s = aggregates.statewide.combined.shares;
  assert.ok(s);
  assert.deepEqual(aggregates.statewide.combined.counts, { TVK: 10_892, "AIADMK+BJP+PMK+AMMK": 8_856, "DMK+INC+VCK": 9_146, NTK: 2_173, NOTA: 249 });
  assert.ok(near(s.TVK, 0.347809, 1e-5));
  assert.ok(near(s["AIADMK+BJP+PMK+AMMK"], 0.282795, 1e-5));
  assert.ok(near(s["DMK+INC+VCK"], 0.292055, 1e-5));
  assert.ok(near(s.NTK, 0.069389, 1e-5));
  assert.ok(near(s.NOTA, 0.007951, 1e-5));
  assert.ok(near(sum(TN_GROUPS.map((g) => s[g] ?? 0)), 1, 1e-5));
});

check("TVK reference 34.80 is separate from the 34.78 workbook value", () => {
  assert.equal(aggregates.referenceShare.party, "TVK");
  assert.equal(aggregates.referenceShare.label, "Reference share");
  assert.ok(near(aggregates.referenceShare.value, 0.348, 1e-12));
  assert.ok(near(aggregates.referenceShare.workbookValue, 0.347809, 1e-5));
  assert.notEqual(aggregates.referenceShare.value, aggregates.referenceShare.workbookValue);
  assert.equal(aggregates.statewide.combined.counts.TVK, 10_892);
});

check("allocation metadata has method, source import ID and version", () => {
  const a = aggregates.allocation;
  assert.equal(a.version, "tn-geographic-allocation-v1");
  assert.ok(a.method.includes("integer division"));
  assert.ok(a.method.includes("location-missing"));
  assert.match(a.sourceImportId, /^tn-aggregate-[a-f0-9]{16}$/);
  assert.match(a.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(a.priority, "Zero recorded total first, then AC ID");
  assert.equal(a.sourceFile, aggregates.sourceFile);
});

check("recorded, district-only, unlocated and combined markers reconcile", () => {
  const a = aggregates.allocation;
  assert.equal(countsSum(a.recorded.assembly), 10_567);
  assert.equal(countsSum(a.recorded.district), 11_449);
  assert.equal(countsSum(a.recorded.districtOnly), 882);
  assert.equal(countsSum(a.recorded.unlocated), 19_867);
  assert.equal(countsSum(a.recorded.statewide), 31_316);
  assert.equal(countsSum(a.allocated.districtOnly), 882);
  assert.equal(countsSum(a.allocated.unlocated), 19_867);
  assert.equal(countsSum(a.combined.assembly), 31_316);
  assert.equal(countsSum(a.combined.district), 31_316);
  assert.equal(countsSum(a.combined.statewide), 31_316);
  assert.deepEqual(a.recorded.unlocated, { TVK: 6_399, "AIADMK+BJP+PMK+AMMK": 5_703, "DMK+INC+VCK": 6_310, NTK: 1_278, NOTA: 177 });
  assert.equal(a.reconcile.assemblyRecorded, 10_567);
  assert.equal(a.reconcile.districtOnlyAllocated, 882);
  assert.equal(a.reconcile.unlocatedAllocated, 19_867);
  assert.equal(a.reconcile.combinedAssembly, 31_316);
  assert.equal(a.reconcile.combinedDistrict, 31_316);
  assert.equal(a.reconcile.combinedStatewide, 31_316);
  assert.equal(a.reconcile.partyTotalsUnchanged, true);
  assert.equal(a.reconcile.acDistrictEqual, true);
  assert.equal(a.reconcile.districtStateEqual, true);
  assert.equal(a.reconcile.noDoubleCount, true);
});

check("234 assemblies, 38 districts and complete geometry", () => {
  assert.equal(aggregates.acs.length, 234);
  assert.equal(aggregates.districts.length, 38);
  assert.equal(new Set(aggregates.acs.map((a) => a.no)).size, 234);
  assert.equal(acGeo.features.length, 234);
  assert.equal(districtGeo.features.length, 38);
  assert.ok(aggregates.acs.every((a) => a.district && a.districtEci));
  assert.ok(aggregates.districts.every((d) => d.coverage.acs > 0));
  for (const f of acGeo.features) {
    assert.ok(f.properties.no >= 1 && f.properties.no <= 234);
    assert.ok(f.properties.district);
    assert.ok(Array.isArray(f.properties.centroid) && f.properties.centroid.length === 2);
  }
});

check("all 234 AC IDs and all 38 canonical district mappings resolve to valid colours", () => {
  const aliases: Record<string, string> = {
    Kanyakumari: "Kanniyakumari", Nilgiris: "The Nilgiris", Thiruvarur: "Tiruvarur",
    Thoothukkudi: "Thoothukudi", Viluppuram: "Villupuram",
  };
  const byNo = new Map(aggregates.acs.map((a) => [a.no, a]));
  for (const f of acGeo.features) {
    const a = byNo.get(f.properties.no);
    assert.ok(a, `Unmatched AC geometry ${f.properties.no}`);
    assert.ok(a!.combined.leader, `No combined leader for AC ${a!.no}`);
    const leader = a!.combined.leader as Group;
    assert.equal(TN_COLOR[leader], aggregates.colors[leader]);
  }
  const byDistrict = new Map(aggregates.districts.map((d) => [d.name, d]));
  for (const f of districtGeo.features) {
    const current = aliases[f.properties.district] ?? f.properties.district;
    const d = byDistrict.get(current);
    assert.ok(d, `Unmatched district geometry ${f.properties.district} -> ${current}`);
    assert.ok(d!.combined.leader, `No combined leader for district ${current}`);
    const leader = d!.combined.leader as Group;
    assert.ok(TN_COLOR[leader], `No colour for ${current}`);
    assert.notEqual(TN_COLOR[leader], "#94A3B8", `Grey valid district ${current}`);
  }
  assert.equal([...byDistrict.keys()].filter((n) => !districtGeo.features.some((f) => (aliases[f.properties.district] ?? f.properties.district) === n)).length, 0);
});

check("recorded assembly and district totals are preserved", () => {
  assert.equal(sum(aggregates.acs.map((a) => a.recorded.valid)), 10_567);
  assert.equal(sum(aggregates.districts.map((d) => d.recorded.valid)), 11_449);
  assert.equal(aggregates.statewide.counts.total - aggregates.acs.reduce((s, a) => s + a.recorded.valid, 0), 20_749);
  for (const d of aggregates.districts) {
    assert.equal(d.recorded.valid, d.coverage.responses);
    assert.equal(countsSum(d.recorded.counts), d.recorded.valid);
  }
});

check("combined AC counts equal recorded + district-only + unlocated", () => {
  for (const a of aggregates.acs) {
    assert.equal(a.combined.valid, countsSum(a.combined.counts));
    for (const g of TN_GROUPS) {
      assert.equal(a.combined.counts[g], a.recorded.counts[g] + a.allocatedDistrictOnly[g] + a.allocatedUnlocated[g], `${a.no} ${g}`);
    }
  }
  assert.equal(sum(aggregates.acs.map((a) => a.combined.valid)), 31_316);
  assert.equal(sum(aggregates.acs.map((a) => countsSum(a.allocatedDistrictOnly))), 882);
  assert.equal(sum(aggregates.acs.map((a) => countsSum(a.allocatedUnlocated))), 19_867);
});

check("combined district counts equal recorded district + unlocated, not district-only again", () => {
  const byNo = new Map(aggregates.acs.map((a) => [a.no, a]));
  for (const d of aggregates.districts) {
    const members = d.acs.map((no) => byNo.get(no)!);
    const allocatedUnlocated = Object.fromEntries(TN_GROUPS.map((g) => [g, sum(members.map((a) => a.allocatedUnlocated[g]))]));
    for (const g of TN_GROUPS) {
      assert.equal(d.combined.counts[g], d.recorded.counts[g] + allocatedUnlocated[g], `${d.name} ${g}`);
      assert.equal(d.allocatedDistrictOnly[g], sum(members.map((a) => a.allocatedDistrictOnly[g])), `${d.name} district-only ${g}`);
      assert.equal(d.combined.counts[g], sum(members.map((a) => a.combined.counts[g])), `${d.name} ${g}`);
    }
    assert.equal(countsSum(d.allocatedUnlocated), sum(members.map((a) => countsSum(a.allocatedUnlocated))));
    assert.equal(d.combined.valid, d.recorded.valid + countsSum(d.allocatedUnlocated));
  }
  assert.equal(sum(aggregates.districts.map((d) => d.combined.valid)), 31_316);
});

check("every party total is unchanged and no vote is counted twice", () => {
  for (const g of TN_GROUPS) {
    assert.equal(sum(aggregates.acs.map((a) => a.recorded.counts[g])), aggregates.allocation.recorded.assembly[g]);
    assert.equal(sum(aggregates.acs.map((a) => a.combined.counts[g])), aggregates.statewide.combined.counts[g]);
    assert.equal(sum(aggregates.districts.map((d) => d.combined.counts[g])), aggregates.statewide.combined.counts[g]);
    assert.equal(aggregates.allocation.recorded.assembly[g] + aggregates.allocation.recorded.districtOnly[g] + aggregates.allocation.recorded.unlocated[g], aggregates.statewide.combined.counts[g]);
  }
});

check("unlocated remainder is deterministic and prioritises zero-recorded ACs then AC ID", () => {
  const nota = aggregates.acs.map((a) => a.allocatedUnlocated.NOTA);
  assert.equal(nota.filter((x) => x === 1).length, 177);
  assert.equal(nota.filter((x) => x === 0).length, 57);
  assert.deepEqual(aggregates.acs.slice(0, 177).map((a) => a.allocatedUnlocated.NOTA), Array(177).fill(1));
  assert.deepEqual(aggregates.acs.slice(177).map((a) => a.allocatedUnlocated.NOTA), Array(57).fill(0));
  for (const g of TN_GROUPS) {
    const total = aggregates.allocation.recorded.unlocated[g];
    const base = Math.floor(total / 234);
    assert.ok(aggregates.acs.every((a) => a.allocatedUnlocated[g] === base || a.allocatedUnlocated[g] === base + 1), g);
  }
  // Each party's extra unit count matches the integer remainder.
  for (const g of TN_GROUPS) {
    const total = aggregates.allocation.recorded.unlocated[g];
    assert.equal(aggregates.acs.filter((a) => a.allocatedUnlocated[g] === Math.floor(total / 234) + 1).length, total % 234, g);
  }
});

check("district-only allocation stays inside the recorded district", () => {
  const byNo = new Map(aggregates.acs.map((a) => [a.no, a]));
  for (const d of aggregates.districts) {
    const members = d.acs.map((no) => byNo.get(no)!);
    for (const g of TN_GROUPS) {
      assert.equal(d.allocatedDistrictOnly[g], d.recorded.counts[g] - sum(members.map((a) => a.recorded.counts[g])), `${d.name} ${g}`);
      assert.equal(sum(members.map((a) => a.allocatedDistrictOnly[g])), d.allocatedDistrictOnly[g], `${d.name} ${g}`);
    }
  }
});

check("combined shares total 100% and leaders/margins derive from combined counts", () => {
  for (const a of aggregates.acs) {
    const total = countsSum(a.combined.counts);
    assert.ok(near(sum(TN_GROUPS.map((g) => a.combined.shares[g] ?? 0)), 1, 1e-5), a.name);
    assert.equal(tnLeader(a.combined.shares), a.combined.leader);
    assert.equal(a.projected.leader, a.combined.leader);
    const sorted = [...TN_GROUPS].sort((x, y) => a.combined.counts[y] - a.combined.counts[x]);
    assert.equal(a.combined.runnerUp, sorted[1]);
    assert.ok(near(a.combined.marginPp, ((a.combined.counts[sorted[0]] - a.combined.counts[sorted[1]]) / total) * 100, 0.02));
  }
  for (const d of aggregates.districts) {
    assert.ok(near(sum(TN_GROUPS.map((g) => d.combined.shares[g] ?? 0)), 1, 1e-5), d.name);
    assert.equal(tnLeader(d.combined.shares), d.combined.leader);
  }
});

check("projected seats and accuracy are recalculated from combined leaders; workbook originals stay recoverable", () => {
  assert.deepEqual(aggregates.statewide.projectedSeats, { TVK: 187, "AIADMK+BJP+PMK+AMMK": 22, "DMK+INC+VCK": 25, NTK: 0, NOTA: 0 });
  assert.equal(seatsSum(aggregates.statewide.projectedSeats), 234);
  assert.deepEqual(aggregates.statewide.workbookProjectedSeats, { TVK: 115, "AIADMK+BJP+PMK+AMMK": 60, "DMK+INC+VCK": 56, NTK: 3, NOTA: 0 });
  assert.equal(aggregates.statewide.workbookAccuracy, 110);
  assert.equal(aggregates.statewide.accuracy, aggregates.acs.filter((a) => a.match).length);
  assert.equal(aggregates.statewide.accuracy, 116);
  for (const a of aggregates.acs) {
    assert.equal(a.projected.leader, a.combined.leader);
    assert.equal(a.match, a.projected.leader === a.actual2026.winner);
    assert.ok(a.workbook.projection.leader);
    assert.ok(a.workbook.adjustedShares);
  }
  for (const d of aggregates.districts) {
    const projected = Object.fromEntries(TN_GROUPS.map((g) => [g, d.acs.filter((no) => aggregates.acs.find((a) => a.no === no)!.combined.leader === g).length]));
    assert.deepEqual(d.projectedSeats, projected);
    assert.ok(d.workbook.projectedSeats);
  }
});

check("actual 2026 and historical results are untouched", () => {
  assert.deepEqual(aggregates.statewide.actualSeats, { TVK: 108, "AIADMK+BJP+PMK+AMMK": 53, "DMK+INC+VCK": 73, NTK: 0, NOTA: 0 });
  for (const a of aggregates.acs) {
    assert.equal("shares" in a.actual2026, false);
  }
  for (const y of ["2011", "2016", "2021"] as const) {
    assert.ok(aggregates.statewide.actual[y].available);
    assert.ok(near(sum(TN_GROUPS.map((g) => aggregates.statewide.actual[y].shares?.[g] ?? 0)), 1, 1e-5), y);
    for (const d of aggregates.districts) assert.equal(d.actual[y].available, true, `${d.name} ${y}`);
  }
  assert.equal(aggregates.acs.find((a) => a.no === 134)!.actual["2016"].available, false);
  assert.equal(aggregates.acs.find((a) => a.no === 174)!.actual["2016"].available, false);
  assert.equal(aggregates.acs.filter((a) => !a.actual["2016"].available).length, 2);
  assert.equal(aggregates.presence["2011"].TVK, false);
  assert.equal(aggregates.presence["2011"].NTK, false);
  assert.equal(aggregates.presence["2011"].NOTA, false);
});

check("workbook adjusted shares are preserved separately and not applied again", () => {
  const a = aggregates.acs[0];
  assert.ok(a.workbook.adjustedShares);
  assert.ok(near(sum(TN_GROUPS.map((g) => a.workbook.adjustedShares?.[g] ?? 0)), 1, 1e-5));
  assert.notDeepEqual(a.combined.shares, a.workbook.adjustedShares);
  for (const ac of aggregates.acs) {
    assert.ok(ac.combined.shares);
    assert.ok(ac.recorded.shares);
    assert.ok(near(sum(TN_GROUPS.map((g) => ac.recorded.shares?.[g] ?? 0)), 1, 1e-5));
  }
  assert.equal(aggregates.source.normalisation.ac.count, 22);
});

check("all nine workbook sheets were read; private sheets stay private", () => {
  const names = aggregates.source.audit.map((a) => a.sheet);
  assert.deepEqual(names, ["Summary", "Statewide Votes", "AC Results", "District Results", "AC vs Actual 2026", "District vs Actual 2026", "Who Voted How", "Model Validation", "Significant Variables"]);
  for (const s of ["Who Voted How", "Model Validation", "Significant Variables"]) {
    assert.ok(aggregates.source.audit.find((a) => a.sheet === s)?.used.includes("private"));
  }
});

check("no survey rounds, dates or raw respondent records are invented", () => {
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
  assert.ok(aggregates.source.districtPolicy.includes("Current 38-district"));
  assert.equal(new Set(aggregates.acs.map((a) => a.name)).size, 233);
  assert.equal(aggregates.acs.filter((a) => a.name === "Tiruppattur").length, 2);
});

console.log(`\n${passed} checks passed.`);
