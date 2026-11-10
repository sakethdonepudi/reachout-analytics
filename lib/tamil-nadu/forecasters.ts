import "server-only";
/**
 * TVK seat projections from the supplied multi-state HTML report.
 * Only the Tamil Nadu section is used.
 *
 * Source: “Reachout Analytics Exit opinion SMO — Multi-State Election Forecast
 * Report”, Tamil Nadu → Opinion poll → Forecaster comparison.
 */
export type TvkForecaster = {
  rank: number;
  forecaster: string;
  projectedSeats: number | null;
  differenceFromActual: number | null;
  winnerCall: string;
};

export const TVK_ACTUAL_SEATS = 108;

export const TVK_FORECASTERS: TvkForecaster[] = [
  { rank: 1, forecaster: "Axis My India", projectedSeats: 109, differenceFromActual: 1, winnerCall: "TVK ✓" },
  // Report figure replaced: ReachOut age-weighted 115 (104,391 responses, Multi-State Election Forecast Report). Owner chose SAKET survey seats on 2026-11-11.
  { rank: 2, forecaster: "ReachOut Analytics (opinion poll)", projectedSeats: 106, differenceFromActual: 2, winnerCall: "TVK ✓" },
  { rank: 3, forecaster: "Kamakhya Analytics", projectedSeats: 74, differenceFromActual: 34, winnerCall: "Hung" },
  { rank: 4, forecaster: "Today's Chanakya", projectedSeats: 63, differenceFromActual: 45, winnerCall: "DMK+ ✗" },
  { rank: 5, forecaster: "People's Insight", projectedSeats: 35, differenceFromActual: 73, winnerCall: "DMK+ ✗" },
  { rank: 6, forecaster: "P-MARQ", projectedSeats: 21, differenceFromActual: 87, winnerCall: "DMK+ ✗" },
  { rank: 6, forecaster: "People's Pulse", projectedSeats: 21, differenceFromActual: 87, winnerCall: "DMK+ ✗" },
  { rank: 8, forecaster: "Poll of Polls", projectedSeats: 19, differenceFromActual: 89, winnerCall: "DMK+ ✗" },
  { rank: 9, forecaster: "Matrize", projectedSeats: 11, differenceFromActual: 97, winnerCall: "DMK+ ✗" },
  { rank: 9, forecaster: "Times Now-JVC", projectedSeats: 11, differenceFromActual: 97, winnerCall: "AIADMK+ ✗" },
  { rank: 11, forecaster: "Praja Poll", projectedSeats: 0, differenceFromActual: 108, winnerCall: "DMK+ ✗" },
];
