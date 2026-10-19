// Generate the bundled Telangana baseline aggregates + simplified geometry
// from the supplied Conductor pack.
//
//   TG_PACK=/path/to/ReachOut_Telangana node scripts/gen-telangana.mjs
//
// The pack contains private admin workbooks and is never committed; only the
// aggregates, simplified geometry and public brand assets are written here.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const pc = require("polygon-clipping");

const PACK = process.env.TG_PACK || path.resolve(process.cwd(), ".context/telangana-pack/ReachOut_Telangana");
if (!fs.existsSync(PACK)) {
  console.error(`Conductor pack not found at ${PACK}. Set TG_PACK to the extracted "ReachOut_Telangana" folder.`);
  process.exit(1);
}
const ROOT = path.resolve(process.cwd());
const OUT_DATA = path.join(ROOT, "lib/data/telangana");
const OUT_PUBLIC = path.join(ROOT, "public/telangana");
const OUT_BRANDS = path.join(ROOT, "public/brand-logos");

fs.mkdirSync(OUT_DATA, { recursive: true });
fs.mkdirSync(OUT_PUBLIC, { recursive: true });
fs.mkdirSync(OUT_BRANDS, { recursive: true });

/* ---------------- CSV ---------------- */
function parseCsv(file) {
  const text = fs.readFileSync(path.join(PACK, file), "utf8").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift() ?? [];
  return rows.filter((r) => r.length > 1 || r[0] !== "").map((r) => {
    const o = {};
    head.forEach((k, i) => (o[k] = r[i] ?? ""));
    return o;
  });
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/* ---------------- party registry ---------------- */
const PARTY_ALIASES = {
  congress: "INC", inc: "INC", "indian national congress": "INC", "inc(i)": "INC",
  janasena: "JSP", jnp: "JSP", jsp: "JSP", "jana sena": "JSP",
  trs: "BRS", bhrs: "BRS", brs: "BRS", "bharat rashtra samithi": "BRS", "telangana rashtra samithi": "BRS",
  bjp: "BJP", "bharatiya janata party": "BJP",
  aimim: "AIMIM", "all india majlis-e-ittehadul muslimeen": "AIMIM", "majlis": "AIMIM",
  tdp: "TDP", "telugu desam party": "TDP",
  nota: "NOTA", none: "NOTA", "none of the above": "NOTA",
  others: "Others", other: "Others", independent: "Others", ind: "Others",
};
const PARTIES = ["BRS", "INC", "BJP", "AIMIM", "TDP", "JSP", "Others", "NOTA"];
function canonParty(raw) {
  const k = String(raw ?? "").trim().toLowerCase();
  return PARTY_ALIASES[k] ?? "Others";
}

/* ---------------- geography ---------------- */
const grouping = JSON.parse(fs.readFileSync(path.join(PACK, "geometry/ac_district_grouping.json"), "utf8"));
const geoRaw = JSON.parse(fs.readFileSync(path.join(PACK, "geometry/telangana_assembly_119.geojson"), "utf8"));

/* ---------------- survey / historical ---------------- */
const acSurvey = parseCsv("data/public/ac_survey_2028.csv");
const acSwing = parseCsv("data/historical/ac_swing_2018_2023.csv");
const districtSwing = parseCsv("data/historical/district_swing_2018_2023.csv");
const statewideCsv = parseCsv("data/public/statewide_swing.csv");
const deviceCsv = parseCsv("data/public/device_mix.csv");
const roundsCsv = parseCsv("data/public/survey_rounds.csv");
const dailyCsv = parseCsv("data/public/survey_daily.csv");
const crosswalkCsv = parseCsv("data/historical/ac_district_crosswalk_review.csv");

const acMap = new Map();
function acRec(no) {
  if (!acMap.has(no)) {
    acMap.set(no, {
      no,
      name: "",
      group: "",
      reservation: "",
      scenarioRows: 0,
      a2028: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      o2028: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      v2018: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      v2023: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      device: {},
    });
  }
  return acMap.get(no);
}

for (const r of acSurvey) {
  const no = num(r["AC number"]);
  if (!no) continue;
  const a = acRec(no);
  a.name = r["AC name"] || a.name;
  a.group = r["Uploaded district grouping"] || a.group;
  a.scenarioRows = Math.max(a.scenarioRows, num(r["Scenario rows"]));
  const p = canonParty(r.Party);
  a.a2028[p] += num(r["Scenario answered party"]);
  a.o2028[p] += num(r["Original answered party"]);
}
for (const r of acSwing) {
  const no = num(r["AC number"]);
  if (!no) continue;
  const a = acRec(no);
  a.name = a.name || r["AC name"];
  a.group = a.group || r["Uploaded district grouping"];
  const p = canonParty(r.Party);
  a.v2018[p] += num(r["2018 votes"]);
  a.v2023[p] += num(r["2023 votes"]);
}
for (const r of deviceCsv) {
  const no = num(r["AC number"]);
  if (!no) continue;
  const a = acRec(no);
  const brand = String(r["Device brand"] ?? "").trim() || "Unknown";
  a.device[brand] = (a.device[brand] ?? 0) + num(r["Original entries"]);
}

for (const a of acMap.values()) {
  const g = grouping[String(a.no)] ?? {};
  a.group = g.district || a.group;
  a.name = g.acName || a.name;
  const m = /\((SC|ST)\)/i.exec(a.name);
  if (m) { a.reservation = m[1].toUpperCase(); a.name = a.name.replace(/\s*\((SC|ST)\)\s*$/i, "").trim(); }
  a.total2023 = PARTIES.reduce((s, p) => s + a.v2023[p], 0);
  a.total2018 = PARTIES.reduce((s, p) => s + a.v2018[p], 0);
  a.answered2028 = PARTIES.reduce((s, p) => s + a.a2028[p], 0);
  a.originalAnswered2028 = PARTIES.reduce((s, p) => s + a.o2028[p], 0);
  a.deviceTotal = Object.values(a.device).reduce((s, v) => s + v, 0);
}

const acs = [...acMap.values()].sort((a, b) => a.no - b.no);

/* ---------------- district groups ---------------- */
const groups = new Map();
for (const a of acs) {
  if (!groups.has(a.group)) {
    groups.set(a.group, {
      group: a.group, acs: [],
      a2028: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      o2028: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      v2018: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      v2023: Object.fromEntries(PARTIES.map((p) => [p, 0])),
      device: {},
    });
  }
  const d = groups.get(a.group);
  d.acs.push(a.no);
  for (const p of PARTIES) { d.a2028[p] += a.a2028[p]; d.o2028[p] += a.o2028[p]; d.v2018[p] += a.v2018[p]; d.v2023[p] += a.v2023[p]; }
  for (const [b, n] of Object.entries(a.device)) d.device[b] = (d.device[b] ?? 0) + n;
}
const districts = [...groups.values()].map((d) => ({
  ...d,
  answered2028: PARTIES.reduce((s, p) => s + d.a2028[p], 0),
  total2023: PARTIES.reduce((s, p) => s + d.v2023[p], 0),
  total2018: PARTIES.reduce((s, p) => s + d.v2018[p], 0),
})).sort((a, b) => a.group.localeCompare(b.group));

/* verify district CSV consistency */
const districtCsvTotals = new Map();
for (const r of districtSwing) {
  const g = districtCsvTotals.get(r["District grouping"]) ?? { v2018: 0, v2023: 0 };
  g.v2018 += num(r["2018 votes"]); g.v2023 += num(r["2023 votes"]);
  districtCsvTotals.set(r["District grouping"], g);
}
let districtMismatch = 0;
for (const d of districts) {
  const c = districtCsvTotals.get(d.group);
  if (!c || Math.abs(c.v2023 - d.total2023) > 0 || Math.abs(c.v2018 - d.total2018) > 0) districtMismatch++;
}

/* ---------------- statewide ---------------- */
const statewide = statewideCsv.map((r) => ({
  party: canonParty(r.Party),
  v2018: num(r["2018 votes"]), s2018: num(r["2018 share"]), seats2018: num(r["2018 seats"]),
  v2023: num(r["2023 votes"]), s2023: num(r["2023 share"]), seats2023: num(r["2023 seats"]),
  answered2028: num(r["2028 scenario answered rows"]), share2028: num(r["2028 scenario share"]),
  swing2018to2023: num(r["2018 to 2023 swing pp"]), diff2023to2028: num(r["2023 to 2028 difference pp"]),
  originalAnswered2028: num(r["Original 2028 answers"]), originalShare2028: num(r["Original 2028 share"]),
})).sort((a, b) => b.answered2028 - a.answered2028);

/* ---------------- device / rounds / daily / crosswalk ---------------- */
const brandTotals = {};
for (const a of acs) for (const [b, n] of Object.entries(a.device)) brandTotals[b] = (brandTotals[b] ?? 0) + n;
const brands = Object.entries(brandTotals).sort((a, b) => b[1] - a[1]).map(([brand, entries]) => ({ brand, entries }));

const rounds = roundsCsv.map((r) => ({
  batchSize: num(r["Batch size"]), batch: num(r["Batch number"]), from: r.From, to: r.To,
  party: canonParty(r.Party), entries: num(r["Original entries"]), answered: num(r["Answered entries"]),
  answers: num(r["Party answers"]), share: num(r.Share), diffPp: num(r["Difference vs 2023 pp"]),
}));
const daily = dailyCsv.map((r) => ({
  date: r.Date, party: canonParty(r.Party), entries: num(r["Original entries"]),
  answered: num(r["Answered entries"]), answers: num(r["Party answers"]),
  share: r.Share === "" ? null : num(r.Share),
})).filter((r) => r.date);

const crosswalk = crosswalkCsv.map((r) => ({
  no: num(r["AC number"]), name: r["AC name"],
  uploaded: r["Uploaded district grouping"], wikipedia: r["Wikipedia 2023 grouping"],
  match: String(r["Exact name match"]).toLowerCase() === "true",
}));

/* ---------------- age groups from the scenario workbook ---------------- */
const wb = XLSX.readFile(path.join(PACK, "data/admin/Telangana_Opinion_Poll_30000_Adjusted.xlsx"));
const rows30k = XLSX.utils.sheet_to_json(wb.Sheets["Opinion Poll"], { defval: "", raw: true });
const AGE_BANDS = ["18–25", "26-35", "36–45", "46–60", "60+", "(missing)"];
const ageMap = new Map(AGE_BANDS.map((b) => [b, Object.fromEntries(PARTIES.map((p) => [p, 0]))]));
let answered2028 = 0, blank2028 = 0;
const party2028 = Object.fromEntries(PARTIES.map((p) => [p, 0]));
for (const r of rows30k) {
  const raw = String(r["Survey (2028 vote, English)"] ?? "").trim();
  const ageRaw = String(r["Age"] ?? "").trim();
  const band = AGE_BANDS.includes(ageRaw) ? ageRaw : "(missing)";
  if (!raw) { blank2028++; continue; }
  answered2028++;
  const p = canonParty(raw);
  party2028[p] += 1;
  ageMap.get(band)[p] += 1;
}
const age = [...ageMap.entries()].map(([band, parties]) => ({
  band, answered: PARTIES.reduce((s, p) => s + parties[p], 0), parties,
}));

/* ---------------- simplify geometry ---------------- */
function sqSegDist(p, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}
function dp(points, sqTol) {
  const n = points.length;
  if (n < 4) return points;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = sqSegDist(points[i], points[a], points[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqTol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const TOL = 0.0009; // ~100 m
const MIN_RING_POINTS = 6;
let beforePts = 0, afterPts = 0;
const features = geoRaw.features.map((f) => {
  const props = f.properties;
  let coords;
  if (f.geometry.type === "Polygon") {
    coords = f.geometry.coordinates.map((ring) => { beforePts += ring.length; const s = dp(ring, TOL * TOL); afterPts += s.length; return s; }).filter((r) => r.length >= MIN_RING_POINTS);
  } else {
    coords = f.geometry.coordinates.map((poly) => poly.map((ring) => { beforePts += ring.length; const s = dp(ring, TOL * TOL); afterPts += s.length; return s; }).filter((r) => r.length >= MIN_RING_POINTS));
  }
  const rec = acMap.get(props.acNo);
  return {
    type: "Feature",
    properties: { acNo: props.acNo, name: rec?.name ?? props.acName, group: rec?.group ?? props.districtGrouping },
    geometry: { type: f.geometry.type, coordinates: coords },
  };
});

/* ---------------- write ---------------- */
const baseline = {
  version: "telangana-baseline-2026.10.1",
  generatedAt: new Date().toISOString().slice(0, 10),
  basis: "replicated-adjusted-scenario",
  pollType: "opinion",
  surveyCollectionYear: 2026,
  surveyQuestionYear: 2028,
  historicalPeriods: [2018, 2023],
  totals: {
    scenarioRows: rows30k.length,
    answered2028,
    blank2028,
    sourceEntries: 5090,
    acs: acs.length,
    groups: districts.length,
    conflictRows: crosswalk.filter((c) => !c.match).length,
    districtMismatch,
    geometryPoints: afterPts,
  },
  partyOrder: PARTIES,
  statewide,
  districts,
  acs,
  age,
  brands,
  rounds,
  daily,
  crosswalk,
};
fs.writeFileSync(path.join(OUT_DATA, "baseline.json"), JSON.stringify(baseline));

fs.writeFileSync(
  path.join(OUT_PUBLIC, "telangana-ac.geojson"),
  JSON.stringify({ type: "FeatureCollection", features }),
);

/* dissolved analytical grouping outlines — a union of the group's AC shapes.
   This is a dissolve of assemblies, not an official administrative boundary. */
const groupRings = new Map();
for (const f of geoRaw.features) {
  const g = f.properties.districtGrouping;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  if (!groupRings.has(g)) groupRings.set(g, []);
  groupRings.get(g).push(...polys);
}
const districtFeatures = [];
let districtPts = 0;
for (const [group, polys] of groupRings) {
  let merged;
  try { merged = pc.union(polys[0], ...polys.slice(1)); }
  catch { continue; }
  const coordinates = merged.map((poly) =>
    poly.map((ring) => {
      const simplified = dp(ring, TOL * TOL);
      districtPts += simplified.length;
      return simplified;
    }),
  );
  const rec = districts.find((d) => d.group === group);
  districtFeatures.push({
    type: "Feature",
    properties: { group, acs: rec?.acs ?? [], basis: "dissolved analytical grouping; not an official district boundary" },
    geometry: { type: "MultiPolygon", coordinates },
  });
}
fs.writeFileSync(
  path.join(OUT_PUBLIC, "telangana-districts.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: districtFeatures }),
);

/* ---------------- assets ---------------- */
fs.copyFileSync(path.join(PACK, "assets/brs_leader_user_supplied.png"), path.join(OUT_PUBLIC, "brs-leader.png"));
fs.copyFileSync(path.join(PACK, "assets/brs_car_symbol_user_supplied.png"), path.join(OUT_PUBLIC, "brs-car.png"));
fs.copyFileSync(path.join(PACK, "assets/device_coverage.svg"), path.join(OUT_PUBLIC, "device-coverage.svg"));

const brandSrc = path.join(PACK, "assets/mobile-brands");
for (const dir of ["png", "marker-png", "marker-svg"]) {
  const from = path.join(brandSrc, dir);
  if (!fs.existsSync(from)) continue;
  const to = path.join(OUT_BRANDS, dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
fs.copyFileSync(path.join(brandSrc, "brand-map.json"), path.join(OUT_BRANDS, "brand-map.json"));
fs.copyFileSync(path.join(brandSrc, "README.md"), path.join(OUT_BRANDS, "README.md"));
for (const f of ["brand-assets.ts", "brand-counts.csv", "brand_preview.png"]) {
  if (fs.existsSync(path.join(brandSrc, f))) fs.copyFileSync(path.join(brandSrc, f), path.join(OUT_BRANDS, f));
}
if (fs.existsSync(path.join(brandSrc, "licenses"))) {
  fs.mkdirSync(path.join(OUT_BRANDS, "licenses"), { recursive: true });
  for (const f of fs.readdirSync(path.join(brandSrc, "licenses"))) fs.copyFileSync(path.join(brandSrc, "licenses", f), path.join(OUT_BRANDS, "licenses", f));
}

console.log(JSON.stringify({
  acs: acs.length, groups: districts.length,
  answered2028, blank2028, scenarioRows: rows30k.length,
  party2028,
  brands: brands.length, brandTotal: Object.values(brandTotals).reduce((a, b) => a + b, 0),
  rounds: rounds.length, daily: daily.length,
  crosswalk: crosswalk.length, conflicts: crosswalk.filter((c) => !c.match).length,
  districtMismatch,
  geoPoints: { beforePts, afterPts },
  geoBytes: fs.statSync(path.join(OUT_PUBLIC, "telangana-ac.geojson")).size,
  baselineBytes: fs.statSync(path.join(OUT_DATA, "baseline.json")).size,
}, null, 1));
