import type { Db } from "mongodb";
import { getOwnerOverview, type Metrics, type OverviewQuery, type OwnerOverview } from "@/lib/meta/overview";

export type ClientMetrics = {
  impressions: number;
  reach: number | null;
  clicks: number;
  ctr: number | null;
  videoPlays: number;
  thruPlays: number;
  spend?: number;
  cpm?: number | null;
  cpc?: number | null;
};
export type ClientCreative = {
  id: string | null;
  videoId: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  instagramPermalinkUrl: string | null;
  effectiveObjectStoryId: string | null;
  body: string | null;
  title: string | null;
};
export type ClientCampaign = {
  id: string;
  name: string;
  status: string | null;
  party: string;
  partyLabel: string;
  color: string;
  metrics: ClientMetrics;
  adsets: { id: string; name: string; status: string | null; metrics: ClientMetrics; ads: { id: string; name: string; status: string | null; metrics: ClientMetrics; creative: ClientCreative | null }[] }[];
};
export type ClientState = {
  state: string;
  range: string;
  platform: string;
  updatedAt: string | null;
  totals: ClientMetrics & { activeCampaigns: number };
  parties: { party: string; partyLabel: string; color: string; campaigns: number; metrics: ClientMetrics }[];
  campaigns: ClientCampaign[];
  daily: { date: string; impressions: number; videoPlays: number }[];
};

function pickMetrics(metrics: Metrics, includeCost: boolean): ClientMetrics {
  const out: ClientMetrics = {
    impressions: metrics.impressions,
    reach: metrics.reach,
    clicks: metrics.clicks,
    ctr: metrics.ctr,
    videoPlays: metrics.videoPlays,
    thruPlays: metrics.thruPlays,
  };
  if (includeCost) {
    out.spend = metrics.spend;
    out.cpm = metrics.cpm;
    out.cpc = metrics.cpc;
  }
  return out;
}

function pickCreative(creative: ClientCreative | null): ClientCreative | null {
  if (!creative) return null;
  return {
    id: creative.id,
    videoId: creative.videoId,
    thumbnailUrl: creative.thumbnailUrl,
    imageUrl: creative.imageUrl,
    instagramPermalinkUrl: creative.instagramPermalinkUrl,
    effectiveObjectStoryId: creative.effectiveObjectStoryId,
    body: creative.body,
    title: creative.title,
  };
}

/** Pure projection so the cost guarantee is testable without a database. */
export function buildClientState(overview: OwnerOverview, slug: string, query: Omit<OverviewQuery, "state">, includeCost = false): ClientState {
  const campaigns: ClientCampaign[] = overview.campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    party: campaign.party,
    partyLabel: campaign.partyLabel,
    color: campaign.color,
    metrics: pickMetrics(campaign.metrics, includeCost),
    adsets: campaign.adsets.map((adset) => ({
      id: adset.id,
      name: adset.name,
      status: adset.status,
      metrics: pickMetrics(adset.metrics, includeCost),
      ads: adset.ads.map((ad) => ({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        metrics: pickMetrics(ad.metrics, includeCost),
        creative: pickCreative(ad.creative),
      })),
    })),
  }));
  const partyNames = [...new Set(campaigns.map((campaign) => campaign.party))];
  const parties = partyNames.map((party) => {
    const matching = campaigns.filter((campaign) => campaign.party === party);
    const first = matching[0];
    const reachValues = matching.map((campaign) => campaign.metrics.reach).filter((value): value is number => value != null);
    const totals = matching.reduce((acc, campaign) => ({
      impressions: acc.impressions + campaign.metrics.impressions,
      reach: acc.reach,
      clicks: acc.clicks + campaign.metrics.clicks,
      videoPlays: acc.videoPlays + campaign.metrics.videoPlays,
      thruPlays: acc.thruPlays + campaign.metrics.thruPlays,
      spend: acc.spend + (campaign.metrics.spend ?? 0),
    }), { impressions: 0, reach: (reachValues.length ? reachValues.reduce((sum, value) => sum + value, 0) : null) as number | null, clicks: 0, videoPlays: 0, thruPlays: 0, spend: 0 });
    return {
      party,
      partyLabel: first?.partyLabel ?? party,
      color: first?.color ?? "#64748b",
      campaigns: matching.length,
      metrics: {
        impressions: totals.impressions,
        reach: totals.reach,
        clicks: totals.clicks,
        ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : null,
        videoPlays: totals.videoPlays,
        thruPlays: totals.thruPlays,
        ...(includeCost ? { spend: totals.spend, cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : null, cpc: totals.clicks ? totals.spend / totals.clicks : null } : {}),
      },
    };
  });

  return {
    state: slug,
    range: query.range,
    platform: query.platform ?? "all",
    updatedAt: overview.connection.lastSyncAt,
    totals: { ...pickMetrics(overview.totals, includeCost), activeCampaigns: overview.totals.activeCampaigns },
    parties,
    campaigns,
    daily: overview.daily.map((row) => ({ date: row.date, impressions: row.impressions, videoPlays: row.videoPlays })),
  };
}

/** Client-safe state view. Cost keys are never present; the owner route opts in. */
export async function getClientState(db: Db, slug: string, query: Omit<OverviewQuery, "state">, includeCost = false): Promise<ClientState> {
  const overview = await getOwnerOverview(db, { ...query, state: slug });
  return buildClientState(overview, slug, query, includeCost);
}

export type ClientCreativeView = {
  adId: string;
  state: string;
  name: string;
  status: string | null;
  metrics: ClientMetrics;
  creative: ClientCreative | null;
};
