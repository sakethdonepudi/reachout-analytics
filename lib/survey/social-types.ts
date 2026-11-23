export type TnSocialCampaign = {
  id?: string; name: string; period: string; status: string; start: string;
  reach: number; impressions: number; views: number; clicks: number; engagements: number;
  href?: string | null;
};
export type TnSocialAccount = {
  key: string;
  name: string;
  id?: string;
  business?: string;
  campaignCount: number; reach: number; impressions: number; views: number; clicks: number; engagements: number;
  href?: string | null;
};
export type TnSocialPeriod = {
  key: string; label: string; campaigns: number; reach: number; impressions: number; views: number; clicks: number; engagements: number; responses?: number;
};
export type TnSocialTotals = { accounts: number; campaigns: number; reach: number; impressions: number; views: number; clicks: number; engagements: number };
export type TnSocialOverview = {
  label: string; range: string; asOf?: string; note?: string;
  totals: TnSocialTotals; accounts: TnSocialAccount[]; periods: TnSocialPeriod[];
};
export type TnSocialFiltered = {
  title: string; note: string; how: string;
  accounts: TnSocialAccount[]; campaigns: TnSocialCampaign[]; totalMatching: number;
};
export type SocialFilter = {
  match: "target" | "campaigns" | "group";
  kind?: string;
  place?: string;
  label?: string;
  value?: string;
  average?: string;
  group?: string;
};
