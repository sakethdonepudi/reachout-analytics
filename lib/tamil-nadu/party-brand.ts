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
  /** A small alliance count shown at the lower right. */
  plus?: number;
};

export const TN_PARTY_BRAND: Record<string, TnPartyBrand> = {
  TVK: { color: "var(--tn-party-tvk)", logo: "/parties/tvk.svg", mask: true },
  "DMK+": { color: "var(--tn-party-dmk)", logo: "/parties/dmk.svg", mask: true },
  "AIADMK+": { color: "var(--tn-party-aiadmk)", logo: "/parties/aiadmk.png" },
  NTK: { color: "var(--tn-party-ntk)", logo: "/parties/ntk.png" },
  Others: { color: "var(--tn-party-others)", monogram: "OTH" },
  NOTA: { color: "var(--tn-party-others)", monogram: "NOTA" },
  NDA: { color: "var(--ap-party-nda)", logo: "/parties/tdp.png", plus: 2 },
  YSRCP: { color: "var(--ap-party-ysrcp)", logo: "/parties/ysrcp.svg", mask: true },
  INC: { color: "var(--ap-party-inc)", logo: "/parties/inc.png" },
};

/** Light-theme hexes used only for contrast calculations. */
const TN_PARTY_HEX: Record<string, string> = {
  TVK: "#E6B800",
  "DMK+": "#DD1100",
  "AIADMK+": "#138808",
  NTK: "#7b3fa0",
  Others: "#8c8f96",
  NOTA: "#8c8f96",
  NDA: "#c98a00",
  YSRCP: "#1f6fd1",
  INC: "#138a52",
};

export function partyBrand(party: string): TnPartyBrand {
  return TN_PARTY_BRAND[party] ?? { color: "#64748B", monogram: party.slice(0, 3).toUpperCase() };
}

export function partyColour(party: string): string {
  return partyBrand(party).color;
}

/** True when white type is the readable choice on a near-full party fill. */
export function partyNeedsWhiteInk(party: string): boolean {
  if (party === "TVK" || party === "NDA" || party === "Others" || party === "NOTA") return false;
  if (party === "YSRCP") return true;
  const hex = (TN_PARTY_HEX[party] ?? "#64748B").replace("#", "");
  if (hex.length !== 6) return false;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(0, 2), 16));
  const g = channel(parseInt(hex.slice(2, 4), 16));
  const b = channel(parseInt(hex.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.42;
}

/** The alliance/survey labels used by the map rows. */
export const TN_GROUP_KEY: Record<string, string> = {
  TVK: "TVK",
  "DMK+": "DMK+INC+VCK",
  "AIADMK+": "AIADMK+BJP+PMK+AMMK",
  NTK: "NTK",
  Others: "Others",
};
