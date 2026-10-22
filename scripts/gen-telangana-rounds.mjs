// Build aggregate survey periods from the uploaded workbook.
//
// - every one of the 5,090 entries belongs to exactly one 388/688 round
// - each question has its own denominator (blank 2028 / blank 2023 excluded)
// - 388: twelve full rounds + a final 434-entry round
// - 688: seven full rounds + a final 274-entry round
// - daily and scope-specific 50-response blocks for distribution views
// - aggregate only: no Entry IDs or raw rows are written
//
// TG_ROUNDS_XLSX=/path/to/workbook node scripts/gen-telangana-rounds.mjs
import fs from "node:fs";
import path from "node:path";
import { read, utils } from "xlsx";

const XLSX =
  process.env.TG_ROUNDS_XLSX ||
  path.resolve(process.cwd(), ".context/attachments/QhSZpw/TG-2028-AC-Swing_19Oct Updated (1).xlsx");
const OUT = path.resolve(process.cwd(), "lib/data/telangana/rounds.json");
const PARTIES = ["BRS", "Congress", "BJP", "AIMIM", "TDP", "JSP", "Others"];

const wb = read(fs.readFileSync(XLSX));
const rows = utils.sheet_to_json(wb.Sheets["Data"], { defval: "", raw: true, range: 0 });
const serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Number(n) * 86_400_000);
const empty = () => Object.fromEntries(PARTIES.map((p) => [p, 0]));
const p28 = (v) => {
  const s = String(v ?? "").trim();
  if (s === "BRS") return "BRS";
  if (s === "Congress") return "Congress";
  if (s === "BJP") return "BJP";
  if (s === "AIMIM") return "AIMIM";
  if (s === "TDP") return "TDP";
  if (s === "Janasena") return "JSP";
  return s ? "Others" : null;
};
const p23 = (v) => {
  const s = String(v ?? "").trim();
  if (s === "BRS" || s === "TRS") return "BRS";
  if (s === "INC" || s === "Congress") return "Congress";
  if (s === "BJP") return "BJP";
  if (s === "AIMIM") return "AIMIM";
  if (s === "TDP") return "TDP";
  if (s === "Janasena" || s === "JSP") return "JSP";
  return s ? "Others" : null; // NOTA and any other recall option
};

const entries = rows.map((r) => {
  const date = serialToDate(Number(r["Entry Date"]));
  return {
    id: String(r["Entry ID"] ?? ""),
    ms: date.getTime(),
    date: date.toISOString(),
    ac: Number(r["AC No"]),
    district: String(r["District"] ?? "").trim(),
    p28: p28(r["2028 Vote"]),
    p23: p23(r["2023 Vote"]),
    blank28: !String(r["2028 Vote"] ?? "").trim(),
    blank23: !String(r["2023 Vote"] ?? "").trim(),
  };
}).sort((a, b) => a.ms - b.ms || (Number(a.id) - Number(b.id)) || a.id.localeCompare(b.id));
entries.forEach((e, i) => { e.globalPos = i; });

const add = (target, entry) => {
  target.entries += 1;
  if (entry.p28) { target.answered2028 += 1; target.counts2028[entry.p28] += 1; }
  if (entry.p23) { target.answered2023 += 1; target.counts2023[entry.p23] += 1; }
};
const newPeriod = (base) => ({
  ...base,
  entries: 0,
  answered2028: 0, counts2028: empty(),
  answered2023: 0, counts2023: empty(),
});
/* Reference round counts: 12 full + a 434-entry final at 388; 7 full + a 274-entry final at 688. */
const ROUND_COUNT = { 388: 13, 688: 8 };
const roundDefs = (size) => {
  const out = [];
  let pos = 0;
  for (let i = 0; i < ROUND_COUNT[size]; i++) {
    const end = i < ROUND_COUNT[size] - 1 ? pos + size : entries.length;
    const chunk = entries.slice(pos, end);
    out.push({
      index: out.length + 1,
      start: chunk[0].date,
      end: chunk[chunk.length - 1].date,
      entries: chunk.length,
      partial: i === ROUND_COUNT[size] - 1,
      startPos: pos,
      endPos: end,
    });
    pos = end;
  }
  return out;
};
const defs388 = roundDefs(388);
const defs688 = roundDefs(688);

