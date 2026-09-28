/* =====================================================================
   Site content — edit everything about parties, leaders and case studies here.
   ===================================================================== */

export type Leader = {
  id: string;
  name: string;
  /** shown under the name — kept to the state so it never goes out of date */
  role: string;
  party: string;
  /** Transparent-background PNG in /public/leaders (head & shoulders, 3:4).
   *  The head breaks out of the top of the 3D frame. Empty = show initials. */
  photo: string;
  initials: string;
  caseSlug: string;
};

export const LEADERS: Leader[] = [
  { id: "cbn", name: "N. Chandrababu Naidu", role: "Andhra Pradesh", party: "TDP", photo: "/leaders/chandrababu-naidu.webp", initials: "CBN", caseSlug: "andhra-pradesh-2024" },
  { id: "eps", name: "Edappadi K. Palaniswami", role: "Tamil Nadu", party: "AIADMK", photo: "/leaders/edappadi-palaniswami.webp", initials: "EPS", caseSlug: "tamil-nadu" },
  { id: "himanta", name: "Himanta Biswa Sarma", role: "Assam", party: "BJP", photo: "/leaders/himanta-biswa-sarma.webp", initials: "HBS", caseSlug: "north-east-elections" },
  { id: "bhupendra", name: "Bhupendra Patel", role: "Gujarat", party: "BJP", photo: "/leaders/bhupendra-patel.webp", initials: "BP", caseSlug: "gujarat" },
  { id: "nitish", name: "Nitish Kumar", role: "Bihar", party: "JD(U)", photo: "/leaders/nitish-kumar.webp", initials: "NK", caseSlug: "bihar" },
  { id: "dks", name: "D. K. Shivakumar", role: "Karnataka", party: "INC", photo: "/leaders/dk-shivakumar.webp", initials: "DKS", caseSlug: "karnataka-2023" },
];

export type CaseStudy = {
  slug: string;
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
  party?: string;
  leaderId?: string;
  subtitle: string;
  summary: string;
  tags: string[];
};

export const CASES: CaseStudy[] = [
  {
    slug: "north-east-elections", tour: true, state: "as", x: 495, y: 262, theta: -0.45,
    label: "North East", badge: "North East", title: "North East Elections", region: "Assam & the North-Eastern states",
    party: "BJP", leaderId: "himanta", subtitle: "Himanta Biswa Sarma",
    summary: "Constituency-level voter surveys and sentiment tracking across the North-East.",
    tags: ["Voter Surveys", "Sentiment Tracking", "Predictions"],
  },
  {
    slug: "tamil-nadu", tour: true, state: "tn", x: 250, y: 563, theta: 0.4, pinDx: 34,
    label: "Tamil Nadu", badge: "Tamil Nadu", title: "Tamil Nadu", region: "Chennai, Tamil Nadu",
    party: "AIADMK", leaderId: "eps", subtitle: "Edappadi K. Palaniswami",
    summary: "Real-time voter insights and campaign strategy for AIADMK in Tamil Nadu.",
    tags: ["Voter Insights", "Campaign Strategy", "Digital Boosting"],
  },
  {
    slug: "andhra-pradesh-2024", tour: true, state: "ap", x: 260, y: 495, theta: -0.25, pinDx: 44,
    label: "Andhra Pradesh", badge: "Andhra Pradesh · 2024", title: "Andhra Pradesh 2024", region: "Andhra Pradesh",
    party: "TDP", leaderId: "cbn", subtitle: "N. Chandrababu Naidu",
    summary: "High-accuracy election predictions and seat-level strategy for TDP.",
    tags: ["Election Predictions", "Booth Analytics", "Digital Boosting"],
  },
  {
    slug: "gujarat", tour: true, state: "gj", x: 92, y: 341, theta: 0.45,
    label: "Gujarat", badge: "Gujarat", title: "Gujarat", region: "Gujarat",
    party: "BJP", leaderId: "bhupendra", subtitle: "Bhupendra Patel",
    summary: "Data-driven voter research and campaign analytics across Gujarat.",
    tags: ["Voter Research", "Analytics", "Strategy"],
  },
  // Shown in the zoomed-out map (not camera stops)
  {
    slug: "telangana", state: "tg", x: 219, y: 467, pinDx: -40,
    label: "Telangana", badge: "Telangana", title: "Telangana", region: "Telangana",
    party: "INC", subtitle: "Indian National Congress",
    summary: "Political analytics and voter insights for Congress in Telangana.",
    tags: ["Voter Insights", "Analytics"],
  },
  {
    slug: "bihar", state: "br", x: 355, y: 282,
    label: "Bihar", badge: "Bihar", title: "Bihar", region: "Bihar",
    party: "JD(U)", leaderId: "nitish", subtitle: "Nitish Kumar",
    summary: "Political analytics and campaign intelligence for JD(U) in Bihar.",
    tags: ["Campaign Intelligence", "Surveys"],
  },
  {
    slug: "karnataka-2023", state: "ka", x: 197, y: 560, pinDx: -38,
    label: "Karnataka", badge: "Karnataka · 2023", title: "Karnataka 2023", region: "Karnataka",
    party: "INC", leaderId: "dks", subtitle: "D. K. Shivakumar",
    summary: "Election analytics and voter research for the 2023 Karnataka elections.",
    tags: ["Predictions", "Voter Research"],
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
  // TODO: replace with the real contact details
  email: "hello@your-domain.com",
  phone: "+91 00000 00000",
  address: "Unit 402, 4th Floor, Westend Mall, Road No. 36, Jubilee Hills, Hyderabad 500081",
  linkedin: "https://www.linkedin.com/company/reachout-analytics-private-limited/about/",
  instagram: "https://www.instagram.com/reachout_analytics_pvt_ltd/",
};

export const leaderById = (id?: string) => LEADERS.find((l) => l.id === id);
export const caseBySlug = (slug: string) => CASES.find((c) => c.slug === slug);
export const caseUrl = (slug: string) => `/case-studies/${slug}`;
