"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { geoMercator } from "d3-geo";
import INDIA_GEO from "@/lib/data/india-geo.json";
import { CASES, caseUrl } from "@/lib/cases";

/* =====================================================================
   Flat, north-up political map of India.
   Geometry: lib/data/india-geo.json (real lng/lat outlines, all states/UTs
   incl. Andaman & Lakshadweep). No tilt, extrusion, glow or grid.
   A single boundary dataset is used — no duplicate outline layers.
   ===================================================================== */

const RAW = INDIA_GEO as unknown as { id: string; rings: number[][][] }[];

const NAMES: Record<string, string> = {
  an: "Andaman & Nicobar", ap: "Andhra Pradesh", ar: "Arunachal Pradesh", as: "Assam", br: "Bihar",
  ch: "Chandigarh", ct: "Chhattisgarh", dn: "Dadra & Nagar Haveli", dd: "Daman & Diu", dl: "Delhi",
  ga: "Goa", gj: "Gujarat", hr: "Haryana", hp: "Himachal Pradesh", jk: "Jammu & Kashmir", jh: "Jharkhand",
  ka: "Karnataka", kl: "Kerala", ld: "Lakshadweep", mp: "Madhya Pradesh", mh: "Maharashtra", mn: "Manipur",
  ml: "Meghalaya", mz: "Mizoram", nl: "Nagaland", or: "Odisha", py: "Puducherry", pb: "Punjab",
  rj: "Rajasthan", sk: "Sikkim", tn: "Tamil Nadu", tg: "Telangana", tr: "Tripura", up: "Uttar Pradesh",
  ut: "Uttarakhand", wb: "West Bengal",
};

const W = 900;
const H = 1000;

export default function IndiaMapFlat() {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const { paths, labels } = useMemo(() => {
    const fc = {
      type: "FeatureCollection",
      features: RAW.map((s) => ({ type: "Feature", properties: { id: s.id }, geometry: { type: "MultiPolygon", coordinates: s.rings.map((r) => [r]) } })),
    };
    const projection = geoMercator().fitExtent([[16, 16], [W - 16, H - 16]], fc as never);
    const paths: { id: string; d: string; centroid: [number, number] }[] = [];
    for (const s of RAW) {
      let d = "";
      for (const ring of s.rings) {
        const pts = ring.map(([lng, lat]) => projection([lng, lat]) as [number, number]);
        if (pts.length < 3) continue;
        d += "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z";
      }
      if (!d) continue;
      // largest-ring centroid (skip tiny islands for label placement)
      const biggest = s.rings.reduce((a, b) => (b.length > a.length ? b : a), s.rings[0]);
      const bp = biggest.map(([lng, lat]) => projection([lng, lat]) as [number, number]);
      const cx = bp.reduce((a, p) => a + p[0], 0) / bp.length;
      const cy = bp.reduce((a, p) => a + p[1], 0) / bp.length;
      paths.push({ id: s.id, d, centroid: [cx, cy] });
    }
    const labels = paths
      .filter((p) => !!NAMES[p.id])
      .map((p) => ({ id: p.id, name: NAMES[p.id], x: p.centroid[0], y: p.centroid[1] }));
    return { paths, labels };
  }, []);

  const dataByState = useMemo(() => {
    const m: Record<string, (typeof CASES)[number]> = {};
    for (const c of CASES) m[c.state] = c;
    return m;
  }, []);

  const activate = (id: string) => {
    const c = dataByState[id];
    if (c) router.push(caseUrl(c.slug));
  };

  return (
    <div className="relative mx-auto w-full max-w-[760px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="Flat map of India with states and union territories"
        onPointerLeave={() => { setHover(null); setPos(null); }}
      >
        {paths.map((p) => {
          const hasData = !!dataByState[p.id];
          const isHover = hover === p.id;
          return (
            <path
              key={p.id}
              d={p.d}
              fillRule="evenodd"
              tabIndex={hasData ? 0 : -1}
              role={hasData ? "link" : undefined}
              aria-label={NAMES[p.id]}
              onClick={() => activate(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(p.id); } }}
              onPointerMove={(e) => { setHover(p.id); setPos({ x: e.clientX, y: e.clientY }); }}
              style={{
                fill: hasData ? "var(--map-sel)" : "var(--map-fill)",
                stroke: hasData ? "var(--map-sel-line)" : "var(--map-line)",
                strokeWidth: hasData ? 0.9 : 0.6,
                vectorEffect: "non-scaling-stroke",
                cursor: hasData ? "pointer" : "default",
                opacity: isHover ? 1 : 0.96,
                filter: isHover ? "brightness(1.08)" : "none",
                transition: "fill 150ms ease, opacity 150ms ease",
                outline: "none",
              }}
            />
          );
        })}
        {/* national outline drawn once, over the fills */}
        {paths.map((p) => (
          <path key={"o" + p.id} d={p.d} fill="none" stroke="var(--map-state)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        ))}
        {labels.map((l) => (
          <text
            key={l.id}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            pointerEvents="none"
            style={{ fontSize: 11, fontWeight: 600, fill: "var(--map-label)", paintOrder: "stroke", stroke: "var(--map-halo)", strokeWidth: 3 }}
          >
            {dataByState[l.id] ? l.name : ""}
          </text>
        ))}
      </svg>

      {hover && (
        <div className="pointer-events-none fixed z-[60] w-[200px] rounded-xl border border-border bg-card/95 p-2.5 text-[12px] shadow-lg backdrop-blur-md" style={pos ? { left: pos.x + 14, top: pos.y + 14 } : undefined}>
          <p className="font-semibold text-foreground">{NAMES[hover] ?? hover}</p>
          {dataByState[hover] ? (
            <p className="mt-0.5 text-muted-foreground">{dataByState[hover].title} · view case study</p>
          ) : (
            <p className="mt-0.5 text-muted-foreground">No data available</p>
          )}
        </div>
      )}
    </div>
  );
}
