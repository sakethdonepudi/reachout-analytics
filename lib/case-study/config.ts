export type CasePartyBrand = {
  color: string;
  border?: string;
  logo?: string;
  mask?: boolean;
  monogram?: string;
  plus?: number;
};

export type CaseIdentity = { party: string; name: string; state: string; logo: string };

export type CaseStudyConfig = {
  slug: string;
  stateName: string;
  stateShort: string;
  identity: CaseIdentity;
  parties: string[];
  seatParties: string[];
  actualParties: string[];
  cardKeys: string[];
  cardStyle: "tn" | "ap";
  actualYear?: string;
  hideMap?: boolean;
  neutralHeader?: string;
  sortPartyCards?: boolean;
  profileHeading?: string;
  showCampaignLinks?: boolean;
  summaryCard?: boolean;
  partyLabels?: Record<string, string>;
  socialCardTitle?: string;
  socialCardSubtitle?: string;
  /** One HTML-style tab rail: live tracking, month tabs, then social. */
  singleTabBar?: boolean;
  /** Show the account-to-campaign explorer on the social overview, not only after a filter. */
  explorerOnOverview?: boolean;
  /** Heading for the seat section when the source calls regions rather than zones. */
  seatsHeading?: string;
  /** Keep the explorer to reach, impressions and clicks (no campaigns metric). */
  explorerNoCampaigns?: boolean;
  /** Client-ready minimal copy: no helper sentences or captions. */
  minimalCopy?: boolean;
  defaultView: string;
  mapPeriod: string;
  apiBase: string;
  socialState: string;
  periodLabels: Record<string, string>;
  monthLabel: "Month" | "Year";
  latestSlot?: "sub" | "month";
  profileOrder: Record<string, string[]>;
  profileThresholds?: Record<string, number>;
  countBelowThreshold?: boolean;
  partyInk?: Record<string, "white" | "black">;
  /** Metrics the source does not report at all: omit them from every social view. */
  hiddenMetrics?: Array<"views" | "engagements">;
  profileGroups?: Record<string, Array<{ label: string; keys: string[] }>>;
  target?: {
    party: string;
    mode: "below-average" | "leads";
    postPollMode?: "gap";
    periods: string[];
    pillParty: string;
    tooltipGeo: string;
    tooltipOther: string;
    tooltipGap?: string;
  };
  swing: { fromLabel: Record<string, string>; toLabel: Record<string, string>; showActual: string[] };
  map: {
    heading: string;
    totalSeats: number;
    majority: number;
    districtAlias: Record<string, string>;
    labelOffset: Record<string, { x: number; y: number }>;
    mobileLabelOffset: Record<string, { x: number; y: number }>;
    shareKey: Record<string, string>;
    fillMode?: "gradient" | "flat";
    mobileLabelCount?: number;
    tilt?: number;
    fit?: number;
    centerZ?: number;
    rotation?: number;
    credit: string;
    creditHref: string;
  };
  social: { stateName: string; targetName: string; fallbackPattern: string; fallbackLabel: string };
  brand: Record<string, CasePartyBrand>;
};

