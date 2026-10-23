// Build the final Telangana compact snapshot from saketh_TG.xlsx.
//
// Every sheet is read and audited. The projection sheet headers are on row 1
// and the English AC-name column is A/c. The stale Sheet3 pivot and the stale
// Summary totals are never used as authoritative totals.
//
// The final workbook's AC model is four-group. The compact display adds AIMIM
// by a documented extension: 2023 ECI AIMIM actual + the AIMIM survey swing
// (2028 intention - recalled 2023), with the AC swing shrunk to the district
// swing using the workbook's own Weight w. The AIMIM amount is subtracted from
// the same AC's Others residual; it is never an arbitrary split and never
// derived from the raw AIMIM survey share as if it were a prediction.
import fs from "node:fs";
import crypto from "node:crypto";
import { read, utils } from "xlsx";

const FILE = process.env.TG_FINAL_XLSX || ".context/attachments/flkjTm/saketh_TG.xlsx";
const OUT = "lib/data/telangana/oct26.json";
const P5 = ["BRS", "Congress", "BJP", "AIMIM", "Others"];
const P4 = ["BRS", "Congress", "BJP", "Others"];
const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const sum4 = (o) => P4.reduce((s, p) => s + (Number(o[p]) || 0), 0);
const sum5 = (o) => P5.reduce((s, p) => s + (Number(o[p]) || 0), 0);
const norm4 = (o) => { const s = sum4(o) || 1; return Object.fromEntries(P4.map((p) => [p, round6((Number(o[p]) || 0) / s)])); };
const norm5 = (o) => { const s = sum5(o) || 1; return Object.fromEntries(P5.map((p) => [p, round6((Number(o[p]) || 0) / s)])); };
const leaderOf = (o, parties = P5) => {
  const sorted = [...parties].sort((a, b) => (o[b] || 0) - (o[a] || 0));
  const top = o[sorted[0]] || 0;
  const tied = sorted.filter((p) => Math.abs((o[p] || 0) - top) < 1e-9);
  if (tied.length > 1) return { leader: "Tie", tied, marginPp: 0 };
  const second = sorted.find((p) => !tied.includes(p));
  return { leader: sorted[0], tied: [], marginPp: second ? (top - (o[second] || 0)) * 100 : 0 };
};
const wshare = (rows, key, parties = P5) => {
  let total = 0; const out = Object.fromEntries(parties.map((p) => [p, 0]));
  for (const r of rows) { const v = Number(r.votes2023) || 0; total += v; for (const p of parties) out[p] += (r[key][p] || 0) * v; }
  if (!total) return Object.fromEntries(parties.map((p) => [p, 0]));
  return Object.fromEntries(parties.map((p) => [p, round6(out[p] / total)]));
};
const serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86_400_000);
const dateOnly = (d) => d.toISOString().slice(0, 10);
const readSheet = (wb, name, opts = {}) => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  return utils.sheet_to_json(ws, { defval: "", raw: true, ...opts });
};

const buf = fs.readFileSync(FILE);
const wb = read(buf, { cellFormula: false });

/* ---------------- sheet audit ---------------- */
const summaryRows = readSheet(wb, "Summary", { header: 1 });
const summaryC4 = wb.Sheets.Summary?.C4?.v;
const summaryC5 = wb.Sheets.Summary?.C5?.v;
const cutoffSerial = Number(summaryC4);
const modelCutoff = Number.isFinite(cutoffSerial) ? dateOnly(serialToDate(cutoffSerial)) : "2026-10-01";
const shrink = Number(summaryC5) || 30;
const acSwingRows = readSheet(wb, "AC-wise Swing", { range: 3 });
const distSwingRows = readSheet(wb, "District-wise Swing", { range: 3 });
const sheet3 = readSheet(wb, "Sheet3", { range: 0 });
const distProjRows = readSheet(wb, "2028 Projection (District)", { range: 1 });
const eciRows = readSheet(wb, "2023 ECI Result", { range: 3 });
const projRows = readSheet(wb, "Saketh 2028 Projection (AC)", { range: 0 });
const dataRows = readSheet(wb, "Data", { range: 0 });

