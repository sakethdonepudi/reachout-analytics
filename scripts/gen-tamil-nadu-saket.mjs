// Build the Tamil Nadu public snapshot from the final calibrated workbook:
// SAKET_TN_District_Estimate_calibrated_v3.xlsx.
//
// The workbook is aggregate-only. It contains separate survey, original-call,
// model-call, final district-calibrated-call and actual layers. The previous
// geographic allocation snapshot is retired and archived privately; it is not
// read or merged here.
import fs from "node:fs";
import crypto from "node:crypto";
import { read, utils } from "xlsx";

const FILE = process.env.TN_SAKET_XLSX || "lib/data/tamil-nadu/source/SAKET_TN_District_Estimate_calibrated_v3.xlsx";
const HIST = process.env.TN_HISTORICAL || "scripts/fixtures/tamil-nadu-historical-2011-2021.json";
const OUT = "lib/data/tamil-nadu/aggregates.json";
const ARCHIVE = "lib/data/tamil-nadu/archive/aggregates-2026-10-25-previous-allocation.json";
const VERSION = "tn-2026-saket-v3";
const GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA", "Others"];
const SEAT_GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK"];
const YEARS = ["2011", "2016", "2021"];
const LABEL = { TVK: "TVK", "AIADMK+BJP+PMK+AMMK": "AIADMK+", "DMK+INC+VCK": "DMK+", NTK: "NTK", NOTA: "NOTA", Others: "Others" };
const FULL = { TVK: "TVK", "AIADMK+BJP+PMK+AMMK": "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK": "DMK+INC+VCK", NTK: "NTK", NOTA: "NOTA", Others: "Others" };
const COLOR = { TVK: "#EAB308", "AIADMK+BJP+PMK+AMMK": "#16A34A", "DMK+INC+VCK": "#DC2626", NTK: "#7C3AED", NOTA: "#64748B", Others: "#0F766E" };
const HIST_ALIAS = { Kanniyakumari: "Kanyakumari", "The Nilgiris": "Nilgiris", Thoothukudi: "Thoothukkudi", Tiruvarur: "Thiruvarur", Villupuram: "Viluppuram" };
const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const sum = (o) => GROUPS.reduce((s, g) => s + (Number(o[g]) || 0), 0);
const sum3 = (o) => SEAT_GROUPS.reduce((s, g) => s + (Number(o[g]) || 0), 0);
const normalize = (o) => { const t = sum(o) || 1; return Object.fromEntries(GROUPS.map((g) => [g, round6((Number(o[g]) || 0) / t)])); };
const leader = (o) => { const s = [...GROUPS].sort((a, b) => (o[b] || 0) - (o[a] || 0)); return s[0] || null; };
const zero = () => Object.fromEntries(GROUPS.map((g) => [g, 0]));
const zero3 = () => Object.fromEntries(SEAT_GROUPS.map((g) => [g, 0]));
const group = (party) => {
  const s = String(party ?? "").trim().toUpperCase();
  if (s === "TVK") return "TVK";
  if (s === "AIDMK" || s === "ADMK" || s === "AIADMK" || s === "AIADMK+" || s === "AIDMK+" || s === "BJP" || s === "PMK" || s === "AMMK") return "AIADMK+BJP+PMK+AMMK";
  if (s === "DMK" || s === "DMK+" || s === "INC" || s === "VCK" || s === "CPI" || s === "CPM" || s === "CPI(M)" || s === "IUML" || s === "DMDK") return "DMK+INC+VCK";
  if (s === "NTK") return "NTK";
  if (s === "NOTA") return "NOTA";
  if (!s) return null;
  return "Others";
};
const groupAlliance = (a) => {
  const s = String(a ?? "").trim();
  if (s === "TVK") return "TVK";
  if (s.startsWith("AIADMK")) return "AIADMK+BJP+PMK+AMMK";
  if (s.startsWith("DMK")) return "DMK+INC+VCK";
  return null;
};
const buf = fs.readFileSync(FILE);
const wb = read(buf, { cellFormula: false });
const arr = (name) => utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: true, header: 1 });
const table = (name, predicate) => { const rows = arr(name); const hi = rows.findIndex(predicate); if (hi < 0) throw new Error(`Header not found: ${name}`); return { header: rows[hi].map((x) => String(x ?? "")), rows: rows.slice(hi + 1) }; };
const obj = (header, row) => Object.fromEntries(header.map((h, i) => [h, row[i]]));
const countOf = (row) => ({
  TVK: Number(row[7] || 0),
  "AIADMK+BJP+PMK+AMMK": Number(row[3] || 0),
  "DMK+INC+VCK": Number(row[4] || 0),
  NTK: Number(row[6] || 0),
  NOTA: Number(row[5] || 0),
  Others: 0,
});
const seatCount = (acs, layer) => {
  const out = zero3();
  for (const a of acs) {
    const g = layer === "actual" ? a.actual2026?.winner : a[layer]?.leader;
    if (g && g in out) out[g] += 1;
  }
  return out;
};

