import "server-only";

const ID = /^\d{5,20}$/;

export function validMetaId(value: unknown): string | null {
  const id = String(value ?? "");
  return ID.test(id) ? id : null;
}

export function adsManagerCampaigns(accountId: unknown): string | null {
  const id = validMetaId(accountId);
  return id ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${id}` : null;
}
export function billing(accountId: unknown): string | null {
  const id = validMetaId(accountId);
  return id ? `https://business.facebook.com/billing_hub/accounts/details?asset_id=${id}` : null;
}
export function adsManagerForCampaign(accountId: unknown, campaignId: unknown): string | null {
  const account = validMetaId(accountId), campaign = validMetaId(campaignId);
  return account && campaign ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account}&selected_campaign_ids=${campaign}` : null;
}
export function adsManagerAdsets(accountId: unknown, campaignId?: unknown): string | null {
  const account = validMetaId(accountId), campaign = campaignId == null ? null : validMetaId(campaignId);
  if (!account || (campaignId != null && !campaign)) return null;
  return `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${account}${campaign ? `&selected_campaign_ids=${campaign}` : ""}`;
}
export function adsManagerAds(accountId: unknown, campaignId?: unknown): string | null {
  const account = validMetaId(accountId), campaign = campaignId == null ? null : validMetaId(campaignId);
  if (!account || (campaignId != null && !campaign)) return null;
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${account}${campaign ? `&selected_campaign_ids=${campaign}` : ""}`;
}
export function pageLink(pageId: unknown): string | null {
  const id = validMetaId(pageId);
  return id ? `https://www.facebook.com/${id}` : null;
}
export function insightsLink(pageId: unknown): string | null {
  const id = validMetaId(pageId);
  return id ? `https://business.facebook.com/latest/insights/overview?asset_id=${id}` : null;
}
export function adLibraryLink(pageId: unknown): string | null {
  const id = validMetaId(pageId);
  return id ? `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=IN&view_all_page_id=${id}` : null;
}

export type OwnerLinks = {
  campaigns?: string | null; billing?: string | null; allAdsets?: string | null; allAds?: string | null;
  campaign?: string | null; adsets?: string | null; ads?: string | null;
  page?: string | null; insights?: string | null; adLibrary?: string | null;
};
