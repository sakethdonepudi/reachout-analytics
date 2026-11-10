import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRecentAuth, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getMetaDb } from "@/lib/meta/store";
import { PARTY_OPTIONS, STATE_OPTIONS, type MetaCampaignTag } from "@/lib/meta/tags";

export const runtime = "nodejs";

const Body = z.object({
  campaignId: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  party: z.string().min(1).max(60),
  confirmed: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const [campaigns, tags, accounts] = await Promise.all([
    db.collection<{ _id: string; name?: string; accountId?: string; status?: string; effectiveStatus?: string }>("meta_campaigns").find({}).sort({ name: 1 }).toArray(),
    db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").find({}).toArray(),
    db.collection<{ _id: string; name?: string; currency?: string }>("meta_accounts").find({}).toArray(),
  ]);
  const tagMap = new Map(tags.map((tag) => [tag.campaignId, tag]));
  return Response.json({
    ok: true,
    campaigns: campaigns.map((campaign) => ({
      id: campaign._id,
      name: campaign.name ?? campaign._id,
      accountId: campaign.accountId ?? null,
      status: campaign.status ?? null,
      effectiveStatus: campaign.effectiveStatus ?? null,
      tag: tagMap.get(campaign._id) ?? null,
    })),
    accounts: accounts.map((account) => ({ id: account._id, name: account.name ?? account._id, currency: account.currency ?? null })),
    states: STATE_OPTIONS,
    parties: PARTY_OPTIONS,
  }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid tag" }, { status: 400 });
  if (!STATE_OPTIONS.some((state) => state.slug === parsed.data.state)) {
    return Response.json({ ok: false, error: "Unknown state" }, { status: 400 });
  }

  const campaign = await db.collection<{ _id: string; accountId?: string }>("meta_campaigns").findOne({ _id: parsed.data.campaignId });
  if (!campaign) return Response.json({ ok: false, error: "Campaign not found" }, { status: 404 });

  const tag: MetaCampaignTag & { _id: string } = {
    _id: parsed.data.campaignId,
    campaignId: parsed.data.campaignId,
    accountId: campaign.accountId ?? "",
    state: parsed.data.state,
    party: parsed.data.party,
    source: "manual",
    confirmed: parsed.data.confirmed ?? true,
    updatedAt: new Date().toISOString(),
  };
  await db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").replaceOne({ _id: tag._id }, tag, { upsert: true });
  await audit({ action: "meta_settings", role: "owner", meta: { tag: tag.campaignId, state: tag.state, party: tag.party } });
  return Response.json({ ok: true, tag }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function DELETE(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const campaignId = new URL(req.url).searchParams.get("campaignId") ?? "";
  if (!campaignId) return Response.json({ ok: false, error: "campaignId is required" }, { status: 400 });
  await db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").deleteOne({ campaignId });
  await audit({ action: "meta_settings", role: "owner", meta: { untag: campaignId } });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
