/**
 * One place for the political colours and symbols used across the Tamil Nadu
 * case study. The colours match the map, the vote bars and the party cards.
 * Logos are local static assets, never fetched from another origin at runtime.
 */
export type TnPartyBrand = {
  color: string;
  border?: string;
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
  NDA: { color: "var(--ap-party-nda)", border: "var(--ap-party-nda-deep)", logo: "/parties/tdp.png" },
  YSRCP: { color: "var(--ap-party-ysrcp)", logo: "/parties/ysrcp.svg", mask: true },
  INC: { color: "var(--ap-party-inc)", logo: "/parties/inc.png" },
};

/** Light-theme hexes used for maps, bars and contrast calculations. */
const TN_PARTY_HEX: Record<string, string> = {
  TVK: "#E6B800",
  "DMK+": "#DD1100",
  "AIADMK+": "#0f7007",
  NTK: "#7b3fa0",
  Others: "#8c8f96",
  NOTA: "#8c8f96",
  NDA: "#f7a325",
  YSRCP: "#1f6fd1",
  INC: "#0f7043",
};

/** Dark-theme hexes. These match the dark map and the party CSS tokens. */
const TN_PARTY_HEX_DARK: Record<string, string> = {
  TVK: "#e8b923",
  "DMK+": "#f0544f",
  "AIADMK+": "#1fa36f",
  NTK: "#a46cd0",
  Others: "#8f939b",
  NOTA: "#8f939b",
  NDA: "#ffb340",
  YSRCP: "#4f8ef7",
  INC: "#1fa36f",
};

export function partyBrand(party: string): TnPartyBrand {
  return TN_PARTY_BRAND[party] ?? { color: "#64748B", monogram: party.slice(0, 3).toUpperCase() };
}

export function partyColour(party: string): string {
  return partyBrand(party).color;
}

export function partyBorder(party: string): string {
  const brand = partyBrand(party);
  return brand.border ?? brand.color;
}

export function partyHex(party: string, dark = false): string {
  return (dark ? TN_PARTY_HEX_DARK[party] : TN_PARTY_HEX[party]) ?? "#64748B";
}

function channel(value: number) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(rgb: [number, number, number]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/** A readable ink for a party tint over a known surface. */
export function inkOnTint(party: string, alpha: number, dark: boolean): { background: string; ink: string } {
  const fill = parseHex(partyHex(party, dark));
  const surface: [number, number, number] = dark ? [26, 26, 25] : [255, 255, 255];
  const ratio = Math.max(0, Math.min(1, alpha / 100));
  const mix = fill.map((value, index) => Math.round(value * ratio + surface[index] * (1 - ratio))) as [number, number, number];
  const lum = luminance(mix);
  const lightContrast = 1.05 / (lum + 0.05);
  const darkContrast = (lum + 0.05) / 0.053;
  const ink = lightContrast >= darkContrast ? "#ffffff" : "#0B0B0C";
  let [r, g, b] = mix;
  for (let step = 0; step < 24; step += 1) {
    const value = luminance([r, g, b]);
    const contrast = ink === "#ffffff" ? 1.05 / (value + 0.05) : (value + 0.05) / 0.053;
    if (contrast >= 4.55) break;
    if (ink === "#ffffff") { r *= 0.96; g *= 0.96; b *= 0.96; }
    else { r += (255 - r) * 0.05; g += (255 - g) * 0.05; b += (255 - b) * 0.05; }
  }
  return { background: `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`, ink };
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
