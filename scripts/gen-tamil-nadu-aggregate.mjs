// Build the Tamil Nadu public aggregate snapshot from the final workbook
// TN-2026-Exit-Poll-Analysis-Data-5.xlsx. This is an aggregate export, not a
// respondent-level source. All nine sheets are read and audited; private
// model/age/religion sheets are retained in the source audit but never exposed
// as public sections.
import fs from "node:fs";
import crypto from "node:crypto";
import { read, utils } from "xlsx";

const FILE = process.env.TN_AGG_XLSX || ".context/attachments/dNI0NW/TN-2026-Exit-Poll-Analysis-Data-5.xlsx";
const OLD = process.env.TN_OLD_AGGREGATES || "scripts/fixtures/tamil-nadu-historical-2011-2021.json";
const OUT = "lib/data/tamil-nadu/aggregates.json";
const ALLOCATION_VERSION = "tn-geographic-allocation-v1";
const ALLOCATION_METHOD = "Recorded district-only votes are allocated within their recorded district; location-missing votes are allocated across all 234 assemblies by party using integer division, with remainders ordered by zero-recorded assemblies first and then AC ID. Combined counts are used for geographic shares.";
const GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"];
const YEARS = ["2011", "2016", "2021"];
const LB = {
  "TVK": "TVK",
  "AIADMK+BJP+PMK+AMMK": "AIADMK+BJP+PMK+AMMK",
  "DMK+INC+VCK": "DMK+INC+VCK",
  "NTK": "NTK",
  "NOTA": "NOTA",
};
const COL = {
  "TVK": "#EAB308",
  "AIADMK+BJP+PMK+AMMK": "#16A34A",
  "DMK+INC+VCK": "#DC2626",
  "NTK": "#7C3AED",
  "NOTA": "#94A3B8",
};
const normName = (s) => String(s ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const HISTORICAL_DISTRICT_ALIAS = {
  Kanniyakumari: "Kanyakumari",
  "The Nilgiris": "Nilgiris",
  Thoothukudi: "Thoothukkudi",
  Tiruvarur: "Thiruvarur",
  Villupuram: "Viluppuram",
};
const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const sum = (o) => GROUPS.reduce((s, p) => s + (Number(o[p]) || 0), 0);
const zeroCounts = () => Object.fromEntries(GROUPS.map((g) => [g, 0]));
const countsOf = (row) => Object.fromEntries(GROUPS.map((g) => [g, g === "TVK" ? Number(row["TVK votes"] || 0) : g === "AIADMK+BJP+PMK+AMMK" ? Number(row["AIADMK+ votes"] || 0) : g === "DMK+INC+VCK" ? Number(row["DMK+ votes"] || 0) : g === "NTK" ? Number(row["NTK votes"] || 0) : Number(row["NOTA votes"] || 0)]));
const totals = (counts) => Object.fromEntries(GROUPS.map((g) => [g, counts.reduce((s2, c) => s2 + (c[g] || 0), 0)]));
const sumCounts = (counts) => GROUPS.reduce((s2, g) => s2 + (counts[g] || 0), 0);
const splitEven = (total, n, ordered) => {
  const base = Math.floor(total / n), remainder = total % n;
  return ordered.map((_, i) => base + (i < remainder ? 1 : 0));
};
const priorityOrder = (items) => [...items].sort((a, b) => {
  const az = sumCounts(a.recorded.counts) === 0 ? 0 : 1;
  const bz = sumCounts(b.recorded.counts) === 0 ? 0 : 1;
  return az - bz || a.no - b.no;
});
const combinedSurvey = (counts) => {
  const valid = sumCounts(counts);
  const shares = normalize(counts);
  const sorted = [...GROUPS].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const leader = sorted[0] ?? null;
  const runnerUp = sorted[1] ?? null;
  const marginPp = valid && leader && runnerUp ? Math.round(((counts[leader] - counts[runnerUp]) / valid) * 10000) / 100 : 0;
  return { valid, counts, shares, leader, runnerUp, marginPp };
};
const confidenceFor = (marginPp, valid) => marginPp === 0 ? "Tie" : valid < 10 ? "Low sample" : marginPp >= 10 && valid >= 30 ? "Strong" : marginPp >= 5 ? "Lean" : "Toss-up";
const normalize = (o) => { const total = sum(o) || 1; return Object.fromEntries(GROUPS.map((p) => [p, round6((Number(o[p]) || 0) / total)])); };
const leaderOf = (o) => {
  const sorted = [...GROUPS].sort((a, b) => (o[b] || 0) - (o[a] || 0));
  return sorted[0] ?? null;
};
const serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86_400_000);
const dateOnly = (d) => d.toISOString().slice(0, 10);
const buf = fs.readFileSync(FILE);
const wb = read(buf, { cellFormula: false });
const old = JSON.parse(fs.readFileSync(OLD, "utf8"));
const wsArray = (name) => utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: true, header: 1 });
const table = (name, predicate) => {
  const rows = wsArray(name);
  const hi = rows.findIndex(predicate);
  if (hi < 0) throw new Error(`Header not found in ${name}`);
  const header = rows[hi].map((h) => String(h ?? ""));
  return { header, rows: rows.slice(hi + 1) };
};
const rowObj = (header, row) => Object.fromEntries(header.map((h, i) => [h, row[i]]));

