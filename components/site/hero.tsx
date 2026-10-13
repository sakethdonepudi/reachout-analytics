"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Compass, Users } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import LeaderCarousel from "@/components/site/leader-carousel";
import MobileLeaderStrip from "@/components/site/mobile-leader-strip";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 *  Hero backgrounds — seven approved images, responsive AVIF/WebP.
 *  Order matters and matches the reading order of the supplied set.
 * ------------------------------------------------------------------ */
const SLIDE_COUNT = 7;
const WIDTHS = [768, 1152, 1672];
const srcSet = (n: number, ext: "avif" | "webp") =>
  WIDTHS.map((w) => `/images/hero/slide-${n}-${w}.${ext} ${w}w`).join(", ");

const HOLD_MS = 8000;
const FADE_MS = 1500;

const FEATURES = [
  { Icon: BarChart3, title: "Election Analysis", desc: "Survey design, constituency modelling and seat-level strategy, built on field data." },
  { Icon: Users, title: "Voter Insights", desc: "Segmentation, sentiment and targeting drawn from ongoing voter research." },
  { Icon: Compass, title: "Regional Intelligence", desc: "State and district research that helps campaigns focus where it counts." },
];

/** A single crossfade layer. Rendered (and therefore loaded) before it shows. */
function Slide({ n, show, immediate }: { n: number; show: boolean; immediate: boolean }) {
  return (
    <picture
      className={cn("absolute inset-0 block transition-opacity ease-in-out", show ? "opacity-100" : "opacity-0")}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <source type="image/avif" srcSet={srcSet(n, "avif")} sizes="100vw" />
      <source type="image/webp" srcSet={srcSet(n, "webp")} sizes="100vw" />
      {/* The subject sits on the right of every frame; bias the crop so it is
          never cut, while keeping the left side clear for the headline. */}
      <img
        src={`/images/hero/slide-${n}-1672.webp`}
        alt=""
        aria-hidden
        decoding="async"
        fetchPriority={immediate ? "high" : "auto"}
        className="h-full w-full object-cover object-[72%_50%]"
      />
    </picture>
  );
}

