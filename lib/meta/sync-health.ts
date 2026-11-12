import "server-only";

import type { Db } from "mongodb";
import { connectionExpiresAt } from "@/lib/meta/insights";
import { redactText } from "@/lib/redact";

export type SyncTrigger = "cron" | "manual";
export type SyncOutcome = "ok" | "partial" | "failed";

export type SyncHealthSnapshot = {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  trigger: SyncTrigger;
  outcome: SyncOutcome;
  status: string;
  error: string | null;
  backfill: boolean;
  daysResynced: number;
  counts: {
    accounts: number;
    campaigns: number;
    adsets: number;
    ads: number;
    creatives: number;
    dailyInsightRows: number;
    rangeInsightRows: number;
  };
  tagging: { confirmed: number; unconfirmed: number; untagged: number };
  reachCheck: { rangeKey: "7d"; rangeReach: number | null; dailySum: number | null; warning: boolean };
  clientVisibleCampaigns: number;
  connectionExpiresAt: string | null;
};

export type SyncHealthView = {
  latest: SyncHealthSnapshot | null;
  connectionExpiresAt: string | null;
  serverTime: string;
};

type RunDoc = {
  _id: string;
  startedAt?: Date | string;
  finishedAt?: Date | string;
  status?: string;
  outcome?: SyncOutcome;
  trigger?: SyncTrigger;
  backfill?: boolean;
  days?: number;
  counts?: Record<string, number>;
  error?: string | null;
  health?: SyncHealthSnapshot;
};
type TagDoc = { campaignId?: string; confirmed?: boolean };
type ReachDoc = { reach?: number | null; platform?: string; level?: string; rangeKey?: string; date?: string };