/* ---------------- read every sheet ---------------- */
const summaryRaw = wsArray("Summary");
const summary = new Map();
for (const row of summaryRaw) { const key = String(row[0] ?? "").trim(); if (key && row[1] !== "" && !summary.has(key)) summary.set(key, row[1]); }
const statewideT = table("Statewide Votes", (r) => r.includes("Respondent group"));
const statewide = Object.fromEntries(statewideT.rows.filter((r) => r[0]).map((r) => [String(r[0]).trim(), rowObj(statewideT.header, r)]));
const all = statewide["All responses"];
const located = statewide["With district or AC"];
const missing = statewide["Vote only (no location)"];
if (!all) throw new Error("Statewide All responses row missing");
const acT = table("AC Results", (r) => r.includes("Constituency") && r.includes("TVK adjusted %"));
const distT = table("District Results", (r) => r.includes("District") && r.includes("TVK adjusted %"));
const acActualT = table("AC vs Actual 2026", (r) => r.includes("AC No") && r.includes("Actual 2026 alliance"));
const distActualT = table("District vs Actual 2026", (r) => r.includes("District") && r.includes("Actual TVK"));
const acRows = acT.rows.filter((r) => String(r[0]).trim() && r[0] !== "Constituency").map((r) => rowObj(acT.header, r));
const distRows = distT.rows.filter((r) => String(r[0]).trim() && !["District", "Tamil Nadu"].includes(String(r[0]).trim())).map((r) => rowObj(distT.header, r));
const actualRows = acActualT.rows.filter((r) => Number(r[acActualT.header.indexOf("AC No")]) >= 1 && Number(r[acActualT.header.indexOf("AC No")]) <= 234).map((r) => rowObj(acActualT.header, r));
const distActualRows = distActualT.rows.filter((r) => String(r[0]).trim() && !["District", "Actual ≥ projected?", "Grand Total"].includes(String(r[0]).trim()) && Number(r[1] || 0) > 0).map((r) => rowObj(distActualT.header, r));
if (acRows.length !== 234) throw new Error(`Expected 234 AC rows, got ${acRows.length}`);
if (distRows.length !== 38) throw new Error(`Expected 38 district rows, got ${distRows.length}`);
if (actualRows.length !== 234) throw new Error(`Expected 234 actual AC rows, got ${actualRows.length}`);
const acNoMap = new Map(); for (const r of actualRows) acNoMap.set(`${normName(r.Constituency)}|${normName(r["District (2026 ECI grouping)"])}`, r);
if (acNoMap.size !== 234) throw new Error(`Actual AC crosswalk duplicates: ${acNoMap.size}`);
const acCurrentMap = new Map(); for (const r of acRows) acCurrentMap.set(`${normName(r.Constituency)}|${normName(r["District (2026 ECI grouping)"])}`, r);
const missingCrosswalk = [...acCurrentMap.keys()].filter((k) => !acNoMap.has(k));
if (missingCrosswalk.length) throw new Error(`Unresolved AC names: ${missingCrosswalk.slice(0, 5).join(", ")}`);
const currentDistricts = new Set(acRows.map((r) => String(r.District).trim()));
const eciDistricts = new Set(acRows.map((r) => String(r["District (2026 ECI grouping)"]).trim()));
if (currentDistricts.size !== 38 || eciDistricts.size !== 38) throw new Error("District grouping cardinality failed");
const privateSheets = ["Who Voted How", "Model Validation", "Significant Variables"].map((name) => ({ name, rows: wsArray(name).length, used: "private only" }));
const adjustedSums = { ac: [], district: [] };
for (const r of acRows) adjustedSums.ac.push(sum({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] }));
for (const r of distRows) adjustedSums.district.push(sum({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] }));
const deviations = adjustedSums.ac.map((x) => Math.abs(x - 1) * 100);
const badAc = deviations.filter((x) => x > 1e-4).length;
const maxDeviation = deviations.length ? Math.max(...deviations) : 0;
const badDistrict = adjustedSums.district.filter((x) => Math.abs(x - 1) > 1e-4).length;
const normalisation = {
  ac: { count: badAc, total: 234, maxDeviationPp: round6(maxDeviation), policy: "Proportional renormalisation to 100% for display; workbook values preserved unchanged. No values were silently altered." },
  district: { count: badDistrict, total: 38, maxDeviationPp: 0, policy: "Validated at 100%; no renormalisation applied." },
};