const TN_LABEL_OFFSET: Record<string, { x: number; y: number }> = {
  Chennai: { x: 58, y: -14 }, Thiruvallur: { x: -46, y: -28 }, Kancheepuram: { x: 40, y: 14 }, Chengalpattu: { x: 54, y: 30 },
  Ranipet: { x: -40, y: -26 }, Vellore: { x: -46, y: 68 }, Tirupathur: { x: -88, y: 0 }, Krishnagiri: { x: -44, y: -32 },
  Dharmapuri: { x: -60, y: -10 }, Kallakurichi: { x: 42, y: -30 }, Salem: { x: 12, y: -8 }, Kanniyakumari: { x: 52, y: 0 },
  "The Nilgiris": { x: -40, y: 12 }, Cuddalore: { x: -18, y: 24 }, Mayiladuthurai: { x: 30, y: 28 }, Nagapattinam: { x: 36, y: 8 },
  Tiruvarur: { x: 6, y: 38 }, Ariyalur: { x: -12, y: 18 }, Perambalur: { x: -36, y: -14 }, Tiruchirappalli: { x: -30, y: 18 },
  Karur: { x: 30, y: -18 }, Sivaganga: { x: 20, y: 6 }, Ramanathapuram: { x: 34, y: 20 }, Thoothukudi: { x: 26, y: 18 },
  Tirunelveli: { x: -34, y: 18 }, Tenkasi: { x: -30, y: -16 }, Virudhunagar: { x: -22, y: 10 }, Madurai: { x: 14, y: -4 },
  Theni: { x: -22, y: -8 }, Erode: { x: 12, y: -12 }, Coimbatore: { x: -32, y: 12 }, Tiruppur: { x: -28, y: 16 },
  Tiruvannamalai: { x: 2, y: -20 }, Namakkal: { x: 14, y: 6 }, Dindigul: { x: -18, y: -6 },
};

const AP_LABEL_OFFSET: Record<string, { x: number; y: number }> = {
  Srikakulam: { x: 24, y: -16 }, Vizianagaram: { x: -18, y: 12 }, "Parvathipuram Manyam": { x: -60, y: -10 },
  Visakhapatnam: { x: 40, y: 16 }, Anakapalli: { x: 22, y: -14 }, "Alluri Sitharama Raju": { x: -50, y: -24 },
  Kakinada: { x: 54, y: -30 }, "East Godavari": { x: 4, y: 26 }, Konaseema: { x: 38, y: 28 }, Polavaram: { x: 8, y: -16 },
  "West Godavari": { x: -22, y: 22 }, Eluru: { x: 10, y: 0 }, NTR: { x: -38, y: -24 }, Krishna: { x: -14, y: 22 },
  Palnadu: { x: -30, y: 8 }, Guntur: { x: 14, y: 4 }, Bapatla: { x: 30, y: 20 }, Markapuram: { x: -26, y: 10 },
  Prakasam: { x: 8, y: 20 }, Nellore: { x: 24, y: 12 }, Tirupati: { x: 34, y: 22 }, "YSR Kadapa": { x: -24, y: 10 },
  Annamayya: { x: 22, y: -4 }, Nandyal: { x: -18, y: -8 }, Kurnool: { x: -34, y: 2 }, Ananthapuramu: { x: -48, y: -10 },
  "Sri Sathya Sai": { x: -30, y: 16 }, Chittoor: { x: 48, y: 18 },
};

export const TN_CONFIG: CaseStudyConfig = {
  slug: "tamil-nadu", stateName: "Tamil Nadu", stateShort: "TN",
  identity: { party: "AIADMK", name: "AIADMK", state: "Tamil Nadu", logo: "/parties/aiadmk.png" },
  parties: ["TVK", "DMK+", "AIADMK+", "NTK", "Others"],
  seatParties: ["TVK", "DMK+", "AIADMK+", "NTK"],
  actualParties: ["TVK", "DMK+", "AIADMK+"],
  cardKeys: ["op", "ex"], cardStyle: "tn", defaultView: "op", mapPeriod: "op", apiBase: "/api/survey/tn", socialState: "tamil-nadu",
  periodLabels: { op: "Month", ex: "Day" }, monthLabel: "Month",
  profileOrder: {
    op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app", "form"],
    ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"],
  },
  target: { party: "AIADMK+", mode: "below-average", periods: ["op"], pillParty: "AIADMK+", tooltipGeo: "AIADMK+ below average here: open campaigns", tooltipOther: "AIADMK+ below average here: open campaigns" },
  swing: { fromLabel: { op: "21→26", ex: "21→26" }, toLabel: { op: "21→26", ex: "21→26" }, showActual: ["op", "ex"] },
  map: { heading: "Tamil Nadu", totalSeats: 234, majority: 118, districtAlias: { Kanyakumari: "Kanniyakumari", Nilgiris: "The Nilgiris", Thiruvarur: "Tiruvarur", Thoothukkudi: "Thoothukudi", Viluppuram: "Villupuram" }, labelOffset: TN_LABEL_OFFSET, mobileLabelOffset: { Chennai: { x: -38, y: 22 } }, shareKey: { TVK: "TVK", "DMK+": "DMK+INC+VCK", "AIADMK+": "AIADMK+BJP+PMK+AMMK", NTK: "NTK", Others: "Others" }, credit: "Map: DataMeet, CC BY 2.5 IN · Outline: svg-maps, CC BY 4.0", creditHref: "https://github.com/datameet/maps" },
  social: { stateName: "Tamil Nadu", targetName: "AIADMK+", fallbackPattern: "aiadmk|admk|eps|edapp|puratchi|amma|it wing|two leaves", fallbackLabel: "AIADMK campaigns" },
  brand: {
    TVK: { color: "var(--tn-party-tvk)", logo: "/parties/tvk.svg", mask: true },
    "DMK+": { color: "var(--tn-party-dmk)", logo: "/parties/dmk.svg", mask: true },
    "AIADMK+": { color: "var(--tn-party-aiadmk)", logo: "/parties/aiadmk.png" },
    NTK: { color: "var(--tn-party-ntk)", logo: "/parties/ntk.png" },
    Others: { color: "var(--tn-party-others)", monogram: "OTH" },
    NOTA: { color: "var(--tn-party-others)", monogram: "NOTA" },
  },
};

