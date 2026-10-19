/* =====================================================================
   Telangana calculation + data-integrity audit.

   Run: npx tsx scripts/telangana.test.ts

   Pure checks over the bundled baseline and the pure helpers. No MongoDB,
   no network and no writes.
   ===================================================================== */

import fs from "node:fs";
import path from "node:path";
import baselineJson from "@/lib/data/telangana/baseline.json";
import {
  parseAcNumber, acNameFromCell, share, ppDiff, partyShares, leadingParty, combineAcs,
  fmtPct, fmtPp, SMALL_SAMPLE, type Baseline,
} from "@/lib/telangana/model";
import { canonicalTgParty, isKnownTgParty, TG_PARTIES, PARTY_META } from "@/lib/telangana/parties";
import { brandAsset, brandMarker, ALL_BRAND_LABELS } from "@/lib/telangana/brands";
import { mapScenarioRow } from "@/lib/telangana/store";

const base = baselineJson as unknown as Baseline;

let pass = 0, fail = 0;
const results: { ok: boolean; name: string; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++; else fail++;
  results.push({ ok, name, detail });
}
const near = (a: number, b: number, tol = 0.0001) => Math.abs(a - b) <= tol;

/* ---------------- 1. party registry ---------------- */
check("Congress → INC", canonicalTgParty("Congress") === "INC");
check("INC stays INC", canonicalTgParty("INC") === "INC");
check("Janasena → JSP", canonicalTgParty("Janasena") === "JSP");
check("JnP → JSP", canonicalTgParty("JnP") === "JSP");
check("TRS → BRS", canonicalTgParty("TRS") === "BRS");
check("BHRS → BRS", canonicalTgParty("BHRS") === "BRS");
check("unknown label → Others (never guessed)", canonicalTgParty("Some Local Front") === "Others");
check("blank → Others", canonicalTgParty("") === "Others");
check("known-label test", isKnownTgParty("Congress") && !isKnownTgParty("Some Local Front"));
check("8 party series", TG_PARTIES.length === 8);
check("distinct party colours", new Set(Object.values(PARTY_META).map((p) => p.color)).size === 8);
check("BRS is not reused for another party",
  Object.values(PARTY_META).filter((p) => p.color === PARTY_META.BRS.color).length === 1);

/* ---------------- 2. AC parsing ---------------- */
check("'57. ముషీరాబాద్' → 57", parseAcNumber("57. ముషీరాబాద్") === 57);
check("'57' → 57", parseAcNumber("57") === 57);
check("'119' → 119", parseAcNumber("119") === 119);
check("'120' out of range → null", parseAcNumber("120") === null);
check("'0' → null", parseAcNumber("0") === null);
check("empty → null", parseAcNumber("") === null);
check("name extraction keeps the Telugu name", acNameFromCell("57. ముషీరాబాద్") === "ముషీరాబాద్");

/* ---------------- 3. scope totals ---------------- */
check("119 assemblies", base.acs.length === 119);
check("33 analytical groups", base.districts.length === 33);
check("30,000 scenario rows", base.totals.scenarioRows === 30_000);
check("27,460 answered 2028 rows", base.totals.answered2028 === 27_460);
check("2,540 blank 2028 rows", base.totals.blank2028 === 2_540);
check("5,090 original entries", base.totals.sourceEntries === 5_090);
check("22 crosswalk conflicts preserved", base.totals.conflictRows === 22);
check("district workbook matches AC re-aggregation", base.totals.districtMismatch === 0);

const all = combineAcs(base.acs);
check("answered counts sum to 27,460", all.answered2028 === 27_460);
check("BRS answered 15,837", all.a2028.BRS === 15_837);
check("INC answered 5,711", all.a2028.INC === 5_711);
check("BJP answered 5,022", all.a2028.BJP === 5_022);
check("AIMIM answered 65", all.a2028.AIMIM === 65);
check("TDP answered 484", all.a2028.TDP === 484);
check("JSP answered 341", all.a2028.JSP === 341);
check("2028 Others not offered (0 recorded)", (all.a2028.Others ?? 0) === 0);
check("2028 NOTA not offered (0 recorded)", (all.a2028.NOTA ?? 0) === 0);

