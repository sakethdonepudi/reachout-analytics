import type { TnShares } from "@/lib/tamil-nadu/model";

/** Statewide Tamil Nadu comparison sources used by the case-study rail. */

export const AMI_EXIT_POLL = {
  label: "Exit Poll · Axis My India",
  shortLabel: "Exit poll",
  source: "https://www.axismyindia.org/perform",
  sourceName: "Axis My India",
  note: "Statewide projection from the AMI Prediction vote-share column. Cross-checked against Wikipedia, Exit polls → Vote share projection.",
  shares: {
    TVK: 0.35,
    "DMK+INC+VCK": 0.35,
    "AIADMK+BJP+PMK+AMMK": 0.23,
    NTK: 0.03,
    Others: 0.04,
  } as TnShares,
};

/**
 * Tamil Nadu Opinion Poll.
 *
 * No genuine opinion-poll dataset with real rows was found. The only supplied
 * workbook with an "Opinion Poll" sheet (TN2026_Poll_Upload_Estimated_Districts
 * .xlsx) has that sheet empty; its 32,736 rows are all Exit Poll. The v3 raw
 * party-choice shares previously shown here were the exit-poll workbook's raw
 * shares, not an opinion poll, and are deliberately not reused in any visible
 * column. A published opinion dataset can still replace this fallback through
 * the summary API if one is imported later.
 */
export const TN_OPINION_POLL = {
  label: "Opinion Poll",
  sourceFile: null,
  denominator: null,
  weighting: null,
  note: "No Tamil Nadu Opinion Poll dataset with real rows is available. The supplied Opinion Poll sheet is empty; the v3 raw shares are exit-poll party choice, not an opinion poll.",
  available: false,
  shares: null,
};

/**
 * Verified 2026 ECI result, grouped for the case-study columns.
 *
 * Grouping (fixed here so the UI never re-derives it):
 *   AIADMK+ = ADMK + BJP + PMK + AMMK
 *   DMK+    = DMK + INC + VCK
 *   TVK, NTK, NOTA stay separate
 *   Others  = every other party and independent
 *
 * Counts were recomputed from the 234 ECI 2026 constituency results as
 * published by IndiaVotes, including the NOTA count on every AC page. The ECI
 * party-wise URL supplied for verification returned 404 at the time of this
 * check; IndiaVotes is the ECI result mirror cited by the supplied workbook.
 * Denominator = total valid votes = 49,324,121.
 */
const ECI_VALID_VOTES = 49_324_121;
const ECI_COUNTS = {
  TVK: 17_226_209,
  "AIADMK+BJP+PMK+AMMK": 13_425_260,
  "DMK+INC+VCK": 14_130_512,
  NTK: 1_972_537,
  Others: 2_369_802,
  NOTA: 199_801,
} as const;

export const ECI_ACTUAL = {
  label: "Actual 2026 · ECI",
  shortLabel: "Actual result",
  source: "https://results.eci.gov.in/ResultAcGenMay2026/partywiseresult-S22.htm",
  mirror: "https://www.indiavotes.com/vidhan-sabha/tamil-nadu/2026/",
  sourceName: "Election Commission of India",
  declaration: "Declared 4 May 2026",
  verifiedAt: "2026-11-10",
  denominator: ECI_VALID_VOTES,
  counts: ECI_COUNTS,
  mapping: {
    "AIADMK+BJP+PMK+AMMK": ["ADMK", "BJP", "PMK", "AMMK"],
    "DMK+INC+VCK": ["DMK", "INC", "VCK"],
    TVK: ["TVK"],
    NTK: ["Naam Tamilar Katchi"],
    NOTA: ["NOTA"],
    Others: "All remaining parties and independents (CPI, CPI(M), IUML, DMDK, ...)",
  },
  shares: {
    TVK: ECI_COUNTS.TVK / ECI_VALID_VOTES,
    "AIADMK+BJP+PMK+AMMK": ECI_COUNTS["AIADMK+BJP+PMK+AMMK"] / ECI_VALID_VOTES,
    "DMK+INC+VCK": ECI_COUNTS["DMK+INC+VCK"] / ECI_VALID_VOTES,
    NTK: ECI_COUNTS.NTK / ECI_VALID_VOTES,
    Others: ECI_COUNTS.Others / ECI_VALID_VOTES,
    NOTA: ECI_COUNTS.NOTA / ECI_VALID_VOTES,
  } as TnShares,
  note: "Alliances: AIADMK+ = ADMK + BJP + PMK + AMMK; DMK+ = DMK + INC + VCK. TVK, NTK, NOTA and Others stay separate. Total valid votes = 49,324,121.",
};

export type SocialRow = {
  platform: string;
  organic: number;
  paid: number;
  total: number;
  followers: number;
};

export const TN_SOCIAL = {
  window: "Meta reach · 23 Mar–22 Apr 2026",
  rows: [
    { platform: "Facebook", organic: 147369734, paid: 209749007, total: 357118741, followers: 246173 },
    { platform: "Instagram", organic: 41971328, paid: 106878129, total: 148849457, followers: 90188 },
    { platform: "Total", organic: 189341062, paid: 316627136, total: 505968198, followers: 336361 },
  ] as SocialRow[],
  organicPct: 37.4,
  paidPct: 62.6,
};
