import "server-only";
import type { TnSeatGroup, TnShares } from "@/lib/tamil-nadu/model";

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
const TN_OPINION_VALID = 31_672;
const TN_OPINION_COUNTS = {
  TVK: 10_866,
  "AIADMK+BJP+PMK+AMMK": 8_866,
  "DMK+INC+VCK": 9_518,
  NTK: 2_173,
  NOTA: 249,
} as const;

/**
 * Owner-designated Tamil Nadu Opinion Poll.
 *
 * Source: data/sources/tamil-nadu/SAKET_TN_District_Estimate_opinion.xlsx
 * SHA-256: c86dd033e4c87b6341ca1990ff67e55194f2371b35fbb8752fee8e7883e82583
 * Grand Total row of the "AC Estimate" sheet: 31,672 responses.
 * Others is not a survey category; the combined Others & NOTA cell is NOTA only.
 */
export const TN_OPINION_POLL = {
  label: "Opinion Poll",
  sourceFile: "SAKET_TN_District_Estimate_opinion.xlsx",
  sha256: "c86dd033e4c87b6341ca1990ff67e55194f2371b35fbb8752fee8e7883e82583",
  denominator: TN_OPINION_VALID,
  weighting: "unweighted",
  note: "Designated as the Tamil Nadu opinion poll by the owner on 2026-11-11. Same survey responses as the v3 raw shares.",
  available: true,
  counts: TN_OPINION_COUNTS,
  shares: {
    TVK: TN_OPINION_COUNTS.TVK / TN_OPINION_VALID,
    "AIADMK+BJP+PMK+AMMK": TN_OPINION_COUNTS["AIADMK+BJP+PMK+AMMK"] / TN_OPINION_VALID,
    "DMK+INC+VCK": TN_OPINION_COUNTS["DMK+INC+VCK"] / TN_OPINION_VALID,
    NTK: TN_OPINION_COUNTS.NTK / TN_OPINION_VALID,
    NOTA: TN_OPINION_COUNTS.NOTA / TN_OPINION_VALID,
  } as TnShares,
  seats: {
    TVK: 106,
    "AIADMK+BJP+PMK+AMMK": 51,
    "DMK+INC+VCK": 77,
  } as Record<TnSeatGroup, number>,
  seatSource: "Summary sheet · Estimated seats",
};

/**
 * Verified 2026 ECI result, grouped for the case-study columns.
 *
 * AIADMK+ = ADMK + BJP + PMK + AMMK
 * DMK+    = DMK + INC + VCK + CPI + CPI(M) + IUML + DMDK
 * TVK, NTK and NOTA stay separate
 * Others  = all remaining parties and independents
 *
 * Counts were recomputed from the 234 ECI 2026 constituency results as
 * published by IndiaVotes, including the NOTA count on every AC page. The ECI
 * party-wise URL supplied for verification returned 404 at the time of this
 * check; IndiaVotes is the ECI result mirror cited by the supplied workbook.
 * Denominator = total valid votes = 49,324,121.
 */
const ECI_VALID_VOTES = 49_324_121;

/** Per-party counts, kept apart so the DMK+ alliance move is auditable. */
const ECI_PARTY_COUNTS = {
  TVK: 17_226_209,
  ADMK: 10_462_146,
  BJP: 1_467_024,
  PMK: 1_070_745,
  AMMK: 425_345,
  DMK: 11_929_144,
  INC: 1_661_312,
  VCK: 540_056,
  CPI: 326_488,
  "CPI(M)": 293_817,
  IUML: 142_465,
  DMDK: 589_500,
  NTK: 1_972_537,
  NOTA: 199_801,
  Others: 1_017_532,
} as const;

const ECI_COUNTS = {
  TVK: ECI_PARTY_COUNTS.TVK,
  "AIADMK+BJP+PMK+AMMK": ECI_PARTY_COUNTS.ADMK + ECI_PARTY_COUNTS.BJP + ECI_PARTY_COUNTS.PMK + ECI_PARTY_COUNTS.AMMK,
  "DMK+INC+VCK": ECI_PARTY_COUNTS.DMK + ECI_PARTY_COUNTS.INC + ECI_PARTY_COUNTS.VCK + ECI_PARTY_COUNTS.CPI + ECI_PARTY_COUNTS["CPI(M)"] + ECI_PARTY_COUNTS.IUML + ECI_PARTY_COUNTS.DMDK,
  NTK: ECI_PARTY_COUNTS.NTK,
  Others: ECI_PARTY_COUNTS.Others,
  NOTA: ECI_PARTY_COUNTS.NOTA,
} as const;

export const ECI_ACTUAL = {
  label: "Actual 2026 · ECI",
  shortLabel: "Actual result",
  source: "https://results.eci.gov.in/ResultAcGenMay2026/partywiseresult-S22.htm",
  mirror: "https://www.indiavotes.com/vidhan-sabha/tamil-nadu/2026/",
  sourceName: "Election Commission of India",
  declaration: "Declared 4 May 2026",
  verifiedAt: "2026-11-11",
  denominator: ECI_VALID_VOTES,
  counts: ECI_COUNTS,
  partyCounts: ECI_PARTY_COUNTS,
  seats: {
    TVK: 108,
    "AIADMK+BJP+PMK+AMMK": 53,
    "DMK+INC+VCK": 73,
  } as Record<TnSeatGroup, number>,
  mapping: {
    "AIADMK+": ["ADMK", "BJP", "PMK", "AMMK"],
    "DMK+": ["DMK", "INC", "VCK", "CPI", "CPI(M)", "IUML", "DMDK"],
    TVK: ["TVK"],
    NTK: ["Naam Tamilar Katchi"],
    NOTA: ["NOTA"],
    Others: "All remaining parties and independents",
  },
  shares: {
    TVK: ECI_COUNTS.TVK / ECI_VALID_VOTES,
    "AIADMK+BJP+PMK+AMMK": ECI_COUNTS["AIADMK+BJP+PMK+AMMK"] / ECI_VALID_VOTES,
    "DMK+INC+VCK": ECI_COUNTS["DMK+INC+VCK"] / ECI_VALID_VOTES,
    NTK: ECI_COUNTS.NTK / ECI_VALID_VOTES,
    Others: ECI_COUNTS.Others / ECI_VALID_VOTES,
    NOTA: ECI_COUNTS.NOTA / ECI_VALID_VOTES,
  } as TnShares,
  note: "Alliances: AIADMK+ = ADMK + BJP + PMK + AMMK; DMK+ = DMK + INC + VCK + CPI + CPI(M) + IUML + DMDK. TVK, NTK, NOTA and Others stay separate. Total valid votes = 49,324,121.",
};

