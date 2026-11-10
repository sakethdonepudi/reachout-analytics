import type { Db } from "mongodb";

type AccountDoc = { _id: string; name?: string; status?: number | null; disableReason?: string | null; amountSpent?: number | null; spendCap?: number | null };
type CampaignDoc = { _id: string; name?: string; status?: string | null; effectiveStatus?: string | null; accountId?: string };
type DailyDoc = { _id: string; level: string; campaignId?: string | null; date: string; spend?: number; impressions?: number };

export type MetaNotification = {
  _id: string;
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  accountId?: string;
  campaignId?: string;
};

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function raise(db: Db, notification: Omit<MetaNotification, "createdAt" | "read">): Promise<boolean> {
  const result = await db.collection<MetaNotification>("meta_notifications").updateOne(
    { _id: notification._id },
    { $setOnInsert: { ...notification, createdAt: new Date().toISOString(), read: false } },
    { upsert: true },
  );
  return result.upsertedCount > 0;
}

/** Generate deduplicated notifications from the latest synced state. */
export async function syncNotifications(db: Db): Promise<number> {
  const [accounts, campaigns, daily] = await Promise.all([
    db.collection<AccountDoc>("meta_accounts").find({}).toArray(),
    db.collection<CampaignDoc>("meta_campaigns").find({}).toArray(),
    db.collection<DailyDoc>("meta_insights_daily").find({ level: "campaign" }).toArray(),
  ]);
  let created = 0;

  for (const account of accounts) {
    const name = account.name ?? account._id;
    if (account.status != null && account.status !== 1) {
      if (await raise(db, {
        _id: `account:${account._id}:status:${account.status}`,
        kind: "account_status",
        severity: account.status === 2 || account.status === 101 ? "danger" : "warning",
        title: `${name} needs attention`,
        body: account.disableReason || `Ad account status ${account.status}.`,
        accountId: account._id,
      })) created += 1;
    }
    if (account.spendCap && account.spendCap > 0 && (account.amountSpent ?? 0) / account.spendCap >= 0.9) {
      if (await raise(db, {
        _id: `account:${account._id}:cap:${Math.floor(((account.amountSpent ?? 0) / account.spendCap) * 20)}`,
        kind: "spend_cap",
        severity: "warning",
        title: `${name} spend cap at ${Math.round(((account.amountSpent ?? 0) / account.spendCap) * 100)}%`,
        body: "The account has reached 90% or more of its spend cap.",
        accountId: account._id,
      })) created += 1;
    }
  }

  const yesterday = dateOffset(-1);
  const today = dateOffset(0);
  const yesterdaySpend = new Map<string, number>();
  const todayImpressions = new Map<string, number>();
  for (const row of daily) {
    if (!row.campaignId) continue;
    if (row.date === yesterday) yesterdaySpend.set(row.campaignId, (yesterdaySpend.get(row.campaignId) ?? 0) + (row.spend ?? 0));
    if (row.date === today) todayImpressions.set(row.campaignId, (todayImpressions.get(row.campaignId) ?? 0) + (row.impressions ?? 0));
  }

  for (const campaign of campaigns) {
    const name = campaign.name ?? campaign._id;
    const status = campaign.effectiveStatus ?? campaign.status;
    if (status && ["PENDING_BILLING_INFO", "WITH_ISSUES", "DISAPPROVED"].includes(status)) {
      if (await raise(db, {
        _id: `campaign:${campaign._id}:status:${status}`,
        kind: "campaign_status",
        severity: status === "DISAPPROVED" ? "danger" : "warning",
        title: `${name} · ${status.replaceAll("_", " ").toLowerCase()}`,
        body: "Review this campaign in Meta Ads Manager.",
        campaignId: campaign._id,
        accountId: campaign.accountId,
      })) created += 1;
    }
    if ((yesterdaySpend.get(campaign._id) ?? 0) > 0 && (todayImpressions.get(campaign._id) ?? 0) === 0) {
      if (await raise(db, {
        _id: `campaign:${campaign._id}:zero-delivery:${today}`,
        kind: "zero_delivery",
        severity: "warning",
        title: `${name} has no delivery today`,
        body: "This campaign spent yesterday but has zero impressions today.",
        campaignId: campaign._id,
        accountId: campaign.accountId,
      })) created += 1;
    }
  }

  return created;
}