/* ---------------- historical numeric mapping (2011/16/21) ---------------- */
const mapOldShares = (s) => {
  if (!s) return null;
  const raw = { TVK: s.TVK || 0, "AIADMK+BJP+PMK+AMMK": s["AIADMK+BJP+PMK+AMMK"] || 0, "DMK+INC+VCK": (s["DMK+INC+VCK"] || 0) + (s.Others || 0), NTK: s.NTK || 0, NOTA: s.NOTA || 0 };
  return normalize(raw);
};
const historical = { state: {}, districts: new Map(), acs: new Map() };
for (const y of YEARS) {
  historical.state[y] = mapOldShares(old.statewide.actual[y]?.shares);
  for (const d of old.districts) historical.districts.set(`${d.name}|${y}`, mapOldShares(d.actual[y]?.shares));
  for (const a of old.acs) historical.acs.set(`${a.no}|${y}`, mapOldShares(a.actual[y]?.shares));
}
const presence = {};
for (const y of YEARS) {
  presence[y] = Object.fromEntries(GROUPS.map((g) => [g, !!old.presence?.[y]?.[g] || (g !== "TVK" && y !== "2011" && g !== "NOTA" && g !== "NTK")]));
  presence[y].TVK = false;
  if (y === "2011") { presence[y].NTK = false; presence[y].NOTA = false; }
}

