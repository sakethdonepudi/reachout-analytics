import type { Db } from "mongodb";
import { graphGet, graphPaged, MetaConnectionExpiredError, MetaReconnectError } from "@/lib/meta/client";
import { connectionExpiresAt, isConnectionExpired, minorToPaise, toPaise } from "@/lib/meta/insights";
import { expireConnection, getConnectionDoc, getMetaDb, markSynced } from "@/lib/meta/store";
import { applyTagRules } from "@/lib/meta/tags";
import { syncNotifications } from "@/lib/meta/notifications";

type MetaRow = Record<string, unknown>;
type UpsertDoc = { _id: string } & Record<string, unknown>;
export type SyncResult = {
  ok: boolean;
  runId?: string;
  skipped?: "not-connected" | "expired" | "reconnect" | "locked" | "database";
  error?: string;
  counts?: Record<string, number>;
};

const INSIGHT_FIELDS = [
  "impressions", "reach", "frequency", "clicks", "inline_link_clicks", "ctr",
  "video_play_actions", "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p100_watched_actions", "video_thruplay_watched_actions",
  "spend", "cpm", "cpc", "cost_per_thruplay", "post_engagement",
].join(",");

const RANGE_PRESETS = [
  { key: "today", preset: "today" },
  { key: "yesterday", preset: "yesterday" },
  { key: "7d", preset: "last_7d" },
  { key: "30d", preset: "last_30d" },
  { key: "month", preset: "this_month" },
  { key: "lifetime", preset: "maximum" },
] as const;

const num = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function actionTotal(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => {
      if (item && typeof item === "object") return sum + (num((item as Record<string, unknown>).value) ?? 0);
      return sum;
    }, 0);
  }
  return num(value) ?? 0;
}

async function acquireLock(db: Db): Promise<boolean> {
  try {
    const now = new Date();
    const result = await db.collection<{ _id: string; lockedAt?: Date; expiresAt?: Date }>("meta_sync_lock").findOneAndUpdate(
      { _id: "owner", $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { lockedAt: now, expiresAt: new Date(now.getTime() + 15 * 60 * 1000) } },
      { upsert: true, returnDocument: "after" },
    );
    return Boolean(result);
  } catch {
    return false;
  }
}

async function releaseLock(db: Db) {
  await db.collection<{ _id: string }>("meta_sync_lock").deleteOne({ _id: "owner" }).catch(() => {});
}

async function upsertDocs(db: Db, collection: string, docs: UpsertDoc[]): Promise<number> {
  if (!docs.length) return 0;
  const col = db.collection<{ _id: string }>(collection);
  for (let index = 0; index < docs.length; index += 500) {
    const batch = docs.slice(index, index + 500);
    const ops = batch.map((doc) => ({
      updateOne: { filter: { _id: doc._id }, update: { $set: doc }, upsert: true },
    }));
    await col.bulkWrite(ops as never);
  }
  return docs.length;
}

async function syncAccount(db: Db, accountId: string): Promise<number> {
  const row = await graphGet<MetaRow>(`/${accountId}`, {
    fields: "name,account_status,disable_reason,currency,amount_spent,spend_cap,balance,funding_source_details",
  });
  return upsertDocs(db, "meta_accounts", [{
    _id: accountId,
    accountId,
    name: String(row.name ?? accountId),
    status: num(row.account_status),
    disableReason: row.disable_reason ? String(row.disable_reason) : null,
    currency: row.currency ? String(row.currency) : null,
    amountSpent: minorToPaise(row.amount_spent as string | number | undefined),
    spendCap: minorToPaise(row.spend_cap as string | number | undefined),
    balance: minorToPaise(row.balance as string | number | undefined),
    fundingSource: row.funding_source_details ?? null,
    updatedAt: new Date().toISOString(),
  }]);
}

