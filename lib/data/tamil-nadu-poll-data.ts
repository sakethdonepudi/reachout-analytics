/* =====================================================================
   TAMIL NADU POLL DATA — MOCK
   MOCK DATA — replace with backend/API data later.

   Everything the Tamil Nadu dashboard displays comes from this module.
   The shapes mirror the intended API response so this file can later be
   swapped for:

     GET /api/case-studies/tamil-nadu/polls?type=exit
     GET /api/case-studies/tamil-nadu/polls?type=opinion

   The generator below is deterministic (seeded), so server and client
   produce identical data and there is no hydration mismatch. No
   Math.random() is used.
   ===================================================================== */

import { TN_DISTRICTS, tnDistrictById } from "./tamil-nadu-districts";
import { pincodesForDistrict } from "./tamil-nadu-pincodes";

export type PartyKey = "aiadmk" | "dmk" | "tvk" | "others";

export type PartyResult = Record<PartyKey, number>;

export type PincodePollResult = {
  pincode: string;
  district: string;
  lat: number;
  lng: number;
  samples: number;
  results: PartyResult;
};

export type DistrictPollResult = {
  district: string;
  samples: number;
  results: PartyResult;
  pincodes: PincodePollResult[];
};

export type PollDataset = {
  exitPoll: DistrictPollResult[];
  opinionPoll: DistrictPollResult[];
};

export type PollType = "exit" | "opinion";

export const PARTY_ORDER: PartyKey[] = ["aiadmk", "dmk", "tvk", "others"];

export const PARTY_META: Record<PartyKey, { label: string; short: string; color: string }> = {
  aiadmk: { label: "AIADMK", short: "ADMK", color: "#ff9933" }, // ReachOut saffron
  dmk: { label: "DMK", short: "DMK", color: "#c0453f" }, // muted red
  tvk: { label: "TVK", short: "TVK", color: "#e0b23a" }, // warm amber
  others: { label: "OTHERS", short: "OTH", color: "#7b8794" }, // neutral slate
};

/** Statewide headline figures shown for the demo (percentages sum to 100). */
export const STATEWIDE: Record<PollType, { samples: number; results: PartyResult }> = {
  exit: { samples: 12480, results: { aiadmk: 38, dmk: 35, tvk: 18, others: 9 } },
  opinion: { samples: 10920, results: { aiadmk: 36, dmk: 37, tvk: 18, others: 9 } },
};

/* ---------------------------------------------------------------------
   Deterministic PRNG (mulberry32)
   --------------------------------------------------------------------- */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Round to whole numbers that still sum to 100. */
function normalizeTo100(v: PartyResult): PartyResult {
  const keys = PARTY_ORDER;
  const raw = keys.map((k) => Math.max(0, v[k]));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const scaled = raw.map((x) => (x / sum) * 100);
  const floored = scaled.map((x) => Math.floor(x));
  let remainder = 100 - floored.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) out[order[k].i] += 1;
  return { aiadmk: out[0], dmk: out[1], tvk: out[2], others: out[3] };
}

/** Districts where we deliberately weight more samples (urban / large). */
const HIGH_WEIGHT = new Set([
  "chennai",
  "coimbatore",
  "madurai",
  "tiruchirappalli",
  "salem",
  "tirunelveli",
  "erode",
  "vellore",
  "kancheepuram",
  "thiruvallur",
  "tiruppur",
  "villupuram",
]);

function districtWeight(id: string): number {
  const r = mulberry32(hashString("w:" + id));
  return 0.6 + r() * 0.9 + (HIGH_WEIGHT.has(id) ? 0.8 : 0);
}

function pincodeFallback(id: string): string {
  // Only used if a district has no representative PIN list yet.
  return String(600000 + (hashString(id) % 44000)).padStart(6, "0").slice(0, 6);
}

/**
 * Split a district's sample total across its PINs so the parts add up exactly.
 * Every PIN gets at least one sample when the district has enough to go round.
 */
function partitionSamples(total: number, n: number, weights: number[]): number[] {
  const out = new Array(n).fill(0);
  if (n === 0) return out;
  let remaining = total;
  if (total >= n) {
    out.fill(1);
    remaining = total - n;
  }
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (remaining * w) / wSum);
  const floors = raw.map((x) => Math.floor(x));
  let rest = remaining - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floors[order[k].i] += 1;
  for (let i = 0; i < n; i++) out[i] += floors[i];
  return out;
}

