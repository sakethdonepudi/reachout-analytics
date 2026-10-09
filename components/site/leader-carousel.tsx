"use client";

import { useEffect, useRef } from "react";
import LeaderPortrait from "@/components/site/leader-portrait";
import { LEADERS } from "@/lib/cases";
import { rafLoop } from "@/lib/raf-loop";

/**
 * A slowly turning 3D ring of leader portraits. Cards further back get smaller,
 * dimmer and softly blurred (depth of field); hovering pauses the ring.
 */
export default function LeaderCarousel({ radius = 290 }: { radius?: number }) {
  const ring = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const paused = useRef(false);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const n = LEADERS.length;
    let angle = 0, last = performance.now(), speed = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = paused.current || reduced ? 0 : 9; // degrees per second
      speed += (target - speed) * Math.min(1, dt * 3);
      angle -= speed * dt;
      if (ring.current) ring.current.style.transform = `translateZ(${-radius}px) rotateX(-7deg) rotateY(${angle}deg)`;
      items.current.forEach((el, i) => {
        if (!el) return;
        const a = ((i * 360) / n + angle) * (Math.PI / 180);
        const facing = Math.cos(a); // 1 = front, -1 = back
        const f = (facing + 1) / 2;
        const fq = Math.round(f * 10) / 10; // quantised so the (costly) filter only changes a few times per turn
        const key = String(fq);
        if (el.dataset.f !== key) {
          el.dataset.f = key;
          el.style.opacity = String(0.25 + fq * 0.75);
          el.style.filter = fq > 0.95 ? "none" : `blur(${((1 - fq) * 3.5).toFixed(1)}px) brightness(${(0.55 + fq * 0.45).toFixed(2)})`;
        }
        el.style.pointerEvents = facing > 0.35 ? "auto" : "none";
        el.style.zIndex = String(Math.round(f * 100));
        el.style.visibility = facing > 0.02 ? "visible" : "hidden";
      });
    };
    return rafLoop(tick);
  }, [radius]);

  return (
    <div
      className="relative h-[330px] w-[560px] [perspective:1700px]"
      onPointerEnter={() => (paused.current = true)}
      onPointerLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      {/* floor glow / reflection */}
      <div className="absolute bottom-[-30px] left-1/2 h-24 w-[520px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,153,51,.35),rgba(47,191,74,.12)_60%,transparent)] blur-xl" aria-hidden />
      <div ref={ring} className="absolute inset-0 [transform-style:preserve-3d]">
        {LEADERS.map((l, i) => (
          <div
            key={l.id}
            ref={(el) => { items.current[i] = el; }}
            className="absolute left-1/2 top-1/2 -ml-[86px] -mt-[118px] [transform-style:preserve-3d]"
            style={{ transform: `rotateY(${(i * 360) / LEADERS.length}deg) translateZ(${radius}px)` }}
          >
            <LeaderPortrait leader={l} />
          </div>
        ))}
      </div>
    </div>
  );
}
