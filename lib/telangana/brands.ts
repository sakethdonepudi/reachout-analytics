import manifest from "@/lib/data/telangana/brand-map.json";

/* =====================================================================
   Mobile-brand lookup for the `Mobile Brand` (column R) field.

   The marker identifies the field's brand category. It is aggregate
   device metadata — not proof of a unique person, a verified handset or a
   GPS location. Never recolour a logo with a party colour; selection and
   party state belong to the surrounding halos.
   ===================================================================== */

export type BrandAsset = {
  brand: string;
  slug: string;
  kind: string;
  markerSvg: string;
  markerPng: string;
  png: string;
  source: string;
  sourceEntries: number;
  expandedRows: number;
};

const BRANDS = manifest.brands as Record<string, BrandAsset>;
const normalise = (s: unknown) => String(s ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

const index = new Map<string, BrandAsset>();
for (const [label, asset] of Object.entries(BRANDS)) index.set(normalise(label), asset);
for (const [alias, label] of Object.entries({
  tecno: "Tecno Mobile",
  "itel mobile": "iTel",
  "cmf by nothing": "CMF",
  "ai plus": "AI+",
  "ai +": "AI+",
  lg: "LG",
  oppo: "OPPO",
  vivo: "Vivo",
  oneplus: "OnePlus",
  poco: "POCO",
  realme: "Realme",
  xiaomi: "Xiaomi",
  "unknown android": "Unknown Android",
})) {
  const found = index.get(normalise(label));
  if (found) index.set(normalise(alias), found);
}

const UNKNOWN = BRANDS.Unknown ?? Object.values(BRANDS)[0];

/** Exact / case-normalised label lookup; unknown labels stay neutral. */
export function brandAsset(raw: unknown): BrandAsset {
  return index.get(normalise(raw)) ?? UNKNOWN;
}

/** Public marker URL for a source label (defaults to the neutral badge). */
export function brandMarker(raw: unknown, format: "svg" | "png" = "svg", base = "/brand-logos") {
  const a = brandAsset(raw);
  return {
    brand: a.brand,
    src: `${base}/${format === "svg" ? a.markerSvg : a.markerPng}`,
    alt: `${a.brand} — aggregate device metadata, not a verified handset location`,
    kind: a.kind,
  };
}

export const ALL_BRAND_LABELS = Object.keys(BRANDS);
export const NAMED_BRAND_COUNT = Object.values(BRANDS).filter((b) => b.kind !== "neutral-fallback").length;
