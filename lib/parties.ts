export type PartyId = "TDP" | "AIADMK" | "BRS" | "BJP" | "JD(U)" | "INC";

export type PartyInfo = {
  id: PartyId;
  name: string;
  fullName: string;
  logo: string;
  width: number;
  height: number;
  /** Optical height used in the small party tiles. */
  opticalHeight: number;
};

export const PARTIES: Record<PartyId, PartyInfo> = {
  TDP: {
    id: "TDP",
    name: "TDP",
    fullName: "Telugu Desam Party",
    logo: "/parties/tdp.png",
    width: 270,
    height: 180,
    opticalHeight: 29,
  },
  AIADMK: {
    id: "AIADMK",
    name: "AIADMK",
    fullName: "All India Anna Dravida Munnetra Kazhagam",
    logo: "/parties/aiadmk.png",
    width: 382,
    height: 256,
    opticalHeight: 31,
  },
  BRS: {
    id: "BRS",
    name: "BRS",
    fullName: "Bharat Rashtra Samithi",
    logo: "/parties/brs.png",
    width: 270,
    height: 183,
    opticalHeight: 28,
  },
  BJP: {
    id: "BJP",
    name: "BJP",
    fullName: "Bharatiya Janata Party",
    logo: "/parties/bjp.png",
    width: 239,
    height: 256,
    opticalHeight: 30,
  },
  "JD(U)": {
    id: "JD(U)",
    name: "JD(U)",
    fullName: "Janata Dal (United)",
    logo: "/parties/jdu.png",
    width: 870,
    height: 256,
    opticalHeight: 20,
  },
  INC: {
    id: "INC",
    name: "INC",
    fullName: "Indian National Congress",
    logo: "/parties/inc.png",
    width: 256,
    height: 256,
    opticalHeight: 30,
  },
};

export type PoliticalIdentity = {
  id: string;
  party: PartyId;
  state: string;
  caseSlug: string;
};

/**
 * One card per public party/state association. These are intentionally
 * party-level identities: no individual politician is represented here.
 */
export const POLITICAL_IDENTITIES: PoliticalIdentity[] = [
  { id: "tdp-andhra-pradesh", party: "TDP", state: "Andhra Pradesh", caseSlug: "andhra-pradesh-2024" },
  { id: "aiadmk-tamil-nadu", party: "AIADMK", state: "Tamil Nadu", caseSlug: "tamil-nadu" },
  { id: "brs-telangana", party: "BRS", state: "Telangana", caseSlug: "telangana" },
  { id: "bjp-assam", party: "BJP", state: "Assam", caseSlug: "north-east-elections" },
  { id: "bjp-gujarat", party: "BJP", state: "Gujarat", caseSlug: "gujarat" },
  { id: "jdu-bihar", party: "JD(U)", state: "Bihar", caseSlug: "bihar" },
  { id: "inc-karnataka", party: "INC", state: "Karnataka", caseSlug: "karnataka-2023" },
];
