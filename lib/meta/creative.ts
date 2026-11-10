import type { Db } from "mongodb";
import type { ClientCreative, ClientCreativeView, ClientMetrics } from "@/lib/meta/client-dto";

type AdDoc = { _id: string; campaignId?: string; name?: string; status?: string; effectiveStatus?: string; creativeId?: string | null };
type CreativeDoc = {
  _id: string; videoId?: string | null; thumbnailUrl?: string | null; imageUrl?: string | null;
  instagramPermalinkUrl?: string | null; effectiveObjectStoryId?: string | null; body?: string | null; title?: string | null;
};
type TagDoc = { campaignId: string; state: string; party: string; confirmed: boolean };
type RangeDoc = { impressions?: number; reach?: number; clicks?: number; inlineLinkClicks?: number; videoPlays?: number; thruPlays?: number; spend?: number };

export async function getCreativeView(db: Db, adId: string, state: string | null, includeCost: boolean, rangeKey = "7d", platform = "all"): Promise<ClientCreativeView | null> {
  const ad = await db.collection<AdDoc>("meta_ads").findOne({ _id: adId });
  if (!ad) return null;
  const campaignId = ad.campaignId ?? "";
  const tag = campaignId ? await db.collection<TagDoc>("meta_campaign_tags").findOne({ campaignId, confirmed: true }) : null;
  if (!includeCost) {
    if (!tag || !state || tag.state !== state) return null;
  }
  const creativeDoc = ad.creativeId ? await db.collection<CreativeDoc>("meta_creatives").findOne({ _id: ad.creativeId }) : null;
  const rows = await db.collection<RangeDoc>("meta_insights_range").find({
    level: "ad",
    adId,
    rangeKey,
    ...(platform && platform !== "all" ? { platform } : {}),
  }).toArray();
  const impressions = rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const clicks = rows.reduce((sum, row) => sum + (row.inlineLinkClicks ?? row.clicks ?? 0), 0);
  const reachRows = rows.filter((row) => row.reach != null);
  const spend = rows.reduce((sum, row) => sum + (row.spend ?? 0), 0);
  const metrics: ClientMetrics = {
    impressions,
    reach: reachRows.length ? reachRows.reduce((sum, row) => sum + (row.reach ?? 0), 0) : null,
    clicks,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    videoPlays: rows.reduce((sum, row) => sum + (row.videoPlays ?? 0), 0),
    thruPlays: rows.reduce((sum, row) => sum + (row.thruPlays ?? 0), 0),
    ...(includeCost ? { spend, cpm: impressions ? (spend / impressions) * 1000 : null, cpc: clicks ? spend / clicks : null } : {}),
  };
  const creative: ClientCreative | null = creativeDoc ? {
    id: creativeDoc._id,
    videoId: creativeDoc.videoId ?? null,
    thumbnailUrl: creativeDoc.thumbnailUrl ?? null,
    imageUrl: creativeDoc.imageUrl ?? null,
    instagramPermalinkUrl: creativeDoc.instagramPermalinkUrl ?? null,
    effectiveObjectStoryId: creativeDoc.effectiveObjectStoryId ?? null,
    body: creativeDoc.body ?? null,
    title: creativeDoc.title ?? null,
  } : null;
  return {
    adId,
    state: tag?.state ?? state ?? "",
    name: ad.name ?? ad._id,
    status: ad.effectiveStatus ?? ad.status ?? null,
    metrics,
    creative,
  };
}
