"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import LeaderPortrait from "@/components/site/leader-portrait";
import LeaderCarousel from "@/components/site/leader-carousel";
import { rafLoop } from "@/lib/raf-loop";
import { CASES, LEADERS, caseUrl } from "@/lib/cases";

const IMG = "/images/parliament.webp";

const CHECKS = [
  "Official Partner in Andhra Pradesh, Telangana, Tamil Nadu, Bihar, Karnataka & Gujarat",
  "High-Accuracy Election Predictions",
  "Real-Time Voter Insights & Digital Boosting",
];

/**
 * Home screen. The Parliament photo is split into depth layers:
 * an ambient blurred copy, the sharp photo, and a "tilt-shift" blurred copy
 * masked to the top and bottom — each layer moves at a different rate with the
 * pointer and the scroll, which reads as real depth. On scroll the whole scene
 * pushes forward and dissolves into the 3D map underneath.
 */
export default function Hero() {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const layers = useRef<{ ambient?: HTMLDivElement | null; sharp?: HTMLDivElement | null; shift?: HTMLDivElement | null; content?: HTMLDivElement | null; people?: HTMLDivElement | null }>({});

  useEffect(() => {
    let mx = 0, my = 0, sx = 0, sy = 0;
    const cache = new Map<HTMLElement, string>();
    const setF = (el: HTMLElement, key: "filter" | "opacity", v: string) => {
      const id = key + v;
      if (cache.get(el) === id) return;
      cache.set(el, id);
      el.style[key] = v;
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
    };
    const tick = () => {
      sx += (mx - sx) * 0.06;
      sy += (my - sy) * 0.06;
      const p = Math.min(1, Math.max(0, scrollY / innerHeight)); // 0 → 1 while leaving the hero
      if (p >= 1) return; // hero is off-screen
      const L = layers.current;
      const k = reduced ? 0 : 1;
      if (L.ambient) L.ambient.style.transform = `translate3d(${sx * -18 * k}px, ${sy * -12 * k + scrollY * 0.5}px, 0) scale(${1.25 + p * 0.2})`;
      if (L.sharp) {
        L.sharp.style.transform = `translate3d(${sx * 14 * k}px, ${sy * 10 * k + scrollY * 0.35}px, 0) scale(${1.06 + p * 0.25})`;
        setF(L.sharp, "filter", p > 0.02 ? `blur(${(p * 10).toFixed(0)}px)` : "none");
      }
      if (L.shift) L.shift.style.transform = `translate3d(${sx * 22 * k}px, ${sy * 14 * k + scrollY * 0.3}px, 0) scale(${1.08 + p * 0.25})`;
      if (L.content) {
        L.content.style.transform = `translate3d(0, ${-p * 80}px, 0) rotateX(${p * 10}deg)`;
        setF(L.content, "opacity", (1 - p * 1.4).toFixed(2));
        setF(L.content, "filter", p > 0.02 ? `blur(${(p * 8).toFixed(0)}px)` : "none");
      }
      if (L.people) {
        L.people.style.transform = `rotateY(${sx * 8 * k}deg) rotateX(${-sy * 5 * k}deg) translate3d(0, ${-p * 140}px, ${-p * 260}px)`;
        setF(L.people, "opacity", (1 - p * 1.3).toFixed(2));
      }
      if (root.current) setF(root.current, "opacity", (1 - Math.max(0, p - 0.55) / 0.45).toFixed(2));
    };
    addEventListener("pointermove", onMove);
    const stopLoop = rafLoop(tick);
    return () => {
      stopLoop();
      removeEventListener("pointermove", onMove);
    };
  }, []);

  const parties = CASES.filter((c) => c.party || c.slug === "karnataka-2023" || c.slug === "north-east-elections");

  return (
    <section ref={root} id="top" className="relative isolate min-h-[100svh] overflow-hidden bg-[#050b1f] [perspective:1400px]">
      {/* --- depth layers --- */}
      <div
        ref={(el) => { layers.current.ambient = el; }}
        className="absolute inset-0 bg-cover bg-center will-change-transform"
        style={{ backgroundImage: `url(${IMG})`, filter: "blur(28px) saturate(1.3) brightness(.6)" }}
        aria-hidden
      />
      <div
        ref={(el) => { layers.current.sharp = el; }}
        className="absolute inset-0 bg-cover bg-[center_35%] will-change-transform"
        style={{
          backgroundImage: `url(${IMG})`,
          WebkitMaskImage: "radial-gradient(120% 95% at 62% 42%, #000 45%, transparent 85%)",
          maskImage: "radial-gradient(120% 95% at 62% 42%, #000 45%, transparent 85%)",
        }}
        aria-hidden
      />
      {/* tilt-shift: blurred copy only at the top (sky/dashboards) and bottom (crowd) */}
      <div
        ref={(el) => { layers.current.shift = el; }}
        className="absolute inset-0 bg-cover bg-[center_35%] will-change-transform"
        style={{
          backgroundImage: `url(${IMG})`,
          filter: "blur(9px) saturate(1.2)",
          WebkitMaskImage: "linear-gradient(180deg,#000 0%,transparent 30%,transparent 62%,#000 88%)",
          maskImage: "linear-gradient(180deg,#000 0%,transparent 30%,transparent 62%,#000 88%)",
        }}
        aria-hidden
      />
      {/* colour grade + light */}
      <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(5,11,31,.94)_0%,rgba(7,20,56,.78)_32%,rgba(7,20,56,.2)_62%,rgba(5,11,31,.35)_100%)]" aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,31,.55)_0%,transparent_22%,transparent_60%,#050b1f_100%)]" aria-hidden />
      <div className="animate-sweep absolute left-[45%] top-[8%] size-[46vw] rounded-full bg-[radial-gradient(circle,rgba(255,170,90,.35),transparent_60%)] mix-blend-screen blur-2xl" aria-hidden />
      <div className="grain absolute inset-0 opacity-[0.07] mix-blend-overlay" aria-hidden />

      {/* --- content --- */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-44 pt-32 sm:px-10">
        <div ref={(el) => { layers.current.content = el; }} className="max-w-xl origin-bottom will-change-transform xl:max-w-2xl">
          <div className="glass mb-7 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[12px] font-medium tracking-wide text-white/80">
            <span className="animate-pulse-dot size-2 rounded-full bg-saffron" />
            India&apos;s Leading Political Analytics &amp; Campaign Strategy Experts
          </div>

          <h1 className="font-display text-[clamp(44px,6.2vw,92px)] font-semibold leading-[0.98] tracking-[-0.035em] text-white [text-shadow:0_10px_60px_rgba(0,0,0,.45)]">
            Winning Elections
            <br />
            with Data,{" "}
            <span className="text-gradient-saffron font-serif font-normal italic tracking-[-0.01em]">not guesswork.</span>
          </h1>

          <ul className="mt-8 grid gap-2.5">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[15px] leading-snug text-white/80">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-saffron to-[#ff7a1a] shadow-[0_0_20px_rgba(255,153,51,.5)]">
                  <Check className="size-3 text-[#07122e]" strokeWidth={3.5} />
                </span>
                {c}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <ShimmerButton
              text="Request Strategy Demo"
              duration={1.8}
              onClick={() => router.push("/#contact")}
              className="border-saffron/40 px-7 py-3.5 shadow-[0_0_0_4px_rgba(255,153,51,.08),0_20px_50px_-10px_rgba(255,153,51,.45)] dark:bg-[#0a1a44]/80 backdrop-blur-xl"
            />
            <a
              href="#tour"
              className="glass group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-medium text-white/90 transition hover:bg-white/15"
            >
              View Case Studies
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>

          {/* portraits on small screens */}
          <div className="-mx-6 mt-10 flex gap-4 overflow-x-auto px-6 pb-8 pt-1 [scrollbar-width:none] lg:hidden">
            {LEADERS.map((l) => (
              <LeaderPortrait key={l.id} leader={l} size="sm" className="shrink-0" />
            ))}
          </div>
        </div>

        {/* 3D ring of leader portraits */}
        <div className="pointer-events-none absolute bottom-48 right-[-40px] hidden [perspective:1600px] lg:block xl:right-0">
          <div
            ref={(el) => { layers.current.people = el; }}
            className="pointer-events-auto origin-center [transform-style:preserve-3d] will-change-transform"
          >
            <LeaderCarousel radius={250} />
          </div>
        </div>
      </div>

      {/* trust marquee */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/10 bg-white/[0.04] py-5 backdrop-blur-2xl">
        <span className="tricolor-line absolute inset-x-0 top-0 h-px opacity-50" aria-hidden />
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">
          Trusted by political campaigns across India
        </p>
        <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <div className="animate-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
            {[...parties, ...parties].map((c, i) => (
              <a
                key={i}
                href={caseUrl(c.slug)}
                className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-5 text-sm text-white/80 transition hover:border-saffron/50 hover:bg-saffron/10"
              >
                <b className="grid h-8 min-w-11 place-items-center rounded-full bg-gradient-to-br from-[#1f4fb0] to-[#0b1f4d] px-3 font-display text-[12px] font-bold tracking-wide text-saffron-2">
                  {c.party ?? c.badge.split(" ")[0]}
                </b>
                <span className="whitespace-nowrap font-medium">{c.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