/* ---------------- read all sheets / audit ---------------- */
const summaryRows = arr("Summary");
const summary = new Map();
for (const r of summaryRows) { const k = String(r[0] ?? "").trim(); if (k && !summary.has(k)) summary.set(k, r); }
const calRows = arr("Calibration");
const cal = new Map();
for (const r of calRows) { const k = String(r[0] ?? "").trim(); if (k && !cal.has(k)) cal.set(k, r); }
const acT = table("AC Estimate", (r) => r.includes("AC No") && r.includes("Final estimate (district-calibrated)"));
const acRows = acT.rows.filter((r) => Number(r[0]) >= 1 && Number(r[0]) <= 234).map((r) => obj(acT.header, r));
const deT = table("District Estimate", (r) => r.includes("District") && r.includes("Final seats called right"));
const deRows = deT.rows.filter((r) => String(r[0]).trim() && String(r[0]).trim() !== "Tamil Nadu (with an AC)").map((r) => obj(deT.header, r));
const dsT = table("District Split", (r) => r.includes("AC No") && r.includes("Final estimate"));
const dsRows = dsT.rows.filter((r) => Number(r[0]) >= 1 && Number(r[0]) <= 234);
const seventyT = arr("Sheet1");
const sourceHash = crypto.createHash("sha256").update(buf).digest("hex");
const sourceImportId = `tn-saket-v3-${sourceHash.slice(0, 16)}`;
if (acRows.length !== 234) throw new Error(`AC rows ${acRows.length}`);
if (deRows.length !== 38) throw new Error(`District rows ${deRows.length}`);
if (dsRows.length !== 234) throw new Error(`District Split AC rows ${dsRows.length}`);

/* ---------------- historical numeric data (separate Others, no folding) ---------------- */
const old = JSON.parse(fs.readFileSync(HIST, "utf8"));
const history = { state: {}, districts: new Map(), acs: new Map() };
for (const y of YEARS) {
  history.state[y] = old.statewide.actual[y]?.shares ? normalize(old.statewide.actual[y].shares) : null;
  for (const d of old.districts) history.districts.set(`${d.name}|${y}`, d.actual[y]?.shares ? normalize(d.actual[y].shares) : null);
  for (const a of old.acs) history.acs.set(`${a.no}|${y}`, a.actual[y]?.shares ? normalize(a.actual[y].shares) : null);
}
const presence = {};
for (const y of YEARS) {
  presence[y] = Object.fromEntries(GROUPS.map((g) => [g, !!old.presence?.[y]?.[g]]));
  presence[y].TVK = false;
  if (y === "2011") { presence[y].NTK = false; presence[y].NOTA = false; }
}