export const AP_CONFIG: CaseStudyConfig = {
  slug: "andhra-pradesh-2024", stateName: "Andhra Pradesh", stateShort: "AP",
  identity: { party: "TDP", name: "TDP", state: "Andhra Pradesh", logo: "/parties/tdp.png" },
  parties: ["NDA", "YSRCP", "INC", "Others"],
  seatParties: ["NDA", "YSRCP"], actualParties: ["NDA", "YSRCP"],
  cardKeys: ["op", "ex", "rd"], cardStyle: "ap", defaultView: "op", mapPeriod: "op", apiBase: "/api/survey/ap", socialState: "andhra-pradesh-2024",
  periodLabels: { op: "Month", ex: "Month", rd: "Year" }, monthLabel: "Month",
  profileOrder: {
    op: ["zone", "area", "dist", "ac"],
    ex: ["zone", "area", "dist", "ac"],
    rd: ["zone", "area", "dist", "ac", "v24", "govt", "mla", "scheme", "super6", "corrupt", "leader", "expect", "caste"],
  },
  profileGroups: {
    op: [{ label: "Region", keys: ["zone", "area", "dist", "ac"] }],
    ex: [{ label: "Region", keys: ["zone", "area", "dist", "ac"] }],
    rd: [{ label: "Region", keys: ["zone", "area", "dist", "ac"] }, { label: "Vote & feedback", keys: ["v24", "govt", "mla", "scheme", "super6", "corrupt", "leader", "expect", "caste"] }],
  },
  target: { party: "YSRCP", mode: "leads", periods: ["op", "ex", "rd"], pillParty: "NDA", tooltipGeo: "YSRCP leads: open look-alike ad campaigns", tooltipOther: "YSRCP leads in this voter group: open post-2024 campaigns to retarget", postPollMode: "gap", tooltipGap: "NDA below its average here: open look-alike campaigns" },
  swing: { fromLabel: { op: "19→24", ex: "19→24", rd: "24→29" }, toLabel: { op: "19→24", ex: "19→24", rd: "24→29" }, showActual: ["op", "ex"] },
  map: { heading: "Andhra Pradesh", totalSeats: 175, majority: 88, districtAlias: { Anantapur: "Ananthapuramu", ASR: "Alluri Sitharama Raju" }, labelOffset: AP_LABEL_OFFSET, mobileLabelOffset: {}, shareKey: { NDA: "NDA", YSRCP: "YSRCP", INC: "INC", Others: "Others" }, fillMode: "flat", mobileLabelCount: 8, tilt: 0.6, fit: 1, centerZ: 35, rotation: 0.22, credit: "Map: DataMeet, CC BY 2.5 IN", creditHref: "https://github.com/datameet/maps" },
  social: { stateName: "Andhra Pradesh", targetName: "YSRCP", fallbackPattern: "ysrcp|jagan|yeduguri|saila|fan", fallbackLabel: "YSRCP campaigns" },
  brand: {
    NDA: { color: "var(--ap-party-nda)", border: "var(--ap-party-nda-deep)", logo: "/parties/tdp.png" },
    YSRCP: { color: "var(--ap-party-ysrcp)", logo: "/parties/ysrcp.svg", mask: true },
    INC: { color: "var(--ap-party-inc)", logo: "/parties/inc.png" },
    Others: { color: "var(--ap-party-others)", monogram: "OTH" },
  },
};

