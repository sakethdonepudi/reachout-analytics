/* Ads Desk parser, DTO and duplicate tests. */

import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";
import { parseAdsDeskHtml } from "@/lib/ads-desk/parse";
import { buildAdsSocial } from "@/lib/ads-desk/client-dto";
import { publishVersion, saveDraft } from "@/lib/ads-desk/store";
import { getRegionMap, socialForCase, setRegionMapping, DEFAULT_REGION_MAP } from "@/lib/ads-desk/mapping";
import { adsManagerAdsets, adsManagerAds, adsManagerCampaigns, adsManagerForCampaign, billing, pageLink, validMetaId } from "@/lib/ads-desk/links";
import { withOwnerLinks } from "@/lib/ads-desk/owner-view";

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
ok("SNAP daily summed", parsed.snap.daily["123456789012345"][0] === 55.25 && parsed.snap.daily["123456789012345"][1] === 95.5);
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
ok("client sees no account or business id", !clientText.includes("test business") && !clientText.includes("123456789012345") && !clientText.includes("120240000000001"));
const owner = buildAdsSocial(parsed, "tn2026", true);
ok("owner sees spend and cost", owner.totals.spend === 150.75 && owner.accounts[0].campaigns[0].costPerResult === 10.05);
ok("owner sees ad set and ad counts", owner.accounts[0].campaigns[0].adsets === 2 && owner.accounts[0].campaigns[0].ads === 2 && owner.accounts[0].campaigns[1].ads === null);
const accountId = "123456789012345", campaignId = "120240000000001", pageId = "100368172755950";
ok("owner account link is exact", owner.accounts[0].href === `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}`);
ok("owner billing link is exact", owner.accounts[0].billingHref === `https://business.facebook.com/billing_hub/accounts/details?asset_id=${accountId}`);
ok("owner all ad set and ad links are exact", owner.accounts[0].allAdsetsHref === `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${accountId}` && owner.accounts[0].allAdsHref === `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountId}`);
ok("owner campaign link is exact", owner.accounts[0].campaigns[0].href === `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${campaignId}`);
ok("owner campaign ad set link is exact", owner.accounts[0].campaigns[0].adsetsHref === `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${accountId}&selected_campaign_ids=${campaignId}`);
ok("owner campaign ad link is exact", owner.accounts[0].campaigns[0].adsHref === `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${accountId}&selected_campaign_ids=${campaignId}`);
ok("campaign without ads has no ad link", owner.accounts[0].campaigns[1].adsHref === null);
const linked = withOwnerLinks(parsed);
ok("owner directory links are exact", linked.snap.pages[0].href === `https://www.facebook.com/${pageId}` && linked.snap.pages[0].insightsHref === `https://business.facebook.com/latest/insights/overview?asset_id=${pageId}` && linked.snap.pages[0].adLibraryHref === `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&view_all_page_id=${pageId}`);
ok("malicious ids produce no link", validMetaId("12345\"><script>alert(1)</script>") === null
  && adsManagerCampaigns('12345\"><script>alert(1)</script>') === null
  && adsManagerForCampaign(accountId, "12345' onmouseover='alert(1)") === null
  && adsManagerAdsets(accountId, "javascript:alert(1)") === null
  && adsManagerAds(accountId, "1 OR 1=1") === null
  && billing("100\"><svg/onload=1") === null
  && pageLink("1".repeat(21)) === null);
const invalid = parseAdsDeskHtml(replaceOnce(html, "\"123456789012345\"", "\"abc\""));
const invalidOwner = JSON.stringify(buildAdsSocial(invalid, "tn2026", true));
ok("invalid account ids produce no link", !/adsmanager|billing_hub|act=/.test(invalidOwner));
const dataPages = ["components/case-studies/tamil-nadu/tamil-nadu-dashboard.tsx", "components/case-studies/telangana/telangana-dashboard.tsx", "components/case-studies/shared/analysis-shell.tsx"];
ok("data pages have no decorative classes", dataPages.every((file) => !/radial-gradient|backdrop-blur|glow/i.test(readFileSync(file, "utf8"))));

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
    ok("client social has no cost/ids", !/spend|costperresult|₹|test business|123456789012345|120240000000001|adsmanager|billing_hub|act=/i.test(JSON.stringify(clientSocial)));
    const ownerSocial = await socialForCase("tamil-nadu", true);
    ok("owner social has spend and links", ownerSocial[0]?.totals.spend === 150.75 && /adsmanager\.facebook\.com/.test(JSON.stringify(ownerSocial)) && /billing_hub/.test(JSON.stringify(ownerSocial)));
    await mongo.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