function scopeData(name, list) {
  const sorted = [...list].sort((a, b) => a.globalPos - b.globalPos);
  const rounds = (defs, size) => {
    const arr = defs.map((d) => newPeriod(d));
    for (const e of sorted) {
      const idx = defs.findIndex((d) => e.globalPos >= d.startPos && e.globalPos < d.endPos);
      add(arr[idx], e);
    }
    return arr;
  };
  const dailyMap = new Map();
  for (const e of sorted) {
    const date = e.date.slice(0, 10);
    const cur = dailyMap.get(date) ?? newPeriod({ date });
    add(cur, e);
    dailyMap.set(date, cur);
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const blocks50 = [];
  for (let i = 0; i < sorted.length; i += 50) {
    const chunk = sorted.slice(i, i + 50);
    const p = newPeriod({ index: blocks50.length + 1, start: chunk[0].date, end: chunk[chunk.length - 1].date, partial: chunk.length < 50 });
    for (const e of chunk) add(p, e);
    blocks50.push(p);
  }
  return {
    name,
    entries: sorted.length,
    dateMin: sorted[0]?.date.slice(0, 10) ?? null,
    dateMax: sorted[sorted.length - 1]?.date.slice(0, 10) ?? null,
    rounds388: rounds(defs388, 388),
    rounds688: rounds(defs688, 688),
    daily,
    blocks50,
  };
}

const scopes = { state: scopeData("Telangana", entries) };
const districts = new Map();
const acs = new Map();
for (const e of entries) {
  const d = districts.get(e.district) ?? [];
  d.push(e); districts.set(e.district, d);
  const a = acs.get(e.ac) ?? [];
  a.push(e); acs.set(e.ac, a);
}
for (const [d, list] of districts) scopes[`d:${d}`] = scopeData(d, list);
for (const [a, list] of acs) scopes[`a:${a}`] = scopeData(`AC ${a}`, list);

const bundle = {
  version: "tg-rounds-2026-10-22-v2",
  source: "TG-2028-AC-Swing_19Oct Updated (1).xlsx · Data sheet",
  parties: PARTIES,
  entries: entries.length,
  dateMin: entries[0]?.date.slice(0, 10) ?? null,
  dateMax: entries[entries.length - 1]?.date.slice(0, 10) ?? null,
  roundBasis: "Global chronological rounds; district/assembly scopes retain the same global round membership and use their own denominators.",
  modelAssumptions: {
    recalled2023Options: ["BRS", "Congress", "BJP", "AIMIM", "NOTA"],
    absentRecallParties: ["TDP", "JSP"],
    absentRecallPolicy: "TDP and JSP are absent from the recalled-2023 answer options; their recall share is recorded as zero, not inferred.",
    projection: "2023 actual + (2028 intention share − recalled 2023 share); floor negatives; normalise the seven-party vector to 100%.",
    others: "Others is the residual component of the same seven-party vector; raw 2028 answers have no separate Others option.",
  },
  scopes,
};
fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({
  out: OUT, bytes: fs.statSync(OUT).size, entries: bundle.entries, dateMin: bundle.dateMin, dateMax: bundle.dateMax,
  state388: scopes.state.rounds388.length, state388Last: scopes.state.rounds388.at(-1)?.entries,
  state688: scopes.state.rounds688.length, state688Last: scopes.state.rounds688.at(-1)?.entries,
  stateDays: scopes.state.daily.length, stateBlocks: scopes.state.blocks50.length,
  scopes: Object.keys(scopes).length,
}, null, 1));
