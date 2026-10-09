/* =====================================================================
   TAMIL NADU SURVEY-INTENSITY COLOUR SCALE — single source of truth.

   Both the map's district fills (WebGL) and the "Survey responses"
   legend (DOM) read from these values, so the swatches can never drift
   from what is rendered on the map.
   ===================================================================== */

export type ThemeName = "light" | "dark";

/** Number of data-driven intensity bands. */
export const INTENSITY_BANDS = 5;

/** Sequential blue ramp, low → high valid survey responses. */
export const BAND_COLORS: Record<ThemeName, string[]> = {
  light: ["#d8e3f1", "#b9cbe4", "#93b0d6", "#5f88c2", "#3566ad"],
  dark: ["#244066", "#2f5686", "#3b6ea8", "#4d8fd0", "#79b4f0"],
};

/** Districts with no survey responses. */
export const NO_DATA_COLOR: Record<ThemeName, string> = {
  light: "#e9edf1",
  dark: "#20293a",
};

/** Selected-district fill + its outline (brand orange family). */
export const SELECTED_FILL: Record<ThemeName, string> = {
  light: "#f7c894",
  dark: "#c2591a",
};

export const SELECTED_LINE: Record<ThemeName, string> = {
  light: "#e07617",
  dark: "#f58a24",
};
