import "server-only";

import type { AdsParse } from "@/lib/ads-desk/parse";
import {
  adLibraryLink, adsManagerAds, adsManagerAdsets, adsManagerCampaigns, adsManagerForCampaign,
  billing, insightsLink, pageLink,
} from "@/lib/ads-desk/links";

/**
 * Deep-copy parsed Ads Desk data and attach owner-only outbound links.
 * Every URL is built here, server-side, from validated numeric Meta IDs.
 * Callers must never pass the result of this function to a client scope.
 */
export function withOwnerLinks(data: AdsParse): AdsParse {
  return {
    ...data,
    regions: data.regions.map((region) => ({
      ...region,
      accounts: region.accounts.map((account) => ({
        ...account,
        href: adsManagerCampaigns(account.id),
        billingHref: billing(account.id),
        allAdsetsHref: adsManagerAdsets(account.id),
        allAdsHref: adsManagerAds(account.id),
        campaigns: account.campaigns.map((campaign) => ({
          ...campaign,
          href: adsManagerForCampaign(account.id, campaign.id),
          adsetsHref: campaign.adsets == null ? null : adsManagerAdsets(account.id, campaign.id),
          adsHref: campaign.ads == null ? null : adsManagerAds(account.id, campaign.id),
        })),
      })),
    })),
    snap: {
      ...data.snap,
      accounts: data.snap.accounts.map((account) => ({
        ...account,
        href: adsManagerCampaigns(account.id),
        billingHref: billing(account.id),
        allAdsetsHref: adsManagerAdsets(account.id),
        allAdsHref: adsManagerAds(account.id),
      })),
      pages: data.snap.pages.map((page) => ({
        ...page,
        href: pageLink(page.id),
        insightsHref: insightsLink(page.id),
        adLibraryHref: adLibraryLink(page.id),
      })),
    },
  };
}