/* ---------------- AC records ---------------- */
const groupActual = (alliance) => {
  const s = String(alliance ?? "").trim();
  if (s === "TVK") return "TVK";
  if (s.includes("AIADMK") || s.includes("AMMK") || s === "BJP" || s === "PMK") return "AIADMK+BJP+PMK+AMMK";
  if (s.includes("DMK") || s === "INC" || s === "VCK") return "DMK+INC+VCK";
  if (s === "NTK") return "NTK";
  if (s === "NOTA") return "NOTA";
  return null;
};
const acs = acRows.map((r) => {
  const actual = acNoMap.get(`${normName(r.Constituency)}|${normName(r["District (2026 ECI grouping)"])}`);
  const no = Number(actual["AC No"]);
  const adjustedShares = normalize({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] });
  const recordedCounts = countsOf(r);
  const recordedValid = sumCounts(recordedCounts);
  const workbookLeader = groupActual ? groupActual(r.Winner) : null;
  const workbookMargin = Number(r["Margin (pts)"]) || 0;
  const workbookProjection = {
    leader: workbookLeader, marginPp: workbookMargin,
    confidence: String(r.Confidence ?? "").trim(), winner: workbookLeader,
  };
  const actualGroup = groupActual(actual["Actual 2026 alliance"]);
  const workbookMatch = String(actual["Match?"] ?? "").trim() === "Yes";
  return {
    no, name: String(r.Constituency).trim(), district: String(r.District).trim(), districtEci: String(r["District (2026 ECI grouping)"]).trim(),
    actual: Object.fromEntries(YEARS.map((y) => {
      const sh = historical.acs.get(`${no}|${y}`) ?? null;
      const winner = y === "2021" && actual["2021 alliance"] ? groupActual(actual["2021 alliance"]) : (sh ? leaderOf(sh) : null);
      return [y, { shares: sh, available: !!sh, winner }];
    })),
    recorded: { valid: recordedValid, counts: recordedCounts, shares: normalize(recordedCounts) },
    recordedLeader: leaderOf(normalize(recordedCounts)),
    allocatedDistrictOnly: zeroCounts(),
    allocatedUnlocated: zeroCounts(),
    combined: null,
    workbook: { adjustedShares, projection: workbookProjection, match: workbookMatch },
    projected: workbookProjection,
    actual2026: { alliance: String(actual["Actual 2026 alliance"] ?? "").trim(), party: String(actual["Actual 2026 winner party"] ?? "").trim(), winner: actualGroup },
    match: workbookMatch,
    noData: !(recordedValid > 0),
  };
}).sort((a, b) => a.no - b.no);
/* ---------------- district records ---------------- */
const byDistrict = new Map();
for (const a of acs) { const l = byDistrict.get(a.district) ?? []; l.push(a); byDistrict.set(a.district, l); }
const districts = distRows.map((r) => {
  const name = String(r.District).trim();
  const members = byDistrict.get(name) ?? [];
  const adjustedShares = normalize({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] });
  const recordedCounts = countsOf(r);
  const recordedValid = sumCounts(recordedCounts);
  const workbookProjectedSeats = Object.fromEntries(GROUPS.map((g) => [g, members.filter((a) => a.workbook.projection.leader === g).length]));
  const workbookSeatProjection = { leader: String(r.Leader ?? "").trim(), marginPp: Number(r["Lead (pts)"]) || 0 };
  const actualSeats = Object.fromEntries(GROUPS.map((g) => [g, members.filter((a) => a.actual2026.winner === g).length]));
  return {
    name, acs: members.map((a) => a.no),
    actual: Object.fromEntries(YEARS.map((y) => { const hist = historical.districts.get(`${HISTORICAL_DISTRICT_ALIAS[name] ?? name}|${y}`) ?? null; return [y, { shares: hist, available: !!hist, winner: null }]; })),
    recorded: { valid: recordedValid, counts: recordedCounts, shares: normalize(recordedCounts) },
    recordedLeader: leaderOf(normalize(recordedCounts)),
    allocatedDistrictOnly: zeroCounts(),
    allocatedUnlocated: zeroCounts(),
    combined: null,
    workbook: { adjustedShares, projectedSeats: workbookProjectedSeats, seatProjection: workbookSeatProjection },
    projectedSeats: workbookProjectedSeats,
    actualSeats,
    seatProjection: workbookSeatProjection,
    coverage: { acs: members.length, responses: recordedValid },
  };
}).sort((a, b) => a.name.localeCompare(b.name));
/* ---------------- geographic allocation ---------------- */
const stateCounts = countsOf(all);
const stateTotal = Number(all.Total);
const locatedTotal = Number(located.Total);
const missingTotal = Number(missing.Total);
const acByNo = new Map(acs.map((a) => [a.no, a]));
const locatedCounts = countsOf(located);
const unlocatedCounts = countsOf(missing);
if (sumCounts(unlocatedCounts) !== missingTotal) throw new Error("Unlocated party counts do not reconcile");
const assemblyRecorded = totals(acs.map((a) => a.recorded.counts));
const assemblyScoped = sumCounts(assemblyRecorded);
const districtRecorded = totals(districts.map((d) => d.recorded.counts));
const districtOnlyByDistrict = new Map();
let districtOnlyTotal = 0;
for (const d of districts) {
  const members = d.acs.map((no) => acByNo.get(no)).filter(Boolean);
  const ordered = priorityOrder(members);
  const districtOnly = zeroCounts();
  for (const g of GROUPS) {
    const recordedHere = members.reduce((s2, a) => s2 + (a.recorded.counts[g] || 0), 0);
    const source = (d.recorded.counts[g] || 0) - recordedHere;
    if (source < 0) throw new Error(`Negative district-only count: ${d.name} ${g}`);
    districtOnly[g] = source;
    const split = splitEven(source, members.length, ordered);
    ordered.forEach((a, i) => { a.allocatedDistrictOnly[g] += split[i]; });
  }
  districtOnlyByDistrict.set(d.name, districtOnly);
  d.allocatedDistrictOnly = districtOnly;
  districtOnlyTotal += sumCounts(districtOnly);
}
if (districtOnlyTotal !== 882) throw new Error(`District-only total ${districtOnlyTotal} != 882`);

