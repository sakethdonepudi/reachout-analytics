/**
 * Client social payload privacy.
 *
 * A source account may carry its numeric Meta id in acct_name. The client DTO
 * must never put a 14-17 digit id in a name, key, row id, URL or campaign
 * field. Owner payloads keep the real id and business name.
 */
import assert from "node:assert/strict";
import { tnSocialFiltered, tnSocialOverview } from "@/lib/survey/tn-view-dto";
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
