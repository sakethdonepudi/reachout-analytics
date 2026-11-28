/**
 * Client social payload privacy.
 *
 * A source account may carry its numeric Meta id in acct_name. The client DTO
 * must never put a 14-17 digit id in a name, key, row id, URL or campaign
 * field. Owner payloads keep the real id and business name.
 * Real ad account names, business names, ids, money and Ads Manager links
 * must never reach a client payload.
 */
import assert from "node:assert/strict";
import { tnSocialFiltered, tnSocialMonthly, tnSocialOverview } from "@/lib/survey/tn-view-dto";
import { apSocialFiltered, apSocialOverview } from "@/lib/survey/ap-view-dto";
import { kaSocialFiltered, kaSocialOverview } from "@/lib/survey/ka-view-dto";
import { tgSocialFiltered, tgSocialOverview } from "@/lib/survey/tg-view-dto";
import { clientText } from "@/lib/survey/privacy";
import type { SurveyData } from "@/lib/survey/types";

let pass = 0;
const check = (name: string, fn: () => void) => { fn(); pass += 1; console.log(`  ✓ ${name}`); };

const ACCOUNT_ID = "345221824368981";
const NAMED_ID = "120200000000001";
const campaign = (id: string, name: string, reach: number) => ({ id, name, per: "Opinion poll", st: "Off", start: "2026-04-01", reach, impr: reach * 2, views: reach, clicks: 10, eng: 20 });
const data = {
  parties: ["TVK", "DMK+", "AIADMK+", "NTK", "Others"],
  regions: ["Tamil Nadu"],
  periods: {},
  actual: { "Tamil Nadu": { TVK: 35 } },
  ads: {
    label: "Meta ads",
    range: "April 2026",
    total: { n: 2, reach: 300, impr: 600, views: 300, clicks: 20, eng: 40 },
    accounts: [
      { acct: ACCOUNT_ID, acct_name: ACCOUNT_ID, business: "Secret Business", n: 1, reach: 200, impr: 400, views: 200, clicks: 10, eng: 20 },
      { acct: NAMED_ID, acct_name: "Named account", business: "Named Business", n: 1, reach: 100, impr: 200, views: 100, clicks: 10, eng: 20 },
    ],
    camps: {
      [ACCOUNT_ID]: [campaign("120210000000001", "Vanniyar campaign", 200)],
      [NAMED_ID]: [campaign("120210000000002", "Other campaign", 100)],
    },
    periods: {},
  },
  n_total: 1,
} as unknown as SurveyData;