export default function Hero() {
  const router = useRouter();
  const { theme } = useTheme();
  const root = useRef<HTMLElement>(null);

  const [active, setActive] = useState(0);
  const [fading, setFading] = useState(false);
  const [onscreen, setOnscreen] = useState(true);
  const [hidden, setHidden] = useState(false);
  const reduced = useRef(false);

  // Reduced motion → a single static background, no rotation.
  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Suspend rotation when the tab is hidden or the hero is off-screen.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver(([e]) => setOnscreen(e.isIntersecting), { threshold: 0.12 });
    if (root.current) io.observe(root.current);
    return () => { document.removeEventListener("visibilitychange", onVis); io.disconnect(); };
  }, []);

  // Hold each slide, then crossfade.
  useEffect(() => {
    if (reduced.current || hidden || !onscreen || fading) return;
    const t = window.setTimeout(() => setFading(true), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [active, hidden, onscreen, fading]);

  useEffect(() => {
    if (!fading) return;
    const t = window.setTimeout(() => { setActive((a) => (a + 1) % SLIDE_COUNT); setFading(false); }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [fading]);

  const current = active;
  const next = (active + 1) % SLIDE_COUNT;

  // Theme-aware scrim: guarantees contrast for the left-aligned copy on every
  // (dark) frame, slightly stronger in light theme.
  const scrimLeft = theme === "light" ? "rgba(4,9,24,.9)" : "rgba(5,11,31,.86)";
  const scrimMid = theme === "light" ? "rgba(7,20,56,.62)" : "rgba(7,20,56,.5)";

  return (
    <section ref={root} id="top" className="pointer-events-auto relative isolate min-h-[100svh] overflow-hidden bg-[#050b1f]">
      {/* load the first background immediately (React hoists this to <head>) */}
      <link rel="preload" as="image" href="/images/hero/slide-1-1672.webp" fetchPriority="high" />

      {/* rotating backgrounds (two layers: current + preloading next) */}
      <div className="absolute inset-0" aria-hidden>
        {/* The outgoing frame stays fully opaque underneath; the incoming frame
            fades in on top — no background bleeds through mid-crossfade. */}
        <Slide n={current + 1} show immediate={current === 0} />
        <Slide n={next + 1} show={fading} immediate={false} />
      </div>

      {/* consistent theme-aware scrims */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(95deg, ${scrimLeft} 0%, ${scrimMid} 36%, rgba(7,20,56,.14) 64%, rgba(5,11,31,.4) 100%)` }} aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,31,.62)_0%,transparent_26%,transparent_60%,#050b1f_100%)]" aria-hidden />
      <div className="grain absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* content */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-start px-5 pb-16 pt-28 sm:px-10 sm:pb-40 lg:justify-center lg:pt-32">
        <div className="w-full max-w-2xl">
          <div className="animate-rise mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-[12px] font-medium tracking-wide text-white/85 backdrop-blur-xl">
            <span className="animate-pulse-dot size-2 rounded-full bg-saffron" />
            Political analytics &amp; campaign strategy
          </div>

          <h1 className="animate-rise font-display text-[clamp(34px,9vw,88px)] font-semibold leading-[1.05] tracking-[-0.03em] text-white [animation-delay:90ms] [text-shadow:0_10px_60px_rgba(0,0,0,.45)]">
            Winning elections
            <br />
            with data,{" "}
            <span className="text-gradient-saffron inline-block px-[0.08em] pb-[0.1em] font-serif font-normal italic tracking-[-0.01em]">
              not guesswork.
            </span>
          </h1>

          <p className="animate-rise mt-5 max-w-xl text-[15px] leading-relaxed text-white/75 [animation-delay:140ms]">
            Election analysis, voter insight and regional intelligence for parties and campaigns across India.
          </p>

          <div className="flex flex-col">
            {/* primary CTA first on mobile; after the features on desktop */}
            <div className="animate-rise order-1 mt-8 flex flex-wrap items-center gap-3 [animation-delay:220ms] lg:order-2 lg:mt-9">
              <ShimmerButton text="Request Strategy Demo" duration={1.8} onClick={() => router.push("/#contact")}
                className="border-saffron/40 px-7 py-3.5 shadow-[0_0_0_4px_rgba(245,138,36,.08),0_20px_50px_-10px_rgba(245,138,36,.4)] dark:bg-[#0a1a44]/80 backdrop-blur-xl" />
              <a href="/case-studies" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-[15px] font-medium text-white/90 backdrop-blur-xl transition-colors hover:bg-white/10">
                View case studies
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            {/* compact leader animation (mobile only) */}
            <div className="order-2 mt-10 lg:hidden">
              <MobileLeaderStrip />
            </div>

            {/* feature content — after the leader strip on mobile, first on desktop */}
            <div className="animate-rise order-3 mt-10 grid gap-3 [animation-delay:180ms] sm:grid-cols-3 lg:order-1 lg:mt-10">
              {FEATURES.map(({ Icon, title, desc }) => (
                <div key={title} className="group rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1">
                  <span className="mb-3 grid size-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-saffron-2 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-4" />
                  </span>
                  <h2 className="font-display text-[15px] font-semibold text-white">{title}</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* circular ring of leader portraits — higher, centred in the right column */}
        <div className="pointer-events-none absolute top-[46%] right-[1%] hidden -translate-y-1/2 [perspective:1600px] lg:block xl:right-[3%]">
          <div className="pointer-events-auto origin-center [transform-style:preserve-3d]">
            <LeaderCarousel radius={250} />
          </div>
        </div>
      </div>

      {/* scroll hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.3em] text-white/35">Scroll to explore</span>
      </div>
    </section>
  );
}