const proj = projRows.filter((r) => { const n = Number(r["AC No"]); return Number.isInteger(n) && n >= 1 && n <= 119 && String(r["A/c"] ?? "").trim(); });
if (proj.length !== 119) throw new Error(`Expected 119 AC projections, found ${proj.length}`);
if (new Set(proj.map((r) => Number(r["AC No"]))).size !== 119) throw new Error("Duplicate AC No in projection");
const districts = new Set(proj.map((r) => String(r.District ?? "").trim()).filter(Boolean));
if (districts.size !== 33) throw new Error(`Expected 33 district groups, found ${districts.size}`);

/* ---------------- final ECI actual AIMIM and Data counts ---------------- */
const eci = new Map();
for (const r of eciRows) {
  const no = Number(r["AC No"]);
  if (!Number.isInteger(no) || no < 1 || no > 119) continue;
  const total = Number(r["Total votes"]) || 0;
  eci.set(no, { aimim: Number(r.AIMIM) || 0, total });
}
const allAcCounts = new Map();
const cutoffAcCounts = new Map();
const cutoffDistrictCounts = new Map();
const addCount = (map, key, r) => {
  const x = map.get(key) ?? { a28: 0, a23: 0, k28: 0, k23: 0 };
  const p28 = String(r["2028 Vote"] ?? "").trim();
  const p23 = String(r["2023 Vote"] ?? "").trim();
  if (p28) { x.a28++; if (p28 === "AIMIM") x.k28++; }
  if (p23) { x.a23++; if (p23 === "AIMIM") x.k23++; }
  map.set(key, x);
};
for (const r of dataRows) {
  const no = Number(r["AC No"]);
  if (!no) continue;
  const total = allAcCounts.get(no) ?? { rows: 0, a28: 0, a23: 0 };
  total.rows++;
  if (String(r["2028 Vote"] ?? "").trim()) total.a28++;
  if (String(r["2023 Vote"] ?? "").trim()) total.a23++;
  allAcCounts.set(no, total);
  if (Number(r["Entry Date"]) >= cutoffSerial) {
    addCount(cutoffAcCounts, no, r);
    const d = String(r.District ?? "").trim();
    if (d) addCount(cutoffDistrictCounts, d, r);
  }
}
const answered2028 = dataRows.filter((r) => String(r["2028 Vote"] ?? "").trim()).length;
const answered2023 = dataRows.filter((r) => String(r["2023 Vote"] ?? "").trim()).length;
const stateCounts = [...cutoffAcCounts.values()].reduce((s, x) => ({ a28: s.a28 + x.a28, a23: s.a23 + x.a23 }), { a28: 0, a23: 0 });
const stateSwing = stateCounts.a28 && stateCounts.a23 ? (stateCounts.k28 / stateCounts.a28 - stateCounts.k23 / stateCounts.a23) * 100 : 0;

