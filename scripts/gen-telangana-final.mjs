// Build the final compact four-group Telangana snapshot from saketh_TG.xlsx.
// The projection sheet headers are on row 1 and the English AC name column is A/c.
// Trailing blank/formatted rows are ignored; Summary/pivot values are never used.
import fs from "node:fs";
import crypto from "node:crypto";
import { read, utils } from "xlsx";

const FILE = process.env.TG_FINAL_XLSX || ".context/attachments/flkjTm/saketh_TG.xlsx";
const OUT = "lib/data/telangana/oct26.json";
const PARTIES = ["BRS", "Congress", "BJP", "Others"];
const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const sum = (o) => PARTIES.reduce((s, p) => s + (Number(o[p]) || 0), 0);
const norm = (o) => { const s = sum(o) || 1; return Object.fromEntries(PARTIES.map((p) => [p, round6((Number(o[p]) || 0) / s)])); };
const leaderOf = (o) => {
  const sorted = [...PARTIES].sort((a, b) => (o[b] || 0) - (o[a] || 0));
  const top = o[sorted[0]] || 0;
  const tied = sorted.filter((p) => Math.abs((o[p] || 0) - top) < 1e-9);
  if (tied.length > 1) return { leader: "Tie", tied, marginPp: 0 };
  const second = sorted.find((p) => !tied.includes(p));
  return { leader: sorted[0], tied: [], marginPp: second ? (top - (o[second] || 0)) * 100 : 0 };
};
const wshare = (rows, key) => {
  let total = 0; const out = { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
  for (const r of rows) { const v = Number(r.votes2023) || 0; total += v; for (const p of PARTIES) out[p] += (r[key][p] || 0) * v; }
  if (!total) return { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
  return Object.fromEntries(PARTIES.map((p) => [p, round6(out[p] / total)]));
};
const serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86_400_000);
const buf = fs.readFileSync(FILE);
const wb = read(buf, { cellFormula: false });
const projRows = utils.sheet_to_json(wb.Sheets["Saketh 2028 Projection (AC)"], { defval: "", raw: true, range: 0 });
const proj = projRows.filter((r) => {
  const n = Number(r["AC No"]);
  return Number.isInteger(n) && n >= 1 && n <= 119 && String(r["A/c"] ?? "").trim();
});
if (proj.length !== 119) throw new Error(`Expected 119 AC projections, found ${proj.length}`);
if (new Set(proj.map((r) => Number(r["AC No"]))).size !== 119) throw new Error("Duplicate AC No in projection");
const districts = new Set(proj.map((r) => String(r.District ?? "").trim()).filter(Boolean));
if (districts.size !== 33) throw new Error(`Expected 33 district groups, found ${districts.size}`);
const dataRows = utils.sheet_to_json(wb.Sheets.Data, { defval: "", raw: true, range: 0 });
const acCounts = new Map();
for (const r of dataRows) {
  const no = Number(r["AC No"]);
  if (!no) continue;
  const x = acCounts.get(no) ?? { rows: 0, a28: 0, a23: 0 };
  x.rows++;
  if (String(r["2028 Vote"] ?? "").trim()) x.a28++;
  if (String(r["2023 Vote"] ?? "").trim()) x.a23++;
  acCounts.set(no, x);
}
const answered2028 = dataRows.filter((r) => String(r["2028 Vote"] ?? "").trim()).length;
const answered2023 = dataRows.filter((r) => String(r["2023 Vote"] ?? "").trim()).length;
const acs = proj.map((r) => {
  const no = Number(r["AC No"]);
  const actual = norm({ BRS: r["BRS 2023 actual %"], Congress: r["Congress 2023 actual %"], BJP: r["BJP 2023 actual %"], Others: r["Others 2023 actual %"] });
  const prediction = norm({ BRS: r["BRS 2028 est. %"], Congress: r["Congress 2028 est. %"], BJP: r["BJP 2028 est. %"], Others: r["Others 2028 est. %"] });
  const lead = leaderOf(prediction);
  const c = acCounts.get(no) ?? { rows: 0, a28: 0, a23: 0 };
  return {
    no, name: String(r["A/c"] ?? "").trim(), district: String(r.District ?? "").trim(), zone: String(r.Zone ?? "").trim(),
    votes2023: Number(r["2023 Total votes"]) || 0,
    actual, prediction,
    answered2028: c.a28, answeredRecall2023: c.a23, totalRows: c.rows,
    leader: lead.leader, tied: lead.tied, marginPp: round6(lead.marginPp),
    sourceLeader: String(r["Projected 2028 leader"] ?? "").trim() || null, override: null,
  };
}).sort((a, b) => a.no - b.no);
if (new Set(acs.map((a) => a.no)).size !== 119) throw new Error("AC name resolution failed");
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
const changePp = Object.fromEntries(PARTIES.map((p) => [p, round6((prediction[p] - actual[p]) * 100)]));
const bundle = {
  version: "tg-final-2026-10-23-v1",
  sourceFile: "saketh_TG.xlsx",
  sourceHash: crypto.createHash("sha256").update(buf).digest("hex"),
  cutoff: "2026-07-16",
  shrinkFactor: 30,
  parties: PARTIES,
  labels: { Congress: "Congress+" },
  congressBasis: "INC+CPI alliance, not INC alone",
  othersBasis: "AIMIM+BSP+Janasena+NOTA+IND+all remaining; compact prediction is four-group",
  devicesAvailable: false, pinDataAvailable: false,
  counts: {
    sourceIds: new Set(dataRows.map((r) => String(r["Entry ID"] ?? "").trim()).filter(Boolean)).size,
    cutoffRows: dataRows.length, answered2028, blank2028: dataRows.length - answered2028,
    answeredRecall2023: answered2023, blankRecall2023: dataRows.length - answered2023,
    acs: acs.length, districts: districtRows.length,
  },
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
  counts: bundle.counts, stateActual: actual, statePrediction: prediction, leaders: leads,
  weightSum: sum(prediction), sourceLeaders: acs.filter((a) => a.sourceLeader !== a.leader).map((a) => [a.no, a.name, a.sourceLeader, a.leader]).slice(0, 10),
}, null, 1));
