"use client";

import { useEffect, useRef, useState } from "react";

/* =====================================================================
   Apache ECharts wrapper — client-only and lazy.

   - `echarts/core` and only the chart/component modules we use are
     dynamically imported the first time the chart scrolls into view.
   - `setOption` merges by series id so geography/filter changes animate
     instead of rebuilding.
   - Disposed on unmount; no animation runs offscreen.
   ===================================================================== */

type Props = {
  option: Record<string, unknown>;
  height: number;
  ariaLabel: string;
  reduced: boolean;
  onEvents?: Record<string, (params: unknown) => void>;
  className?: string;
  /** replace the series list (party show/hide) instead of merging */
  replaceSeries?: boolean;
};

export default function EChart({ option, height, ariaLabel, reduced, onEvents, className, replaceSeries }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ setOption: (o: unknown, opts?: unknown) => void; resize: () => void; dispose: () => void; on: (n: string, f: (p: unknown) => void) => void; off: (n: string) => void; dispatchAction: (a: unknown) => void } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let started = false;
    const io = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      io.disconnect();
      const [core, charts, components, renderers] = await Promise.all([
        import("echarts/core"),
        import("echarts/charts"),
        import("echarts/components"),
        import("echarts/renderers"),
      ]);
      core.use([
        charts.BarChart, charts.LineChart, charts.ScatterChart,
        components.GridComponent, components.TooltipComponent, components.DataZoomComponent,
        components.MarkLineComponent, components.MarkAreaComponent, components.AriaComponent,
        renderers.CanvasRenderer,
      ]);
      if (cancelled || !hostRef.current) return;
      chartRef.current = core.init(hostRef.current, undefined, { renderer: "canvas" }) as never;
      setReady(true);
    }, { threshold: 0.1 });
    io.observe(host);
    return () => { cancelled = true; io.disconnect(); };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    chart.setOption(option, { notMerge: false, lazyUpdate: true, replaceMerge: replaceSeries ? ["series"] : undefined });
  }, [option, ready, replaceSeries]);

  useEffect(() => {
    const chart = chartRef.current;
    const host = hostRef.current;
    if (!chart || !host || !ready) return;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(host);
    return () => ro.disconnect();
  }, [ready]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready || !onEvents) return;
    for (const [name, fn] of Object.entries(onEvents)) chart.on(name, fn);
    return () => { for (const name of Object.keys(onEvents)) chart.off(name); };
  }, [onEvents, ready]);

  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null; }, []);

  return (
    <div className={className} role="img" aria-label={ariaLabel}>
      <div className="relative" style={{ height }}>
        <div ref={hostRef} className="absolute inset-0" />
        {!ready && <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground">Loading chart…</div>}
      </div>
    </div>
  );
}