/* ---------------- AC rows ---------------- */
const caps = [];
const acs = proj.map((r) => {
  const no = Number(r["AC No"]);
  const actual4 = norm4({ BRS: r["BRS 2023 actual %"], Congress: r["Congress 2023 actual %"], BJP: r["BJP 2023 actual %"], Others: r["Others 2023 actual %"] });
  const prediction4 = norm4({ BRS: r["BRS 2028 est. %"], Congress: r["Congress 2028 est. %"], BJP: r["BJP 2028 est. %"], Others: r["Others 2028 est. %"] });
  const e = eci.get(no) ?? { aimim: 0, total: 0 };
  const actualAimim = e.total ? e.aimim / e.total : 0;
  const aimimActual = Math.min(actualAimim, actual4.Others);
  const actual = { BRS: actual4.BRS, Congress: actual4.Congress, BJP: actual4.BJP, AIMIM: round6(aimimActual), Others: round6(actual4.Others - aimimActual) };
  // Data cutoff counts, mirroring the workbook's Weight w and district prior.
  const c = cutoffAcCounts.get(no) ?? { a28: 0, a23: 0, k28: 0, k23: 0 };
  const d = String(r.District ?? "").trim();
  const dc = cutoffDistrictCounts.get(d) ?? { a28: 0, a23: 0, k28: 0, k23: 0 };
  const acSwing = c.a28 && c.a23 ? (c.k28 / c.a28 - c.k23 / c.a23) * 100 : 0;
  const districtSwing = dc.a28 && dc.a23 ? (dc.k28 / dc.a28 - dc.k23 / dc.a23) * 100 : stateSwing;
  const weight = Number(r["Weight w (AC)"]) || 0;
  const usedSwing = weight * acSwing + (1 - weight) * districtSwing;
  const estimate = Math.max(0, actualAimim + usedSwing / 100);
  const aimimPred = Math.min(estimate, prediction4.Others);
  if (estimate > prediction4.Others + 1e-12) caps.push({ acNo: no, name: String(r["A/c"] ?? ""), estimate, others: prediction4.Others });
  const prediction = { BRS: prediction4.BRS, Congress: prediction4.Congress, BJP: prediction4.BJP, AIMIM: round6(aimimPred), Others: round6(prediction4.Others - aimimPred) };
  const lead = leaderOf(prediction);
  const total = allAcCounts.get(no) ?? { rows: 0, a28: 0, a23: 0 };
  return {
    no, name: String(r["A/c"] ?? "").trim(), district: d, zone: String(r.Zone ?? "").trim(),
    votes2023: Number(r["2023 Total votes"]) || 0,
    actual: norm5(actual), prediction: norm5(prediction),
    answered2028: total.a28, answeredRecall2023: total.a23, totalRows: total.rows,
    leader: lead.leader, tied: lead.tied, marginPp: round6(lead.marginPp),
    sourceLeader: String(r["Projected 2028 leader"] ?? "").trim() || null,
    override: null,
    aimimEstimate: round6(estimate), aimimUsedSwingPp: round6(usedSwing),
  };
}).sort((a, b) => a.no - b.no);
if (new Set(acs.map((a) => a.no)).size !== 119) throw new Error("AC name resolution failed");

/* ---------------- district/state rollups ---------------- */
const byDistrict = new Map();
for (const a of acs) { const l = byDistrict.get(a.district) ?? []; l.push(a); byDistrict.set(a.district, l); }
const districtRows = [...byDistrict.entries()].map(([name, list]) => {
  const actual = wshare(list, "actual"); const prediction = wshare(list, "prediction"); const lead = leaderOf(prediction);
  return {
    name, acs: list.map((a) => a.no), votes2023: list.reduce((s, a) => s + a.votes2023, 0),
    actual, prediction, answered2028: list.reduce((s, a) => s + a.answered2028, 0),
    leader: lead.leader, tied: lead.tied, marginPp: round6(lead.marginPp),
  };
}).sort((a, b) => a.name.localeCompare(b.name));
const actual = wshare(acs, "actual"); const prediction = wshare(acs, "prediction"); const lead = leaderOf(prediction);
const leads = {};
for (const a of acs) { const l = leaderOf(a.prediction); const k = l.tied.length > 1 ? "Tie" : l.leader; leads[k] = (leads[k] ?? 0) + 1; }
const changePp = Object.fromEntries(P5.map((p) => [p, round6((prediction[p] - actual[p]) * 100)]));

