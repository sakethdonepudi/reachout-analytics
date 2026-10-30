"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PartyDisc from "@/components/site/party-disc";
import { POLITICAL_IDENTITIES } from "@/lib/parties";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Party orbit
 *
 *  A single ring of party identities on a shallow ellipse. One identity is
 *  in the foreground at a time; every 5.6s the ring eases one step so the next
 *  party slides round into place while the others shrink and recede. No
 *  politician portraits are used.
 * ------------------------------------------------------------------ */

const N = POLITICAL_IDENTITIES.length;
const BASE = 184;
const HOLD_MS = 5600;
const DURATION = 900;
const RAISE = 59;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const wrapHalf = (d: number) => {
  const m = ((d % N) + N) % N;
  return m > N / 2 ? m - N : m;
};

type Geo = {
  W: number; H: number; cx: number; cy: number;
  A: number; B: number;
  front: number; s1: number; s2: number; s3: number;
  captionTop: number; captionH: number;
};

function computeGeo(raw: number, compact: boolean): Geo {
  const W = clamp(raw || 520, 260, compact ? 400 : 520);
  const front = clamp(W * 0.35, compact ? 112 : 150, 182);
  const s1 = clamp(W * 0.2, compact ? 62 : 84, 104);
  const s2 = s1 * 0.85;
  const s3 = s1 * 0.73;
  const A = W / 2 - s1 / 2 - 6;
  const B = A * 0.5;
  const visibleTop = compact ? 0.5 * B + s1 / 2 : B + s3 / 2;
  const cy = 6 + visibleTop;
  const captionH = compact ? 48 : 56;
  const captionTop = cy + B + front / 2 + 14;
  const contentBottom = captionTop + captionH + 6;
  const discCentre = cy + (front - (compact ? s1 : s3)) / 4;
  const H = compact ? contentBottom : Math.max(contentBottom, 2 * (discCentre + RAISE));
  return { W, H, cx: W / 2, cy, A, B, front, s1, s2, s3, captionTop, captionH };
}

export default function PartyOrbit({ compact = false, className }: { compact?: boolean; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const discRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [size, setSize] = useState(0);
  const [geo, setGeo] = useState<Geo>(() => computeGeo(520, compact));
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(false);

  const geoRef = useRef(geo);
  const virtualRef = useRef(0);
  const animRef = useRef<{ from: number; to: number; elapsed: number; last: number } | null>(null);
  const rafRef = useRef(0);
  const reducedRef = useRef(false);

  const paint = useCallback(() => {
    const g = geoRef.current;
    const v = virtualRef.current;
    const sizes = [g.front, g.s1, g.s2, g.s3];
    for (let i = 0; i < N; i++) {
      const el = discRefs.current[i];
      if (!el) continue;
      const d = wrapHalf(i - v);
      const ad = Math.abs(d);
      const t = Math.min(ad, 3);
      const angle = (d * 2 * Math.PI) / N;
      const x = g.cx + g.A * Math.sin(angle);
      const y = g.cy + g.B * Math.cos(angle);
      const i0 = Math.min(Math.floor(t), 2);
      const s = sizes[i0] + (sizes[i0 + 1] - sizes[i0]) * (t - i0);
      const loud = 1 - 0.45 * (t / 3);
      const keep = compact ? clamp((1.55 - ad) / 0.35, 0, 1) : 1;
      el.style.transform = `translate3d(${(x - BASE / 2).toFixed(2)}px, ${(y - BASE / 2).toFixed(2)}px, 0) scale(${(s / BASE).toFixed(4)})`;
      el.style.opacity = (loud * keep).toFixed(3);
      el.style.zIndex = String(Math.round((3 - t) * 40));
      el.style.pointerEvents = keep > 0.5 ? "auto" : "none";
    }
  }, [compact]);

  const tick = useCallback(
    (now: number) => {
      const a = animRef.current;
      if (!a) { rafRef.current = 0; return; }
      const dt = a.last ? now - a.last : 0;
      a.last = now;
      if (visible) a.elapsed += dt;
      const p = Math.min(1, a.elapsed / DURATION);
      virtualRef.current = a.from + (a.to - a.from) * easeInOut(p);
      paint();
      if (p >= 1) {
        animRef.current = null;
        virtualRef.current = ((virtualRef.current % N) + N) % N;
        paint();
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [paint, visible],
  );

  const goTo = useCallback(
    (target: number) => {
      const from = virtualRef.current;
      const to = from + wrapHalf(target - from);
      if (reducedRef.current) {
        virtualRef.current = ((to % N) + N) % N;
        animRef.current = null;
        paint();
        return;
      }
      animRef.current = { from, to, elapsed: 0, last: 0 };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    },
    [paint, tick],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setSize((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    const io = new IntersectionObserver(
      ([e]) => { setVisible(e.isIntersecting); },
      { threshold: 0.15 },
    );
    io.observe(el);
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const g = computeGeo(size, compact);
    geoRef.current = g;
    setGeo(g);
    paint();
    if (size > 0) setReady(true);
  }, [size, compact, paint]);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => { reducedRef.current = mq.matches; setReduced(mq.matches); };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduced || !visible || hidden || hover) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % N), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [active, reduced, visible, hidden, hover]);

  useEffect(() => { goTo(active); }, [active, goTo]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full select-none", compact ? "max-w-[400px]" : "max-w-[520px]", className)}
      data-party-orbit
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
      onPointerLeave={() => setHover(false)}
    >
      <div
        className="relative mx-auto"
        style={{ width: geo.W, height: geo.H, opacity: ready ? 1 : 0, transition: "opacity .4s ease" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(56% 52% at 50% 40%, rgba(4,9,24,.55), transparent 72%)" }}
          aria-hidden
        />

        <svg className="pointer-events-none absolute inset-0" width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`} fill="none" aria-hidden>
          <defs>
            <linearGradient id={`orbit-${compact ? "c" : "d"}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,.04)" />
              <stop offset="42%" stopColor="rgba(255,255,255,.20)" />
              <stop offset="100%" stopColor="rgba(255,255,255,.04)" />
            </linearGradient>
          </defs>
          <ellipse cx={geo.cx} cy={geo.cy} rx={geo.A} ry={geo.B} stroke={`url(#orbit-${compact ? "c" : "d"})`} strokeWidth="1" />
        </svg>

        {POLITICAL_IDENTITIES.map((identity, i) => (
          <div
            key={identity.id}
            ref={(el) => { discRefs.current[i] = el; }}
            data-party-disc
            className="absolute left-0 top-0 will-change-transform"
            style={{ width: BASE, height: BASE }}
          >
            <PartyDisc identity={identity} active={i === active} onActivate={() => setActive(i)} />
          </div>
        ))}

        <div className="absolute inset-x-0" style={{ top: geo.captionTop, height: geo.captionH }}>
          {POLITICAL_IDENTITIES.map((identity, i) => (
            <div
              key={identity.id}
              aria-hidden={i !== active}
              className="party-caption absolute inset-0 flex flex-col items-center text-center"
              style={{ opacity: i === active ? 1 : 0 }}
            >
              <p className="font-display text-[14px] font-semibold leading-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,.75)]">
                {identity.party} <span className="text-white/45">·</span> {identity.state}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">View case study</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