const RANGE_KEY = "7d" as const;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function sumReach(rows: ReachDoc[]): number | null {
  const values = rows.map((row) => row.reach).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function safeError(value: unknown): string | null {
  if (value == null || value === "") return null;
  return redactText(value);
}

/** Current tagging totals and the 7-day reach comparison, independent of the run. */
async function liveHealth(db: Db): Promise<{
  tagging: SyncHealthSnapshot["tagging"];
  clientVisibleCampaigns: number;
  reachCheck: SyncHealthSnapshot["reachCheck"];
}> {
  const until = new Date();
  const since = new Date(until.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sinceDate = since.toISOString().slice(0, 10);
  const untilDate = until.toISOString().slice(0, 10);

  const [campaigns, tags, rangeRows, dailyRows] = await Promise.all([
    db.collection<{ _id: string }>("meta_campaigns").find({}, { projection: { _id: 1 } }).toArray(),
    db.collection<TagDoc>("meta_campaign_tags").find({}, { projection: { campaignId: 1, confirmed: 1 } }).toArray(),
    db.collection<ReachDoc>("meta_insights_range").find({ level: "account", rangeKey: RANGE_KEY, platform: "all" }).toArray(),
    db.collection<ReachDoc>("meta_insights_daily")
      .find({ level: "campaign", date: { $gte: sinceDate, $lte: untilDate } })
      .toArray(),
  ]);

  const tagByCampaign = new Map(tags.map((tag) => [String(tag.campaignId ?? ""), Boolean(tag.confirmed)]));
  let confirmed = 0;
  let unconfirmed = 0;
  let untagged = 0;
  for (const campaign of campaigns) {
    const tag = tagByCampaign.get(campaign._id);
    if (tag === true) confirmed += 1;
    else if (tag === false) unconfirmed += 1;
    else untagged += 1;
  }

  const rangeReach = sumReach(rangeRows);
  const dailySum = sumReach(dailyRows);
  return {
    tagging: { confirmed, unconfirmed, untagged },
    clientVisibleCampaigns: confirmed,
    reachCheck: {
      rangeKey: RANGE_KEY,
      rangeReach,
      dailySum,
      warning: rangeReach != null && dailySum != null && rangeReach > dailySum,
    },
  };
}

/**
 * Store the run summary and prune to the 30 most recent runs. Never throws into
 * the sync path: a failed summary must not turn a successful sync into an error.
 */
export async function finalizeSyncRun(db: Db, runId: string, input: {
  trigger: SyncTrigger;
  status: string;
  outcome: SyncOutcome;
  error: string | null;
  counts: Record<string, number>;
  days: number;
  backfill: boolean;
  startedAt: Date;
  finishedAt: Date;
}): Promise<void> {
  try {
    const live = await liveHealth(db).catch(() => null);
    const connection = await db.collection<{ _id: string; expiresAt?: string; connectedAt?: string }>("meta_connection")
      .findOne({ _id: "owner" })
      .catch(() => null);
    const expiresAt = connection?.expiresAt ?? (connection?.connectedAt ? connectionExpiresAt(connection.connectedAt) : null);
    const counts = input.counts;
    const snapshot: SyncHealthSnapshot = {
      runId,
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.finishedAt.toISOString(),
      durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
      trigger: input.trigger,
      outcome: input.outcome,
      status: input.status,
      error: safeError(input.error),
      backfill: input.backfill,
      daysResynced: input.days,
      counts: {
        accounts: counts.meta_accounts ?? 0,
        campaigns: counts.meta_campaigns ?? 0,
        adsets: counts.meta_adsets ?? 0,
        ads: counts.meta_ads ?? 0,
        creatives: counts.meta_creatives ?? 0,
        dailyInsightRows: counts.meta_insights_daily ?? 0,
        rangeInsightRows: counts.meta_insights_range ?? 0,
      },
      tagging: live?.tagging ?? { confirmed: 0, unconfirmed: 0, untagged: 0 },
      reachCheck: live?.reachCheck ?? { rangeKey: RANGE_KEY, rangeReach: null, dailySum: null, warning: false },
      clientVisibleCampaigns: live?.clientVisibleCampaigns ?? 0,
      connectionExpiresAt: expiresAt,
    };

    const collection = db.collection<RunDoc>("meta_sync_runs");
    await collection.updateOne(
      { _id: runId },
      {
        $set: {
          finishedAt: input.finishedAt,
          status: input.status,
          outcome: input.outcome,
          trigger: input.trigger,
          days: input.days,
          backfill: input.backfill,
          counts,
          error: snapshot.error,
          health: snapshot,
        },
      },
    );

    const keep = await collection.find({}, { projection: { _id: 1 } }).sort({ startedAt: -1 }).limit(30).toArray();
    const ids = keep.map((row) => row._id);
    if (ids.length) await collection.deleteMany({ _id: { $nin: ids } });
  } catch {
    // Best effort. The sync result itself is returned to the caller.
  }
}

/** Owner-only view: latest run plus live tagging, reach and connection state. */
export async function getSyncHealth(db: Db): Promise<SyncHealthView> {
  const [run, live, connection] = await Promise.all([
    db.collection<RunDoc>("meta_sync_runs").find({}).sort({ startedAt: -1 }).limit(1).next().catch(() => null),
    liveHealth(db).catch(() => null),
    db.collection<{ _id: string; expiresAt?: string; connectedAt?: string }>("meta_connection").findOne({ _id: "owner" }).catch(() => null),
  ]);
  const expiresAt = connection?.expiresAt ?? (connection?.connectedAt ? connectionExpiresAt(connection.connectedAt) : null);

  let latest: SyncHealthSnapshot | null = null;
  if (run) {
    const base = run.health;
    const counts = base?.counts ?? {
      accounts: run.counts?.meta_accounts ?? 0,
      campaigns: run.counts?.meta_campaigns ?? 0,
      adsets: run.counts?.meta_adsets ?? 0,
      ads: run.counts?.meta_ads ?? 0,
      creatives: run.counts?.meta_creatives ?? 0,
      dailyInsightRows: run.counts?.meta_insights_daily ?? 0,
      rangeInsightRows: run.counts?.meta_insights_range ?? 0,
    };
    const startedAt = iso(run.startedAt);
    const finishedAt = iso(run.finishedAt);
    latest = {
      runId: run._id,
      startedAt: startedAt ?? new Date(0).toISOString(),
      finishedAt,
      durationMs: startedAt && finishedAt ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()) : null,
      trigger: base?.trigger ?? run.trigger ?? "manual",
      outcome: base?.outcome ?? (run.status === "success" ? "ok" : "failed"),
      status: run.status ?? "unknown",
      error: safeError(base?.error ?? run.error),
      backfill: base?.backfill ?? Boolean(run.backfill),
      daysResynced: base?.daysResynced ?? run.days ?? 0,
      counts,
      tagging: live?.tagging ?? base?.tagging ?? { confirmed: 0, unconfirmed: 0, untagged: 0 },
      reachCheck: live?.reachCheck ?? base?.reachCheck ?? { rangeKey: RANGE_KEY, rangeReach: null, dailySum: null, warning: false },
      clientVisibleCampaigns: live?.clientVisibleCampaigns ?? base?.clientVisibleCampaigns ?? 0,
      connectionExpiresAt: expiresAt ?? base?.connectionExpiresAt ?? null,
    };
  }

  return { latest, connectionExpiresAt: expiresAt, serverTime: new Date().toISOString() };
}
