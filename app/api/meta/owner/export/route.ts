import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { requireRecentAuth } from "@/lib/auth";
import { getMetaDb } from "@/lib/meta/store";
import { getOwnerOverview, toRangeKey } from "@/lib/meta/overview";

export const runtime = "nodejs";
export const maxDuration = 60;

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const params = new URL(req.url).searchParams;
  const range = toRangeKey(params.get("range"));
  const overview = await getOwnerOverview(db, {
    range,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    state: params.get("state") ?? undefined,
    party: params.get("party") ?? undefined,
    platform: params.get("platform") ?? undefined,
  });

  const lines: unknown[][] = [["Section", "State", "Party", "Campaign", "Status", "Spend (paise)", "Impressions", "Reach", "Clicks", "CTR", "ThruPlays"]];
  lines.push(["Totals", "", "", "", "", overview.totals.spend, overview.totals.impressions, overview.totals.reach ?? "", overview.totals.clicks, overview.totals.ctr ?? "", overview.totals.thruPlays]);
  for (const group of overview.groups) {
    lines.push(["Group", group.stateLabel, group.partyLabel, "", "", group.spend, group.impressions, group.reach ?? "", group.clicks, group.ctr ?? "", group.thruPlays]);
  }
  for (const campaign of overview.campaigns) {
    lines.push(["Campaign", campaign.stateLabel, campaign.partyLabel, campaign.name, campaign.status ?? "", campaign.metrics.spend, campaign.metrics.impressions, campaign.metrics.reach ?? "", campaign.metrics.clicks, campaign.metrics.ctr ?? "", campaign.metrics.thruPlays]);
    for (const adset of campaign.adsets) {
      for (const ad of adset.ads) {
        lines.push(["Ad", campaign.stateLabel, campaign.partyLabel, ad.name, ad.status ?? "", ad.metrics.spend, ad.metrics.impressions, ad.metrics.reach ?? "", ad.metrics.clicks, ad.metrics.ctr ?? "", ad.metrics.thruPlays]);
      }
    }
  }

  await audit({ action: "export", role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(), meta: { metaAds: range } });
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meta-ads-${range}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
