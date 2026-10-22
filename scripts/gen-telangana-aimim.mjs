// Extend the compact Telangana four-group model with a separate AIMIM estimate.
//
// The four-group workbook prediction deliberately folds AIMIM into Others.
// This step keeps the three major-party estimates and the existing override
// intact, then moves a model-based AIMIM estimate out of the residual:
//
//   AIMIM 2028 = 2023 ECI AIMIM share
//              + [w × AC AIMIM swing + (1 − w) × district AIMIM swing] / 100
//   w = min(answered 2028, answered 2023) / (min + 30)
//   AC swing = AIMIM 2028 survey share − recalled AIMIM 2023 survey share
//
// The estimate is capped at the four-group Others value rather than divided
// arbitrarily.  The remaining Others is the same four-group residual minus
// that exact extraction, so all five displayed shares continue to total 1.
//
// Source: the supplied workbook at the model's 2026-10-01 cutoff.  Run after
// gen-telangana-oct26.mjs / gen-telangana-history.mjs:
//   node scripts/gen-telangana-aimim.mjs
import fs from "node:fs";
import path from "node:path";
import { read, utils } from "xlsx";

const ROOT = process.cwd();
const DATA_PATH = path.resolve(ROOT, "lib/data/telangana/oct26.json");
const HISTORY_PATH = path.resolve(ROOT, "lib/data/telangana/history.json");
const XLSX_PATH = process.env.TG_SOURCE_XLSX || path.resolve(ROOT, ".context/attachments/QhSZpw/TG-2028-AC-Swing_19Oct Updated (1).xlsx");
const PARTIES = ["BRS", "Congress", "BJP", "AIMIM", "Others"];
const SHRINK = 30;
const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const empty = () => Object.fromEntries(PARTIES.map((p) => [p, 0]));
const norm4 = (o) => {
  const sum = Number(o.BRS || 0) + Number(o.Congress || 0) + Number(o.BJP || 0) + Number(o.Others || 0);
  if (!(sum > 0)) return { BRS: 0, Congress: 0, BJP: 0, Others: 0 };
  return { BRS: o.BRS / sum, Congress: o.Congress / sum, BJP: o.BJP / sum, Others: o.Others / sum };
};
const norm5 = (o) => {
  const sum = PARTIES.reduce((s, p) => s + (o[p] || 0), 0);
  if (!(sum > 0)) return empty();
  return Object.fromEntries(PARTIES.map((p) => [p, (o[p] || 0) / sum]));
};
const split = (four, aimim) => {
  const a = Math.max(0, Math.min(aimim, four.Others));
  return { BRS: four.BRS, Congress: four.Congress, BJP: four.BJP, AIMIM: a, Others: four.Others - a };
};
const leaderOf = (shares) => {
  const sorted = [...PARTIES].sort((a, b) => (shares[b] || 0) - (shares[a] || 0));
  const top = shares[sorted[0]] || 0;
  const tied = sorted.filter((p) => Math.abs((shares[p] || 0) - top) < 1e-12);
  if (tied.length > 1) return { leader: tied[0], tied, marginPp: 0 };
  const second = sorted.find((p) => !tied.includes(p));
  return { leader: sorted[0] ?? null, tied: [], marginPp: second ? (top - (shares[second] || 0)) * 100 : 0 };
};
const weighted = (list, key) => {
  let weight = 0;
  const out = empty();
  for (const a of list) {
    if (!(a.votes2023 > 0)) continue;
    weight += a.votes2023;
    for (const p of PARTIES) out[p] += (a[key][p] || 0) * a.votes2023;
  }
  if (!weight) return empty();
  for (const p of PARTIES) out[p] /= weight;
  return out;
};

const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
if ((data.parties ?? []).includes("AIMIM")) {
  console.error("oct26.json already has AIMIM. Re-run gen-telangana-oct26.mjs first to restore the four-group base.");
  process.exit(1);
}
const history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
const wb = read(fs.readFileSync(XLSX_PATH));
const rows = utils.sheet_to_json(wb.Sheets.Data, { defval: "", raw: true, range: 0 });
const [cy, cm, cd] = data.cutoff.split("-").map(Number);
const cutoffSerial = Math.round(Date.UTC(cy, cm - 1, cd) / 86_400_000) + 25569;
const hist2023 = new Map((history.years["2023"]?.acs ?? []).map((a) => [a.no, a]));
const overrideByAc = new Map((data.overrides ?? []).map((o) => [o.acNo, o]));