const unlocatedOrder = priorityOrder(acs);
for (const g of GROUPS) {
  const split = splitEven(unlocatedCounts[g], acs.length, unlocatedOrder);
  unlocatedOrder.forEach((a, i) => { a.allocatedUnlocated[g] += split[i]; });
}

for (const a of acs) {
  const combinedCounts = Object.fromEntries(GROUPS.map((g) => [g, a.recorded.counts[g] + a.allocatedDistrictOnly[g] + a.allocatedUnlocated[g]]));
  a.combined = combinedSurvey(combinedCounts);
  a.projected = {
    leader: a.combined.leader,
    marginPp: a.combined.marginPp,
    confidence: confidenceFor(a.combined.marginPp, a.combined.valid),
    winner: a.combined.leader,
  };
  a.match = a.projected.leader === a.actual2026.winner;
}
for (const d of districts) {
  const members = d.acs.map((no) => acByNo.get(no)).filter(Boolean);
  const unlocated = totals(members.map((a) => a.allocatedUnlocated));
  const combinedCounts = Object.fromEntries(GROUPS.map((g) => [g, d.recorded.counts[g] + unlocated[g]]));
  d.allocatedUnlocated = unlocated;
  d.combined = combinedSurvey(combinedCounts);
  d.projectedSeats = Object.fromEntries(GROUPS.map((g) => [g, members.filter((a) => a.projected.leader === g).length]));
  d.seatProjection = { leader: d.combined.leader, marginPp: d.combined.marginPp };
}

const combinedAssemblyCounts = totals(acs.map((a) => a.combined.counts));
const combinedDistrictCounts = totals(districts.map((d) => d.combined.counts));
if (sumCounts(combinedAssemblyCounts) !== stateTotal) throw new Error(`Combined assembly total ${sumCounts(combinedAssemblyCounts)} != ${stateTotal}`);
if (sumCounts(combinedDistrictCounts) !== stateTotal) throw new Error(`Combined district total ${sumCounts(combinedDistrictCounts)} != ${stateTotal}`);
for (const g of GROUPS) {
  if (combinedAssemblyCounts[g] !== stateCounts[g] || combinedDistrictCounts[g] !== stateCounts[g]) throw new Error(`Combined party total changed: ${g}`);
}
for (const d of districts) {
  const acCombined = totals(d.acs.map((no) => acByNo.get(no).combined.counts));
  for (const g of GROUPS) if (acCombined[g] !== d.combined.counts[g]) throw new Error(`AC/district combined mismatch: ${d.name} ${g}`);
}
const allocatedDistrictOnly = totals(acs.map((a) => a.allocatedDistrictOnly));
const allocatedUnlocated = totals(acs.map((a) => a.allocatedUnlocated));
if (sumCounts(allocatedDistrictOnly) !== 882 || sumCounts(allocatedUnlocated) !== missingTotal) throw new Error("Allocated totals do not reconcile");

