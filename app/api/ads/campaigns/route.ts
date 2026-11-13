import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveVersionId, getRegionSummaries } from "@/lib/ads-desk/store";
import { getRegionMap } from "@/lib/ads-desk/mapping";
import { caseAllowed } from "@/lib/session-scope";
import { adsManagerAds, adsManagerAdsets, adsManagerForCampaign } from "@/lib/ads-desk/links";
import { getMongo } from "@/lib/mongodb";
import { getClientLinks } from "@/lib/ads-desk/settings";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

type CampaignDoc = {
  versionId: string; regionKey: string; accountId: string;
  id: string; name: string; delivery: string; start: string; end: string;
  spend: number; reach: number; impressions: number; views: number; clicks: number; engagements: number;
  results: number | null; resultLabel: string | null; costPerResult: number | null;
  adsets?: number | null; ads?: number | null;
};

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers });

  const url = req.nextUrl;
  const regionKey = String(url.searchParams.get("region") ?? "").slice(0, 40);
  const accountName = String(url.searchParams.get("account") ?? "").slice(0, 200);
  const page = Math.min(10_000, Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));
  const q = String(url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const sortParam = String(url.searchParams.get("sort") ?? "impressions");
  const sortKey = (["impressions", "reach", "clicks", "results"].includes(sortParam) ? sortParam : "impressions") as "impressions" | "reach" | "clicks" | "results";
  if (!regionKey || !accountName) return Response.json({ ok: false, error: "region and account are required" }, { status: 400, headers });

  if (session.role === "client") {
    const map = await getRegionMap();
    const slug = map[regionKey];
    if (!slug || !(await caseAllowed(session, slug))) return Response.json({ ok: false, error: "Forbidden" }, { status: 403, headers });
  }

  const versionId = await getActiveVersionId();
  if (!versionId) return Response.json({ ok: true, total: 0, page: 1, pageSize, campaigns: [] }, { headers });
  const summaries = await getRegionSummaries(versionId);
  const summary = summaries.find((item) => item.regionKey === regionKey);
  const account = summary?.accounts.find((item) => item.name === accountName);
  if (!summary || !account) return Response.json({ ok: false, error: "Account not found" }, { status: 404, headers });

  const promise = getMongo();
  if (!promise) return Response.json({ ok: false, error: "Database not configured" }, { status: 503, headers });
  const database = (await promise).db(process.env.MONGODB_DB || "reachout");
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = { versionId, regionKey, accountId: account.id, ...(q ? { name: { $regex: escaped, $options: "i" } } : {}) };
  const [total, rows] = await Promise.all([
    database.collection<CampaignDoc>("ads_campaigns").countDocuments(query),
    database.collection<CampaignDoc>("ads_campaigns")
      .find(query, { projection: { _id: 0 } })
      .sort({ [sortKey]: -1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);

  const owner = session.role === "owner";
  const links = owner || (await getClientLinks());
  const campaigns = rows.map((campaign) => ({
    name: campaign.name,
    delivery: campaign.delivery.replace("Stopped by account spend limit", "Stopped by account limit"),
    start: campaign.start,
    end: campaign.end,
    reach: campaign.reach,
    impressions: campaign.impressions,
    views: campaign.views,
    clicks: campaign.clicks,
    engagements: campaign.engagements,
    results: campaign.results,
    resultLabel: campaign.resultLabel,
    ...(owner ? { spend: campaign.spend, costPerResult: campaign.costPerResult } : {}),
    ...(links ? {
      adsets: campaign.adsets ?? null,
      ads: campaign.ads ?? null,
      href: adsManagerForCampaign(account.id, campaign.id),
      adsetsHref: adsManagerAdsets(account.id, campaign.id),
      adsHref: adsManagerAds(account.id, campaign.id),
    } : {}),
  }));

  return Response.json({ ok: true, total, page, pageSize, hasMore: page * pageSize < total, campaigns }, { headers });
}
