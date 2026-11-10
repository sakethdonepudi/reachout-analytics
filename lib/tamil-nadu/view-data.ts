import type { TnSeatGroup, TnShares } from "./model";

/** Serializable data passed from the protected server page to the client dashboard. */

export type TnSocialRow = { platform: string; organic: number; paid: number; total: number; followers: number };
export type TnSocial = { window: string; rows: TnSocialRow[]; organicPct: number; paidPct: number };
export type TnForecaster = { rank: number; forecaster: string; projectedSeats: number | null; differenceFromActual: number | null; winnerCall: string };

export type TnExitPollView = {
  label: string;
  shortLabel: string;
  source: string;
  sourceName: string;
  note: string;
  shares: TnShares;
};

export type TnOpinionPollView = {
  label: string;
  sourceFile: string | null;
  sha256: string | null;
  denominator: number | null;
  weighting: string | null;
  note: string;
  available: boolean;
  counts: TnShares;
  shares: TnShares;
};

export type TnEciActualView = {
  label: string;
  shortLabel: string;
  source: string;
  mirror?: string;
  sourceName: string;
  declaration: string;
  verifiedAt: string;
  denominator: number;
  counts: TnShares;
  partyCounts: Record<string, number>;
  seats: Record<TnSeatGroup, number>;
  mapping: Record<string, unknown>;
  shares: TnShares;
  note: string;
};

export type TnCaseData = {
  exitPoll: TnExitPollView;
  opinionPoll: TnOpinionPollView;
  actual: TnEciActualView;
  social: TnSocial;
  forecasters: TnForecaster[];
  forecastActualSeats: number;
};