const rawByAc = new Map();
const rawByDistrict = new Map();
for (const r of rows) {
  if (Number(r["Entry Date"]) < cutoffSerial) continue;
  const ac = Number(r["AC No"]);
  const district = String(r["District"] ?? "").trim();
  const v28 = String(r["2028 Vote"] ?? "").trim();
  const v23 = String(r["2023 Vote"] ?? "").trim();
  const add = (map, key) => {
    let x = map.get(key);
    if (!x) map.set(key, (x = { aimim28: 0, aimim23: 0 }));
    if (v28 === "AIMIM") x.aimim28 += 1;
    if (v23 === "AIMIM") x.aimim23 += 1;
  };
  add(rawByAc, ac);
  add(rawByDistrict, district);
}
const stateRaw = [...rawByAc.values()].reduce((s, x) => ({ aimim28: s.aimim28 + x.aimim28, aimim23: s.aimim23 + x.aimim23 }), { aimim28: 0, aimim23: 0 });

const perAc = new Map();
const caps = [];
const capZero = [];
for (const a of data.acs) {
  const raw = rawByAc.get(a.no) ?? { aimim28: 0, aimim23: 0 };
  const answer28 = Number(a.answered2028 || 0);
  const answer23 = Number(a.answeredRecall2023 || 0);
  const acSwing = answer28 && answer23 ? (raw.aimim28 / answer28 - raw.aimim23 / answer23) * 100 : 0;
  const n = Math.min(answer28, answer23);
  const w = n > 0 ? n / (n + SHRINK) : 0;

  const districtAcs = data.acs.filter((x) => x.district === a.district);
  const draw = rawByDistrict.get(a.district) ?? { aimim28: 0, aimim23: 0 };
  const dAnswer28 = districtAcs.reduce((s, x) => s + Number(x.answered2028 || 0), 0);
  const dAnswer23 = districtAcs.reduce((s, x) => s + Number(x.answeredRecall2023 || 0), 0);
  let districtSwing = dAnswer28 && dAnswer23 ? (draw.aimim28 / dAnswer28 - draw.aimim23 / dAnswer23) * 100 : 0;
  if (!(dAnswer28 && dAnswer23)) {
    const sAnswer28 = data.acs.reduce((s, x) => s + Number(x.answered2028 || 0), 0);
    const sAnswer23 = data.acs.reduce((s, x) => s + Number(x.answeredRecall2023 || 0), 0);
    districtSwing = sAnswer28 && sAnswer23 ? (stateRaw.aimim28 / sAnswer28 - stateRaw.aimim23 / sAnswer23) * 100 : 0;
  }
  const usedSwing = w * acSwing + (1 - w) * districtSwing;
  const actualAimim = Math.max(0, Number(hist2023.get(a.no)?.detail?.AIMIM ?? 0));
  const estimate = Math.max(0, actualAimim + usedSwing / 100);
  const four = norm4(a.prediction);
  let prediction;
  if (a.override) {
    // Preserve the exact prediction-only override (Kodangal 50–50).
    const ov = norm4(overrideByAc.get(a.no)?.predictionShares ?? a.prediction);
    prediction = { ...ov, AIMIM: 0, Others: ov.Others };
  } else {
    const aimim = Math.min(estimate, four.Others);
    prediction = norm5(split(four, aimim));
    if (estimate > four.Others + 1e-12) caps.push({ acNo: a.no, name: a.name, estimate, others: four.Others });
    if (four.Others === 0) capZero.push(a.no);
  }
  const actualFour = norm4(a.actual);
  const actual = norm5(split(actualFour, actualAimim));
  if (actualAimim > actualFour.Others + 1e-12) caps.push({ acNo: a.no, name: a.name, estimate: actualAimim, others: actualFour.Others, kind: "actual" });
  const lead = leaderOf(prediction);
  perAc.set(a.no, { ...a, actual, prediction, aimimEstimate: estimate, aimimUsedSwingPp: usedSwing, leader: lead.tied.length > 1 ? "Tie" : lead.leader, tied: lead.tied, marginPp: round6(lead.marginPp) });
}