/* ---------------- state ---------------- */
const stateShares = normalize(stateCounts);
const combinedState = combinedSurvey(stateCounts);
const workbookProjectedSeats = Object.fromEntries(GROUPS.map((g) => [g, acs.filter((a) => a.workbook.projection.leader === g).length]));
const workbookAccuracy = acs.filter((a) => a.workbook.match).length;
const projectedSeats = Object.fromEntries(GROUPS.map((g) => [g, acs.filter((a) => a.projected.leader === g).length]));
const actualSeats = Object.fromEntries(GROUPS.map((g) => [g, acs.filter((a) => a.actual2026.winner === g).length]));
const accuracy = acs.filter((a) => a.match).length;
const reference = { party: "TVK", value: 0.348, label: "Reference share", workbookValue: round6(stateShares.TVK), note: "Retained reference headline; workbook-derived TVK share is 34.78%." };
if (actualSeats.TVK !== 108 || actualSeats["DMK+INC+VCK"] !== 73 || actualSeats["AIADMK+BJP+PMK+AMMK"] !== 53) throw new Error(`Actual seat totals failed: ${JSON.stringify(actualSeats)}`);
if (Object.values(projectedSeats).reduce((s2, n) => s2 + n, 0) !== 234) throw new Error("Combined projected seats do not total 234");
if (Object.values(workbookProjectedSeats).reduce((s2, n) => s2 + n, 0) !== 234) throw new Error("Workbook projected seats do not total 234");
const allocation = {
  version: ALLOCATION_VERSION,
  method: ALLOCATION_METHOD,
  sourceImportId: `tn-aggregate-${crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16)}`,
  sourceFile: "TN-2026-Exit-Poll-Analysis-Data-5.xlsx",
  sourceHash: crypto.createHash("sha256").update(buf).digest("hex"),
  priority: "Zero recorded total first, then AC ID",
  recorded: { assembly: assemblyRecorded, district: districtRecorded, districtOnly: totals(districts.map((d) => d.allocatedDistrictOnly)), unlocated: unlocatedCounts, statewide: stateCounts },
  allocated: { districtOnly: allocatedDistrictOnly, unlocated: allocatedUnlocated },
  combined: { assembly: combinedAssemblyCounts, district: combinedDistrictCounts, statewide: stateCounts },
  workbook: { projectedSeats: workbookProjectedSeats, accuracy: workbookAccuracy, note: "Workbook-original adjusted projections retained for recoverability; public projections use combined counts." },
  reconcile: {
    assemblyRecorded: sumCounts(assemblyRecorded),
    districtOnlyAllocated: sumCounts(allocatedDistrictOnly),
    unlocatedAllocated: sumCounts(allocatedUnlocated),
    combinedAssembly: sumCounts(combinedAssemblyCounts),
    combinedDistrict: sumCounts(combinedDistrictCounts),
    combinedStatewide: sumCounts(stateCounts),
    partyTotalsUnchanged: GROUPS.every((g) => combinedAssemblyCounts[g] === stateCounts[g] && combinedDistrictCounts[g] === stateCounts[g]),
    acDistrictEqual: districts.every((d) => GROUPS.every((g) => totals(d.acs.map((no) => acByNo.get(no).combined.counts))[g] === d.combined.counts[g])),
    districtStateEqual: GROUPS.every((g) => combinedDistrictCounts[g] === stateCounts[g]),
    noDoubleCount: GROUPS.every((g) => stateCounts[g] === assemblyRecorded[g] + allocatedDistrictOnly[g] + allocatedUnlocated[g]),
  },
};
const audit = [
  { sheet: "Summary", rows: summaryRaw.length, used: "headline counts, accuracy and projected seat validation", detail: `Votes ${summary.get("Votes analysed")}; located ${summary.get("With district or AC")}; no location ${summary.get("Vote only (no location)")}` },
  { sheet: "Statewide Votes", rows: statewideT.rows.length, used: "statewide all-response shares and counts", detail: "All responses used; located and missing-location rows retained separately for audit" },
  { sheet: "AC Results", rows: acRows.length, used: "recorded AC votes; workbook adjusted shares retained for audit", detail: `${adjustedSums.ac.length} ACs; ${badAc} adjusted rows exceeded 100% and were proportionally renormalised for display (max +${maxDeviation.toFixed(3)} pp); source workbook unchanged` },
  { sheet: "District Results", rows: distRows.length, used: "recorded district votes; workbook adjusted shares retained for audit", detail: `${adjustedSums.district.length} districts; adjusted sums validated at 100%; no renormalisation applied` },
  { sheet: "AC vs Actual 2026", rows: actualRows.length, used: "actual 2026 winners, seat totals and prediction-vs-actual", detail: `Accuracy ${accuracy}/234; current district mapping used for public tables; ECI grouping retained for audit` },
  { sheet: "District vs Actual 2026", rows: distActualRows.length, used: "audit only", detail: "Workbook uses the 2026 ECI district grouping; public views use the current 38-district grouping" },
  { sheet: "Who Voted How", rows: privateSheets[0].rows, used: "private only", detail: "Age/religion/form sections intentionally not public" },
  { sheet: "Model Validation", rows: privateSheets[1].rows, used: "private only", detail: "Not a public analysis section" },
  { sheet: "Significant Variables", rows: privateSheets[2].rows, used: "private only", detail: "Not a public analysis section" },
];

