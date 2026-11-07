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

export const TN_OPINION_POLL = {
  label: "Opinion Poll · ReachOut Analytics",
  sourceFile: "SAKET_TN_District_Estimate_calibrated_v2.xlsx",
  denominator: 31672,
  weighting: "unweighted",
  note: "Others was not a survey category; the calibrated ECI residual is not a survey share.",
  shares: {
    TVK: 0.34307906036878,
    "AIADMK+BJP+PMK+AMMK": 0.27993180095983833,
    "DMK+INC+VCK": 0.30051780752715335,
    NTK: 0.0686094973478151,
    NOTA: 0.007861833796413236,
  } as TnShares,
};

export const ECI_ACTUAL = {
  label: "Actual 2026 · ECI",
  shortLabel: "Actual result",
  source: "https://results.eci.gov.in/ResultAcGenMay2026/partywiseresult-S22.htm",
  sourceName: "Election Commission of India",
  declaration: "Declared 4 May 2026",
  note: "Alliances: AIADMK+ = AIADMK + BJP + PMK + AMMK; DMK+ = DMK + INC + VCK. TVK, NTK, NOTA and Others are shown separately.",
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