const acs = data.acs.map((a) => {
  const enriched = perAc.get(a.no);
  const lead = leaderOf(enriched.prediction);
  return {
    ...a,
    actual: Object.fromEntries(PARTIES.map((p) => [p, round6(enriched.actual[p])])),
    prediction: Object.fromEntries(PARTIES.map((p) => [p, round6(enriched.prediction[p])])),
    leader: lead.tied.length > 1 ? "Tie" : lead.leader,
    tied: lead.tied,
    marginPp: round6(lead.marginPp),
    aimimEstimate: round6(enriched.aimimEstimate),
    aimimUsedSwingPp: round6(enriched.aimimUsedSwingPp),
  };
});

const districts = data.districts.map((d) => {
  const members = acs.filter((a) => a.district === d.name);
  const actual = weighted(members, "actual");
  const prediction = weighted(members, "prediction");
  const lead = leaderOf(prediction);
  return {
    ...d,
    votes2023: members.reduce((s, a) => s + a.votes2023, 0),
    actual: Object.fromEntries(PARTIES.map((p) => [p, round6(actual[p])])),
    prediction: Object.fromEntries(PARTIES.map((p) => [p, round6(prediction[p])])),
    answered2028: members.reduce((s, a) => s + a.answered2028, 0),
    leader: lead.tied.length > 1 ? "Tie" : lead.leader,
    tied: lead.tied,
    marginPp: round6(lead.marginPp),
  };
});

const actual = weighted(acs, "actual");
const prediction = weighted(acs, "prediction");
const stateLead = leaderOf(prediction);
const changePp = Object.fromEntries(PARTIES.map((p) => [p, round6((prediction[p] - actual[p]) * 100)]));
const leads = {};
for (const a of acs) {
  const l = leaderOf(a.prediction);
  const key = l.tied.length > 1 ? "Tie" : l.leader ?? "Tie";
  leads[key] = (leads[key] ?? 0) + 1;
}
const overrides = data.overrides.map((o) => ({
  ...o,
  predictionShares: { ...o.predictionShares, AIMIM: 0 },
}));
const out = {
  ...data,
  parties: PARTIES,
  labels: { ...data.labels, AIMIM: "AIMIM" },
  othersBasis: "BSP+Janasena+NOTA+IND+all remaining; AIMIM is displayed separately; raw survey Others=TDP+Janasena+AIMIM",
  aimimExtension: {
    version: "tg-aimim-extension-v1",
    method: "2023 ECI AIMIM actual share + (AIMIM 2028 intention share − recalled AIMIM 2023 share), AC swing shrunk to the district swing with w = min(n2028,n2023)/(min+30). Extracted from the four-group Others; capped at the four-group residual; no division or relabeling.",
    baseline: "2023 ECI AIMIM share",
    cutoff: data.cutoff,
    shrinkFactor: SHRINK,
    source: "TG-2028-AC-Swing_19Oct Updated (1).xlsx · Data sheet; history.json 2023 ECI detail",
    cappedCount: caps.length,
    cappedAcs: caps.map((x) => x.acNo),
    zeroResidualAcs: capZero,
    overrideAcs: data.overrides.map((o) => o.acNo),
    note: "AIMIM is extracted only where the existing four-group Others residual has room. Override seats retain their exact prediction. AIMIM is not a raw survey share.",
  },
  counts: { ...data.counts, acs: acs.length, districts: districts.length },
  statewide: {
    ...data.statewide,
    acs: acs.length,
    votes2023: acs.reduce((s, a) => s + a.votes2023, 0),
    actual: Object.fromEntries(PARTIES.map((p) => [p, round6(actual[p])])),
    prediction: Object.fromEntries(PARTIES.map((p) => [p, round6(prediction[p])])),
    answered2028: acs.reduce((s, a) => s + a.answered2028, 0),
    changePp,
    leads,
    leader: stateLead.tied.length > 1 ? "Tie" : stateLead.leader,
    tied: stateLead.tied,
    marginPp: round6(stateLead.marginPp),
  },
  districts,
  acs,
  overrides,
};
fs.writeFileSync(DATA_PATH, JSON.stringify(out));
console.log(JSON.stringify({
  path: DATA_PATH,
  cutoff: data.cutoff,
  acs: acs.length,
  caps: caps.length,
  capZero,
  overrides: out.overrides.map((o) => [o.acNo, o.predictionShares]),
  stateActual: out.statewide.actual,
  statePrediction: out.statewide.prediction,
  stateLeads: out.statewide.leads,
  aimimAcs: acs.filter((a) => a.prediction.AIMIM > 0).length,
  maxAimim: Math.max(...acs.map((a) => a.prediction.AIMIM)),
}, null, 1));
