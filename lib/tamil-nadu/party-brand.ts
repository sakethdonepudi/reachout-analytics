/**
 * One place for the political colours and symbols used across the Tamil Nadu
 * case study. The colours match the map, the vote bars and the party cards.
 * Logos are local static assets, never fetched from another origin at runtime.
 */
export type TnPartyBrand = {
  color: string;
  logo?: string;
  /** Black line art that is tinted with the party colour through a CSS mask. */
  mask?: boolean;
  /** Fallback badge text when no symbol is available. */
  monogram?: string;
};

export const TN_PARTY_BRAND: Record<string, TnPartyBrand> = {
  TVK: { color: "#E6B800", logo: "/parties/tvk.svg", mask: true },
  "DMK+": { color: "#DD1100", logo: "/parties/dmk.svg", mask: true },
  "AIADMK+": { color: "#138808", logo: "/parties/aiadmk.png" },
  NTK: { color: "#7b3fa0", logo: "/parties/ntk.png" },
  Others: { color: "#8c8f96", monogram: "OTH" },
  NOTA: { color: "#8c8f96", monogram: "NOTA" },
};

export function partyBrand(party: string): TnPartyBrand {
  return TN_PARTY_BRAND[party] ?? { color: "#64748B", monogram: party.slice(0, 3).toUpperCase() };
}

export function partyColour(party: string): string {
  return partyBrand(party).color;
}

/** The alliance/survey labels used by the map rows. */
export const TN_GROUP_KEY: Record<string, string> = {
  TVK: "TVK",
  "DMK+": "DMK+INC+VCK",
  "AIADMK+": "AIADMK+BJP+PMK+AMMK",
  NTK: "NTK",
  Others: "Others",
};
