"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { rafLoop } from "@/lib/raf-loop";
import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import indiaGeo from "@/lib/data/india-geo.json";

type Props = {
  className?: string;
  /** degrees per second */
  speed?: number;
  /**
   * "clockwise" = clockwise when seen from above the North Pole, so the surface
   * moves right → left across the front of the globe. Use "counterclockwise"
   * for the Earth's real spin (left → right).
   */
  direction?: "clockwise" | "counterclockwise";
  /** optional external control 0‥1 for the spin speed (used during the zoom-out transition) */
  spinRef?: MutableRefObject<number>;
};
// spinRef.current < 0 pauses drawing (globe hidden)

const INDIA_ID = "356";
const HYDERABAD: [number, number] = [78.49, 17.39];
const HUBS: [number, number][] = [
  [91.74, 26.14], // Guwahati
  [80.27, 13.08], // Chennai
  [80.62, 16.51], // Vijayawada
  [72.57, 23.02], // Ahmedabad
  [85.14, 25.6], // Patna
  [77.59, 12.97], // Bengaluru
];

/** Wire-frame globe drawn on a canvas — India outlined state by state in saffron. */
export default function Globe({ className, speed = 10, direction = "clockwise", spinRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
    // India is drawn from our own state outlines, so leave the atlas shape out.
    const others = { ...countries, features: countries.features.filter((f) => String(f.id) !== INDIA_ID) };
    const graticule = geoGraticule10();
    const india = indiaGeo as { id: string; rings: [number, number][][] }[];

    const projection = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(projection, ctx);
    const sign = direction === "clockwise" ? -1 : 1;
    let lambda = -80; // start with India facing us
    const phi = -18;
    let last = performance.now(), w = 0, h = 0, dpr = 1;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = spinRef ? spinRef.current : 1;
      if (k < 0) return;
      if (!reduced) lambda += sign * speed * k * dt;
      const R = Math.min(w, h) / 2 - 2;
      projection.translate([w / 2, h / 2]).scale(R).rotate([lambda, phi]);
      const center: [number, number] = [-lambda, -phi];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // sphere body + rim light
      const g = ctx.createRadialGradient(w / 2 - R * 0.35, h / 2 - R * 0.4, R * 0.1, w / 2, h / 2, R);
      g.addColorStop(0, "rgba(40,80,170,.28)");
      g.addColorStop(1, "rgba(5,11,31,.9)");
      ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = g; ctx.fill();

      ctx.beginPath(); path(graticule); ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 0.6; ctx.stroke();

      ctx.beginPath(); path(others); ctx.fillStyle = "rgba(255,255,255,.035)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 0.7; ctx.stroke();

      // India — states in saffron
      ctx.beginPath();
      for (const s of india) for (const ring of s.rings) {
        let pen = false;
        for (const pt of ring) {
          if (geoDistance(pt, center) > Math.PI / 2) { pen = false; continue; }
          const p = projection(pt);
          if (!p) { pen = false; continue; }
          if (pen) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); pen = true; }
        }
      }
      ctx.fillStyle = "rgba(255,153,51,.12)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,170,90,.95)"; ctx.lineWidth = 0.8; ctx.shadowColor = "rgba(255,140,40,.9)"; ctx.shadowBlur = 8; ctx.stroke();
      ctx.shadowBlur = 0;

      // hubs + HQ pulse
      const t = now / 1000;
      for (const hub of HUBS) {
        if (geoDistance(hub, center) > Math.PI / 2) continue;
        const p = projection(hub)!;
        ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); ctx.fillStyle = "#ffd6a3"; ctx.fill();
      }
      if (geoDistance(HYDERABAD, center) < Math.PI / 2) {
        const p = projection(HYDERABAD)!;
        const q = (t * 0.8) % 1;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3 + q * 16, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(47,191,74,${1 - q})`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fillStyle = "#2fbf4a"; ctx.fill();
      }

      // outline
      ctx.beginPath(); path({ type: "Sphere" }); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.1; ctx.stroke();
    };
    const stopLoop = rafLoop(draw);
    return () => { stopLoop(); ro.disconnect(); };
  }, [speed, direction, spinRef]);

  return <canvas ref={canvasRef} className={className} aria-label="Rotating globe with India highlighted" role="img" />;
}
