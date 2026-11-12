import "server-only";

import type { AdsParse, AdsRegion } from "@/lib/ads-desk/parse";
import type { AdsRegionSummary } from "@/lib/ads-desk/summary";
import {
  adsManagerAds, adsManagerAdsets, adsManagerCampaigns, adsManagerForCampaign, billing,
} from "@/lib/ads-desk/links";

export type AdsSocialCampaign = {
  name: string; delivery: string; start: string; end: string;
  reach: number; impressions: number; views: number; clicks: number; engagements: number;
  results: number | null; resultLabel: string | null; spend?: number; costPerResult?: number | null;
  adsets?: number | null; ads?: number | null;
  href?: string | null; adsetsHref?: string | null; adsHref?: string | null;
};
export type AdsSocialAccount = {
  name: string;
  campaignCount?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  engagements?: number;
  spend?: number;
  results?: number;
  href?: string | null; billingHref?: string | null; allAdsetsHref?: string | null; allAdsHref?: string | null;
  campaigns: AdsSocialCampaign[];
};
export type AdsSocialView = {
  available: boolean; key: string; label: string; range: string; note: string; asOf: string; viewsLabel: string | null;
  band: string; bandSoft: string;
  totals: { accounts: number; campaigns: number; reach: number; impressions: number; views: number; clicks: number; engagements: number; spend?: number };
  accounts: AdsSocialAccount[];
};

const EMPTY: AdsSocialView = {
  available: false, key: "", label: "", range: "", note: "", asOf: "", viewsLabel: null, band: "", bandSoft: "",
  totals: { accounts: 0, campaigns: 0, reach: 0, impressions: 0, views: 0, clicks: 0, engagements: 0 },
  accounts: [],
};

export function buildAdsSocial(version: AdsParse | AdsRegion | null, regionKey: string, includeCost: boolean): AdsSocialView {
  if (!version) return EMPTY;
  const region = "regions" in version ? version.regions.find((item) => item.key === regionKey) : version;
  if (!region) return EMPTY;
  return {
    available: true,
    key: region.key,
    label: region.label, range: region.range,
    note: includeCost || !/spend|cost|budget|payment|billing|cpm/i.test(region.note) ? region.note : "Election campaign delivery overview.",
    asOf: region.asOf, viewsLabel: region.viewsLabel,
    band: region.colors.band, bandSoft: region.colors.bandSoft,
    totals: {
      accounts: region.totals.accounts, campaigns: region.totals.campaigns, reach: region.totals.reach,
      impressions: region.totals.impressions, views: region.totals.views, clicks: region.totals.clicks,
      engagements: region.totals.engagements,
      ...(includeCost ? { spend: region.totals.spend } : {}),
    },
    accounts: region.accounts.map((account) => ({
      name: account.name,
      ...(includeCost ? {
        href: adsManagerCampaigns(account.id),
        billingHref: billing(account.id),
        allAdsetsHref: adsManagerAdsets(account.id),
        allAdsHref: adsManagerAds(account.id),
      } : {}),
      campaigns: account.campaigns.map((campaign) => ({
        name: campaign.name, delivery: campaign.delivery, start: campaign.start, end: campaign.end,
        reach: campaign.reach, impressions: campaign.impressions, views: campaign.views,
        clicks: campaign.clicks, engagements: campaign.engagements,
        results: campaign.results, resultLabel: campaign.resultLabel,
        ...(includeCost ? {
          spend: campaign.spend, costPerResult: campaign.costPerResult,
          adsets: campaign.adsets ?? null, ads: campaign.ads ?? null,
          href: adsManagerForCampaign(account.id, campaign.id),
          adsetsHref: campaign.adsets == null ? null : adsManagerAdsets(account.id, campaign.id),
          adsHref: campaign.ads == null ? null : adsManagerAds(account.id, campaign.id),
        } : {}),
      })),
    })),
  };
}

export function buildAdsSocialFromSummary(summary: AdsRegionSummary, includeCost: boolean): AdsSocialView {
  return {
    available: true,
    key: summary.regionKey,
    label: summary.label,
    range: summary.range,
    note: includeCost || !/spend|cost|budget|payment|billing|cpm/i.test(summary.note) ? summary.note : "Election campaign delivery overview.",
    asOf: summary.asOf,
    viewsLabel: summary.viewsLabel,
    band: summary.band,
    bandSoft: summary.bandSoft,
    totals: {
      accounts: summary.totals.accounts,
      campaigns: summary.totals.campaigns,
      reach: summary.totals.reach,
      impressions: summary.totals.impressions,
      views: summary.totals.views,
      clicks: summary.totals.clicks,
      engagements: summary.totals.engagements,
      ...(includeCost ? { spend: summary.totals.spend } : {}),
    },
    accounts: summary.accounts.map((account) => ({
      name: account.name,
      campaignCount: account.campaigns,
      impressions: account.impressions,
      reach: account.reach,
      clicks: account.clicks,
      engagements: account.engagements,
      results: account.results,
      ...(includeCost ? {
        spend: account.spend,
        href: adsManagerCampaigns(account.id),
        billingHref: billing(account.id),
        allAdsetsHref: adsManagerAdsets(account.id),
        allAdsHref: adsManagerAds(account.id),
      } : {}),
      campaigns: [],
    })),
  };
}