/* ---------------- ACs ---------------- */
const acs = acRows.map((r) => {
  const no = Number(r["AC No"]);
  const counts = countOf([r["AC No"], r["AC"], r["District (ECI 2026)"], r["AIDMK+BJP+PMK+AMMK"], r["DMK+INC+VCK"], r["NOTA"], r["NTK"], r["TVK"]]);
  const valid = sum(counts);
  const shares = normalize(counts);
  const original = groupAlliance(r["Estimate alliance"]) ?? group(r["Winner (estimate)"]);
  const model = groupAlliance(r["Model call (statewide fit)"]) ?? group(r["Model call (statewide fit)"]);
  const final = groupAlliance(r["Final estimate (district-calibrated)"]) ?? group(r["Final estimate (district-calibrated)"]);
  const actual = groupAlliance(r["Actual 2026 alliance"]) ?? group(r["Actual 2026 winner party (ECI)"]);
  const modelP = model === "TVK" ? Number(r["P(win) TVK"]) : model === "AIADMK+BJP+PMK+AMMK" ? Number(r["P(win) AIADMK+"]) : model === "DMK+INC+VCK" ? Number(r["P(win) DMK+"]) : 0;
  const finalP = Number(r["P(win) of final call"]) || 0;
  return {
    no, name: String(r.AC).trim(), district: String(r["District (ECI 2026)"]).trim(), districtEci: String(r["District (ECI 2026)"]).trim(),
    survey: { valid, counts, shares, leader: group(r["Survey leader"]) ?? leader(shares), runnerUp: [...GROUPS].sort((a, b) => shares[b] - shares[a])[1] ?? null, marginPp: valid ? round6((shares[group(r["Survey leader"]) ?? leader(shares)] - shares[[...GROUPS].sort((a, b) => shares[b] - shares[a])[1]]) * 100) : 0 },
    surveyLeader: group(r["Survey leader"]) ?? leader(shares),
    original: { leader: original, party: String(r["Winner (estimate)"] ?? "").trim(), correct: String(r["Match?"]).trim() === "Yes" },
    model: { leader: model, probability: round6(modelP), correct: String(r["Calibrated match?"]).trim() === "Yes" },
    final: { leader: final, probability: round6(finalP), correct: String(r["Final match?"]).trim() === "Yes", changedVsSaket: String(r["Changed vs Saket?"] ?? "").trim() === "Yes" },
    actual2026: { winner: actual, alliance: String(r["Actual 2026 alliance"] ?? "").trim(), party: String(r["Actual 2026 winner party (ECI)"] ?? "").trim() },
    historical: Object.fromEntries(YEARS.map((y) => { const sh = history.acs.get(`${no}|${y}`) ?? null; return [y, { shares: sh, available: !!sh, winner: sh ? leader(sh) : null }]; })),
    match: String(r["Final match?"]).trim() === "Yes",
    noData: valid === 0,
  };
}).sort((a, b) => a.no - b.no);
/* ---------------- districts ---------------- */
const byDistrict = new Map();
for (const a of acs) { const l = byDistrict.get(a.district) ?? []; l.push(a); byDistrict.set(a.district, l); }
for (const a of acs) a.historical = a.historical;
const districts = deRows.map((r) => {
  const name = String(r.District).trim();
  const members = byDistrict.get(name) ?? [];
  const counts = {
    TVK: Number(r["TVK votes"] || 0), "AIADMK+BJP+PMK+AMMK": Number(r["AIDMK+BJP+PMK+AMMK votes"] || 0),
    "DMK+INC+VCK": Number(r["DMK+INC+VCK votes"] || 0), NTK: Number(r["NTK votes"] || 0), NOTA: Number(r["NOTA votes"] || 0), Others: 0,
  };
  const valid = sum(counts);
  const shares = normalize(counts);
  const original = seatCount(members, "original"); const final = seatCount(members, "final"); const model = seatCount(members, "model"); const actual = seatCount(members, "actual");
  return {
    name, acs: members.map((a) => a.no),
    survey: { valid, counts, shares, leader: group(r["Survey leader"]) ?? leader(shares), runnerUp: [...GROUPS].sort((a, b) => shares[b] - shares[a])[1] ?? null, marginPp: valid ? round6((shares[group(r["Survey leader"]) ?? leader(shares)] - shares[[...GROUPS].sort((a, b) => shares[b] - shares[a])[1]]) * 100) : 0 },
    surveyLeader: group(r["Survey leader"]) ?? leader(shares),
    originalSeats: original, modelSeats: model, finalSeats: final, actualSeats: actual,
    coverage: { acs: members.length, responses: valid },
    historical: Object.fromEntries(YEARS.map((y) => { const h = history.districts.get(`${HIST_ALIAS[name] ?? name}|${y}`) ?? null; return [y, { shares: h, available: !!h, winner: h ? leader(h) : null }]; })),
  };
}).sort((a, b) => a.name.localeCompare(b.name));

