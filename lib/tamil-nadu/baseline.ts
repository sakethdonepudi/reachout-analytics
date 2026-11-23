/**
 * 2021 zone baseline from the uploaded Tamil Nadu source dashboard. Used only
 * as a fallback when a legacy stored survey predates the `base` field, so the
 * swing table still has rows after a code deploy but before the owner uploads
 * a fresh HTML file.
 */
export const TN_2021_BASE: Record<string, Record<string, number>> = {
  Chennai: { TVK: 0, "DMK+": 48.76, "AIADMK+": 33.08, NTK: 8.28, Others: 9.88 },
  North: { TVK: 0, "DMK+": 46.83, "AIADMK+": 42.91, NTK: 4.98, Others: 5.28 },
  Kongu: { TVK: 0, "DMK+": 41.7, "AIADMK+": 46.02, NTK: 5.14, Others: 7.14 },
  Delta: { TVK: 0, "DMK+": 48.01, "AIADMK+": 37.76, NTK: 6.94, Others: 7.29 },
  South: { TVK: 0, "DMK+": 43.56, "AIADMK+": 36.6, NTK: 8.02, Others: 11.82 },
  "Tamil Nadu": { TVK: 0, "DMK+": 45.38, "AIADMK+": 39.72, NTK: 6.58, Others: 8.32 },
};
