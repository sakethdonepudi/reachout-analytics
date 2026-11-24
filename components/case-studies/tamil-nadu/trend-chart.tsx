"use client";

import { useMemo, useState } from "react";
import type { TnSocialMonth } from "@/lib/survey/social-types";
import { cn } from "@/lib/utils";

type Metric = "campaigns" | "reach" | "impressions" | "views" | "clicks" | "engagements";

const METRICS: Metric[] = ["campaigns", "reach", "impressions", "views", "clicks", "engagements"];

const MONTHS: Record<string, string> = {
  campaigns: "campaigns",
  reach: "reach",
  impressions: "impressions",
  views: "views",
  clicks: "clicks",
  engagements: "engagement",
};

const compactNumber = (value: number, mode: "compact" | "int" = "compact") => {
  if (!Number.isFinite(value)) return "—";
  if (mode === "int") return new Intl.NumberFormat("en-IN").format(Math.round(value));
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
};

export type TrendSeries = {
  metric: Metric;
  label: string;
  color: string;
};

/**
 * A real monthly line chart. Values come from the campaign rows, never from a
 * hand-drawn sparkline. Hovering the chart reveals the month and value.
 */
export function TrendChart({
  data,
  series,
  height = 44,
  className,
  label,
  mode = "compact",
}: {
  data: TnSocialMonth[];
  series: TrendSeries[];
  height?: number;
  className?: string;
  label?: string;
  mode?: "compact" | "int";
}) {
  const [hover, setHover] = useState<number | null>(null);

  const usable = useMemo(() => {
    if (data.length < 3) return { months: [], lines: [] as Array<TrendSeries & { points: string; last: { x: number; y: number } }>, max: 1 };
    const months = data.filter((row) => METRICS.some((metric) => Number(row[metric] ?? 0) > 0));
    if (months.length < 3) return { months: [], lines: [] as Array<TrendSeries & { points: string; last: { x: number; y: number } }>, max: 1 };
    const max = Math.max(1, ...months.flatMap((row) => series.map((item) => Number(row[item.metric] ?? 0))));
    const width = 160;
    const top = 3;
    const bottom = height - 3;
    const lines = series
      .filter((item) => months.filter((row) => Number(row[item.metric] ?? 0) > 0).length >= 3)
      .map((item) => {
        const points = months.map((row, index) => {
          const x = months.length === 1 ? width / 2 : (index / (months.length - 1)) * width;
          const y = bottom - (Number(row[item.metric] ?? 0) / max) * (bottom - top);
          return { x, y };
        });
        return { ...item, points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "), last: points[points.length - 1] };
      });
    return { months, lines, max };
  }, [data, height, series]);

  if (!usable.lines.length) return null;

  const viewHeight = height;
  const active = hover != null ? usable.months[hover] : null;
  const activeX = hover != null ? (usable.months.length === 1 ? 80 : (hover / (usable.months.length - 1)) * 160) : 0;

  return (
    <div className={cn("group/trend relative", className)}>
      <svg
        viewBox={`0 0 160 ${viewHeight}`}
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
        role="img"
        aria-label={label ?? series.map((item) => item.label).join(", ")}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
          setHover(Math.round(ratio * (usable.months.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {usable.lines.map((line) => (
          <g key={line.metric}>
            <polyline
              points={line.points}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={line.last.x} cy={line.last.y} r="2.4" fill={line.color} />
          </g>
        ))}
        {active && (
          <line x1={activeX} y1="2" x2={activeX} y2={viewHeight - 2} stroke="var(--theme-border)" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        )}
        {hover != null && usable.lines.map((line) => {
          const values = usable.months.map((row, index) => ({ index, x: usable.months.length === 1 ? 80 : (index / (usable.months.length - 1)) * 160, y: viewHeight - 3 - (Number(row[line.metric] ?? 0) / usable.max) * (viewHeight - 6) }));
          const point = values[hover];
          return point ? <circle key={`dot-${line.metric}`} cx={point.x} cy={point.y} r="3.2" fill={line.color} stroke="var(--theme-surface)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /> : null;
        })}
      </svg>
      {active && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 min-w-[120px] -translate-x-1/2 rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-2 py-1.5 text-[12px] shadow-xl"
          style={{ left: `${Math.max(16, Math.min(84, (activeX / 160) * 100))}%`, bottom: "calc(100% + 6px)" }}
        >
          <p className="font-semibold text-[color:var(--theme-text)]">{active.label}</p>
          {usable.lines.map((line) => (
            <p key={line.metric} className="mt-0.5 flex items-center justify-between gap-3 tabular-nums text-[color:var(--theme-text-2)]">
              <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: line.color }} />{line.label}</span>
              <span>{compactNumber(Number(active[line.metric] ?? 0), mode)}</span>
            </p>
          ))}
        </div>
      )}
      <span className="sr-only">{`${label ?? "Trend"}: ${usable.months.map((row) => `${row.label} ${MONTHS[series[0]?.metric ?? "reach"]} ${compactNumber(Number(row[series[0]?.metric ?? "reach"] ?? 0), mode)}`).join(", ")}`}</span>
    </div>
  );
}

export default TrendChart;
