"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PARTIES, type PartyId } from "@/lib/parties";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";

export type OrbitCase = { slug: string; party: PartyId; stateName: string };

const TICKS = Array.from({ length: 180 }, (_, index) => index * 2);
const NODES = [
  { dur: "44s", delay: "0s" },
  { dur: "58s", delay: "-8s" },
  { dur: "67s", delay: "-19s" },
  { dur: "76s", delay: "-31s" },
  { dur: "84s", delay: "-42s" },
  { dur: "92s", delay: "-54s" },
];

export default function CaseOrbit({ cases }: { cases: OrbitCase[] }) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const anchorRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const resumeTimer = useRef(0);
  const [size, setSize] = useState(560);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  const count = cases.length;

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const measure = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    measure.observe(element);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(element);
    return () => { measure.disconnect(); observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (reduced || paused || !visible) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % count), 4500);
    return () => window.clearInterval(timer);
  }, [reduced, paused, visible, count]);

  function hold() {
    window.clearTimeout(resumeTimer.current);
    setPaused(true);
  }

  function release() {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setPaused(false), 1200);
  }

  function moveFocus(index: number) {
    const next = ((index % count) + count) % count;
    setActive(next);
    anchorRefs.current[next]?.focus();
  }

  const positions = cases.map((item, index) => {
    const offset = (index - active + count) % count;
    if (offset === 0) return { x: 50, y: 50, featured: true, depth: 0 };
    const angle = (offset / count) * Math.PI * 2 + Math.PI / 2;
    return {
      x: 50 + 39 * Math.cos(angle),
      y: 50 + 30 * Math.sin(angle),
      featured: false,
      depth: 1 + (count - offset) * 0.01,
    };
  });

  return (
    <div
      ref={stageRef}
      className="hero-orbit relative mx-auto aspect-square w-full max-w-[620px]"
      style={{ "--orbit-size": `${size}px` } as React.CSSProperties}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") hold(); }}
      onPointerLeave={release}
      onFocusCapture={hold}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) release();
      }}
    >
      <div className="hero-orbit-mask absolute inset-0" aria-hidden>
        <svg viewBox="0 0 200 200" className="h-full w-full" role="presentation">
          <defs>
            <pattern id="hero-dots" width="4.8" height="4.8" patternUnits="userSpaceOnUse">
              <circle cx="0.8" cy="0.8" r="0.34" fill="#CFCFCF" opacity="0.55" />
            </pattern>
            <radialGradient id="hero-node">
              <stop offset="0%" stopColor="#7A7A7A" />
              <stop offset="100%" stopColor="#BDBDBD" />
            </radialGradient>
            <linearGradient id="hero-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#1D9E75" />
            </linearGradient>
          </defs>

          <rect width="200" height="200" fill="url(#hero-dots)" />
          <line x1="100" y1="0" x2="100" y2="200" stroke="#D0D0D0" strokeWidth="0.35" strokeDasharray="1 2.4" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#D0D0D0" strokeWidth="0.35" strokeDasharray="1 2.4" />

          <g className={reduced ? undefined : "hero-orbit-drift"}>
            <g transform="rotate(-22 100 100)">
              <ellipse cx="100" cy="100" rx="47" ry="33" fill="none" stroke="#CFCFCF" strokeWidth="0.8" />
              <ellipse cx="100" cy="100" rx="39" ry="27" fill="none" stroke="#D6D6D6" strokeWidth="0.7" strokeDasharray="2 2.4" />
              <ellipse cx="100" cy="100" rx="31" ry="21" fill="none" stroke="#D9D9D9" strokeWidth="0.65" />
              {TICKS.map((degree) => {
                const angle = (degree * Math.PI) / 180;
                const major = degree % 10 === 0;
                const outerX = 100 + 49.4 * Math.cos(angle);
                const outerY = 100 + 35.4 * Math.sin(angle);
                const innerX = 100 + (major ? 46.2 : 47.8) * Math.cos(angle);
                const innerY = 100 + (major ? 32.8 : 34.2) * Math.sin(angle);
                return <line key={degree} x1={outerX} y1={outerY} x2={innerX} y2={innerY} stroke="#BDBDBD" strokeWidth={major ? 0.5 : 0.3} />;
              })}
              {!reduced && visible && NODES.map((node) => (
                <circle key={node.dur} r="1.15" fill="url(#hero-node)" opacity="0.7">
                  <animateMotion dur={node.dur} begin={node.delay} repeatCount="indefinite" path="M 100 67 A 47 33 0 1 1 99.99 67" />
                </circle>
              ))}
            </g>

            <g transform="rotate(-18 100 100)" className={reduced || !visible ? undefined : "hero-orbit-turn"}>
              <path d="M 100 62 A 38 30 0 0 1 138 100" fill="none" stroke="url(#hero-arc)" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>

      <div className="absolute inset-0" aria-hidden={false}>
        {cases.map((item, index) => {
          const position = positions[index];
          const party = PARTIES[item.party];
          const dx = ((position.x - 50) / 100) * size;
          const dy = ((position.y - 50) / 100) * size;
          const scale = position.featured ? 1 : 0.44;
          return (
            <Link
              key={item.slug}
              href={`/case-studies/${item.slug}`}
              ref={(node) => { anchorRefs.current[index] = node; }}
              aria-label={`Open ${item.party} · ${item.stateName} case study`}
              data-featured={position.featured || undefined}
              onMouseEnter={() => router.prefetch(`/case-studies/${item.slug}`)}
              onFocus={() => router.prefetch(`/case-studies/${item.slug}`)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveFocus(active + 1); }
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveFocus(active - 1); }
              }}
              className="case-disc group absolute left-1/2 top-1/2 block w-[30%] touch-manipulation focus:outline-none"
              style={{
                transform: `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale})`,
                zIndex: position.featured ? 30 : Math.round(20 - position.depth * 10),
                transition: reduced ? "none" : "transform 700ms cubic-bezier(.34,1.16,.64,1)",
              }}
            >
              <span className="case-disc-face flex aspect-square w-full flex-col items-center justify-center rounded-full border border-[#E6E6E6] bg-white text-center">
                <span className="flex w-full items-center justify-center" style={{ height: position.featured ? "46%" : "68%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={party.logo}
                    alt=""
                    width={party.width}
                    height={party.height}
                    className="max-h-full max-w-[62%] object-contain"
                    style={{ filter: "grayscale(1) contrast(1.1)" }}
                    draggable={false}
                  />
                </span>
                <span className={position.featured ? "mt-1 block px-3" : "sr-only"}>
                  <span className="block text-[clamp(11px,1.35vw,17px)] font-semibold leading-tight text-[#0B0B0C]">{item.party} · {item.stateName}</span>
                  <span className="case-disc-view mt-1 block text-[clamp(9px,1vw,13px)] text-[#6B6B6B] underline underline-offset-2" />
                </span>
              </span>
              {position.featured && (
                <span className="pointer-events-none absolute inset-0" aria-hidden>
                  {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((classes) => (
                    <span key={classes} className={`absolute size-4 border-[#0B0B0C] ${classes}`} style={{ margin: "-7px" }} />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
