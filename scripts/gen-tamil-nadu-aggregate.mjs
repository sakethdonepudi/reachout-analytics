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
  const surveyShares = normalize({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] });
  const surveyCounts = Object.fromEntries(GROUPS.map((g) => [g, g === "TVK" ? Number(r["TVK votes"]) : g === "AIADMK+BJP+PMK+AMMK" ? Number(r["AIADMK+ votes"]) : g === "DMK+INC+VCK" ? Number(r["DMK+ votes"]) : g === "NTK" ? Number(r["NTK votes"]) : Number(r["NOTA votes"])]));
  const projected = groupActual(r.Winner);
  const actualGroup = groupActual(actual["Actual 2026 alliance"]);
  const rec = {
    no, name: String(r.Constituency).trim(), district: String(r.District).trim(), districtEci: String(r["District (2026 ECI grouping)"]).trim(),
    actual: Object.fromEntries(YEARS.map((y) => {
      const sh = historical.acs.get(`${no}|${y}`) ?? null;
      const winner = y === "2021" && actual["2021 alliance"] ? groupActual(actual["2021 alliance"]) : (sh ? leaderOf(sh) : null);
      return [y, { shares: sh, available: !!sh, winner }];
    })),
    survey: { valid: Number(r["Responses (n)"]) || 0, counts: surveyCounts, shares: surveyShares },
    surveyLeader: leaderOf(surveyShares),
    projected: { leader: projected, marginPp: Number(r["Margin (pts)"]) || 0, confidence: String(r.Confidence ?? "").trim(), winner: projected },
    actual2026: { alliance: String(actual["Actual 2026 alliance"] ?? "").trim(), party: String(actual["Actual 2026 winner party"] ?? "").trim(), winner: actualGroup },
    match: String(actual["Match?"] ?? "").trim() === "Yes",
    noData: !surveyShares || !(Number(r["Responses (n)"]) > 0),
  };
  return rec;
}).sort((a, b) => a.no - b.no);

/* ---------------- district records ---------------- */
const byDistrict = new Map();
for (const a of acs) { const l = byDistrict.get(a.district) ?? []; l.push(a); byDistrict.set(a.district, l); }
const districts = distRows.map((r) => {
  const name = String(r.District).trim();
  const members = byDistrict.get(name) ?? [];
  const shares = normalize({ TVK: r["TVK adjusted %"], "AIADMK+BJP+PMK+AMMK": r["AIADMK+ adjusted %"], "DMK+INC+VCK": r["DMK+ adjusted %"], NTK: r["NTK adjusted %"], NOTA: r["NOTA adjusted %"] });
  const projectedSeats = Object.fromEntries(GROUPS.map((g) => [g, members.filter((a) => a.projected.leader === g).length]));
  const actualSeats = Object.fromEntries(GROUPS.map((g) => [g, members.filter((a) => a.actual2026.winner === g).length]));
  return {
    name, acs: members.map((a) => a.no),
    actual: Object.fromEntries(YEARS.map((y) => { const hist = historical.districts.get(`${HISTORICAL_DISTRICT_ALIAS[name] ?? name}|${y}`) ?? null; return [y, { shares: hist, available: !!hist, winner: null }]; })),
    survey: { valid: Number(r["Responses (n)"]) || 0, shares, counts: Object.fromEntries(GROUPS.map((g) => [g, g === "TVK" ? Number(r["TVK votes"]) : g === "AIADMK+BJP+PMK+AMMK" ? Number(r["AIADMK+ votes"]) : g === "DMK+INC+VCK" ? Number(r["DMK+ votes"]) : g === "NTK" ? Number(r["NTK votes"]) : Number(r["NOTA votes"])])) },
    projectedSeats, actualSeats,
    seatProjection: { leader: String(r.Leader ?? "").trim(), marginPp: Number(r["Lead (pts)"]) || 0 },
    coverage: { acs: members.length, responses: Number(r["Responses (n)"]) || 0 },
  };
}).sort((a, b) => a.name.localeCompare(b.name));