async function syncCampaigns(db: Db, accountId: string): Promise<number> {
  const rows = await graphPaged<MetaRow>(`/${accountId}/campaigns`, {
    fields: "id,name,objective,status,effective_status,start_time,stop_time,daily_budget,lifetime_budget",
  });
  return upsertDocs(db, "meta_campaigns", rows.map((row) => ({
    _id: String(row.id),
    accountId,
    name: String(row.name ?? ""),
    objective: row.objective ? String(row.objective) : null,
    status: row.status ? String(row.status) : null,
    effectiveStatus: row.effective_status ? String(row.effective_status) : null,
    startTime: row.start_time ? String(row.start_time) : null,
    endTime: row.stop_time ? String(row.stop_time) : null,
    dailyBudget: minorToPaise(row.daily_budget as string | undefined),
    lifetimeBudget: minorToPaise(row.lifetime_budget as string | undefined),
    updatedAt: new Date().toISOString(),
  })));
}

async function syncAdsets(db: Db, accountId: string): Promise<number> {
  const rows = await graphPaged<MetaRow>(`/${accountId}/adsets`, {
    fields: "id,campaign_id,name,status,effective_status,start_time,end_time,daily_budget,lifetime_budget",
  });
  return upsertDocs(db, "meta_adsets", rows.map((row) => ({
    _id: String(row.id),
    campaignId: String(row.campaign_id ?? ""),
    accountId,
    name: String(row.name ?? ""),
    status: row.status ? String(row.status) : null,
    effectiveStatus: row.effective_status ? String(row.effective_status) : null,
    startTime: row.start_time ? String(row.start_time) : null,
    endTime: row.end_time ? String(row.end_time) : null,
    dailyBudget: minorToPaise(row.daily_budget as string | undefined),
    lifetimeBudget: minorToPaise(row.lifetime_budget as string | undefined),
    updatedAt: new Date().toISOString(),
  })));
}

async function syncAds(db: Db, accountId: string): Promise<number> {
  const rows = await graphPaged<MetaRow>(`/${accountId}/ads`, {
    fields: "id,adset_id,campaign_id,name,status,effective_status,creative{id}",
  });
  return upsertDocs(db, "meta_ads", rows.map((row) => ({
    _id: String(row.id),
    adsetId: String(row.adset_id ?? ""),
    campaignId: String(row.campaign_id ?? ""),
    accountId,
    name: String(row.name ?? ""),
    status: row.status ? String(row.status) : null,
    effectiveStatus: row.effective_status ? String(row.effective_status) : null,
    creativeId: row.creative && typeof row.creative === "object" ? String((row.creative as Record<string, unknown>).id ?? "") : null,
    updatedAt: new Date().toISOString(),
  })));
}

async function syncCreatives(db: Db, accountId: string): Promise<number> {
  const rows = await graphPaged<MetaRow>(`/${accountId}/adcreatives`, {
    fields: "id,video_id,thumbnail_url,image_url,effective_object_story_id,effective_instagram_media_id,instagram_permalink_url,body,title",
  });
  return upsertDocs(db, "meta_creatives", rows.map((row) => ({
    _id: String(row.id),
    videoId: row.video_id ? String(row.video_id) : null,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    imageUrl: row.image_url ? String(row.image_url) : null,
    effectiveObjectStoryId: row.effective_object_story_id ? String(row.effective_object_story_id) : null,
    effectiveInstagramMediaId: row.effective_instagram_media_id ? String(row.effective_instagram_media_id) : null,
    instagramPermalinkUrl: row.instagram_permalink_url ? String(row.instagram_permalink_url) : null,
    body: row.body ? String(row.body) : null,
    title: row.title ? String(row.title) : null,
    updatedAt: new Date().toISOString(),
  })));
}

