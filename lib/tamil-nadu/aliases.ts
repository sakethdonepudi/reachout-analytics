/** Name normalisation shared by the HTML map rows and the raw workbook aggregator. */

export const TN_DISTRICT_ALIASES: Record<string, string> = {
  Kanyakumari: "Kanniyakumari",
  Nilgiris: "The Nilgiris",
  Thiruvarur: "Tiruvarur",
  Thoothukkudi: "Thoothukudi",
  Viluppuram: "Villupuram",
  Tirupattur: "Tirupathur",
  Mayiladuturai: "Mayiladuthurai",
};

/** Normalised lookup key: lower case, letters and digits only. */
export function nameKey(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canonicalDistrictName(value: unknown): string {
  const raw = String(value ?? "").trim();
  return TN_DISTRICT_ALIASES[raw] ?? raw;
}

/** Strip an AC number prefix such as "12 Tiruppattur" and fix spelling aliases. */
export function splitAcLabel(value: unknown): { no: number | null; name: string } {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,3})\s+(.*)$/);
  if (match) return { no: Number(match[1]), name: match[2].trim() };
  return { no: null, name: raw };
}

export function canonicalAcName(value: unknown): string {
  const { name } = splitAcLabel(value);
  return name.replace(/Mayiladuturai/gi, "Mayiladuthurai");
}

/**
 * Resolve the duplicate AC name "Tiruppattur" without ever guessing by name
 * alone. The raw workbook uses the Zone column; the HTML uses the AC number.
 */
export function resolveAcDistrict(input: {
  name: unknown;
  zone?: unknown;
  no?: number | null;
  districtByNo?: Map<number, string>;
}): string | null {
  if (input.no != null && input.districtByNo?.has(input.no)) {
    return canonicalDistrictName(input.districtByNo.get(input.no));
  }
  const name = canonicalAcName(input.name);
  if (nameKey(name) === nameKey("Tiruppattur")) {
    const zone = nameKey(input.zone);
    if (zone === "north") return "Tirupathur";
    if (zone === "south") return "Sivaganga";
    return null;
  }
  return null;
}

export function districtAliasAudit(): Array<{ from: string; to: string }> {
  return Object.entries(TN_DISTRICT_ALIASES).map(([from, to]) => ({ from, to }));
}