const KA_LABEL_OFFSET: Record<string, { x: number; y: number }> = {
  "Bengaluru Urban": { x: 38, y: 22 },
  "Bengaluru Rural": { x: -28, y: -18 },
  "Chamarajanagar": { x: -18, y: 20 },
  "Uttara Kannada": { x: -24, y: 0 },
  "Dakshina Kannada": { x: 20, y: 18 },
};

export const KA_CONFIG: CaseStudyConfig = {
  slug: "karnataka", stateName: "Karnataka", stateShort: "KA",
  identity: { party: "INC", name: "INC", state: "Karnataka", logo: "/parties/inc.png" },
  parties: ["INC", "BJP", "JDS", "Others"],
  seatParties: ["INC", "BJP", "JDS", "Others"],
  actualParties: ["INC", "BJP", "JDS", "Others"],
  cardKeys: ["rd"], cardStyle: "ap", actualYear: "2023", defaultView: "rd", mapPeriod: "rd", apiBase: "/api/survey/ka", socialState: "karnataka",
  periodLabels: { rd: "Month" }, monthLabel: "Month", latestSlot: "month",
  profileOrder: { rd: ["zone", "area", "dist", "ac", "month", "v23", "caste", "age", "cm", "issue"] },
  profileGroups: { rd: [{ label: "Region", keys: ["zone", "area", "dist", "ac"] }, { label: "Survey", keys: ["month"] }, { label: "Voter", keys: ["v23", "caste", "age", "cm", "issue"] }] },
  profileThresholds: { zone: 30, area: 30, month: 30, v23: 30, dist: 10, ac: 10, caste: 10, age: 10, cm: 10, issue: 10 },
  countBelowThreshold: true,
  swing: { fromLabel: { rd: "23→28" }, toLabel: { rd: "23→28" }, showActual: [] },
  map: { heading: "Karnataka", totalSeats: 224, majority: 113, districtAlias: {}, labelOffset: KA_LABEL_OFFSET, mobileLabelOffset: { "Bengaluru Urban": { x: 40, y: 24 } }, shareKey: { INC: "INC", BJP: "BJP", JDS: "JDS", Others: "Others" }, fillMode: "flat", mobileLabelCount: 8, tilt: 0.6, fit: 1, centerZ: 35, rotation: 0.22, credit: "", creditHref: "" },
  social: { stateName: "Karnataka", targetName: "INC", fallbackPattern: "inc|congress|karnataka", fallbackLabel: "INC campaigns" },
  partyInk: { INC: "white", BJP: "black", JDS: "white", Others: "black" },
  hiddenMetrics: ["views", "engagements"],
  hideMap: true,
  neutralHeader: "Karnataka 2028 · Live Tracking Survey Analysis",
  sortPartyCards: true,
  summaryCard: true,
  partyLabels: { JDS: "JD(S)" },
  socialCardTitle: "Social Media Dissemination",
  socialCardSubtitle: "Survey ad campaigns · reach & engagement",
  singleTabBar: true,
  explorerOnOverview: true,
  seatsHeading: "Seats by region · 2028 projection",
  explorerNoCampaigns: true,
  minimalCopy: true,
  profileHeading: "Raw 2028 vote % by voter profile",
  showCampaignLinks: false,
  brand: {
    INC: { color: "var(--ka-party-inc)", logo: "/parties/inc.png" },
    BJP: { color: "var(--ka-party-bjp)", logo: "/parties/bjp.png" },
    JDS: { color: "var(--ka-party-jds)", logo: "/parties/jds.svg", mask: true },
    Others: { color: "var(--ka-party-others)", logo: "/parties/others.svg", mask: true },
  },
};

