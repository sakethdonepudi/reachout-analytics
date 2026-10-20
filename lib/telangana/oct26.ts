import bundle from "@/lib/data/telangana/oct26.json";

/* =====================================================================
   Telangana October workbook dataset (tg-oct20-v1).

   Three separate measures, never mixed:
   - actual:        2023 election result (candidate votes + NOTA)
   - prediction:    model estimate from the AC projection workbook
   - raw:           actual 2028 survey answers at the workbook cutoff
   State/district aggregates weight ACs by 2023 total votes for
   actual/prediction, and by answered 2028 rows for the raw survey.
   ===================================================================== */

export type Party = "BRS" | "Congress" | "BJP" | "Others";
export const PARTIES: Party[] = ["BRS", "Congress", "BJP", "Others"];
export const PARTY_COLOR: Record<Party, string> = {
  BRS: "#e5007d", Congress: "#1f6fd0", BJP: "#e87511", Others: "#6f62a0",
};
export const PARTY_LABEL: Record<Party, string> = {
  BRS: "BRS", Congress: "Congress+", BJP: "BJP", Others: "Others",
};
export const NO_DATA_COLOR = "#9aa1ab";
export type ShareSet = Record<Party, number>;

/* Party-colour shading: hue identifies the party, lightness tracks its
   predicted share. 20% → lightest, 70%+ → darkest, 50% ≈ the base colour. */
function rgbToHsl(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
export function partyShade(party: Party, share: number): string {
  const t = Math.max(0, Math.min(1, (share - 0.2) / 0.5));
  const [h, s, l] = rgbToHsl(PARTY_COLOR[party]);
  const light = Math.min(76, l + 24);
  const dark = Math.max(30, l - 20);
  return hslToHex(h, s, light + (dark - light) * t);
}

export type Override = { basis: string; reason: string; version: string };
export type AcRow = {
  no: number; name: string; district: string; zone: string;
  votes2023: number;
  actual: ShareSet; prediction: ShareSet; raw: ShareSet;
  answered2028: number; answeredRecall2023: number; totalRows: number;
  leader: Party | "Tie"; tied: Party[]; marginPp: number;
  sourceLeader: Party | null;
  override: Override | null;
};
export type DistrictRow = {
  name: string; acs: number[]; votes2023: number;
  actual: ShareSet; prediction: ShareSet; raw: ShareSet;
  answered2028: number; leader: Party | "Tie"; tied: Party[]; marginPp: number;
};
export type Oct26 = {
  version: string; sourceFile: string; sourceHash: string; cutoff: string; shrinkFactor: number;
  parties: Party[]; labels: Record<string, string>; congressBasis: string; othersBasis: string;
  devicesAvailable: boolean; pinDataAvailable: boolean;
  counts: {
    sourceIds: number; cutoffRows: number; answered2028: number; blank2028: number;
    answeredRecall2023: number; blankRecall2023: number; acs: number; districts: number;
  };
  statewide: {
    name: string; acs: number; votes2023: number;
    actual: ShareSet; prediction: ShareSet; raw: ShareSet;
    answered2028: number; changePp: ShareSet;
    leads: Record<string, number>; leader: Party | "Tie"; tied: Party[]; marginPp: number;
  };
  districts: DistrictRow[];
  acs: AcRow[];
  overrides: { acNo: number; acName: string; predictionShares: Record<string, number>; result: string }[];
  overrideMeta: {
    predictionOnly: boolean;
    congressLeadAssertions: number[];
    historicalKodangalWinner: string;
    note: string;
  };
  overrideVersion: string;
};

export const DATA = bundle as unknown as Oct26;
export const EMPTY: ShareSet = { BRS: 0, Congress: 0, BJP: 0, Others: 0 };

/* ---------------- aggregation ---------------- */
export function weightedShares(acs: AcRow[], key: "actual" | "prediction"): ShareSet {
  let weight = 0;
  const out: ShareSet = { ...EMPTY };
  for (const a of acs) {
    if (!(a.votes2023 > 0)) continue;
    weight += a.votes2023;
    for (const p of PARTIES) out[p] += a[key][p] * a.votes2023;
  }
  if (!weight) return { ...EMPTY };
  for (const p of PARTIES) out[p] /= weight;
  return out;
}

export function rawShares(acs: AcRow[]): ShareSet {
  let answered = 0;
  const out: ShareSet = { ...EMPTY };
  for (const a of acs) {
    if (!(a.answered2028 > 0)) continue;
    answered += a.answered2028;
    for (const p of PARTIES) out[p] += a.raw[p] * a.answered2028;
  }
  if (!answered) return { ...EMPTY };
  for (const p of PARTIES) out[p] /= answered;
  return out;
}

export function leaderOf(shares: ShareSet, parties: Party[] = PARTIES): { leader: Party | null; tied: Party[]; marginPp: number } {
  const total = parties.reduce((s, p) => s + (shares[p] ?? 0), 0);
  if (total <= 0) return { leader: null, tied: [], marginPp: 0 };
  const sorted = [...parties].sort((a, b) => shares[b] - shares[a]);
  const top = shares[sorted[0]];
  const tied = sorted.filter((p) => Math.abs(shares[p] - top) < 1e-9);
  if (tied.length > 1) return { leader: tied[0], tied, marginPp: 0 };
  const second = sorted.find((p) => !tied.includes(p));
  return {
    leader: tied[0] ?? null,
    tied: [],
    marginPp: second ? (top - shares[second]) * 100 : 0,
  };
}

export function changePp(actual: ShareSet, next: ShareSet): ShareSet {
  const out: ShareSet = { ...EMPTY };
  for (const p of PARTIES) out[p] = (next[p] - actual[p]) * 100;
  return out;
}

export function sumShares(s: ShareSet): number {
  return PARTIES.reduce((n, p) => n + s[p], 0);
}

/* ---------------- formatting ---------------- */
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`);
export const fmtPp = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`;
};

/* ---------------- system lookups ---------------- */
export const districtNames = () => DATA.districts.map((d) => d.name).sort((a, b) => a.localeCompare(b));
export const acsOfDistrict = (name: string | null) =>
  name ? DATA.acs.filter((a) => a.district === name) : DATA.acs;
export const acByNo = (no: number | null) => (no === null ? null : DATA.acs.find((a) => a.no === no) ?? null);