function buildDataset(type: PollType): DistrictPollResult[] {
  const state = STATEWIDE[type];
  const weights = TN_DISTRICTS.map((d) => districtWeight(d.id));
  const wSum = weights.reduce((a, b) => a + b, 0);

  // Integer sample counts per district, then nudge the largest so the
  // district total exactly equals the statewide headline sample count.
  const samples = weights.map((w) => Math.max(120, Math.round((w / wSum) * state.samples)));
  const diff = state.samples - samples.reduce((a, b) => a + b, 0);
  samples[0] += diff;

  const golden = Math.PI * (3 - Math.sqrt(5));

  return TN_DISTRICTS.map((d, di) => {
    const rnd = mulberry32(hashString(`${type}:${d.id}`));
    const base = state.results;
    // district-level swing around the statewide figure
    const results = normalizeTo100({
      aiadmk: base.aiadmk + (rnd() - 0.5) * 22,
      dmk: base.dmk + (rnd() - 0.5) * 20,
      tvk: base.tvk + (rnd() - 0.5) * 12,
      others: base.others + (rnd() - 0.5) * 10,
    });

    // Representative PINs for this district (real codes, demo subset).
    const codes = pincodesForDistrict(d.name);
    const n = Math.max(1, codes.length);
    const codeList = codes.length ? codes : [pincodeFallback(d.id)];
    const split = partitionSamples(samples[di], n, Array.from({ length: n }, () => 0.6 + rnd()));

    // Spread the PINs around the district centroid (demo positioning only —
    // not exact PIN geolocation) using a golden-angle spiral inside `d.r`.
    const rot = rnd() * Math.PI * 2;
    const cosLat = Math.cos((d.lat * Math.PI) / 180) || 1;
    const pincodes: PincodePollResult[] = codeList.map((code, i) => {
      const frac = (i + 0.5) / codeList.length;
      const rad = Math.sqrt(frac) * d.r;
      const ang = i * golden + rot;
      const lng = +(d.lng + (rad * Math.cos(ang)) / cosLat).toFixed(4);
      const lat = +(d.lat + rad * Math.sin(ang)).toFixed(4);
      const pr = normalizeTo100({
        aiadmk: results.aiadmk + (rnd() - 0.5) * 18,
        dmk: results.dmk + (rnd() - 0.5) * 18,
        tvk: results.tvk + (rnd() - 0.5) * 12,
        others: results.others + (rnd() - 0.5) * 10,
      });
      return { pincode: code, district: d.name, lng, lat, samples: split[i], results: pr };
    });

    return { district: d.name, samples: samples[di], results, pincodes };
  });
}

export const TN_POLLS: PollDataset = {
  exitPoll: buildDataset("exit"),
  opinionPoll: buildDataset("opinion"),
};

/* ---------------------------------------------------------------------
   Selectors / aggregation
   --------------------------------------------------------------------- */

export function datasetFor(type: PollType): DistrictPollResult[] {
  return type === "exit" ? TN_POLLS.exitPoll : TN_POLLS.opinionPoll;
}

/** Statewide or filtered headline numbers, derived from district data. */
export function aggregate(rows: DistrictPollResult[]): { samples: number; results: PartyResult } {
  if (rows.length === 0) return { samples: 0, results: { aiadmk: 0, dmk: 0, tvk: 0, others: 0 } };
  const samples = rows.reduce((a, r) => a + r.samples, 0);
  const avg: PartyResult = { aiadmk: 0, dmk: 0, tvk: 0, others: 0 };
  for (const r of rows) {
    const w = r.samples / (samples || 1);
    for (const k of PARTY_ORDER) avg[k] += r.results[k] * w;
  }
  return { samples, results: normalizeTo100(avg) };
}

export function aggregatePincodes(rows: DistrictPollResult[]): { samples: number; results: PartyResult } {
  const all = rows.flatMap((r) => r.pincodes);
  if (all.length === 0) return { samples: 0, results: { aiadmk: 0, dmk: 0, tvk: 0, others: 0 } };
  const samples = all.reduce((a, r) => a + r.samples, 0);
  const avg: PartyResult = { aiadmk: 0, dmk: 0, tvk: 0, others: 0 };
  for (const r of all) {
    const w = r.samples / (samples || 1);
    for (const k of PARTY_ORDER) avg[k] += r.results[k] * w;
  }
  return { samples, results: normalizeTo100(avg) };
}

export function leadingParty(results: PartyResult): PartyKey {
  return PARTY_ORDER.reduce((best, k) => (results[k] > results[best] ? k : best), PARTY_ORDER[0]);
}

export function districtRow(name: string, type: PollType): DistrictPollResult | undefined {
  return datasetFor(type).find((r) => r.district === name);
}

export function rowsForDistricts(names: string[], type: PollType): DistrictPollResult[] {
  if (names.length === 0) return datasetFor(type);
  const set = new Set(names);
  return datasetFor(type).filter((r) => set.has(r.district));
}

export function findPincode(pincode: string, type: PollType): PincodePollResult | undefined {
  for (const d of datasetFor(type)) {
    const p = d.pincodes.find((x) => x.pincode === pincode);
    if (p) return p;
  }
  return undefined;
}

/** District centroids for survey-node placement (id → lng/lat). */
export function districtCentroid(name: string) {
  const d = TN_DISTRICTS.find((x) => x.name === name);
  return d ? { lng: d.lng, lat: d.lat } : { lng: 78.6, lat: 11.1 };
}

/** Demo spread radius (degrees) used to size survey spread and camera zoom. */
export function districtRadius(name: string): number {
  const d = TN_DISTRICTS.find((x) => x.name === name);
  return d?.r ?? 0.2;
}

export { tnDistrictById };
