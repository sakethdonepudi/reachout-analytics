/* =====================================================================
   Site content — edit everything about parties and case studies here.
   ===================================================================== */

import type { PartyId } from "@/lib/parties";

export type CaseTab = "exit" | "opinion" | "social";

export const DEFAULT_CASE_TABS: CaseTab[] = ["opinion", "social"];

export function tabsForCase(item: CaseStudy | null | undefined): CaseTab[] {
  return item?.tabs?.length ? item.tabs : DEFAULT_CASE_TABS;
}

/** Map the legacy views onto a tab this state actually has. */
export function resolveCaseTab(view: string | undefined, tabs: CaseTab[]): CaseTab {
  const first = tabs[0] ?? "opinion";
  if (view === "social" && tabs.includes("social")) return "social";
  if (view === "exit" && tabs.includes("exit")) return "exit";
  if (view === "opinion" && tabs.includes("opinion")) return "opinion";
  if (view === "polls" || view === "overview") {
    const firstPoll = tabs.find((tab) => tab !== "social");
    return firstPoll ?? first;
  }
  if (view && (tabs as string[]).includes(view)) return view as CaseTab;
  return first;
}

export type CaseStudy = {
  slug: string;
  /** Tabs shown on the case-study page, in order. */
  tabs?: CaseTab[];
  /** true = the camera stops here while scrolling (in this order) */
  tour?: boolean;
  /** state id on the map (svg-maps ids: ap, tn, gj, as, tg, br, ka, …) */
  state: string;
  /** position of the marker on the 612 × 696 map */
  x: number;
  y: number;
  /** camera angle when zoomed in */
  theta?: number;
  /** horizontal nudge for the label pin in the zoomed-out view */
  pinDx?: number;
  label: string;
  badge: string;
  title: string;
  region: string;
  party?: PartyId;
  /** The state/union-territory identity shown with the party. */
  stateName: string;
  /** Election year shown on cards and in navigation. */
  year: number;
  /** No client party. The projected lead is shown with logos instead. */
  projectedLead?: { parties: PartyId[]; label: string };
  summary: string;
  tags: string[];
};

export const CASES: CaseStudy[] = [
  {
    slug: "north-east-elections", tabs: ["opinion", "social"], tour: true, state: "as", x: 495, y: 262, theta: -0.45,
    label: "North East", badge: "North East", title: "North East Elections", region: "Assam & the North-Eastern states",
    party: "BJP", stateName: "Assam", year: 2026,
    summary: "Constituency-level voter surveys and sentiment tracking across the North-East.",
    tags: ["Voter Surveys", "Sentiment Tracking", "Predictions"],
  },
  {
    slug: "tamil-nadu", tabs: ["exit", "opinion", "social"], tour: true, state: "tn", x: 250, y: 563, theta: 0.4, pinDx: 34,
    label: "Tamil Nadu", badge: "Tamil Nadu", title: "Tamil Nadu", region: "Chennai, Tamil Nadu",
    party: "AIADMK", stateName: "Tamil Nadu", year: 2026,
    summary: "Real-time voter insights and campaign strategy for AIADMK in Tamil Nadu.",
    tags: ["Voter Insights", "Campaign Strategy", "Digital Boosting"],
  },
  {
    slug: "telangana", tabs: ["social"], tour: true, state: "tg", x: 232, y: 452, theta: -0.12, pinDx: -54,
    label: "Telangana", badge: "Telangana · 2028", title: "Telangana 2028", region: "Telangana",
    stateName: "Telangana", year: 2028, projectedLead: { parties: ["BRS"], label: "BRS" },
    summary: "Live tracking survey for the 2028 Telangana election.",
    tags: ["Live Tracking", "Voter Research", "Predictions"],
  },
  {
    slug: "andhra-pradesh-2024", tabs: ["exit", "opinion", "social"], tour: true, state: "ap", x: 260, y: 500, theta: -0.25, pinDx: 44,
    label: "Andhra Pradesh", badge: "Andhra Pradesh · 2024", title: "Andhra Pradesh 2024", region: "Andhra Pradesh",
    party: "TDP", stateName: "Andhra Pradesh", year: 2024,
    summary: "High-accuracy election predictions and seat-level strategy for TDP.",
    tags: ["Election Predictions", "Booth Analytics", "Digital Boosting"],
  },
  {
    slug: "gujarat", tabs: ["opinion", "social"], tour: true, state: "gj", x: 92, y: 341, theta: 0.45,
    label: "Gujarat", badge: "Gujarat", title: "Gujarat", region: "Gujarat",
    party: "BJP", stateName: "Gujarat", year: 2026,
    summary: "Data-driven voter research and campaign analytics across Gujarat.",
    tags: ["Voter Research", "Analytics", "Strategy"],
  },
  // Shown in the zoomed-out map (not camera stops)
  {
    slug: "bihar", tabs: ["opinion", "social"], state: "br", x: 355, y: 282,
    label: "Bihar", badge: "Bihar", title: "Bihar", region: "Bihar",
    party: "JD(U)", stateName: "Bihar", year: 2026,
    summary: "Political analytics and campaign intelligence for JD(U) in Bihar.",
    tags: ["Campaign Intelligence", "Surveys"],
  },
  {
    slug: "karnataka", tabs: ["social"], tour: true, state: "ka", x: 197, y: 560, pinDx: -38,
    label: "Karnataka", badge: "Karnataka · 2028", title: "Karnataka 2028", region: "Karnataka",
    stateName: "Karnataka", year: 2028, projectedLead: { parties: ["INC", "BJP"], label: "INC votes · BJP seats" },
    summary: "Live tracking survey for the 2028 Karnataka election.",
    tags: ["Live Tracking", "Voter Research", "Predictions"],
  },
];