/* ---------------- audit every sheet ---------------- */
const audit = [
  { sheet: "Summary", rows: summaryRows.length, used: "cutoff and shrink controls", detail: `cutoff ${modelCutoff}; k=${shrink}; pivot/summary totals not authoritative` },
  { sheet: "AC-wise Swing", rows: acSwingRows.length, used: "audit only", detail: "raw four-group survey; Others includes AIMIM/TDP/Janasena" },
  { sheet: "District-wise Swing", rows: distSwingRows.length, used: "audit only", detail: "raw four-group survey; district prior is recomputed from Data" },
  { sheet: "Sheet3", rows: sheet3.length, used: "ignored", detail: "stale pivot counts 66/32; final AC numeric predictions are 68/30" },
  { sheet: "Saketh 2028 Projection (AC)", rows: proj.length, used: "compact four-group prediction and Weight w", detail: "headers row 1; English name A/c; 119 ACs / 33 districts" },
  { sheet: "2028 Projection (District)", rows: distProjRows.length, used: "audit only", detail: "district summaries recomputed by 2023-vote weighting" },
  { sheet: "Data", rows: dataRows.length, used: "rounds, counts and cutoff AIMIM/recall answers", detail: "5,090 entries; raw labels unchanged" },
  { sheet: "2023 ECI Result", rows: eciRows.length, used: "AIMIM actual and historical totals", detail: "AIMIM and Janasena are separate historical columns" },
];

const bundle = {
  version: "tg-final-aimim-2026-10-23-v1",
  sourceFile: "saketh_TG.xlsx",
  sourceHash: crypto.createHash("sha256").update(buf).digest("hex"),
  cutoff: "2026-07-16",
  modelCutoff,
  shrinkFactor: shrink,
  parties: P5,
  labels: { Congress: "Congress+", AIMIM: "AIMIM" },
  congressBasis: "INC+CPI alliance, not INC alone",
  othersBasis: "BSP+Janasena+NOTA+IND+all remaining; AIMIM extracted separately; raw survey Others=TDP+Janasena+AIMIM",
  devicesAvailable: false, pinDataAvailable: false,
  counts: {
    sourceIds: new Set(dataRows.map((r) => String(r["Entry ID"] ?? "").trim()).filter(Boolean)).size,
    cutoffRows: dataRows.length, answered2028, blank2028: dataRows.length - answered2028,
    answeredRecall2023: answered2023, blankRecall2023: dataRows.length - answered2023,
    acs: acs.length, districts: districtRows.length,
  },
  aimimExtension: {
    version: "tg-final-aimim-v1",
    method: "2023 ECI AIMIM actual + (AIMIM 2028 intention − recalled AIMIM 2023); AC swing shrunk to district swing with the final workbook's Weight w. Extracted from the four-group Others residual; capped at that residual. No division or relabeling.",
    baseline: "2023 ECI AIMIM votes / 2023 Total votes",
    cutoff: modelCutoff, shrinkFactor: shrink,
    cappedCount: caps.length, cappedAcs: caps.map((x) => x.acNo),
    source: "saketh_TG.xlsx: Data, 2023 ECI Result, Saketh 2028 Projection (AC), Summary",
    note: "AIMIM is not the entire Others group and is not a raw survey share. All five displayed shares sum to 100% before rounding.",
  },
  sheetAudit: audit,
  statewide: {
    name: "Telangana", acs: acs.length, votes2023: acs.reduce((s, a) => s + a.votes2023, 0),
    actual, prediction, answered2028, changePp, leads, leader: lead.leader, tied: lead.tied, marginPp: round6(lead.marginPp),
  },
  districts: districtRows, acs, overrides: [],
  overrideMeta: { predictionOnly: false, congressLeadAssertions: [], historicalKodangalWinner: "Congress", note: "The final workbook contains no prediction override; numeric AC predictions are authoritative." },
  overrideVersion: "final-no-overrides",
};
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({
  out: OUT, bytes: fs.statSync(OUT).size, hash: bundle.sourceHash.slice(0, 16), acs: acs.length, districts: districtRows.length,
  counts: bundle.counts, modelCutoff, leaders: leads, stateActual: actual, statePrediction: prediction, caps: caps.length,
  aimimAcs: acs.filter((a) => a.prediction.AIMIM > 0).length, maxAimim: Math.max(...acs.map((a) => a.prediction.AIMIM)),
  sheets: audit.map((x) => [x.sheet, x.rows, x.used]),
}, null, 1));