(async () => {
  console.log("\n1. Client overview");
  const overview = await tnSocialOverview(data, false);
  const overviewText = JSON.stringify(overview);
  check("numeric acct_name becomes Ad account <rank>", () => {
    const account = overview.accounts.find((item) => item.key === "acct-1");
    assert.equal(account?.name, "Ad account 1");
    assert.equal(account?.id, undefined);
    assert.equal(account?.business, undefined);
    assert.equal(account?.href, undefined);
  });
  check("overview has no 14-17 digit number", () => assert.ok(!/\d{14,17}/.test(overviewText)));

  check("monthly series sums to every KPI total", () => {
    const monthly = tnSocialMonthly(data);
    const sum = (key: "reach" | "impressions" | "views" | "clicks" | "engagements") => monthly.reduce((total, row) => total + row[key], 0);
    assert.equal(sum("reach"), overview.totals.reach);
    assert.equal(sum("impressions"), overview.totals.impressions);
    assert.equal(sum("views"), overview.totals.views);
    assert.equal(sum("clicks"), overview.totals.clicks);
    assert.equal(sum("engagements"), overview.totals.engagements);
    assert.equal(monthly.reduce((total, row) => total + row.campaigns, 0), overview.totals.campaigns);
  });

  console.log("\n1b. Andhra Pradesh client overview");
  const apData = {
    parties: ["NDA", "YSRCP", "INC", "Others"],
    regions: ["Andhra Pradesh"],
    periods: {},
    actual: { "Andhra Pradesh": { NDA: 55.3 } },
    ads: {
      label: "Meta ads", range: "2023 – 2026",
      total: { n: 2, reach: 300, impr: 600, views: 300, clicks: 20, eng: 40 },
      accounts: [
        { acct: ACCOUNT_ID, acct_name: ACCOUNT_ID, business: "Secret Business", n: 1, reach: 200, impr: 400, views: 200, clicks: 10, eng: 20 },
        { acct: NAMED_ID, acct_name: "Districts AIADMK", business: "Named Business", n: 1, reach: 100, impr: 200, views: 100, clicks: 10, eng: 20 },
      ],
      camps: {
        [ACCOUNT_ID]: [campaign("120210000000001", "Kuppam look-alike ₹37,350 crore", 200)],
        [NAMED_ID]: [campaign("120210000000002", "YSRCP retargeting", 100)],
      },
      periods: { op: { label: "Opinion poll", responses: 55773, n: 1, reach: 200, impr: 400, views: 200, clicks: 10, eng: 20 } },
    },
    n_total: 95389,
  } as unknown as SurveyData;
  const apOverview = await apSocialOverview(apData, false);
  const apOverviewText = JSON.stringify(apOverview);
  check("AP numeric account becomes Ad account <rank>", () => assert.equal(apOverview.accounts.find((item) => item.key === "acct-1")?.name, "Ad account 1"));
  check("AP client payload has no real account names", () => {
    assert.ok(apOverview.accounts.every((item) => /^Ad account \d+$/.test(item.name)));
    assert.ok(!apOverviewText.includes("Districts AIADMK"));
    assert.ok(!apOverviewText.includes("Secret Business"));
  });
  check("AP account aliases follow reach rank", () => {
    assert.equal(apOverview.accounts.find((item) => item.key === "acct-1")?.name, "Ad account 1");
    assert.equal(apOverview.accounts.find((item) => item.key === "acct-2")?.name, "Ad account 2");
  });
  check("AP overview has no 14-17 digit number", () => assert.ok(!/\d{14,17}/.test(apOverviewText)));
  check("AP overview has no business name or href", () => {
    const account = apOverview.accounts.find((item) => item.key === "acct-2");
    assert.equal(account?.business, undefined);
    assert.equal(account?.href, undefined);
  });
  const apFiltered = await apSocialFiltered(apData, { match: "target", kind: "govt", place: "Not good", label: "Govt performance · Not good" }, false);
  check("AP target view has no ids or long numbers", () => assert.ok(!/\d{14,17}/.test(JSON.stringify(apFiltered))));
  check("AP client campaign names strip currency amounts", () => assert.ok(!/₹|\bINR\b|\bRs\.?\b/i.test(JSON.stringify(apFiltered))));
  check("AP explorer payload has per-account campaigns", () => {
    assert.ok(apFiltered.campaignsByAccount && Object.keys(apFiltered.campaignsByAccount).length > 0);
    assert.ok(Object.values(apFiltered.campaignsByAccount).every((list) => list.length > 0));
  });
  check("AP explorer payload has no spend, ids, business names or Ads Manager links", () => {
    const explorer = JSON.stringify(apFiltered.campaignsByAccount);
    assert.ok(!/₹|\bINR\b|\bRs\.?\b|\bspend\b|\bcost\b|\bCPM\b|\bCPC\b/i.test(explorer));
    assert.ok(!/\d{12,20}/.test(explorer));
    assert.ok(!/Secret Business|Named Business|Districts AIADMK/i.test(explorer));
    assert.ok(!/adsmanager|facebook\.com\/ads|business\.facebook/i.test(explorer));
    assert.ok(Object.values(apFiltered.campaignsByAccount ?? {}).flat().every((campaign) => !("id" in campaign) && !("href" in campaign)));
  });
  check("AP target view labels non-geo audiences", () => assert.match(apFiltered.how, /reuse for retargeting and look-alike/i));

  console.log("\n1c. Karnataka client overview");
  const kaData = {
    parties: ["INC", "BJP", "JDS", "Others"],
    regions: ["Karnataka"],
    periods: {},
    actual: { Karnataka: { INC: 42.97 } },
    ads: {
      label: "Karnataka 2028", range: "from 27 Oct 2026",
      total: { n: 1, reach: 867185, impr: 1978908, views: 0, clicks: 115474, eng: 0 },
      accounts: [{ acct: "screenshot", acct_name: "Karnataka survey campaign", business: "Reachout Analytics", n: 1, reach: 867185, impr: 1978908, views: 0, clicks: 115474, eng: 0 }],
      camps: { screenshot: [{ id: "", name: "Karnataka swing OCT 27th", st: "Active", start: "2026-10-27", stop: "", per: "Live tracking", reach: 867185, impr: 1978908, views: 0, clicks: 115474, eng: 0, spend: 23048.16, acct: "Karnataka survey campaign" }] },
      periods: {},
    },
    n_total: 8489,
  } as unknown as SurveyData;
  const kaOverview = await kaSocialOverview(kaData, false);
  const kaText = JSON.stringify(kaOverview);
  check("KA client account becomes Ad account 1", () => assert.equal(kaOverview.accounts[0]?.name, "Ad account 1"));
  check("KA client payload has no screenshot key, id, business or money", () => {
    assert.ok(!kaText.includes("screenshot"));
    assert.ok(!kaText.includes("Reachout Analytics"));
    assert.ok(!kaText.includes("23048"));
    assert.ok(!/₹|\bINR\b|\bRs\.?\b|\bspend\b|\bcost\b|\bCPM\b|\bCPC\b/i.test(kaText));
    assert.ok(!/\d{12,20}/.test(kaText));
  });
  const kaFiltered = await kaSocialFiltered(kaData, { match: "target", kind: "zone", place: "Old Mysore", label: "INC below average" }, false);
  check("KA filtered payload keeps one alias account and one campaign", () => {
    assert.equal(kaFiltered.accounts.length, 1);
    assert.equal(kaFiltered.accounts[0]?.name, "Ad account 1");
    assert.equal(kaFiltered.campaigns.length, 1);
    assert.ok(!JSON.stringify(kaFiltered).includes("screenshot"));
  });

  console.log("\n1d. Telangana client overview");
  const tgData = {
    parties: ["BRS", "INC", "BJP", "AIMIM", "Others"],
    regions: ["Telangana"],
    periods: {},
    actual: { Telangana: { BRS: 37.35 } },
    ads: {
      label: "Telangana 2028", range: "from 16 Jul 2026", asOf: "22 Nov 2026 (Meta Ads Manager screenshots)",
      total: { n: 3, reach: 3371375, impr: 9907704, views: 0, clicks: 128490, eng: 0, spend: 108053.51 },
      accounts: [{ acct: "screenshot", acct_name: "Telangana survey campaigns", business: "Reachout Analytics", n: 3, reach: 3371375, impr: 9907704, views: 0, clicks: 128490, eng: 0 }],
      camps: { screenshot: [
        { id: "", name: "Telangana July-2027", st: "Off", start: "2026-07-16", per: "Jul 2026", reach: 617079, impr: 1133336, views: 0, clicks: 29993, eng: 0, spend: 13224.37 },
        { id: "", name: "Telangana Swing Oct 1st tsfeedback.in WPForms form 19148", st: "Active", start: "2026-10-01", per: "Oct – Nov 2026", reach: 2522324, impr: 8423520, views: 0, clicks: 76206, eng: 0, spend: 89510.85 },
      ] },
      periods: {},
    },
    n_total: 5453,
  } as unknown as SurveyData;
  const tgOverview = await tgSocialOverview(tgData, false);
  const tgText = JSON.stringify(tgOverview);
  check("TG client account becomes Ad account 1", () => assert.equal(tgOverview.accounts[0]?.name, "Ad account 1"));
  check("TG client payload has no screenshot key, id, business, money or tooling", () => {
    assert.ok(!tgText.includes("screenshot"));
    assert.ok(!tgText.includes("Reachout Analytics"));
    assert.ok(!tgText.includes("108053"));
    assert.ok(!/₹|\bINR\b|\bRs\.?\b|\bspend\b|\bcost\b|\bCPM\b|\bCPC\b/i.test(tgText));
    assert.ok(!/\d{12,20}/.test(tgText));
    assert.ok(!/WPForms|tsfeedback|form 19148|Reachout Ads Desk|screenshot|Ads Manager/i.test(tgText));
  });
  const tgFiltered = await tgSocialFiltered(tgData, { match: "group", group: "Telangana Swing" }, false);
  check("TG filtered payload has no tooling or domains", () => {
    assert.ok(!/WPForms|tsfeedback|form 19148|Reachout Ads Desk|screenshot/i.test(JSON.stringify(tgFiltered)));
  });
  check("clientText strips tooling, form numbers and domains", () => {
    assert.equal(clientText("2,899 answers from form 19148 (to 26 Oct) – the current form has no age question"), "2,899 answers (to 26 Oct) – the current form has no age question");
    assert.equal(clientText("WPForms form 19250 at tsfeedback.in via Reachout Ads Desk"), "");
    assert.equal(clientText("Karnataka swing OCT 27th ₹23,048.16"), "Karnataka swing OCT 27th");
  });

  console.log("\n2. Client filtered view");
  const filtered = await tnSocialFiltered(data, { match: "group", group: "Vanniyar" }, false);
  const filteredText = JSON.stringify(filtered);
  check("filtered account keeps the alias", () => assert.equal(filtered.accounts[0]?.name, "Ad account 1"));
  check("filtered campaigns have no ids or long numbers", () => {
    assert.ok(!/\d{14,17}/.test(filteredText));
    assert.equal(filtered.campaigns[0]?.id, undefined);
  });

  console.log("\n3. Owner payload");
  const owner = await tnSocialOverview(data, true);
  const ownerAccount = owner.accounts.find((item) => item.key === "acct-1");
  check("owner keeps the real id, name and business", () => {
    assert.equal(ownerAccount?.id, ACCOUNT_ID);
    assert.equal(ownerAccount?.name, ACCOUNT_ID);
    assert.equal(ownerAccount?.business, "Secret Business");
    assert.ok(ownerAccount?.href?.includes(ACCOUNT_ID));
  });

  console.log(`\nSOCIAL PRIVACY ${pass} passed`);
})().catch((error) => { console.error(error); process.exit(1); });
