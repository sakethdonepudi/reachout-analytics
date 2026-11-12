/* =====================================================================
   TAMIL NADU SURVEY-INTENSITY COLOUR SCALE — single source of truth.

   Both the map's district fills (WebGL) and the "Survey responses"
   legend (DOM) read from these values, so the swatches can never drift
   from what is rendered on the map.
   ===================================================================== */

export type ThemeName = "light";

/** Number of data-driven intensity bands. */
export const INTENSITY_BANDS = 5;

/** Sequential blue ramp, low → high valid survey responses. */
export const BAND_COLORS: Record<ThemeName, string[]> = {
  light: ["#d8e3f1", "#b9cbe4", "#93b0d6", "#5f88c2", "#3566ad"],
};

/**
 * Districts with no recorded responses. Neutral slate / light grey so the
 * fill stays readable (never black) while boundaries and labels remain visible.
 */
export const NO_DATA_COLOR: Record<ThemeName, string> = {
  light: "#e6e9ee",
};

/** Selected-district fill + its outline (brand orange family). */
export const SELECTED_FILL: Record<ThemeName, string> = {
  light: "#f7c894",
};

export const SELECTED_LINE: Record<ThemeName, string> = {
  light: "#e07617",
};