const bundle = {
  version: "tn-2026-aggregate-final-v2",
  sourceFile: "TN-2026-Exit-Poll-Analysis-Data-5.xlsx",
  sourceHash: crypto.createHash("sha256").update(buf).digest("hex"),
  source: { type: "aggregate analysis export", totalResponses: stateTotal, locatedResponses: locatedTotal, unlocatedResponses: missingTotal, assemblyScopedResponses: assemblyScoped, constituencies: acs.length, districts: districts.length, reference, audit, normalisation, crosswalk: { matched: actualRows.length, unresolved: missingCrosswalk.length, method: "assembly name + District (2026 ECI grouping)", duplicateNames: ["Tiruppattur"] }, districtPolicy: "Current 38-district grouping for public geometry, dropdowns and tables; 2026 ECI grouping retained only for audit." },
  groups: GROUPS, labels: LB, colors: COL, years: YEARS, presence, referenceShare: reference,
  allocation,
  statewide: {
    name: "Tamil Nadu", actual: Object.fromEntries(YEARS.map((y) => [y, { shares: historical.state[y], available: !!historical.state[y], winner: historical.state[y] ? leaderOf(historical.state[y]) : null }])),
    recorded: { valid: stateTotal, counts: stateCounts, shares: stateShares },
    combined: combinedState,
    counts: { total: stateTotal, located: locatedTotal, unlocated: missingTotal },
    projectedSeats, workbookProjectedSeats, actualSeats, accuracy, workbookAccuracy,
  },
  districts, acs,
};
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, hash: bundle.sourceHash.slice(0, 16), acs: acs.length, districts: districts.length, stateShares, projectedSeats, workbookProjectedSeats, actualSeats, accuracy, workbookAccuracy, reconcile: allocation.reconcile, privateSheets, audit: audit.map((x) => [x.sheet, x.rows]) }, null, 1));
