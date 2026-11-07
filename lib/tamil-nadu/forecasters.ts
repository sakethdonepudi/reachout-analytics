/**
 * TVK seat projections from the multi-state forecaster report.
 *
 * The report is not present in this workspace, so the table is intentionally
 * empty rather than populated with invented figures. When the report is
 * supplied, add one row per forecaster and keep the report's rank, projected
 * seats, difference from the actual result and winner call.
 */
export type TvkForecaster = {
  rank: number;
  forecaster: string;
  projectedSeats: number | null;
  differenceFromActual: number | null;
  winnerCall: string;
};

export const TVK_ACTUAL_SEATS = 108;
export const TVK_FORECASTERS: TvkForecaster[] = [];