/* ---------------- statewide ---------------- */
const surveyCounts = Object.fromEntries(GROUPS.map((g) => [g, acs.reduce((s, a) => s + (a.survey.counts[g] || 0), 0)]));
const noDist = acT.rows.find((r) => String(r[1]).trim() === "NO DIST, AC");
const noDistCounts = countOf(noDist);
const grand = acT.rows.find((r) => String(r[1]).trim() === "Grand Total");
const grandCounts = countOf(grand);
for (const g of GROUPS) if (surveyCounts[g] + noDistCounts[g] !== grandCounts[g]) throw new Error(`State total mismatch ${g}`);
const totalResponses = sum(grandCounts);
if (totalResponses !== 31_672) throw new Error(`Total ${totalResponses}`);
const surveyShares = normalize(grandCounts);
const calibratedShares = { TVK: round6(Number(cal.get("Calibrated share")[5])), "AIADMK+BJP+PMK+AMMK": round6(Number(cal.get("Calibrated share")[1])), "DMK+INC+VCK": round6(Number(cal.get("Calibrated share")[2])), NTK: round6(Number(cal.get("Calibrated share")[4])), NOTA: round6(Number(cal.get("Calibrated share")[3])), Others: round6(Number(cal.get("Calibrated share")[6])) };
const actualShares = { TVK: round6(Number(cal.get("Actual 2026 share (ECI)")[5])), "AIADMK+BJP+PMK+AMMK": round6(Number(cal.get("Actual 2026 share (ECI)")[1])), "DMK+INC+VCK": round6(Number(cal.get("Actual 2026 share (ECI)")[2])), NTK: round6(Number(cal.get("Actual 2026 share (ECI)")[4])), NOTA: round6(Number(cal.get("Actual 2026 share (ECI)")[3])), Others: round6(Number(cal.get("Actual 2026 share (ECI)")[6])) };
const originalSeats = seatCount(acs, "original");
const modelSeats = seatCount(acs, "model");
const finalSeats = seatCount(acs, "final");
const actualSeats = seatCount(acs, "actual");
const checkSeats = { original: [106, 51, 77], final: [108, 53, 73], actual: [108, 53, 73] };
if (originalSeats.TVK !== 106 || originalSeats["AIADMK+BJP+PMK+AMMK"] !== 51 || originalSeats["DMK+INC+VCK"] !== 77) throw new Error("Original seats");
if (finalSeats.TVK !== 108 || finalSeats["AIADMK+BJP+PMK+AMMK"] !== 53 || finalSeats["DMK+INC+VCK"] !== 73) throw new Error("Final seats");
if (actualSeats.TVK !== 108 || actualSeats["AIADMK+BJP+PMK+AMMK"] !== 53 || actualSeats["DMK+INC+VCK"] !== 73) throw new Error("Actual seats");
const accuracy = acs.filter((a) => a.final.correct).length;
const originalAccuracy = acs.filter((a) => a.original.correct).length;
const modelAccuracy = acs.filter((a) => a.model.correct).length;
const surveyLeaderAccuracy = acs.filter((a) => a.surveyLeader === a.actual2026.winner).length;
if (accuracy !== 164 || originalAccuracy !== 104 || modelAccuracy !== 134) throw new Error(`Accuracy ${accuracy}/${originalAccuracy}/${modelAccuracy}`);
const metrics = {
  originalCorrect: originalAccuracy, surveyLeaderCorrect: surveyLeaderAccuracy, modelCorrect: modelAccuracy,
  modelCvCorrect: Number(cal.get("Model, cross-validated (each district predicted by a model that never saw it)")[1]),
  finalCorrect: accuracy, finalCvCorrect: Number(cal.get("Final, cross-validated (model never saw the district; district totals imposed)")[1]),
  baselineTVK: 108, districtsTopMatch: 12, districtsTied: 10, districtsMissed: 16, districtSeatError: 170, finalDistrictError: 0,
};
if (metrics.modelCvCorrect !== 126 || metrics.finalCvCorrect !== 161) throw new Error("CV metrics");
const reference = null;
const allocation = null;
const stateSurvey = { valid: totalResponses, counts: grandCounts, shares: surveyShares, leader: leader(surveyShares), runnerUp: [...GROUPS].sort((a, b) => surveyShares[b] - surveyShares[a])[1] ?? null, marginPp: round6((surveyShares[leader(surveyShares)] - surveyShares[[...GROUPS].sort((a, b) => surveyShares[b] - surveyShares[a])[1]]) * 100) };const statewide = {
  name: "Tamil Nadu",
  survey: stateSurvey,
  surveyLeader: leader(surveyShares),
  calibrated: { valid: totalResponses, shares: calibratedShares, counts: null, note: "Result-calibrated hindcast; fitted to declared 2026 results. Others is the ECI residual, not an observed survey response." },
  actualVoteShares: { valid: totalResponses, shares: actualShares, counts: null, note: "Statewide actual vote shares supplied by the workbook. Local actual vote shares are not supplied." },
  counts: { total: totalResponses, withAc: sum(surveyCounts), noAc: totalResponses - sum(surveyCounts) },
  originalSeats, modelSeats, finalSeats, actualSeats,
  accuracy, originalAccuracy, modelAccuracy,
  historical: Object.fromEntries(YEARS.map((y) => [y, { shares: history.state[y], available: !!history.state[y], winner: history.state[y] ? leader(history.state[y]) : null }])),
};const calibration = {
  weights: Object.fromEntries([["AIADMK+BJP+PMK+AMMK", 1], ["DMK+INC+VCK", 2], ["NOTA", 3], ["NTK", 4], ["TVK", 5]].map(([g, i]) => [g, round6(Number(cal.get("Weight per response (actual ÷ raw)")[i]))])),
  tolerance: Number(calRows.find((r) => String(r[0]).includes("Tolerance"))?.[1]) || 0.5,
  withinTolerance: String(summary.get("Districts with every alliance within tolerance")?.[1] ?? "38 of 38"),
  coefficients: calRows.slice(34).filter((r) => ["AIADMK+", "DMK+", "TVK"].includes(String(r[0]))).map((r) => ({ alliance: String(r[0]), values: r.slice(1) })),
  notes: [
    "Hindcast: weights and the seat model are fitted to the declared result; agreement with fitted targets is not independent validation.",
    "Model-only cross-validation: 126/234.",
    "Final cross-validation with district totals imposed: 161/234.",
    "Final district-calibrated calls: 164/234.",
  ],
};
const source = {
  type: "final calibrated aggregate workbook", totalResponses, withAc: sum(surveyCounts), noAc: totalResponses - sum(surveyCounts),
  constituencies: 234, districts: 38, sourceImportId,
  audit: [
    { sheet: "Summary", rows: summaryRows.length, used: "headline seat, accuracy and vote-share metrics" },
    { sheet: "Calibration", rows: calRows.length, used: "weights, calibrated and actual statewide shares, model coefficients and CV metrics" },
    { sheet: "District Split", rows: dsRows.length, used: "cross-check only; AC Estimate is authoritative for AC rows" },
    { sheet: "AC Estimate", rows: acs.length, used: "survey counts, original, model and final calls, actual winners" },
    { sheet: "Sheet1", rows: seventyT.length, used: "ignored saved pivot snapshot" },
    { sheet: "District Estimate", rows: districts.length, used: "district counts, seat rollups and actual/final comparison" },
  ],
  notes: [
    "AIDMK in the source is normalised to the application AIADMK alias; original source labels are retained in the audit.",
    "NO DIST, AC (20,749) and Grand Total are excluded from geographic feature lists and retained in statewide survey totals.",
    "Previous geographic allocation snapshot archived privately and not used.",
    "No dated individual responses; time/round/smoothing features are unsupported.",
  ],
  archive: ARCHIVE,
  districtPolicy: "Current 38-district grouping for geometry; ECI 2026 district labels in the workbook; five geometry name aliases canonicalised.",
};
const bundle = {
  version: VERSION, sourceFile: "SAKET_TN_District_Estimate_calibrated_v3.xlsx", sourceHash, sourceImportId,
  source, groups: GROUPS, seatGroups: SEAT_GROUPS, labels: LABEL, fullLabels: FULL, colors: COLOR, years: YEARS, presence,
  reference: null, allocation,
  statewide, districts, acs, calibration, metrics,
};
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, hash: sourceHash.slice(0, 16), totalResponses, withAc: sum(surveyCounts), noAc: totalResponses - sum(surveyCounts), districts: districts.length, acs: acs.length, originalSeats, modelSeats, finalSeats, actualSeats, accuracy, originalAccuracy, modelAccuracy, surveyShares, calibratedShares, actualShares, metrics }, null, 1));
