import "server-only";

import type { AdsParse, AdsRegion } from "@/lib/ads-desk/parse";

export type AdsSocialCampaign = {
  name: string; delivery: string; start: string; end: string;
  reach: number; impressions: number; views: number; clicks: number; engagements: number;
  results: number | null; resultLabel: string | null; spend?: number; costPerResult?: number | null;
};
export type AdsSocialAccount = { name: string; campaigns: AdsSocialCampaign[] };
export type AdsSocialView = {
  available: boolean; label: string; range: string; note: string; asOf: string; viewsLabel: string | null;
  band: string; bandSoft: string;
  totals: { accounts: number; campaigns: number; reach: number; impressions: number; views: number; clicks: number; engagements: number; spend?: number };
  accounts: AdsSocialAccount[];
};

const EMPTY: AdsSocialView = {
  available: false, label: "", range: "", note: "", asOf: "", viewsLabel: null, band: "", bandSoft: "",
  totals: { accounts: 0, campaigns: 0, reach: 0, impressions: 0, views: 0, clicks: 0, engagements: 0 },
  accounts: [],
};

export function buildAdsSocial(version: AdsParse | AdsRegion | null, regionKey: string, includeCost: boolean): AdsSocialView {
  if (!version) return EMPTY;
  const region = "regions" in version ? version.regions.find((item) => item.key === regionKey) : version;
  if (!region) return EMPTY;
  return {
    available: true,
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
      campaigns: account.campaigns.map((campaign) => ({
        name: campaign.name, delivery: campaign.delivery, start: campaign.start, end: campaign.end,
        reach: campaign.reach, impressions: campaign.impressions, views: campaign.views,
        clicks: campaign.clicks, engagements: campaign.engagements,
        results: campaign.results, resultLabel: campaign.resultLabel,
        ...(includeCost ? { spend: campaign.spend, costPerResult: campaign.costPerResult } : {}),
      })),
    })),
  };
}
