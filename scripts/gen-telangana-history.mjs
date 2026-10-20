// Build the Telangana historical bundle (2014/2018/2023) + swing statistics +
// device-brand aggregates from the supplied Excel pack.
//   TG_HISTORY_PACK=/path/to/Telangana_Election_Excel_Pack node scripts/gen-telangana-history.mjs
import fs from "node:fs";
import path from "node:path";
import { read as readWorkbook, utils as xlsxUtils } from "xlsx";

const PACK = process.env.TG_HISTORY_PACK || path.resolve(process.cwd(), ".context/telangana-history-pack");
const OUT = path.resolve(process.cwd(), "lib/data/telangana/history.json");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PACK, p), "utf8"));

const history = readJson("data/normalized_history.json");
const stats = readJson("data/swing_statistics.json");
const colours = readJson("data/party_colours.json");
const sourceAudit = readJson("docs/source_audit.json");

const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const groups = ["BRS", "Congress", "BJP", "Others"];
const pickShares = (s) => ({ BRS: round6(s.BRS), Congress: round6(s["Congress+"] ?? s.Congress), BJP: round6(s.BJP), Others: round6(s.Others) });

const years = {};
for (const year of ["2014", "2018", "2023"]) {
  const rows = history[year];
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const weighted = { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
  for (const r of rows) { const sh = pickShares(r.shares); for (const p of groups) weighted[p] += sh[p] * r.total; }
  for (const p of groups) weighted[p] /= total || 1;
  const seats = {};
  for (const r of rows) seats[r.winnerParty] = (seats[r.winnerParty] ?? 0) + 1;
  years[year] = {
    total,
    shares: Object.fromEntries(groups.map((p) => [p, round6(weighted[p])])),
    seats,
    acs: rows.map((r) => ({
      no: r.acNo,
      name: r.acName,
      district: r.district,
      total: r.total,
      shares: pickShares(r.shares),
      winnerParty: r.winnerParty,
      winnerName: r.winnerName,
      winnerVotes: r.winnerVotes,
      winnerShare: round6(r.total ? r.winnerVotes / r.total : 0),
    })),
  };
}

/* trim the stats: names/districts come from the crosswalk */
const statsOut = stats.map((s) => ({
  fromYear: s.fromYear,
  toYear: s.toYear,
  party: s.party,
  medianPp: round6(s.medianPp),
  q1Pp: round6(s.q1Pp),
  q3Pp: round6(s.q3Pp),
  lowerFencePp: round6(s.lowerFencePp),
  upperFencePp: round6(s.upperFencePp),
  assemblies: s.assemblies.map((a) => ({ no: a.acNo, changePp: round6(a.changePp), outlier: !!a.outlier })),
}));

/* device workbook — headers are on row 4 */
const devWb = readWorkbook(fs.readFileSync(path.join(PACK, "excel/Telangana_Device_Brand_Metadata.xlsx")));
const sheet = (name) => xlsxUtils.sheet_to_json(devWb.Sheets[name], { defval: "", raw: true, range: 3 });
const brandMix = sheet("Brand mix").map((r) => ({ brand: String(r.Brand), entries: Number(r.Entries), share: round6(Number(r["Entry share"])) }));
const assemblyMix = sheet("Assembly brand mix");
const byAc = {};
for (const r of assemblyMix) {
  const no = String(Number(r["AC No"]));
  const rec = byAc[no] ?? { total: 0, brands: [] };
  rec.total += Number(r.Entries) || 0;
  rec.brands.push({ brand: String(r.Brand), entries: Number(r.Entries) || 0, share: round6(Number(r["Entry share"])) });
  byAc[no] = rec;
}
const deviceTotal = brandMix.reduce((s, b) => s + b.entries, 0);

const crosswalk = history["2014"].map((r) => ({ no: r.acNo, name: r.acName, district: r.district }));

const bundle = {
  version: "tg-2014-2028-v1",
  cutoff: "2026-10-01",
  groups: ["BRS", "Congress", "BJP", "Others"],
  groupLabels: { BRS: "BRS", Congress: "Congress+", BJP: "BJP", Others: "Others" },
  winnerColours: colours,
  sourceAudit,
  years,
  stats: statsOut,
  devices: {
    total: deviceTotal,
    brands: brandMix,
    byAc,
    note: "Exact Entry ID/AC-enriched predicted brands; illustrative placement, not GPS or verified handsets.",
  },
  crosswalk,
};

fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({
  out: OUT, bytes: fs.statSync(OUT).size,
  years: Object.fromEntries(Object.entries(years).map(([y, v]) => [y, { total: v.total, shares: v.shares, seats: Object.keys(v.seats).length }])),
  stats: statsOut.length,
  deviceTotal,
  brands: brandMix.length,
  acsWithDevices: Object.keys(byAc).length,
  crosswalk: crosswalk.length,
}, null, 1));