/* ---------------- 4. share maths ---------------- */
const shares = partyShares(all.a2028, [...TG_PARTIES], all.answered2028);
const sh = (p: string) => shares.find((s) => s.party === p)?.share ?? null;
check("BRS share 57.67%", near(sh("BRS") ?? -1, 57.67297887836854, 0.0001), String(sh("BRS")));
check("INC share 20.80%", near(sh("INC") ?? -1, 20.797523670793883, 0.0001));
check("BJP share 18.29%", near(sh("BJP") ?? -1, 18.288419519300077, 0.0001));
check("AIMIM share 0.24%", near(sh("AIMIM") ?? -1, 0.2367086664238893, 0.0001));
check("TDP share 1.76%", near(sh("TDP") ?? -1, 1.7625637290604522, 0.0001));
check("JSP share 1.24%", near(sh("JSP") ?? -1, 1.2418057603787328, 0.0001));
check("shares sum to 100 (±0.0001)", near(shares.reduce((s, x) => s + (x.share ?? 0), 0), 100, 0.001));
check("zero denominator → null", share(0, 0) === null && share(5, 0) === null);
check("null denominator format is an em dash", fmtPct(null) === "—");
check("pp difference", ppDiff(20, 25) === 5);
check("pp difference with null", ppDiff(null, 25) === null);

/* ---------------- 5. multi-select aggregation ---------------- */
const a = base.acs.find((x) => x.no === 1)!;
const b = base.acs.find((x) => x.no === 2)!;
const pair = combineAcs([a, b]);
const pairShares = partyShares(pair.a2028, [...TG_PARTIES], pair.answered2028);
const meanOfAcs = partyShares(a.a2028, [...TG_PARTIES], a.answered2028)[0].share!;
check("multi-select sums counts before dividing",
  near(pairShares[0].share!, ((a.a2028.BRS ?? 0) + (b.a2028.BRS ?? 0)) / (a.answered2028 + b.answered2028) * 100, 0.0001));
check("multi-select is not the mean of AC percentages",
  !near(pairShares[0].share!, (meanOfAcs + (partyShares(b.a2028, [...TG_PARTIES], b.answered2028)[0].share ?? 0)) / 2, 0.01));

/* ---------------- 6. leading party + ties ---------------- */
const lead = leadingParty(all.a2028, [...TG_PARTIES]);
check("statewide lead is BRS", lead.party === "BRS");
check("no tie statewide", lead.tie.length === 0);
const tie = leadingParty({ BRS: 10, INC: 10, BJP: 1 }, ["BRS", "INC", "BJP"]);
check("tie reported as a shared lead", tie.tie.length === 2);
const none = leadingParty({ BRS: 0, INC: 0 }, ["BRS", "INC"]);
check("zero counts → no lead and null share", none.party === null && none.share === null);

/* ---------------- 7. historical contract ---------------- */
const sw = Object.fromEntries(base.statewide.map((r) => [r.party, r]));
check("2018 total 20,695,458", base.statewide.reduce((s, r) => s + r.v2018, 0) === 20_695_458);
check("2023 total 23,439,945", base.statewide.reduce((s, r) => s + r.v2023, 0) === 23_439_945);
check("BRS 2018→2023 swing −9.5271", near(sw.BRS.swing2018to2023, -9.52710654451019, 0.0001));
check("INC 2018→2023 swing +10.9750", near(sw.INC.swing2018to2023, 10.975046810363098, 0.0001));
check("BRS 2023→2028 survey difference +20.3263", near(sw.BRS.diff2023to2028, 20.32627861947288, 0.0001));
check("INC 2023→2028 survey difference −18.6046", near(sw.INC.diff2023to2028, -18.604586701052128, 0.0001));
check("2018 BJP share ≈7.01% in this source (tracker uses 6.98%)", near(sw.BJP.s2018 * 100, 7.01, 0.01), `${(sw.BJP.s2018 * 100).toFixed(4)}%`);

/* ---------------- 8. geography ---------------- */
const ids = base.acs.map((x) => x.no);
check("119 unique AC ids", new Set(ids).size === 119);
check("AC ids are exactly 1..119", [...ids].sort((x, y) => x - y).every((v, i) => v === i + 1));
check("every AC has a group", base.acs.every((x) => !!x.group));
check("groups cover every AC exactly once", base.districts.reduce((s, d) => s + d.acs.length, 0) === 119);
check("district totals equal their AC sums",
  base.districts.every((d) => {
    const acs = base.acs.filter((x) => x.group === d.group);
    return acs.reduce((s, x) => s + x.total2023, 0) === d.total2023;
  }));

