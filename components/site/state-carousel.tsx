"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import LeaderPortrait from "@/components/site/leader-portrait";
import { LEADERS } from "@/lib/cases";
import { cn } from "@/lib/utils";

const CARD_W = 300;
const GAP = 24;

/**
 * State leader carousel. One prominent active card with a preview of its
 * neighbours, explicit prev/next controls, position dots, keyboard support and
 * swipe. Autoplay is slow and pauses on hover, focus, manual interaction or when
 * the user prefers reduced motion. Presentation is illustrative only — it does
 * not imply endorsement, partnership or a client relationship.
 */
export default function StateCarousel() {
  const n = LEADERS.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [offset, setOffset] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number } | null>(null);

  const go = useCallback((next: number) => setIndex(((next % n) + n) % n), [n]);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // keep the active card centred
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setOffset(el.clientWidth / 2 - CARD_W / 2 - index * (CARD_W + GAP));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  const autoplay = !paused && !hovered && !focused && !reduced;
  useEffect(() => {
    if (!autoplay) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % n), 6000);
    return () => window.clearInterval(t);
  }, [autoplay, n]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(n - 1); }
  };

  const startDrag = (x: number) => (drag.current = { x });
  const endDrag = (x: number) => {
    if (!drag.current) return;
    const dx = x - drag.current.x;
    drag.current = null;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <section id="leaders" className="pointer-events-auto relative bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Across India</p>
            <h2 className="mt-3 font-display text-[clamp(28px,3.4vw,44px)] font-semibold tracking-[-0.03em] text-foreground">
              Campaigns we&apos;ve worked alongside
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              State and party associations shown for illustration, based on publicly reported roles. This does not imply endorsement or an ongoing client relationship.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPaused((p) => !p)} aria-label={autoplay ? "Pause autoplay" : "Play autoplay"}
              className="grid size-10 place-items-center rounded-full border border-border bg-card/70 text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
              {autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="State leaders"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerDown={(e) => startDrag(e.clientX)}
          onPointerUp={(e) => endDrag(e.clientX)}
          onPointerCancel={() => (drag.current = null)}
          className="relative overflow-hidden rounded-3xl border border-border bg-card/50 py-8 outline-none backdrop-blur-xl focus-visible:ring-2 focus-visible:ring-saffron/50"
        >
          <div
            className="flex items-center"
            style={{ gap: GAP, transform: `translate3d(${offset}px,0,0)`, transition: reduced ? "none" : "transform 500ms cubic-bezier(.4,0,.2,1)" }}
          >
            {LEADERS.map((l, i) => {
              const active = i === index;
              return (
                <div key={l.id} className="shrink-0" style={{ width: CARD_W }}>
                  <div
                    className="origin-bottom transition-[transform,opacity] duration-500"
                    style={{ transform: `scale(${active ? 1 : 0.88})`, opacity: active ? 1 : 0.5 }}
                    aria-hidden={!active}
                  >
                    <LeaderPortrait leader={l} size="lg" className="pointer-events-none mx-auto" />
                  </div>
                  <p className={cn("mt-4 text-center text-[13px] transition-colors", active ? "text-foreground" : "text-muted-foreground")}>
                    <b className="font-semibold" style={{ color: undefined }}>{l.name}</b> · {l.role} · {l.party}
                  </p>
                </div>
              );
            })}
          </div>

          {/* controls */}
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous"
            className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/80 text-foreground/80 backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next"
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/80 text-foreground/80 backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* position indicators */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {LEADERS.map((l, i) => (
            <button key={l.id} type="button" onClick={() => go(i)} aria-label={`Go to ${l.name}`} aria-current={i === index}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-saffron" : "w-2 bg-border hover:bg-muted-foreground")} />
          ))}
        </div>
      </div>
    </section>
  );
}