function dailyDoc(accountId: string, level: "campaign" | "ad", row: MetaRow): UpsertDoc {
  const entityId = level === "campaign" ? String(row.campaign_id ?? "") : String(row.ad_id ?? "");
  const platform = row.publisher_platform ? String(row.publisher_platform) : "all";
  return {
    _id: `${level}:${entityId}:${String(row.date_start)}:${platform}`,
    accountId,
    level,
    entityId,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    adId: row.ad_id ? String(row.ad_id) : null,
    date: String(row.date_start),
    platform,
    impressions: num(row.impressions) ?? 0,
    reach: num(row.reach) ?? 0,
    frequency: num(row.frequency),
    clicks: num(row.clicks) ?? 0,
    inlineLinkClicks: num(row.inline_link_clicks) ?? 0,
    ctr: num(row.ctr),
    videoPlays: actionTotal(row.video_play_actions),
    videoP25: actionTotal(row.video_p25_watched_actions),
    videoP50: actionTotal(row.video_p50_watched_actions),
    videoP75: actionTotal(row.video_p75_watched_actions),
    videoP100: actionTotal(row.video_p100_watched_actions),
    thruPlays: actionTotal(row.video_thruplay_watched_actions),
    postEngagement: num(row.post_engagement) ?? 0,
    spend: toPaise(row.spend as string | undefined) ?? 0,
    cpm: toPaise(row.cpm as string | undefined),
    cpc: toPaise(row.cpc as string | undefined),
    costPerThruplay: toPaise(row.cost_per_thruplay as string | undefined),
    updatedAt: new Date().toISOString(),
  };
}

function rangeDoc(accountId: string, level: "account" | "campaign" | "ad", rangeKey: string, row: MetaRow): UpsertDoc {
  const entityId = level === "account" ? accountId : level === "campaign" ? String(row.campaign_id ?? "") : String(row.ad_id ?? "");
  const platform = row.publisher_platform ? String(row.publisher_platform) : "all";
  return {
    _id: `${level}:${entityId}:${rangeKey}:${platform}`,
    accountId,
    level,
    rangeKey,
    entityId,
    campaignId: row.campaign_id ? String(row.campaign_id) : null,
    adId: row.ad_id ? String(row.ad_id) : null,
    platform,
    dateStart: row.date_start ? String(row.date_start) : null,
    dateStop: row.date_stop ? String(row.date_stop) : null,
    impressions: num(row.impressions) ?? 0,
    reach: num(row.reach) ?? 0,
    frequency: num(row.frequency),
    clicks: num(row.clicks) ?? 0,
    inlineLinkClicks: num(row.inline_link_clicks) ?? 0,
    ctr: num(row.ctr),
    videoPlays: actionTotal(row.video_play_actions),
    videoP25: actionTotal(row.video_p25_watched_actions),
    videoP50: actionTotal(row.video_p50_watched_actions),
    videoP75: actionTotal(row.video_p75_watched_actions),
    videoP100: actionTotal(row.video_p100_watched_actions),
    thruPlays: actionTotal(row.video_thruplay_watched_actions),
    postEngagement: num(row.post_engagement) ?? 0,
    spend: toPaise(row.spend as string | undefined) ?? 0,
    cpm: toPaise(row.cpm as string | undefined),
    cpc: toPaise(row.cpc as string | undefined),
    costPerThruplay: toPaise(row.cost_per_thruplay as string | undefined),
    updatedAt: new Date().toISOString(),
  };
}

async function syncDaily(db: Db, accountId: string, since: string, until: string): Promise<number> {
  let total = 0;
  for (const level of ["campaign", "ad"] as const) {
    const rows = await graphPaged<MetaRow>(`/${accountId}/insights`, {
      level,
      fields: INSIGHT_FIELDS,
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      breakdowns: "publisher_platform",
    });
    total += await upsertDocs(db, "meta_insights_daily", rows.map((row) => dailyDoc(accountId, level, row)));
  }
  return total;
}

async function syncRanges(db: Db, accountId: string): Promise<number> {
  let total = 0;
  for (const range of RANGE_PRESETS) {
    for (const level of ["account", "campaign", "ad"] as const) {
      const rows = await graphPaged<MetaRow>(`/${accountId}/insights`, {
        level,
        fields: INSIGHT_FIELDS,
        date_preset: range.preset,
        time_increment: "all_days",
        breakdowns: "publisher_platform",
      });
      total += await upsertDocs(db, "meta_insights_range", rows.map((row) => rangeDoc(accountId, level, range.key, row)));
    }
    // A single account-level all_days row without a platform breakdown gives
    // the unique reach for the account. Reach is never summed from daily rows.
    const totals = await graphPaged<MetaRow>(`/${accountId}/insights`, {
      level: "account",
      fields: INSIGHT_FIELDS,
      date_preset: range.preset,
      time_increment: "all_days",
    });
    total += await upsertDocs(db, "meta_insights_range", totals.map((row) => rangeDoc(accountId, "account", range.key, row)));
  }
  return total;
}

