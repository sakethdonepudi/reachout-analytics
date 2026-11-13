import "server-only";

import type { AdsParse, AdsRegion } from "@/lib/ads-desk/parse";
import { rate } from "@/lib/ads-desk/format";

export type AdsAccountAggregate = {
  id: string;
  name: string;
  campaigns: number;
  reach: number;
  impressions: number;
  views: number;
  clicks: number;
  engagements: number;
  spend: number;
  results: number;
};

export type AdsTopAccount = { id: string; name: string; value: number };

export const SUMMARY_SCHEMA = 2;

export type AdsRegionSummary = {
  schemaVersion: number;
  versionId: string;
  regionKey: string;
  label: string;
  range: string;
  note: string;
  asOf: string;
  takenAt: string;
  viewsLabel: string | null;
  band: string;
  bandSoft: string;
  totals: AdsRegion["totals"];
  rates: { ctr: number; engagementRate: number; cpm: number };
  accounts: AdsAccountAggregate[];
  top: { impressions: AdsTopAccount[]; reach: AdsTopAccount[]; engagements: AdsTopAccount[] };
};

function aggregate(region: AdsRegion): AdsAccountAggregate[] {
  return region.accounts.map((account) => {
    const campaigns = account.campaigns;
    return {
      id: account.id,
      name: account.name,
      campaigns: campaigns.length,
      reach: campaigns.reduce((sum, item) => sum + item.reach, 0),
      impressions: campaigns.reduce((sum, item) => sum + item.impressions, 0),
      views: campaigns.reduce((sum, item) => sum + item.views, 0),
      clicks: campaigns.reduce((sum, item) => sum + item.clicks, 0),
      engagements: campaigns.reduce((sum, item) => sum + item.engagements, 0),
      spend: campaigns.reduce((sum, item) => sum + item.spend, 0),
      results: campaigns.reduce((sum, item) => sum + (item.results ?? 0), 0),
    };
  });
}

function topTen(accounts: AdsAccountAggregate[], key: "impressions" | "reach" | "engagements"): AdsTopAccount[] {
  return [...accounts].sort((a, b) => b[key] - a[key]).slice(0, 10).map((account) => ({ id: account.id, name: account.name, value: account[key] }));
}

export function buildRegionSummary(region: AdsRegion, versionId: string, takenAt: string): AdsRegionSummary {
  const accounts = aggregate(region);
  const totalImpressions = region.totals.impressions;
  return {
    schemaVersion: SUMMARY_SCHEMA,
    versionId,
    regionKey: region.key,
    label: region.label,
    range: region.range,
    note: region.note,
    asOf: region.asOf,
    takenAt,
    viewsLabel: region.viewsLabel,
    band: region.colors.band,
    bandSoft: region.colors.bandSoft,
    totals: region.totals,
    rates: {
      ctr: rate(region.totals.clicks, totalImpressions),
      engagementRate: rate(region.totals.engagements, totalImpressions),
      cpm: totalImpressions > 0 ? (region.totals.spend / totalImpressions) * 1000 : 0,
    },
    accounts,
    top: {
      impressions: topTen(accounts, "impressions"),
      reach: topTen(accounts, "reach"),
      engagements: topTen(accounts, "engagements"),
    },
  };
}

export function buildRegionSummaries(parsed: AdsParse, versionId: string): AdsRegionSummary[] {
  return parsed.regions.map((region) => buildRegionSummary(region, versionId, parsed.takenAt));
}
