/* Ads Desk parser, DTO and duplicate tests. */

import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { parseAdsDeskHtml } from "@/lib/ads-desk/parse";
import { buildAdsSocial } from "@/lib/ads-desk/client-dto";
import { publishVersion, saveDraft } from "@/lib/ads-desk/store";
import { getRegionMap, socialForCase, setRegionMapping, DEFAULT_REGION_MAP } from "@/lib/ads-desk/mapping";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const html = readFileSync("scripts/fixtures/ads-desk-small.html", "utf8");
const replaceOnce = (source: string, from: string, to: string) => source.replace(from, to);

console.log("\n1. Parser");
const parsed = parseAdsDeskHtml(html);
ok("REGIONS and SNAP parse", parsed.regions.length === 1 && parsed.snap.accounts.length === 1 && parsed.snap.pages.length === 1);
ok("campaign totals", parsed.regions[0].totals.accounts === 1 && parsed.regions[0].totals.campaigns === 2 && parsed.regions[0].totals.spend === 150.75);
ok("results and cost per result", parsed.regions[0].accounts[0].campaigns[0].results === 10 && parsed.regions[0].accounts[0].campaigns[0].costPerResult === 10.05);
ok("SNAP assignment pages", parsed.snap.pages[0].name === "Test Page");
ok("SNAP daily summed", parsed.snap.daily["100"][0] === 55.25 && parsed.snap.daily["100"][1] === 95.5);
ok("light and dark colors", parsed.regions[0].colors.band === "#0b8a3e" && parsed.regions[0].colors.darkBand === "#4fc982");
ok("sha is stable", parseAdsDeskHtml(html).sha256 === parsed.sha256);

console.log("\n2. Literal-only rejection");
function inSnap(from: string, to: string): string {
  const index = html.indexOf("const SNAP = ");
  return html.slice(0, index) + html.slice(index).replace(from, to);
}
const cases: [string, string][] = [
  ["function call", inSnap("100.5,200", "foo(),200")],
  ["identifier", inSnap("100.5,200", "someValue,200")],
  ["member expression", inSnap("100.5,200", "obj.value,200")],
  ["template expression", inSnap("\"Campaign One\"", "`Campaign ${1}`")],
];
for (const [name, source] of cases) {
  try { parseAdsDeskHtml(source); ok(`rejects ${name}`, false); }
  catch (error) { ok(`rejects ${name}`, error instanceof Error && /Unsupported content|Could not parse/.test(error.message), error instanceof Error ? error.message : String(error)); }
}
try { parseAdsDeskHtml(replaceOnce(html, "\"label\":\"TN 2026\",", "")); ok("missing field errors name the field", false); }
catch (error) { ok("missing field errors name the field", error instanceof Error && /label/.test(error.message), error instanceof Error ? error.message : ""); }
try { parseAdsDeskHtml("x".repeat(15 * 1024 * 1024 + 1)); ok("rejects over 15 MB", false); }
catch (error) { ok("rejects over 15 MB", error instanceof Error && /15 MB/.test(error.message)); }

console.log("\n3. Client DTO and duplicate SHA");
const client = buildAdsSocial(parsed, "tn2026", false);
const clientText = JSON.stringify(client).toLowerCase();
ok("client sees no spend", !/spend|costperresult|cost_per_result|cpm|billing|adsmanager/.test(clientText));
ok("client sees no rupee", !clientText.includes("₹"));
ok("client sees no account or business id", !clientText.includes("test business") && !clientText.includes("\"100\""));
const owner = buildAdsSocial(parsed, "tn2026", true);
ok("owner sees spend and cost", owner.totals.spend === 150.75 && owner.accounts[0].campaigns[0].costPerResult === 10.05);

(async () => {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const mongo = new MongoClient(uri); await mongo.connect();
    const db = mongo.db(process.env.MONGODB_DB || "reachout");
    await db.collection("ads_versions").deleteMany({});
    const versionId = await saveDraft(parsed, "small.html", "tester");
    await publishVersion(versionId);
    try { await saveDraft(parsed, "small.html", "tester"); ok("duplicate sha rejected against active", false); }
    catch (error) { ok("duplicate sha rejected against active", error instanceof Error && /already the active version/.test(error.message)); }
    console.log("\n4. Region mapping");
    const map = await getRegionMap();
    ok("default mapping seeded", map.tn2026 === "tamil-nadu" && map.ka2028 === "karnataka-2023");
    ok("defaults cover every fixture region", Object.keys(DEFAULT_REGION_MAP).every((key) => Boolean(map[key])));
    await setRegionMapping("tn2026", "telangana", "tester");
    ok("mapping change removes the old case data immediately", (await socialForCase("tamil-nadu", false)).length === 0);
    const changed = await getRegionMap();
    ok("one region maps to one case study", changed.tn2026 === "telangana");
    ok("case can have several regions", (await socialForCase("telangana", false)).length >= 1);
    await setRegionMapping("tn2026", "tamil-nadu", "tester");
    const clientSocial = await socialForCase("tamil-nadu", false);
    ok("client social has no cost/ids", !/spend|costperresult|₹|test business|"100"/i.test(JSON.stringify(clientSocial)));
    const ownerSocial = await socialForCase("tamil-nadu", true);
    ok("owner social has spend", ownerSocial[0]?.totals.spend === 150.75);
    await mongo.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