/** Sync selected ad accounts. First sync backfills 90 days; later runs use 7. */
export async function syncMeta(options: { backfill?: boolean } = {}): Promise<SyncResult> {
  const db = await getMetaDb();
  if (!db) return { ok: false, skipped: "database" };
  const doc = await getConnectionDoc();
  if (!doc) return { ok: false, skipped: "not-connected" };

  const expiresAt = doc.expiresAt ?? (doc.connectedAt ? connectionExpiresAt(doc.connectedAt) : null);
  if (isConnectionExpired(expiresAt)) {
    await expireConnection(doc);
    return { ok: false, skipped: "expired" };
  }

  if (!(await acquireLock(db))) return { ok: false, skipped: "locked" };

  const runId = globalThis.crypto.randomUUID();
  const startedAt = new Date();
  const counts: Record<string, number> = {};
  const backfill = options.backfill || !doc.lastSyncAt;
  const days = backfill ? 90 : 7;
  const untilDate = new Date();
  const sinceDate = new Date(untilDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const until = untilDate.toISOString().slice(0, 10);
  const since = sinceDate.toISOString().slice(0, 10);
  const accounts = doc.enabledAdAccounts.length
    ? doc.adAccounts.filter((account) => doc.enabledAdAccounts.includes(account.id))
    : doc.adAccounts;

  try {
    await db.collection<{ _id: string } & Record<string, unknown>>("meta_sync_runs").insertOne({
      _id: runId, startedAt, status: "running", backfill, counts: {}, error: null,
    });

    for (const account of accounts) {
      counts.meta_accounts = (counts.meta_accounts ?? 0) + await syncAccount(db, account.id);
      counts.meta_campaigns = (counts.meta_campaigns ?? 0) + await syncCampaigns(db, account.id);
      counts.meta_adsets = (counts.meta_adsets ?? 0) + await syncAdsets(db, account.id);
      counts.meta_ads = (counts.meta_ads ?? 0) + await syncAds(db, account.id);
      counts.meta_creatives = (counts.meta_creatives ?? 0) + await syncCreatives(db, account.id);
      counts.meta_insights_daily = (counts.meta_insights_daily ?? 0) + await syncDaily(db, account.id, since, until);
      counts.meta_insights_range = (counts.meta_insights_range ?? 0) + await syncRanges(db, account.id);
    }

    counts.meta_campaign_tags = await applyTagRules(db).catch(() => 0);
    counts.meta_notifications = await syncNotifications(db).catch(() => 0);
    await db.collection<{ _id: string } & Record<string, unknown>>("meta_sync_runs").updateOne(
      { _id: runId },
      { $set: { finishedAt: new Date(), status: "success", counts } },
    );
    await markSynced(untilDate.toISOString());
    return { ok: true, runId, counts };
  } catch (error) {
    if (error instanceof MetaConnectionExpiredError) {
      await db.collection<{ _id: string } & Record<string, unknown>>("meta_sync_runs").updateOne({ _id: runId }, { $set: { finishedAt: new Date(), status: "expired", error: "connection-expired" } });
      return { ok: false, skipped: "expired", runId };
    }
    if (error instanceof MetaReconnectError) {
      await db.collection<{ _id: string } & Record<string, unknown>>("meta_sync_runs").updateOne({ _id: runId }, { $set: { finishedAt: new Date(), status: "reconnect", error: "reconnect-required" } });
      return { ok: false, skipped: "reconnect", runId };
    }
    const message = error instanceof Error ? error.message : "Sync failed";
    await db.collection<{ _id: string } & Record<string, unknown>>("meta_sync_runs").updateOne({ _id: runId }, { $set: { finishedAt: new Date(), status: "failed", error: message } });
    return { ok: false, error: message, runId };
  } finally {
    await releaseLock(db);
  }
}
