/* =====================================================================
   PIN-code handling — header mapping, text preservation, normalisation,
   validation and (separately) geographic-mapping checks.

   Design rules (audit):
   - Never invent PIN codes from districts/constituencies.
   - Preserve the supplied value as text end-to-end.
   - Normalise whitespace and "numeric Excel" representations.
   - Validate the 6-digit format separately from geographic mapping.
   - A PIN that is not in the (partial) location reference is NOT invalid;
     "unknown location" simply means no reliable location reference.
   ===================================================================== */

import { TN_DISTRICT_PINCODES, DISTRICT_ALIASES, PIN_COORDINATES } from "./data/tamil-nadu-pincodes";

export const PIN_CANONICAL = "PIN Code";

/** Accepted source headers (case / spacing / punctuation variants included). */
export const PIN_HEADER_ALIASES = ["PIN Code", "PINCode", "Pincode", "Postal Code"] as const;

/** Normalised tokens that identify a PIN column (lowercase, alphanumerics only). */
const PIN_TOKENS = new Set(["pincode", "postalcode", "postcode", "pin"]);

export function pinHeaderToken(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isPinHeader(header: string): boolean {
  return PIN_TOKENS.has(pinHeaderToken(header));
}

/** All PIN-like headers present, in source order. */
export function pinHeadersOf(headers: string[]): string[] {
  return headers.filter(isPinHeader);
}

const PREFERRED = ["PIN Code", "PINCode", "Pincode", "Postal Code", "PIN"];
/** Pick the header that should become canonical when several are present. */
export function pickPinHeader(headers: string[]): string {
  for (const p of PREFERRED) {
    const exact = headers.find((h) => h === p);
    if (exact) return exact;
  }
  for (const p of PREFERRED) {
    const ci = headers.find((h) => h.toLowerCase() === p.toLowerCase());
    if (ci) return ci;
  }
  return headers[0] ?? PIN_CANONICAL;
}

/* ---- value normalisation -------------------------------------------- */

/** Clean text: drop Excel text markers, unify unicode spaces, trim, collapse runs. */
export function toPinText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    const s = Number.isInteger(value) ? value.toFixed(0) : String(value);
    return s.replace(/\.0+$/, "");
  }
  return String(value)
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/^['\u2019]/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Canonical normalised PIN: no whitespace, full-width digits folded, trailing .0 dropped. */
export function normalizePin(value: unknown): string {
  const t = toPinText(value);
  if (!t) return "";
  let s = t.replace(/\s/g, "");
  // fold full-width digits (０-９) to ASCII
  s = s.replace(/[\uFF10-\uFF19]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));
  s = s.replace(/\.0+$/, "");
  return s;
}

export type PinFormat = "blank" | "ok" | "invalid";

export function isSixDigitPin(normalized: string): boolean {
  return /^[0-9]{6}$/.test(normalized);
}

export function classifyPin(value: unknown): { raw: string; normalized: string; format: PinFormat } {
  const raw = toPinText(value);
  const normalized = normalizePin(value);
  const format: PinFormat = normalized === "" ? "blank" : isSixDigitPin(normalized) ? "ok" : "invalid";
  return { raw, normalized, format };
}

/* ---- per-row resolution + conflict detection ------------------------ */

export type PinRowResolution = {
  /** Canonical field name to use for this row. */
  canonical: string;
  /** Preserved (cleaned) text value. Empty on conflict or absence. */
  value: string;
  normalized: string;
  format: PinFormat;
  /** Every PIN-like column present on the row, with its cleaned value. */
  values: { header: string; value: string }[];
  /** True when two or more PIN columns carry different non-empty values. */
  conflict: boolean;
  /** A convenient label describing the conflict (for messages). */
  conflictDetail?: string;
};

/**
 * Resolve the PIN value for a single row object. Detects conflicting PIN
 * columns (rather than silently picking one).
 */
export function resolveRowPin(row: Record<string, unknown>): PinRowResolution {
  const headers = Object.keys(row).filter(isPinHeader);
  const values = headers.map((h) => ({ header: h, value: toPinText(row[h]) }));
  const nonEmpty = values.filter((v) => v.value !== "");
  const distinct = new Set(nonEmpty.map((v) => normalizePin(v.value)));
  const conflict = distinct.size > 1;
  const canonical = headers.length ? pickPinHeader(headers) : PIN_CANONICAL;
  const chosen = conflict ? "" : nonEmpty[0]?.value ?? values[0]?.value ?? "";
  const { normalized, format } = classifyPin(chosen);
  const detail = conflict
    ? nonEmpty.map((v) => `${v.header}="${v.value}"`).join(" vs ")
    : undefined;
  return { canonical, value: chosen, normalized, format, values, conflict, conflictDetail: detail };
}

