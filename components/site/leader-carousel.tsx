"use client";

import { useEffect, useRef, useState } from "react";
import LeaderDisc from "@/components/site/leader-disc";
import { LEADERS } from "@/lib/cases";
import { rafLoop } from "@/lib/raf-loop";

const N = LEADERS.length;
const DISC = 108;         // base disc diameter (px)
const A = 148;            // horizontal semi-axis of the orbit
const B = 42;             // vertical semi-axis — a shallow ellipse
const SPEED = 0.16;       // radians / second (~9°/s) — slow and calm

/**
 * A shallow elliptical orbit of circular, always-front-facing portrait discs.
 * One disc at the front is prominent (largest, on top, with a readable
 * caption); the rest recede in scale/opacity only — never rotated edge-on or
 * flipped to a card back. Positions stay inside the column at every frame.
 */
export default function LeaderCarousel() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const paused = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let angle = 0; // disc 0 starts at the front
    let last = performance.now();
    let currentActive = -1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused.current && !reduced && !document.hidden) angle += SPEED * dt;

      let best = -1, bestF = -1;
      for (let i = 0; i < N; i++) {
        const el = refs.current[i];
        const theta = angle + (i * 2 * Math.PI) / N;
        const c = Math.cos(theta);
        const f = (c + 1) / 2; // 1 = front, 0 = back
        if (f > bestF) { bestF = f; best = i; }
        if (!el) continue;
        const x = A * Math.sin(theta);
        const y = B * c;
        const s = 0.7 + f * 0.48; // front ≈ 1.18, back ≈ 0.7
        el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        el.style.opacity = (0.42 + f * 0.58).toFixed(2);
        el.style.zIndex = String(Math.round(f * 100));
      }
      if (best !== currentActive) { currentActive = best; setActiveIdx(best); }
    };
    return rafLoop(tick);
  }, []);

  return (
    <div
      className="relative h-[420px] w-full max-w-[520px] [perspective:1200px]"
      data-leader-orbit
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      {LEADERS.map((l, i) => (
        <div
          key={l.id}
          ref={(el) => { refs.current[i] = el; }}
          data-leader-disc
          className="absolute left-1/2 top-1/2 will-change-transform"
        >
          <LeaderDisc leader={l} active={i === activeIdx} size={DISC} />
        </div>
      ))}
    </div>
  );
}