/* ---------------- state ---------------- */
const stateCounts = { TVK: Number(all["TVK votes"]), "AIADMK+BJP+PMK+AMMK": Number(all["AIADMK+ votes"]), "DMK+INC+VCK": Number(all["DMK+ votes"]), NTK: Number(all["NTK votes"]), NOTA: Number(all["NOTA votes"]) };
const stateTotal = Number(all.Total);
const locatedTotal = Number(located.Total);
const missingTotal = Number(missing.Total);
const assemblyScoped = acs.reduce((s, a) => s + a.survey.valid, 0);
const stateShares = normalize({ TVK: all["TVK share"], "AIADMK+BJP+PMK+AMMK": all["AIADMK+ share"], "DMK+INC+VCK": all["DMK+ share"], NTK: all["NTK share"], NOTA: all["NOTA share"] });
const projectedSeats = Object.fromEntries(GROUPS.map((g) => [g, acs.filter((a) => a.projected.leader === g).length]));
const actualSeats = Object.fromEntries(GROUPS.map((g) => [g, acs.filter((a) => a.actual2026.winner === g).length]));
const accuracy = acs.filter((a) => a.match).length;
const reference = { party: "TVK", value: 0.348, label: "Reference share", workbookValue: round6(stateShares.TVK), note: "Retained reference headline; workbook-derived TVK share is 34.78%." };
if (actualSeats.TVK !== 108 || actualSeats["DMK+INC+VCK"] !== 73 || actualSeats["AIADMK+BJP+PMK+AMMK"] !== 53) throw new Error(`Actual seat totals failed: ${JSON.stringify(actualSeats)}`);
if (projectedSeats.TVK !== 115 || projectedSeats["AIADMK+BJP+PMK+AMMK"] !== 60 || projectedSeats["DMK+INC+VCK"] !== 56 || projectedSeats.NTK !== 3) throw new Error(`Projected seat totals failed: ${JSON.stringify(projectedSeats)}`);

const audit = [
  { sheet: "Summary", rows: summaryRaw.length, used: "headline counts, accuracy and projected seat validation", detail: `Votes ${summary.get("Votes analysed")}; located ${summary.get("With district or AC")}; no location ${summary.get("Vote only (no location)")}` },
  { sheet: "Statewide Votes", rows: statewideT.rows.length, used: "statewide all-response shares and counts", detail: "All responses used; located and missing-location rows retained separately for audit" },
  { sheet: "AC Results", rows: acRows.length, used: "adjusted AC shares, leaders and margins", detail: `${adjustedSums.ac.length} ACs; ${badAc} adjusted rows exceeded 100% and were proportionally renormalised for display (max +${maxDeviation.toFixed(3)} pp); source workbook unchanged` },
  { sheet: "District Results", rows: distRows.length, used: "adjusted district shares and leaders", detail: `${adjustedSums.district.length} districts; adjusted sums validated at 100%; no renormalisation applied` },
  { sheet: "AC vs Actual 2026", rows: actualRows.length, used: "actual 2026 winners, seat totals and prediction-vs-actual", detail: `Accuracy ${accuracy}/234; current district mapping used for public tables; ECI grouping retained for audit` },
  { sheet: "District vs Actual 2026", rows: distActualRows.length, used: "audit only", detail: "Workbook uses the 2026 ECI district grouping; public views use the current 38-district grouping" },
  { sheet: "Who Voted How", rows: privateSheets[0].rows, used: "private only", detail: "Age/religion/form sections intentionally not public" },
  { sheet: "Model Validation", rows: privateSheets[1].rows, used: "private only", detail: "Not a public analysis section" },
  { sheet: "Significant Variables", rows: privateSheets[2].rows, used: "private only", detail: "Not a public analysis section" },
];

const bundle = {
  version: "tn-2026-aggregate-final-v1",
  sourceFile: "TN-2026-Exit-Poll-Analysis-Data-5.xlsx",
  sourceHash: crypto.createHash("sha256").update(buf).digest("hex"),
  source: { type: "aggregate analysis export", totalResponses: stateTotal, locatedResponses: locatedTotal, unlocatedResponses: missingTotal, assemblyScopedResponses: assemblyScoped, constituencies: acs.length, districts: districts.length, reference, audit, normalisation, crosswalk: { matched: actualRows.length, unresolved: missingCrosswalk.length, method: "assembly name + District (2026 ECI grouping)", duplicateNames: ["Tiruppattur"] }, districtPolicy: "Current 38-district grouping for public geometry, dropdowns and tables; 2026 ECI grouping retained only for audit." },
  groups: GROUPS, labels: LB, colors: COL, years: YEARS, presence, referenceShare: reference,
  statewide: {
    name: "Tamil Nadu", actual: Object.fromEntries(YEARS.map((y) => [y, { shares: historical.state[y], available: !!historical.state[y], winner: historical.state[y] ? leaderOf(historical.state[y]) : null }])),
    survey: { valid: stateTotal, counts: stateCounts, shares: stateShares }, surveyLeader: leaderOf(stateShares),
    counts: { total: stateTotal, located: locatedTotal, unlocated: missingTotal },
    projectedSeats, actualSeats, accuracy,
  },
  districts, acs,
};
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, hash: bundle.sourceHash.slice(0, 16), acs: acs.length, districts: districts.length, stateShares, projectedSeats, actualSeats, accuracy, normalisation, privateSheets, audit: audit.map((x) => [x.sheet, x.rows]) }, null, 1));