/**
 * Return a shallow copy of the row with the canonical PIN column populated
 * (text preserved). Conflicting rows are left untouched so nothing is
 * silently overwritten; callers should reject/flag them.
 */
export function applyCanonicalPin(row: Record<string, unknown>): Record<string, unknown> {
  const r = resolveRowPin(row);
  if (r.conflict) return row;
  const out = { ...row };
  // Store the normalised digits for a well-formed PIN; keep the cleaned text
  // otherwise so malformed values remain visible for validation.
  out[PIN_CANONICAL] = r.format === "ok" ? r.normalized : r.value;
  return out;
}

/* ---- geographic-mapping validation (separate from format) ----------- */

const canonDist = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS: Record<string, string> = {};
for (const [k, v] of Object.entries(DISTRICT_ALIASES)) ALIAS[canonDist(k)] = canonDist(v);

/** Canonical district key — reconciles renamed / misspelled district names. */
export function canonicalDistrictKey(name: string): string {
  const c = canonDist(String(name ?? ""));
  return ALIAS[c] ?? c;
}

const DISTRICT_TO_PINS = new Map<string, { name: string; pins: Set<string> }>();
const PIN_DISTRICTS = new Map<string, Set<string>>();
for (const [district, pins] of Object.entries(TN_DISTRICT_PINCODES)) {
  const key = canonDist(district);
  const entry = DISTRICT_TO_PINS.get(key) ?? { name: district, pins: new Set<string>() };
  for (const p of pins) {
    entry.pins.add(p);
    const set = PIN_DISTRICTS.get(p) ?? new Set<string>();
    set.add(key);
    PIN_DISTRICTS.set(p, set);
  }
  DISTRICT_TO_PINS.set(key, entry);
}
const AMBIGUOUS_PINS = new Set<string>();
for (const [p, set] of PIN_DISTRICTS) if (set.size > 1) AMBIGUOUS_PINS.add(p);

/** Candidate PINs for a district (alias-aware); ambiguous PINs are excluded. */
export function candidatePinsForDistrict(district: string): string[] {
  const entry = DISTRICT_TO_PINS.get(canonicalDistrictKey(district));
  if (!entry) return [];
  return [...entry.pins].filter((p) => !AMBIGUOUS_PINS.has(p)).sort();
}

/** Reference district for a PIN, or null when unknown/ambiguous. */
export function districtForPin(pin: string): string | null {
  const set = PIN_DISTRICTS.get(normalizePin(pin));
  if (!set || set.size !== 1) return null;
  return DISTRICT_TO_PINS.get([...set][0])?.name ?? null;
}

/** Whether a PIN is ambiguous (appears under more than one reference district). */
export function isAmbiguousPin(pin: string): boolean {
  return AMBIGUOUS_PINS.has(normalizePin(pin));
}

/** Verified coordinates for a PIN, or null when none are bundled. */
export function coordinatesForPin(pin: string): { lat: number; lng: number } | null {
  return PIN_COORDINATES[normalizePin(pin)] ?? null;
}

export function referenceAudit() {
  return {
    referenceDistricts: DISTRICT_TO_PINS.size,
    referencePins: PIN_DISTRICTS.size,
    ambiguousPins: [...AMBIGUOUS_PINS].sort(),
  };
}

export type PinLocationRef = { known: boolean; district: string | null };

/**
 * Look up a PIN in the bundled *representative* reference set. `known:false`
 * means "no reliable location reference available" — it never means the PIN
 * is invalid, and it must never be used to fabricate coordinates.
 */
export function pinLocationRef(pin: string): PinLocationRef {
  const d = districtForPin(pin);
  return d ? { known: true, district: d } : { known: false, district: null };
}

/** Geographic check: does the PIN's reference district match the stated district? */
export function pinMatchesDistrict(pin: string, district: string): "match" | "mismatch" | "unknown" {
  const ref = pinLocationRef(pin);
  if (!ref.known || !ref.district) return "unknown";
  const stated = canonicalDistrictKey(district);
  if (!stated) return "unknown";
  return canonicalDistrictKey(ref.district) === stated ? "match" : "mismatch";
}
