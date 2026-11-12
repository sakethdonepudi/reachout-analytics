import type { Db } from "mongodb";
import { CASES } from "@/lib/cases";
import { TN_COLOR, TN_LABEL, type TnGroup } from "@/lib/tamil-nadu/model";
import { PARTY_COLOR, PARTY_LABEL, type Party } from "@/lib/telangana/constants";
import type { MetaCampaignTag } from "@/lib/meta/tags";
import type { MetaConnectionDoc } from "@/lib/meta/store";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "month" | "lifetime" | "custom";
export type OverviewQuery = {
  range: RangeKey;
  from?: string;
  to?: string;
  state?: string;
  party?: string;
  platform?: string;
  /** null/undefined = every synced account; [] = no account is reachable. */
  accountIds?: string[] | null;
  connection?: MetaConnectionDoc | null;
};
export type Metrics = {
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  cpc: number | null;
  videoPlays: number;
  thruPlays: number;
};
export type GroupRow = Metrics & {
  state: string;
  stateLabel: string;
  party: string;
  partyLabel: string;
  color: string;
  activeCampaigns: number;
};
export type AccountRow = {
  id: string;
  name: string;
  currency: string | null;
  status: number | null;
  disableReason: string | null;
  amountSpent: number | null;
  spendCap: number | null;
  balance: number | null;
  fundingSource: unknown;
  metaUserName: string | null;
  lastSyncedAt: string | null;
};
export type ExplorerAd = {
  id: string;
  name: string;
  status: string | null;
  metrics: Metrics;
  creative: {
    id: string | null;
    videoId: string | null;
    thumbnailUrl: string | null;
    imageUrl: string | null;
    instagramPermalinkUrl: string | null;
    effectiveObjectStoryId: string | null;
    body: string | null;
    title: string | null;
  } | null;
};
export type ExplorerAdset = { id: string; name: string; status: string | null; metrics: Metrics; ads: ExplorerAd[] };
export type ExplorerCampaign = {
  id: string;
  name: string;
  status: string | null;
  state: string;
  stateLabel: string;
  party: string;
  partyLabel: string;
  color: string;
  metaUserName: string | null;
  lastSyncedAt: string | null;
  metrics: Metrics;
  adsets: ExplorerAdset[];
};
export type NotificationRow = {
  id: string;
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
export type OwnerOverview = {
  connection: { connected: boolean; expired: boolean; lastSyncAt: string | null; expiresAt: string | null; metaUserName: string | null };
  range: { key: RangeKey; since: string | null; until: string | null };
  totals: Metrics & { activeCampaigns: number; previous: Metrics | null; reachIsUnique: boolean };
  groups: GroupRow[];
  accounts: AccountRow[];
  daily: { date: string; spend: number; impressions: number; videoPlays: number; thruPlays: number }[];
  platforms: { platform: string; spend: number; impressions: number }[];
  campaigns: ExplorerCampaign[];
  notifications: { unread: number; rows: NotificationRow[] };
};

type RangeDoc = {
  _id: string;
  accountId: string;
  level: "account" | "campaign" | "ad";
  rangeKey: string;
  platform: string;
  campaignId?: string | null;
  adId?: string | null;
  impressions?: number;
  reach?: number;
  clicks?: number;
  inlineLinkClicks?: number;
  ctr?: number;
  spend?: number;
  cpm?: number;
  cpc?: number;
  videoPlays?: number;
  thruPlays?: number;
};
type DailyDoc = {
  _id: string;
  accountId: string;
  level: "campaign" | "ad";
  date: string;
  platform: string;
  campaignId?: string | null;
  adId?: string | null;
  impressions?: number;
  clicks?: number;
  inlineLinkClicks?: number;
  ctr?: number;
  spend?: number;
  videoPlays?: number;
  thruPlays?: number;
};
type CampaignDoc = { _id: string; name?: string; accountId?: string; status?: string; effectiveStatus?: string; metaUserName?: string; updatedAt?: string };
type AdsetDoc = { _id: string; campaignId?: string; name?: string; status?: string; effectiveStatus?: string };
type AdDoc = { _id: string; campaignId?: string; adsetId?: string; name?: string; status?: string; effectiveStatus?: string; creativeId?: string | null };
type CreativeDoc = {
  _id: string; videoId?: string | null; thumbnailUrl?: string | null; imageUrl?: string | null;
  instagramPermalinkUrl?: string | null; effectiveObjectStoryId?: string | null; body?: string | null; title?: string | null;
};

const RANGE_KEYS: RangeKey[] = ["today", "yesterday", "7d", "30d", "month", "lifetime", "custom"];

export function toRangeKey(value: string | null): RangeKey {
  return RANGE_KEYS.includes(value as RangeKey) ? value as RangeKey : "7d";
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function rangeWindow(range: RangeKey, from?: string, to?: string): { since: string | null; until: string } {
  const now = new Date();
  const until = dateOnly(now);
  if (range === "custom") return { since: from || null, until: to || until };
  if (range === "today") return { since: until, until };
  if (range === "yesterday") { const d = new Date(now); d.setDate(d.getDate() - 1); return { since: dateOnly(d), until: dateOnly(d) }; }
  if (range === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); return { since: dateOnly(d), until }; }
  if (range === "30d") { const d = new Date(now); d.setDate(d.getDate() - 29); return { since: dateOnly(d), until }; }
  if (range === "month") return { since: `${until.slice(0, 7)}-01`, until };
  return { since: null, until };
}

function previousWindow(range: RangeKey, since: string | null, until: string): { since: string | null; until: string } | null {
  if (!since || range === "lifetime" || range === "custom") return null;
  const start = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  return { since: dateOnly(prevStart), until: dateOnly(prevEnd) };
}

function sumRange(rows: RangeDoc[]): Metrics {
  const total = rows.reduce((acc, row) => {
    acc.impressions += row.impressions ?? 0;
    acc.clicks += row.inlineLinkClicks ?? row.clicks ?? 0;
    acc.spend += row.spend ?? 0;
    acc.videoPlays += row.videoPlays ?? 0;
    acc.thruPlays += row.thruPlays ?? 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, videoPlays: 0, thruPlays: 0 });
  const reachRows = rows.filter((row) => row.reach != null);
  return {
    ...total,
    reach: reachRows.length ? reachRows.reduce((sum, row) => sum + (row.reach ?? 0), 0) : null,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : null,
    cpm: total.impressions ? (total.spend / total.impressions) * 1000 : null,
    cpc: total.clicks ? total.spend / total.clicks : null,
  };
}

function sumDaily(rows: DailyDoc[]): Metrics {
  const total = rows.reduce((acc, row) => {
    acc.impressions += row.impressions ?? 0;
    acc.clicks += row.inlineLinkClicks ?? row.clicks ?? 0;
    acc.spend += row.spend ?? 0;
    acc.videoPlays += row.videoPlays ?? 0;
    acc.thruPlays += row.thruPlays ?? 0;
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, videoPlays: 0, thruPlays: 0 });
  return {
    ...total,
    reach: null,
    ctr: total.impressions ? (total.clicks / total.impressions) * 100 : null,
    cpm: total.impressions ? (total.spend / total.impressions) * 1000 : null,
    cpc: total.clicks ? total.spend / total.clicks : null,
  };
}

function combineMetrics(items: Metrics[]): Metrics {
  const spend = items.reduce((sum, item) => sum + item.spend, 0);
  const impressions = items.reduce((sum, item) => sum + item.impressions, 0);
  const clicks = items.reduce((sum, item) => sum + item.clicks, 0);
  const videoPlays = items.reduce((sum, item) => sum + item.videoPlays, 0);
  const thruPlays = items.reduce((sum, item) => sum + item.thruPlays, 0);
  const reaches = items.map((item) => item.reach).filter((value): value is number => value != null);
  return {
    spend, impressions, clicks, videoPlays, thruPlays,
    reach: reaches.length ? reaches.reduce((sum, value) => sum + value, 0) : null,
    ctr: impressions ? (clicks / impressions) * 100 : null,
    cpm: impressions ? (spend / impressions) * 1000 : null,
    cpc: clicks ? spend / clicks : null,
  };
}

function stateLabel(slug: string): string {
  return CASES.find((item) => item.slug === slug)?.stateName ?? slug;
}

function partyMeta(state: string, party: string): { partyLabel: string; color: string } {
  if (state === "tamil-nadu") {
    return { partyLabel: TN_LABEL[party as TnGroup] ?? party, color: TN_COLOR[party as TnGroup] ?? "#64748b" };
  }
  if (state === "telangana") {
    return { partyLabel: PARTY_LABEL[party as Party] ?? party, color: PARTY_COLOR[party as Party] ?? "#64748b" };
  }
  return { partyLabel: party, color: "#64748b" };
}

function groupKey(state: string, party: string) {
  return `${state}|${party}`;
}

export async function getOwnerOverview(db: Db, query: OverviewQuery): Promise<OwnerOverview> {
  const scoped = query.accountIds ? { accountId: { $in: query.accountIds } } : {};
  const [accounts, campaigns, adsets, ads, creatives, tags, rangeRows, dailyRows, notifications] = await Promise.all([
    db.collection<AccountDoc>("meta_accounts").find(scoped).toArray(),
    db.collection<CampaignDoc>("meta_campaigns").find(scoped).toArray(),
    db.collection<AdsetDoc>("meta_adsets").find(scoped).toArray(),
    db.collection<AdDoc>("meta_ads").find(scoped).toArray(),
    db.collection<CreativeDoc>("meta_creatives").find({}).toArray(),
    db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").find({}).toArray(),
    db.collection<RangeDoc>("meta_insights_range").find({ ...scoped, rangeKey: query.range === "custom" ? "7d" : query.range }).toArray(),
    db.collection<DailyDoc>("meta_insights_daily").find(scoped).toArray(),
    db.collection<Record<string, unknown> & { _id: string }>("meta_notifications").find({ read: false }).sort({ createdAt: -1 }).limit(20).toArray(),
  ]);
  const connection = query.connection ?? null;

  const tagMap = new Map(tags.filter((tag) => tag.confirmed).map((tag) => [tag.campaignId, tag]));
  const campaignMap = new Map(campaigns.map((campaign) => [campaign._id, campaign]));
  const adsetMap = new Map(adsets.map((adset) => [adset._id, adset]));
  const creativeMap = new Map(creatives.map((creative) => [creative._id, creative]));
  const allowed = new Set(campaigns.filter((campaign) => {
    const tag = tagMap.get(campaign._id);
    if (query.state && tag?.state !== query.state) return false;
    if (query.party && tag?.party !== query.party) return false;
    return true;
  }).map((campaign) => campaign._id));

  const platform = query.platform && query.platform !== "all" ? query.platform : null;
  const window = rangeWindow(query.range, query.from, query.to);
  const previous = previousWindow(query.range, window.since, window.until);
  const isCustom = query.range === "custom";
  const range = isCustom ? "7d" : query.range;

  const currentCampaignRange = rangeRows.filter((row) => row.level === "campaign" && row.rangeKey === range && (!platform || row.platform === platform) && allowed.has(row.campaignId ?? ""));
  const currentAccountPlatform = rangeRows.filter((row) => row.level === "account" && row.rangeKey === range && row.platform !== "all" && (!platform || row.platform === platform));
  const currentAccountUnique = rangeRows.filter((row) => row.level === "account" && row.rangeKey === range && row.platform === "all");
  const filtered = Boolean(query.state || query.party);
  const totalsBase = isCustom
    ? sumDaily(dailyRows.filter((row) => row.level === "campaign" && row.date >= (window.since ?? "") && row.date <= window.until && allowed.has(row.campaignId ?? "") && (!platform || row.platform === platform)))
    : filtered
      ? sumRange(currentCampaignRange)
      : sumRange(currentAccountPlatform);
  const uniqueReach = !isCustom && !filtered && !platform
    ? currentAccountUnique.reduce((sum, row) => sum + (row.reach ?? 0), 0) || null
    : null;

  const previousTotals = previous
    ? sumDaily(dailyRows.filter((row) => row.level === "campaign" && row.date >= previous.since! && row.date <= previous.until && allowed.has(row.campaignId ?? "") && (!platform || row.platform === platform)))
    : null;

  const adRange = new Map<string, RangeDoc[]>();
  for (const row of rangeRows.filter((item) => item.level === "ad" && item.rangeKey === range && (!platform || item.platform === platform))) {
    if (!row.adId) continue;
    adRange.set(row.adId, [...(adRange.get(row.adId) ?? []), row]);
  }
  const campaignRange = new Map<string, RangeDoc[]>();
  for (const row of currentCampaignRange) {
    if (!row.campaignId) continue;
    campaignRange.set(row.campaignId, [...(campaignRange.get(row.campaignId) ?? []), row]);
  }
  const dailyCampaign = new Map<string, DailyDoc[]>();
  const dailyAd = new Map<string, DailyDoc[]>();
  for (const row of dailyRows) {
    if (platform && row.platform !== platform) continue;
    if (window.since && row.date < window.since) continue;
    if (row.date > window.until) continue;
    if (row.level === "campaign" && row.campaignId) dailyCampaign.set(row.campaignId, [...(dailyCampaign.get(row.campaignId) ?? []), row]);
    if (row.level === "ad" && row.adId) dailyAd.set(row.adId, [...(dailyAd.get(row.adId) ?? []), row]);
  }
  const campaignMetrics = (id: string) => isCustom ? sumDaily(dailyCampaign.get(id) ?? []) : sumRange(campaignRange.get(id) ?? []);
  const adMetrics = (id: string) => isCustom ? sumDaily(dailyAd.get(id) ?? []) : sumRange(adRange.get(id) ?? []);

  const groupsMap = new Map<string, GroupRow>();
  for (const campaign of campaigns) {
    if (!allowed.has(campaign._id)) continue;
    const tag = tagMap.get(campaign._id);
    const state = tag?.state ?? "unassigned";
    const party = tag?.party ?? "unassigned";
    const key = groupKey(state, party);
    const current = groupsMap.get(key) ?? {
      state,
      stateLabel: state === "unassigned" ? "Unassigned" : stateLabel(state),
      party,
      partyLabel: party === "unassigned" ? "Unassigned" : partyMeta(state, party).partyLabel,
      color: party === "unassigned" ? "#64748b" : partyMeta(state, party).color,
      activeCampaigns: 0,
      ...sumRange([]),
    };
    const metrics = campaignMetrics(campaign._id);
    current.spend += metrics.spend;
    current.impressions += metrics.impressions;
    if (metrics.reach != null) current.reach = (current.reach ?? 0) + metrics.reach;
    current.clicks += metrics.clicks;
    current.videoPlays += metrics.videoPlays;
    current.thruPlays += metrics.thruPlays;
    current.ctr = current.impressions ? (current.clicks / current.impressions) * 100 : null;
    current.cpm = current.impressions ? (current.spend / current.impressions) * 1000 : null;
    current.cpc = current.clicks ? current.spend / current.clicks : null;
    if (campaign.effectiveStatus === "ACTIVE") current.activeCampaigns += 1;
    groupsMap.set(key, current);
  }
  const groups = [...groupsMap.values()].sort((a, b) => {
    if (a.state === "unassigned") return 1;
    if (b.state === "unassigned") return -1;
    if (a.state !== b.state) return a.stateLabel.localeCompare(b.stateLabel);
    return a.partyLabel.localeCompare(b.partyLabel);
  });

  const accountRows: AccountRow[] = accounts.map((account) => ({
    id: account._id,
    name: account.name ?? account._id,
    currency: account.currency ?? null,
    status: account.status ?? null,
    disableReason: account.disableReason ?? null,
    amountSpent: account.amountSpent ?? null,
    spendCap: account.spendCap ?? null,
    balance: account.balance ?? null,
    fundingSource: account.fundingSource ?? null,
    metaUserName: account.metaUserName ?? null,
    lastSyncedAt: account.updatedAt ?? null,
  }));

  const dailyMap = new Map<string, { date: string; spend: number; impressions: number; videoPlays: number; thruPlays: number }>();
  for (const row of dailyRows) {
    if (row.level !== "campaign" || !allowed.has(row.campaignId ?? "")) continue;
    if (platform && row.platform !== platform) continue;
    if (window.since && row.date < window.since) continue;
    if (row.date > window.until) continue;
    const entry = dailyMap.get(row.date) ?? { date: row.date, spend: 0, impressions: 0, videoPlays: 0, thruPlays: 0 };
    entry.spend += row.spend ?? 0;
    entry.impressions += row.impressions ?? 0;
    entry.videoPlays += row.videoPlays ?? 0;
    entry.thruPlays += row.thruPlays ?? 0;
    dailyMap.set(row.date, entry);
  }

  const platformMap = new Map<string, { platform: string; spend: number; impressions: number }>();
  for (const row of currentAccountPlatform) {
    const key = row.platform;
    const entry = platformMap.get(key) ?? { platform: key, spend: 0, impressions: 0 };
    entry.spend += row.spend ?? 0;
    entry.impressions += row.impressions ?? 0;
    platformMap.set(key, entry);
  }

  const explorer: ExplorerCampaign[] = campaigns.filter((campaign) => allowed.has(campaign._id)).map((campaign) => {
    const tag = tagMap.get(campaign._id);
    const state = tag?.state ?? "unassigned";
    const party = tag?.party ?? "unassigned";
    const meta = partyMeta(state, party);
    const campaignStats = campaignMetrics(campaign._id);
    const campaignAdsets = adsets.filter((adset) => adset.campaignId === campaign._id).map((adset) => {
      const campaignAds = ads.filter((ad) => ad.adsetId === adset._id).map((ad) => {
        const creative = ad.creativeId ? creativeMap.get(ad.creativeId) : undefined;
        return {
          id: ad._id,
          name: ad.name ?? ad._id,
          status: ad.effectiveStatus ?? ad.status ?? null,
          metrics: adMetrics(ad._id),
          creative: creative ? {
            id: creative._id,
            videoId: creative.videoId ?? null,
            thumbnailUrl: creative.thumbnailUrl ?? null,
            imageUrl: creative.imageUrl ?? null,
            instagramPermalinkUrl: creative.instagramPermalinkUrl ?? null,
            effectiveObjectStoryId: creative.effectiveObjectStoryId ?? null,
            body: creative.body ?? null,
            title: creative.title ?? null,
          } : null,
        };
      });
      return {
        id: adset._id,
        name: adset.name ?? adset._id,
        status: adset.effectiveStatus ?? adset.status ?? null,
        metrics: combineMetrics(campaignAds.map((ad) => ad.metrics)),
        ads: campaignAds,
      };
    });
    // Include ads without an ad set under a synthetic group.
    const orphanAds = ads.filter((ad) => ad.campaignId === campaign._id && (!ad.adsetId || !adsetMap.has(ad.adsetId)));
    if (orphanAds.length) {
      campaignAdsets.push({
        id: `${campaign._id}:unassigned`,
        name: "Unassigned ad set",
        status: null,
        metrics: combineMetrics(orphanAds.map((ad) => adMetrics(ad._id))),
        ads: orphanAds.map((ad) => {
          const creative = ad.creativeId ? creativeMap.get(ad.creativeId) : undefined;
          return {
            id: ad._id,
            name: ad.name ?? ad._id,
            status: ad.effectiveStatus ?? ad.status ?? null,
            metrics: adMetrics(ad._id),
            creative: creative ? { id: creative._id, videoId: creative.videoId ?? null, thumbnailUrl: creative.thumbnailUrl ?? null, imageUrl: creative.imageUrl ?? null, instagramPermalinkUrl: creative.instagramPermalinkUrl ?? null, effectiveObjectStoryId: creative.effectiveObjectStoryId ?? null, body: creative.body ?? null, title: creative.title ?? null } : null,
          };
        }),
      });
    }
    return {
      id: campaign._id,
      name: campaign.name ?? campaign._id,
      status: campaign.effectiveStatus ?? campaign.status ?? null,
      state,
      stateLabel: state === "unassigned" ? "Unassigned" : stateLabel(state),
      party,
      partyLabel: party === "unassigned" ? "Unassigned" : meta.partyLabel,
      color: party === "unassigned" ? "#64748b" : meta.color,
      metaUserName: campaign.metaUserName ?? null,
      lastSyncedAt: campaign.updatedAt ?? null,
      metrics: campaignStats,
      adsets: campaignAdsets,
    };
  });

  const expiresAt = connection?.expiresAt ?? (connection?.connectedAt ? new Date(new Date(connection.connectedAt).getTime() + 12 * 60 * 60 * 1000).toISOString() : null);
  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  const unread = await db.collection("meta_notifications").countDocuments({ read: false }).catch(() => 0);

  return {
    connection: {
      connected: Boolean(connection) && !expired,
      expired,
      lastSyncAt: connection?.lastSyncAt ?? null,
      expiresAt,
      metaUserName: connection?.metaUserName ?? null,
    },
    range: { key: query.range, since: window.since, until: window.until },
    totals: {
      ...totalsBase,
      reach: uniqueReach ?? totalsBase.reach,
      activeCampaigns: campaigns.filter((campaign) => allowed.has(campaign._id) && campaign.effectiveStatus === "ACTIVE").length,
      previous: previousTotals,
      reachIsUnique: uniqueReach != null,
    },
    groups,
    accounts: accountRows,
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    platforms: [...platformMap.values()].sort((a, b) => b.spend - a.spend),
    campaigns: explorer,
    notifications: {
      unread,
      rows: notifications.map((row) => ({
        id: row._id,
        kind: String(row.kind ?? "info"),
        severity: row.severity === "danger" || row.severity === "warning" ? row.severity : "info",
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        createdAt: String(row.createdAt ?? ""),
        read: Boolean(row.read),
      })),
    },
  };
}

type AccountDoc = {
  _id: string; name?: string; currency?: string | null; status?: number | null; disableReason?: string | null;
  amountSpent?: number | null; spendCap?: number | null; balance?: number | null; fundingSource?: unknown;
  metaUserName?: string; metaUserIds?: string[]; updatedAt?: string;
};