const geoPath = path.join(process.cwd(), "public/telangana/telangana-ac.geojson");
check("simplified geometry exists", fs.existsSync(geoPath));
if (fs.existsSync(geoPath)) {
  const geo = JSON.parse(fs.readFileSync(geoPath, "utf8")) as { features: { properties: { acNo: number } }[] };
  const geoIds = geo.features.map((f) => f.properties.acNo);
  check("geometry has 119 features", geo.features.length === 119);
  check("geometry joins each AC exactly once", new Set(geoIds).size === 119 && geoIds.every((n) => ids.includes(n)));
}

/* ---------------- 9. crosswalk / age / device ---------------- */
check("crosswalk covers 119 ACs", base.crosswalk.length === 119);
check("22 exact-string conflicts", base.crosswalk.filter((c) => !c.match).length === 22);
check("age includes a missing band", base.age.some((r) => r.band === "(missing)"));
check("age answered sums to 27,460", base.age.reduce((s, r) => s + r.answered, 0) === 27_460);
check("30 device brand labels", base.brands.length === 30);
check("device entries sum to 5,090", base.brands.reduce((s, b) => s + b.entries, 0) === 5_090);
check("all 30 brand labels resolve to an asset", ALL_BRAND_LABELS.length === 30 && base.brands.every((b) => !!brandAsset(b.brand)));
check("unknown brand falls back to the neutral badge", brandAsset("Not A Brand").brand === "Unknown");
check("brand marker URL points at the pack", brandMarker("Samsung").src.startsWith("/brand-logos/marker-svg/"));
check("brand marker is case-insensitive", brandAsset("samsung").brand === "Samsung");

/* ---------------- 10. import mapping never uses adjusted C/D ---------------- */
const row = mapScenarioRow({
  "Survey (2028 vote, English)": "Congress",
  "2023 adjusted vote (English)": "BJP",
  "Original 2023 vote (English)": "BRS",
  Age: "26-35",
  "Assembly Constituency": "57. ముషీరాబాద్",
  "AC District (from AC column)": "Hyderabad",
  "Mobile Brand": "Vivo",
  "Entry ID": "5100",
  "Source Excel Row": 2,
  "Record Basis": "Replicated; 2023 adjusted",
}, "imp1", 0);
check("mapper uses column B for 2028 party", row.party === "INC" && row.partyRaw === "Congress");
check("adjusted 2023 is preserved but not used as party", row.adjusted2023Raw === "BJP" && row.party === "INC");
check("mapper parses the leading AC number", row.ac === 57);
check("mapper keeps the group and brand", row.group === "Hyderabad" && row.brand === "Vivo");
check("mapper stores provenance", row.sourceEntryId === "5100" && row.sourceExcelRow === 2 && row.scenarioRowId.length === 24);
check("duplicate source rows get distinct scenario ids",
  mapScenarioRow({ "Survey (2028 vote, English)": "BRS", "Assembly Constituency": "57. x", "Source Excel Row": 2 }, "imp1", 0).scenarioRowId !==
  mapScenarioRow({ "Survey (2028 vote, English)": "BRS", "Assembly Constituency": "57. x", "Source Excel Row": 2 }, "imp1", 1).scenarioRowId);

/* ---------------- 11. public payload has no private fields ---------------- */
const payload = JSON.stringify(base);
const forbidden = ["User IP", "Unique Generated User ID", "User Agent", "User Journey information", "Entry ID", "Geolocation Details"];
check("public baseline exposes no private fields", forbidden.every((f) => !payload.includes(f)));
check("small-sample threshold documented", SMALL_SAMPLE === 30);
check("small-sample detection uses answered rows", base.acs.some((x) => x.answered2028 > 0 && x.answered2028 < SMALL_SAMPLE));

/* ---------------- report ---------------- */
const groups = results.reduce<Record<string, { ok: number; bad: number }>>((m, r) => {
  const k = r.name.split(" ")[0];
  m[k] = m[k] ?? { ok: 0, bad: 0 };
  if (r.ok) m[k].ok++; else m[k].bad++;
  return m;
}, {});
for (const r of results) if (!r.ok) console.log(`FAIL: ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
console.log(`\nTelangana audit: ${pass} passed, ${fail} failed, ${results.length} checks`);
console.log(`Sections: ${Object.keys(groups).length}`);
process.exit(fail ? 1 : 0);
