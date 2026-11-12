/* Client DTO cost-redaction tests. Run: npx tsx --conditions react-server scripts/meta-client-dto.test.ts */

import { buildClientState } from "@/lib/meta/client-dto";
import type { OwnerOverview } from "@/lib/meta/overview";

let pass = 0, fail = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const metrics = {
  spend: 1234567,
  impressions: 220000,
  reach: 140000,
  clicks: 3200,
  ctr: 1.45,
  cpm: 5611.7,
  cpc: 385.8,
  videoPlays: 52000,
  thruPlays: 12000,
};

const overview: OwnerOverview = {
  connection: { connected: true, expired: false, lastSyncAt: "2026-11-11T10:00:00.000Z", expiresAt: "2026-11-11T22:00:00.000Z", metaUserName: "Owner", holderName: "Venkat", holderUserId: "u1", isHolder: true, status: "active" },
  range: { key: "7d", since: "2026-11-05", until: "2026-11-11" },
  totals: { ...metrics, activeCampaigns: 3, previous: metrics, reachIsUnique: true },
  groups: [],
  accounts: [{ id: "act_1", name: "Account", currency: "INR", status: 1, disableReason: null, amountSpent: 900000, spendCap: 1000000, balance: 100000, fundingSource: null, metaUserName: "Owner", lastSyncedAt: "2026-11-11T10:00:00.000Z" }],
  daily: [{ date: "2026-11-11", spend: 100000, impressions: 20000, videoPlays: 4000, thruPlays: 900 }],
  platforms: [{ platform: "facebook", spend: 100000, impressions: 20000 }],
  campaigns: [
    {
      id: "c_1", name: "TN_TVK_Reels", status: "ACTIVE", state: "tamil-nadu", stateLabel: "Tamil Nadu",
      party: "TVK", partyLabel: "TVK", color: "#e0a800", metaUserName: "Owner", lastSyncedAt: "2026-11-11T10:00:00.000Z", metrics,
      adsets: [
        {
          id: "as_1", name: "Ad set", status: "ACTIVE", metrics,
          ads: [
            {
              id: "ad_1", name: "Ad one", status: "ACTIVE", metrics,
              creative: {
                id: "cr_1", videoId: "vid_1", thumbnailUrl: "https://example.com/p.jpg", imageUrl: null,
                instagramPermalinkUrl: "https://www.instagram.com/p/abc/", effectiveObjectStoryId: null,
                body: "Body copy", title: "Title",
              },
            },
          ],
        },
      ],
    },
  ],
  notifications: { unread: 0, rows: [] },
};

const COST_KEY = /spend|cpm|cpc|cpp|cost|budget|balance|amount|currency|funding|bid/i;

function walk(value: unknown, path: string, hits: string[], rupeeHits: string[]) {
  if (value == null) return;
  if (typeof value === "string") {
    if (value.includes("₹")) rupeeHits.push(`${path}: ${value}`);
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, hits, rupeeHits));
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (COST_KEY.test(key)) hits.push(`${path}.${key}`);
    walk(child, `${path}.${key}`, hits, rupeeHits);
  }
}

console.log("\n1. Client DTO redacts cost server-side");
const client = buildClientState(overview, "tamil-nadu", { range: "7d", platform: "all" }, false);
const clientKeys: string[] = [];
const clientRupees: string[] = [];
walk(client, "state", clientKeys, clientRupees);
ok("no cost-like keys anywhere in the client payload", clientKeys.length === 0, clientKeys.join(", "));
ok("no rupee values anywhere in the client payload", clientRupees.length === 0, clientRupees.join(", "));
ok("delivery metrics survive the projection", client.totals.impressions === 220000 && client.totals.clicks === 3200 && client.totals.reach === 140000);
ok("campaign and ad breakdown survives", client.campaigns[0].adsets[0].ads[0].metrics.impressions === 220000);
ok("creative metadata survives", client.campaigns[0].adsets[0].ads[0].creative?.instagramPermalinkUrl === "https://www.instagram.com/p/abc/");
ok("client totals keep the active campaign count", client.totals.activeCampaigns === 3);

console.log("\n2. Owner projection opts in to costs");
const owner = buildClientState(overview, "tamil-nadu", { range: "7d", platform: "all" }, true);
const ownerKeys: string[] = [];
const ownerRupees: string[] = [];
walk(owner, "state", ownerKeys, ownerRupees);
ok("owner payload includes spend", owner.totals.spend === 1234567);
ok("owner payload includes cpm and cpc", owner.totals.cpm === 5611.7 && owner.totals.cpc === 385.8);
ok("owner party row includes spend", owner.parties[0].metrics.spend === 1234567);
ok("owner campaign row includes spend", owner.campaigns[0].metrics.spend === 1234567);

console.log("\n3. Missing reach stays null, never zero");
const noReach: OwnerOverview = {
  ...overview,
  totals: { ...metrics, reach: null, activeCampaigns: 0, previous: null, reachIsUnique: false },
  campaigns: [{ ...overview.campaigns[0], metrics: { ...metrics, reach: null } }],
};
const bare = buildClientState(noReach, "tamil-nadu", { range: "7d", platform: "all" }, false);
ok("missing total reach is null", bare.totals.reach === null);
ok("missing party reach is null", bare.parties[0].metrics.reach === null);
ok("missing campaign reach is null", bare.campaigns[0].metrics.reach === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
