// Build the bundled Telangana dataset for the October workbook replacement.
// Source: the validated aggregates in the Conductor update pack.
//   TG_UPDATE_PACK=/path/to/Telangana_Update node scripts/gen-telangana-oct26.mjs
import fs from "node:fs";
import path from "node:path";

const PACK = process.env.TG_UPDATE_PACK || path.resolve(process.cwd(), ".context/telangana-update/Telangana_Update");
const OUT = path.resolve(process.cwd(), "lib/data/telangana/oct26.json");
const read = (p) => JSON.parse(fs.readFileSync(path.join(PACK, p), "utf8"));

const assemblies = read("data/aggregates/assembly_results.json");
const districtsIn = read("data/aggregates/district_results.json");
const statewideIn = read("data/aggregates/statewide_results.json");
const overrides = read("data/prediction_overrides.json");
const contract = read("data/import_contract.json");
const audit = read("docs/audit.json");

const round6 = (n) => (Number.isFinite(n) ? Math.round(n * 1e6) / 1e6 : 0);
const shares = (o) => ({ BRS: round6(o.BRS), Congress: round6(o.Congress), BJP: round6(o.BJP), Others: round6(o.Others) });

const acs = assemblies
  .map((a) => ({
    no: a.acNo,
    name: a.acName,
    district: a.district,
    zone: a.zone ?? "",
    votes2023: a.votes2023,
    actual: shares(a.actual2023Shares),
    prediction: shares(a.prediction2028Shares),
    raw: shares(a.survey.raw2028Shares),
    answered2028: a.survey.answered2028,
    answeredRecall2023: a.survey.answeredRecall2023,
    totalRows: a.survey.totalRows,
    leader: a.leader,
    tied: a.tiedParties ?? [],
    marginPp: round6(a.marginPp),
    sourceLeader: a.sourceLeader2028 ?? null,
    override: a.override ? { basis: a.override.basis, reason: a.override.reason, version: a.override.version } : null,
  }))
  .sort((x, y) => x.no - y.no);

const districts = districtsIn
  .map((d) => ({
    name: d.name,
    acs: acs.filter((a) => a.district === d.name).map((a) => a.no),
    votes2023: d.weightTotal2023Votes,
    actual: shares(d.actual2023Shares),
    prediction: shares(d.prediction2028Shares),
    raw: shares(d.raw2028Shares),
    answered2028: d.answered2028,
    leader: d.leader,
    tied: d.tiedParties ?? [],
    marginPp: round6(d.marginPp),
  }))
  .sort((x, y) => x.name.localeCompare(y.name));

const bundle = {
  version: contract.version,
  sourceFile: contract.sourceFile,
  sourceHash: contract.sha256,
  cutoff: contract.defaultCutoff.slice(0, 10),
  shrinkFactor: contract.shrinkFactor,
  parties: contract.parties,
  labels: { Congress: "Congress+" },
  congressBasis: contract.congressBasis,
  othersBasis: contract.othersBasis,
  devicesAvailable: false,
  pinDataAvailable: false,
  counts: {
    sourceIds: audit.uniqueEntryIds ?? 5090,
    cutoffRows: audit.filteredRows ?? 4768,
    answered2028: audit.rawSurveyStatewide ? 4401 : 4401,
    blank2028: 367,
    answeredRecall2023: 3940,
    blankRecall2023: 828,
    acs: acs.length,
    districts: districts.length,
  },
  statewide: {
    name: "Telangana",
    acs: statewideIn.acCount,
    votes2023: statewideIn.weightTotal2023Votes,
    actual: shares(statewideIn.actual2023Shares),
    prediction: shares(statewideIn.prediction2028Shares),
    raw: shares(statewideIn.raw2028Shares),
    answered2028: statewideIn.answered2028,
    changePp: shares(statewideIn.changePp),
    leads: statewideIn.projectedLeads,
    leader: statewideIn.leader,
    tied: statewideIn.tiedParties ?? [],
    marginPp: round6(statewideIn.marginPp),
  },
  districts,
  acs,
  overrides: overrides.overrides,
  overrideMeta: {
    predictionOnly: overrides.predictionOnly,
    congressLeadAssertions: overrides.congressLeadAssertions,
    historicalKodangalWinner: overrides.historicalKodangalWinner,
    note: overrides.note,
  },
  overrideVersion: overrides.version,
};

fs.writeFileSync(OUT, JSON.stringify(bundle));
console.log(JSON.stringify({
  out: OUT,
  bytes: fs.statSync(OUT).size,
  acs: acs.length,
  districts: districts.length,
  statewide: bundle.statewide,
  ties: acs.filter((a) => a.tied.length).map((a) => [a.no, a.name, a.tied, a.leader]),
  overrides: acs.filter((a) => a.override).map((a) => [a.no, a.name]),
  jubileeSourceLeader: acs.find((a) => a.no === 61)?.sourceLeader,
  jubileeLeader: acs.find((a) => a.no === 61)?.leader,
  congressLeads: [24, 85, 89, 92, 93].map((no) => [no, acs.find((a) => a.no === no)?.leader]),
}, null, 1));