export const TG_CONFIG: CaseStudyConfig = {
  slug: "telangana", stateName: "Telangana", stateShort: "TG",
  identity: { party: "BRS", name: "BRS", state: "Telangana", logo: "/parties/brs.png" },
  parties: ["BRS", "INC", "BJP", "AIMIM", "Others"],
  seatParties: ["BRS", "INC", "BJP", "AIMIM", "Others"],
  actualParties: ["BRS", "INC", "BJP", "AIMIM", "Others"],
  cardKeys: ["rd"], cardStyle: "ap", actualYear: "2023", defaultView: "rd", mapPeriod: "rd", apiBase: "/api/survey/tg", socialState: "telangana",
  periodLabels: { rd: "Month" }, monthLabel: "Month", latestSlot: "month",
  profileOrder: { rd: ["zone", "area", "dist", "ac", "v23", "age"] },
  profileGroups: { rd: [{ label: "Region", keys: ["zone", "area", "dist", "ac"] }, { label: "Voter", keys: ["v23", "age"] }] },
  profileThresholds: { zone: 30, area: 30, dist: 10, ac: 10, v23: 10, age: 10 },
  countBelowThreshold: true,
  hideMap: true,
  neutralHeader: "Telangana 2028 · Live Tracking Survey Analysis",
  sortPartyCards: true,
  partyLabels: { JDS: "JD(S)" },
  socialCardTitle: "Social Media Dissemination",
  socialCardSubtitle: "Survey ad campaigns · reach & engagement",
  singleTabBar: true,
  explorerOnOverview: true,
  seatsHeading: "Seats by region · 2028 projection",
  explorerNoCampaigns: true,
  minimalCopy: true,
  profileHeading: "Weighted 2028 vote % by voter profile",
  showCampaignLinks: false,
  swing: { fromLabel: { rd: "23→28" }, toLabel: { rd: "23→28" }, showActual: [] },
  map: { heading: "Telangana", totalSeats: 119, majority: 60, districtAlias: {}, labelOffset: {}, mobileLabelOffset: {}, shareKey: { BRS: "BRS", INC: "INC", BJP: "BJP", AIMIM: "AIMIM", Others: "Others" }, fillMode: "flat", mobileLabelCount: 8, tilt: 0.6, fit: 1, centerZ: 35, rotation: 0.22, credit: "", creditHref: "" },
  social: { stateName: "Telangana", targetName: "BRS", fallbackPattern: "brs|telangana", fallbackLabel: "BRS campaigns" },
  hiddenMetrics: ["views", "engagements"],
  partyInk: { BRS: "white", INC: "white", BJP: "black", AIMIM: "white", Others: "black" },
  brand: {
    BRS: { color: "var(--tg-party-brs)", logo: "/parties/brs.png" },
    INC: { color: "var(--tg-party-inc)", logo: "/parties/inc.png" },
    BJP: { color: "var(--tg-party-bjp)", logo: "/parties/bjp.png" },
    AIMIM: { color: "var(--tg-party-aimim)", logo: "/parties/aimim.svg", mask: true },
    Others: { color: "var(--tg-party-others)", logo: "/parties/others.svg", mask: true },
  },
};

export const CASE_CONFIGS: Record<string, CaseStudyConfig> = { "tamil-nadu": TN_CONFIG, "andhra-pradesh-2024": AP_CONFIG, karnataka: KA_CONFIG, telangana: TG_CONFIG };
export function caseConfig(slug: string): CaseStudyConfig { return CASE_CONFIGS[slug] ?? TN_CONFIG; }
