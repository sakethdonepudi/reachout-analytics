// Build aggregate survey periods (388/688 rounds, calendar days, 50-response
// blocks) for the expanded Telangana analysis. No Entry IDs or raw rows are
// written; the source workbook stays private.
//   TG_ROUNDS_XLSX=/path/to/Telangana_2028_Source_Workbook.xlsx node scripts/gen-telangana-rounds.mjs
import fs from "node:fs";
import path from "node:path";
import { read, utils } from "xlsx";

const XLSX =
  process.env.TG_ROUNDS_XLSX ||
  path.resolve(process.cwd(), ".context/telangana-history-pack/excel/Telangana_2028_Source_Workbook.xlsx");
const OUT = path.resolve(process.cwd(), "lib/data/telangana/rounds.json");

const wb = read(fs.readFileSync(XLSX));
const ws = wb.Sheets["Data"];
if (!ws) throw new Error("Data sheet missing");
const rows = utils.sheet_to_json(ws, { defval: "", raw: true, range: 0 });
const parties = ["BRS", "Congress", "BJP", "AIMIM", "Others"];

const serialToDate = (serial) => new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86_400_000);
const empty = () => ({ BRS: 0, Congress: 0, BJP: 0, AIMIM: 0, Others: 0 });
const partyOf = (value) => {
  const v = String(value ?? "").trim();
  if (v === "BRS") return "BRS";
  if (v === "Congress" || v === "INC") return "Congress";
  if (v === "BJP") return "BJP";
  if (v === "AIMIM") return "AIMIM";
  if (!v) return null;
  return "Others"; // TDP, Janasena, NOTA and any other options
};

const records = rows
  .map((r) => {
    const id = Number(r["Entry ID"]);
    const serial = Number(r["Entry Date"]);
    const date = serialToDate(serial);
    const party = partyOf(r["2028 Vote"]);
    return party && Number.isFinite(serial)
      ? { id: Number.isFinite(id) ? id : String(r["Entry ID"]), date: date.toISOString(), ms: date.getTime(), ac: Number(r["AC No"]), district: String(r["District"] ?? "").trim(), party }
      : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.ms - b.ms || (typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : String(a.id).localeCompare(String(b.id))));

function countsOf(list) {
  const counts = empty();
  for (const r of list) counts[r.party] += 1;
  return counts;
}
function aggregate(list) {
  return { n: list.length, counts: countsOf(list) };
}
function batch(list, size, kind) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    const chunk = list.slice(i, i + size);
    const agg = aggregate(chunk);
    out.push({
      kind,
      index: out.length + 1,
      start: chunk[0].date,
      end: chunk[chunk.length - 1].date,
      n: agg.n,
      partial: chunk.length < size,
      counts: agg.counts,
    });
  }
  return out;
}
function daily(list) {
  const map = new Map();
  for (const r of list) {
    const day = r.date.slice(0, 10);
    const arr = map.get(day) ?? [];
    arr.push(r);
    map.set(day, arr);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, arr]) => ({ kind: "day", date, ...aggregate(arr) }));
}
function scope(list, name) {
  const sorted = [...list].sort((a, b) => a.ms - b.ms || (typeof a.id === "number" && typeof b.id === "number" ? a.id - b.id : String(a.id).localeCompare(String(b.id))));
  return {
    name,
    eligible: sorted.length,
    dateMin: sorted[0]?.date.slice(0, 10) ?? null,
    dateMax: sorted[sorted.length - 1]?.date.slice(0, 10) ?? null,
    rounds388: batch(sorted, 388, "round388"),
    rounds688: batch(sorted, 688, "round688"),
    daily: daily(sorted),
    blocks50: batch(sorted, 50, "block50"),
  };
}

const scopes = { state: scope(records, "Telangana") };
const districts = new Map();
const acs = new Map();
for (const r of records) {
  if (r.district) {
    const arr = districts.get(r.district) ?? [];
    arr.push(r);
    districts.set(r.district, arr);
  }
  if (Number.isInteger(r.ac)) {
    const arr = acs.get(r.ac) ?? [];
    arr.push(r);
    acs.set(r.ac, arr);
  }
}
for (const [d, list] of districts) scopes[`d:${d}`] = scope(list, d);
for (const [a, list] of acs) scopes[`a:${a}`] = scope(list, `AC ${a}`);

const bundle = {
  version: "tg-rounds-2026-10-22",
  source: "2028 source workbook Data sheet",
  partyGroups: { BRS: "BRS", Congress: "Congress", BJP: "BJP", AIMIM: "AIMIM", Others: "TDP + Janasena + any other 2028 answer" },
  parties,
  eligible: records.length,
  dateMin: records[0]?.date.slice(0, 10) ?? null,
  dateMax: records[records.length - 1]?.date.slice(0, 10) ?? null,
  scopes,
};

fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({
  out: OUT, bytes: fs.statSync(OUT).size, eligible: bundle.eligible, dateMin: bundle.dateMin, dateMax: bundle.dateMax,
  stateRounds388: scopes.state.rounds388.length, stateRounds688: scopes.state.rounds688.length,
  stateDays: scopes.state.daily.length, stateBlocks50: scopes.state.blocks50.length,
  scopes: Object.keys(scopes).length,
}, null, 1));