export const UPCOMING = [
  { title: "Lok Sabha 2029", slug: "lok-sabha-2029" },
  { title: "UP & Maharashtra 2026", slug: "up-maharashtra-2026" },
];

/** Short descriptions used on the case-study pages for each capability tag. */
export const CAPABILITIES: Record<string, string> = {
  "Voter Surveys": "Constituency-level sampling and field surveys that capture what voters actually think.",
  "Sentiment Tracking": "Continuous tracking of voter mood across regions, issues and demographics.",
  Predictions: "Seat-level forecasting models built from survey and historical data.",
  "Election Predictions": "Seat-level forecasting models built from survey and historical data.",
  "Voter Insights": "Real-time dashboards that turn field data into decisions for the campaign team.",
  "Campaign Strategy": "Messaging, targeting and resource allocation guided by the data.",
  "Digital Boosting": "Targeted digital outreach to the voter segments that move the result.",
  "Booth Analytics": "Booth-by-booth analysis to focus ground effort where it counts.",
  "Voter Research": "Structured research into voter priorities, issues and swing segments.",
  Analytics: "End-to-end analysis of survey, demographic and past-election data.",
  Strategy: "Data-backed campaign planning from announcement to polling day.",
  "Campaign Intelligence": "Competitive and ground intelligence consolidated into one view.",
  Surveys: "Large-scale surveys designed and run by trained field teams.",
};

export const CONTACT = {
  email: "hr@reachoutanalytics.com",
  phone: "+91 93901 07086",
  address: "Pillar no. 1677, Unit No. 402, 4th Floor, Westend Mall, Rd Number 36, Jubilee Hills, Hyderabad, Telangana 500081",
  linkedin: "https://www.linkedin.com/company/reachout-analytics-private-limited/",
  instagram: "https://www.instagram.com/reachout_analytics_pvt_ltd/",
};

export const LIVE_CASE_SLUGS = ["tamil-nadu", "andhra-pradesh-2024", "karnataka", "telangana"] as const;
export function isLiveCase(slug: string): boolean {
  return (LIVE_CASE_SLUGS as readonly string[]).includes(slug);
}
export function orderedCases(): CaseStudy[] {
  const live = LIVE_CASE_SLUGS.map((slug) => CASES.find((item) => item.slug === slug)).filter(Boolean) as CaseStudy[];
  return [...live, ...CASES.filter((item) => !isLiveCase(item.slug))];
}
export const caseBySlug = (slug: string) => CASES.find((c) => c.slug === slug);
export const caseUrl = (slug: string) => `/case-studies/${slug}`;

export function caseLeadParties(item: CaseStudy): PartyId[] {
  return item.party ? [item.party] : item.projectedLead?.parties ?? [];
}

export function caseLeadLabel(item: CaseStudy): string {
  return item.party ?? item.projectedLead?.label ?? "";
}

export function caseTitle(item: CaseStudy): string {
  return item.party ? `${item.party} · ${item.stateName}` : `${item.stateName} · ${item.year}`;
}
