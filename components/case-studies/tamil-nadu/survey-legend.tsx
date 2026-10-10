"use client";

import {
  BAND_COLORS, INTENSITY_BANDS, NO_DATA_COLOR, SELECTED_FILL, SELECTED_LINE, type ThemeName,
} from "@/lib/data/tamil-nadu-scale";
import { cn } from "@/lib/utils";

export type IntensityRange = { lo: number; hi: number };

/**
 * "Survey responses" key. Colours come from the shared tamil-nadu-scale
 * module, so they match the map's district fills exactly.
 */
export default function SurveyLegend({
  ranges,
  hasData,
  pollLabel,
  basisLabel,
  theme,
  className,
}: {
  ranges: IntensityRange[];
  hasData: boolean;
  pollLabel: string;
  basisLabel: string;
  theme: ThemeName;
  className?: string;
}) {
  const swatch = (color: string, border?: string) => (
    <span className="size-3 shrink-0 rounded-[3px] border" style={{ background: color, borderColor: border ?? "transparent" }} aria-hidden />
  );
  return (
    <div className={cn("glass rounded-2xl px-3.5 py-3", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Survey responses</p>
      <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
        {hasData ? (
          Array.from({ length: INTENSITY_BANDS }, (_, i) => {
            const r = ranges[i];
            return (
              <li key={i} className="flex items-center gap-2">
                {swatch(BAND_COLORS[theme][i])}
                <span className="tabular-nums">
                  {r ? `${r.lo.toLocaleString("en-IN")}–${r.hi.toLocaleString("en-IN")}` : "—"}
                </span>
              </li>
            );
          })
        ) : (
          <li className="flex items-center gap-2">{swatch(NO_DATA_COLOR[theme])} No survey responses</li>
        )}
        {hasData && <li className="flex items-center gap-2">{swatch(NO_DATA_COLOR[theme])} No survey responses</li>}
        <li className="flex items-center gap-2">{swatch(SELECTED_FILL[theme], SELECTED_LINE[theme])} Selected district</li>
      </ul>
      <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
        Valid party responses · {pollLabel} · {basisLabel}
      </p>
    </div>
  );
}
