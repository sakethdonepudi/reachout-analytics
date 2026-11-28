/**
 * Karnataka and Telangana presentation checks.
 *
 * Real source files stay out of git. Point SURVEY_KA_HTML and SURVEY_TG_HTML
 * at local copies to run the data checks; the structural checks always run.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { CASES, LIVE_CASE_SLUGS, caseBySlug, caseTitle, isLiveCase, orderedCases } from "../lib/cases";
import { CASE_CONFIGS, KA_CONFIG, TG_CONFIG } from "../lib/case-study/config";
import { parseSurveyUpload } from "../lib/survey/parse";
import { kaClientModel } from "../lib/survey/ka-view-dto";
import { tgClientModel } from "../lib/survey/tg-view-dto";
import { latestMonthFromData } from "../lib/survey/post-poll";
import { partyBrand } from "../lib/tamil-nadu/party-brand";

let pass = 0;
const check = (name: string, fn: () => void) => { fn(); pass += 1; console.log(`  ✓ ${name}`); };
const forbidden = /WPForms|tsfeedback\.in|Reachout Ads Desk|form\s*#?\s*\d+|screenshot|₹|\bspend\b|\bcost\b|\bCPM\b|\bCPC\b|Not reported|· undefined|Target Campaign|Retarget/i;

console.log("\n1. Live case registry");
check("live order is Tamil Nadu, Andhra Pradesh, Karnataka, Telangana", () => {
  assert.deepEqual([...LIVE_CASE_SLUGS], ["tamil-nadu", "andhra-pradesh-2024", "karnataka", "telangana"]);
});
check("all four live slugs report live", () => {
  for (const slug of LIVE_CASE_SLUGS) assert.equal(isLiveCase(slug), true, slug);
});
check("Karnataka and Telangana have no client party", () => {
  assert.equal(caseBySlug("karnataka")?.party, undefined);
  assert.equal(caseBySlug("telangana")?.party, undefined);
  assert.equal(caseTitle(caseBySlug("karnataka")!), "Karnataka · 2028");
  assert.equal(caseTitle(caseBySlug("telangana")!), "Telangana · 2028");
});
check("projected leads use party logos, not a client label", () => {
  assert.deepEqual(caseBySlug("karnataka")?.projectedLead, { parties: ["INC", "BJP"], label: "INC votes · BJP seats" });
  assert.deepEqual(caseBySlug("telangana")?.projectedLead, { parties: ["BRS"], label: "BRS" });
});
check("the old karnataka-2023 slug is gone", () => {
  assert.equal(caseBySlug("karnataka-2023"), undefined);
  assert.equal(CASES.some((item) => item.slug === "karnataka-2023"), false);
});
check("the live cards come first in the required order", () => {
  assert.deepEqual(orderedCases().slice(0, 4).map((item) => item.slug), ["tamil-nadu", "andhra-pradesh-2024", "karnataka", "telangana"]);
  assert.deepEqual(orderedCases().slice(4).map((item) => item.slug), ["north-east-elections", "gujarat", "bihar"]);
});

console.log("\n2. Page config");
for (const config of [KA_CONFIG, TG_CONFIG]) {
  check(`${config.slug}: neutral header, no map, no target party`, () => {
    assert.equal(config.hideMap, true);
    assert.equal(config.target, undefined);
    assert.equal(config.singleTabBar, true);
    assert.ok(config.neutralHeader?.includes(String(config.stateName)));
    assert.equal(config.socialCardTitle, "Social Media Dissemination");
    assert.equal(config.socialCardSubtitle, "Survey ad campaigns · reach & engagement");
    assert.deepEqual(config.hiddenMetrics, ["views", "engagements"]);
  });
}
check("KA shows JD(S) everywhere the code is displayed", () => {
  assert.equal(KA_CONFIG.partyLabels?.JDS, "JD(S)");
});
check("every KA and TG party has a logo", () => {
  for (const config of [KA_CONFIG, TG_CONFIG]) {
    for (const party of config.parties) {
      const brand = config.brand[party];
      assert.ok(brand?.logo, `${config.slug}/${party} has no logo`);
      const path = `public${brand.logo}`;
      assert.ok(existsSync(path), `${path} is missing`);
      assert.ok(statSync(path).size > 100, `${path} is empty`);
      const badge = partyBrand(party);
      assert.ok(badge.logo, `${party} badge has no logo`);
      assert.ok(existsSync(`public${badge.logo}`), `${party} badge logo is missing`);
    }
  }
});
check("KA and TG are registered on their own routes and APIs", () => {
  assert.equal(CASE_CONFIGS.karnataka, KA_CONFIG);
  assert.equal(CASE_CONFIGS.telangana, TG_CONFIG);
  for (const path of ["app/case-studies/karnataka/page.tsx", "app/case-studies/telangana/page.tsx", "app/api/survey/social/route.ts", "app/api/survey/download/route.ts"]) {
    assert.ok(existsSync(path), `${path} is missing`);
  }
});

console.log("\n3. Client models from the real files");
const files = [
  { state: "karnataka" as const, env: "SURVEY_KA_HTML", config: KA_CONFIG, summary: true },
  { state: "telangana" as const, env: "SURVEY_TG_HTML", config: TG_CONFIG, summary: false },
];
for (const item of files) {
  const path = process.env[item.env];
  if (!path) {
    console.log(`  - ${item.env} is not set; skipping the ${item.state} model check`);
    continue;
  }
  const data = parseSurveyUpload(readFileSync(path, "utf8"), item.state);
  const latest = latestMonthFromData(data, "rd", false);
  const model = item.state === "karnataka" ? kaClientModel(data, "rd", latest) : tgClientModel(data, "rd", latest);
  check(`${item.state}: default slot is the newest month`, () => {
    assert.equal(latest, "2026-11");
    assert.equal(model.slots.rd.some((slot) => slot.key === latest), true);
  });
  check(`${item.state}: tab rail has All months, both months and social last`, () => {
    assert.deepEqual(model.slots.rd.filter((slot) => !slot.subKey).map((slot) => slot.key), ["all", "2026-10", "2026-11"]);
    assert.equal(item.config.singleTabBar, true);
  });
  check(`${item.state}: client model has no client-party, map or private fields`, () => {
    const json = JSON.stringify(model);
    assert.ok(!forbidden.test(json), `${item.state} model contains a forbidden string`);
    assert.equal(model.initialMap.acs.length, 0);
    assert.equal(model.initialMap.districts.length, 0);
  });
  check(`${item.state}: every party name has a symbol in the model`, () => {
    assert.deepEqual(model.parties, item.config.parties);
  });
  if (item.summary) {
    check("KA summary keeps the HTML-only past-vote rows", () => {
      const summary = (model.meta?.summary ?? {}) as { latestEntry?: string; pastVote?: Record<string, unknown> };
      assert.equal(summary.latestEntry, "28 Nov at 06:17");
      assert.ok(summary.pastVote?.["2026-11"]);
      assert.ok(summary.pastVote?.["2026-10"]);
    });
  }
}

console.log(`\nKA/TG ${pass} passed`);
