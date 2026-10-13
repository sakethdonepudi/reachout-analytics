"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import LeaderOrbit from "@/components/site/leader-orbit";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Hero backgrounds — seven approved images, responsive AVIF/WebP.
 * ------------------------------------------------------------------ */
const SLIDE_COUNT = 7;
const WIDTHS = [768, 1152, 1672];
const srcSet = (n: number, ext: "avif" | "webp") =>
  WIDTHS.map((w) => `/images/hero/slide-${n}-${w}.${ext} ${w}w`).join(", ");

const HOLD_MS = 8000;
const FADE_MS = 1500;

/** A single hero background layer. `ken` alternates the drift direction. */
function Slide({
  n,
  z,
  animateIn,
  ken,
  priority,
  preload,
}: {
  n: number;
  z: number;
  animateIn: boolean;
  ken: "a" | "b";
  priority?: boolean;
  /** invisible layer that only warms the next frame's image cache */
  preload?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0", preload && "opacity-0")} style={{ zIndex: z }} aria-hidden>
      <div className={cn("absolute inset-0", !preload && animateIn && "hero-enter")}>
        <div className={cn("absolute inset-0", !preload && (ken === "a" ? "hero-kb-a" : "hero-kb-b"))}>
          <picture className="absolute inset-0 block">
            <source type="image/avif" srcSet={srcSet(n, "avif")} sizes="100vw" />
            <source type="image/webp" srcSet={srcSet(n, "webp")} sizes="100vw" />
            {/* The subject sits on the right of every frame; bias the crop so it
                is never cut, while keeping the left side clear for the headline. */}
            <img
              src={`/images/hero/slide-${n}-1672.webp`}
              alt=""
              aria-hidden
              decoding="async"
              fetchPriority={priority ? "high" : "auto"}
              className="h-full w-full object-cover object-[72%_50%]"
            />
          </picture>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const router = useRouter();
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);

  // Active slide plus a monotonic cycle counter, so every mount is uniquely
  // keyed and its CSS animation restarts exactly once.
  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [leaving, setLeaving] = useState<{ n: number; cycle: number } | null>(null);
  const [onscreen, setOnscreen] = useState(true);
  const [hidden, setHidden] = useState(false);
  const reduced = useRef(false);

  useEffect(() => { reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);

  // Suspend rotation when the tab is hidden or the hero is off-screen.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setOnscreen(e.isIntersecting), { threshold: 0.12 });
    if (root.current) io.observe(root.current);
    return () => { document.removeEventListener("visibilitychange", onVis); io.disconnect(); };
  }, []);

  // Hold the frame, then hand over: the outgoing frame stays mounted (and
  // opaque) underneath while the incoming one dissolves in on top of it.
  useEffect(() => {
    if (reduced.current || hidden || !onscreen) return;
    const t = window.setTimeout(() => {
      setLeaving({ n: idx, cycle });
      setIdx((i) => (i + 1) % SLIDE_COUNT);
      setCycle((c) => c + 1);
    }, HOLD_MS);
    return () => window.clearTimeout(t);
  }, [idx, cycle, hidden, onscreen]);

  // Retire the outgoing frame once the dissolve has finished.
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), FADE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  const next = (idx + 1) % SLIDE_COUNT;
  const layers = [
    ...(leaving ? [{ n: leaving.n, cycle: leaving.cycle, out: true }] : []),
    { n: idx, cycle, out: false },
  ];

  const scrimLeft = theme === "light" ? "rgba(4,9,24,.92)" : "rgba(5,11,31,.88)";
  const scrimMid = theme === "light" ? "rgba(7,20,56,.66)" : "rgba(7,20,56,.52)";

  return (
    <section ref={root} id="top" className="pointer-events-auto relative isolate overflow-hidden bg-[#050b1f]">
      <link rel="preload" as="image" href="/images/hero/slide-1-1672.webp" fetchPriority="high" />

      {/* rotating backgrounds — the outgoing frame stays opaque under the
          incoming dissolve, so a transition never shows a blank frame */}
      <div className="absolute inset-0 isolate" aria-hidden>
        {layers.map((l) => (
          <Slide
            key={`${l.n}-${l.cycle}`}
            n={l.n + 1}
            z={l.out ? 10 : 20}
            animateIn={l.cycle !== 0}
            ken={l.n % 2 === 0 ? "a" : "b"}
            priority={l.n === 0}
          />
        ))}
        {/* silently warm the next frame so a dissolve never waits on the network */}
        <Slide key={`warm-${next}`} n={next + 1} z={5} animateIn={false} ken="a" preload />
      </div>

      {/* consistent theme-aware scrims */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(95deg, ${scrimLeft} 0%, ${scrimMid} 38%, rgba(7,20,56,.16) 66%, rgba(5,11,31,.42) 100%)` }} aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,31,.64)_0%,transparent_26%,transparent_60%,#050b1f_100%)]" aria-hidden />
      {/* extra calm behind the leader column so the discs read on every frame */}
      <div className="absolute inset-0 hidden bg-[radial-gradient(42%_58%_at_76%_46%,rgba(4,9,24,.74),transparent_74%)] lg:block" aria-hidden />
      <div className="grain absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* one centred container, balanced two-column desktop grid */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-[1280px] flex-col justify-center px-6 py-24 sm:px-10 lg:py-28">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* left: eyebrow → headline → description → CTAs */}
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-saffron-2">Election intelligence</p>

            <h1 className="mt-5 font-display text-[clamp(30px,4.6vw,58px)] font-semibold leading-[1.06] tracking-[-0.03em] text-white [text-shadow:0_10px_60px_rgba(0,0,0,.45)]">
              Winning elections
              <br />
              with data,{" "}
              <span className="text-gradient-saffron inline-block px-[0.06em] pb-[0.12em] font-serif font-normal italic tracking-[-0.01em]">
                not guesswork.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/75">
              Election analysis, voter insight and regional intelligence for parties and campaigns across India.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ShimmerButton text="Book a Consultation" duration={1.8} onClick={() => router.push("/#contact")}
                className="border-saffron/40 px-7 py-3.5 shadow-[0_0_0_4px_rgba(245,138,36,.08),0_20px_50px_-10px_rgba(245,138,36,.4)] dark:bg-[#0a1a44]/80 backdrop-blur-xl" />
              <a href="/case-studies" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-[15px] font-medium text-white/90 backdrop-blur-xl transition-colors hover:bg-white/10">
                Explore Case Studies
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>

          {/* right: leader composition, vertically centred beside the headline */}
          <div className="hidden justify-center lg:flex" data-hero-leaders>
            <LeaderOrbit />
          </div>
        </div>

        {/* mobile: compact composition (one active + two supporting) under the CTAs */}
        <div className="mt-12 flex justify-center lg:hidden">
          <LeaderOrbit compact />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.3em] text-white/35">Scroll to explore</span>
      </div>
    </section>
  );
}
