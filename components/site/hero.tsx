"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Compass, Users } from "lucide-react";
import ShimmerButton from "@/components/ui/shimmer-button";
import LeaderPortrait from "@/components/site/leader-portrait";
import LeaderCarousel from "@/components/site/leader-carousel";
import { LEADERS } from "@/lib/cases";
import { rafLoop } from "@/lib/raf-loop";

const IMG = "/images/parliament.webp";

const FEATURES = [
  { Icon: BarChart3, title: "Election Analysis", desc: "Survey design, constituency modelling and seat-level strategy, built on field data." },
  { Icon: Users, title: "Voter Insights", desc: "Segmentation, sentiment and targeting drawn from ongoing voter research." },
  { Icon: Compass, title: "Regional Intelligence", desc: "State and district research that helps campaigns focus where it counts." },
];

/**
 * Landing hero. The Parliament image is split into depth layers (blurred
 * ambient, sharp photo, tilt-shift copy) that drift subtly with the pointer and
 * scroll. A restrained architectural line motif adds motion without noise.
 * Motion respects prefers-reduced-motion and stops once the hero is off-screen.
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
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    const tick = () => {
      sx += (mx - sx) * 0.06;
      sy += (my - sy) * 0.06;
      const p = Math.min(1, Math.max(0, scrollY / innerHeight));
      if (p >= 1) return;
      const L = layers.current;
      const k = reduced ? 0 : 1;
      if (L.ambient) L.ambient.style.transform = `translate3d(${sx * -16 * k}px, ${sy * -10 * k + scrollY * 0.45}px, 0) scale(${1.22 + p * 0.18})`;
      if (L.sharp) {
        L.sharp.style.transform = `translate3d(${sx * 12 * k}px, ${sy * 8 * k + scrollY * 0.32}px, 0) scale(${1.06 + p * 0.22})`;
        setF(L.sharp, "filter", p > 0.02 ? `blur(${(p * 9).toFixed(0)}px)` : "none");
      }
      if (L.shift) L.shift.style.transform = `translate3d(${sx * 18 * k}px, ${sy * 12 * k + scrollY * 0.28}px, 0) scale(${1.08 + p * 0.22})`;
      if (L.content) {
        L.content.style.transform = `translate3d(0, ${-p * 70}px, 0)`;
        setF(L.content, "opacity", (1 - p * 1.3).toFixed(2));
        setF(L.content, "filter", p > 0.02 ? `blur(${(p * 6).toFixed(0)}px)` : "none");
      }
      if (L.people) {
        L.people.style.transform = `rotateY(${sx * 8 * k}deg) rotateX(${-sy * 5 * k}deg) translate3d(0, ${-p * 140}px, ${-p * 260}px)`;
        setF(L.people, "opacity", (1 - p * 1.3).toFixed(2));
      }
      if (root.current) setF(root.current, "opacity", (1 - Math.max(0, p - 0.6) / 0.4).toFixed(2));
    };
    addEventListener("pointermove", onMove);
    const stopLoop = rafLoop(tick);
    return () => { stopLoop(); removeEventListener("pointermove", onMove); };
  }, []);

  return (
    <section ref={root} id="top" className="pointer-events-auto relative isolate min-h-[100svh] overflow-hidden bg-[#050b1f]">
      {/* depth layers */}
      <div ref={(el) => { layers.current.ambient = el; }} className="absolute inset-0 bg-cover bg-center will-change-transform"
        style={{ backgroundImage: `url(${IMG})`, filter: "blur(30px) saturate(1.2) brightness(.55)" }} aria-hidden />
      <div ref={(el) => { layers.current.sharp = el; }} className="absolute inset-0 bg-cover bg-[center_35%] will-change-transform"
        style={{ backgroundImage: `url(${IMG})`, WebkitMaskImage: "radial-gradient(125% 100% at 64% 44%, #000 48%, transparent 88%)", maskImage: "radial-gradient(125% 100% at 64% 44%, #000 48%, transparent 88%)" }} aria-hidden />
      <div ref={(el) => { layers.current.shift = el; }} className="absolute inset-0 bg-cover bg-[center_35%] will-change-transform"
        style={{ backgroundImage: `url(${IMG})`, filter: "blur(10px) saturate(1.1)", WebkitMaskImage: "linear-gradient(180deg,#000 0%,transparent 32%,transparent 64%,#000 90%)", maskImage: "linear-gradient(180deg,#000 0%,transparent 32%,transparent 64%,#000 90%)" }} aria-hidden />

      {/* colour grade */}
      <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(5,11,31,.92)_0%,rgba(7,20,56,.72)_34%,rgba(7,20,56,.16)_64%,rgba(5,11,31,.32)_100%)]" aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,31,.6)_0%,transparent_24%,transparent_62%,#050b1f_100%)]" aria-hidden />

      {/* architectural line motif — subtle, slow drift */}
      <div className="animate-drift pointer-events-none absolute inset-x-0 bottom-0 h-[78%] text-white/[0.09] mix-blend-soft-light" aria-hidden>
        <svg viewBox="0 0 1400 700" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
          <g fill="none" stroke="currentColor" strokeWidth="1.1">
            <line x1="0" y1="618" x2="1400" y2="618" />
            {Array.from({ length: 22 }).map((_, i) => {
              const x = 120 + i * 54;
              return (
                <g key={i}>
                  <line x1={x} y1="300" x2={x} y2="618" />
                  <line x1={x - 10} y1="300" x2={x + 10} y2="300" />
                  <line x1={x - 8} y1="318" x2={x + 8} y2="318" />
                </g>
              );
            })}
            <path d="M120 300 Q700 150 1280 300" />
            <path d="M120 262 Q700 112 1280 262" />
            <line x1="0" y1="262" x2="1400" y2="262" />
            <line x1="0" y1="240" x2="1400" y2="240" />
          </g>
        </svg>
      </div>
      <div className="grain absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      {/* content */}
      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-center px-6 pb-40 pt-32 sm:px-10">
        <div ref={(el) => { layers.current.content = el; }} className="max-w-2xl origin-bottom will-change-transform">
          <div className="animate-rise mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 text-[12px] font-medium tracking-wide text-white/85 backdrop-blur-xl">
            <span className="animate-pulse-dot size-2 rounded-full bg-saffron" />
            Political analytics &amp; campaign strategy
          </div>

          <h1 className="animate-rise font-display text-[clamp(40px,6vw,88px)] font-semibold leading-[1.03] tracking-[-0.03em] text-white [animation-delay:90ms] [text-shadow:0_10px_60px_rgba(0,0,0,.45)]">
            Winning elections
            <br />
            with data,{" "}
            <span className="text-gradient-saffron inline-block px-[0.08em] pb-[0.1em] font-serif font-normal italic tracking-[-0.01em]">
              not guesswork.
            </span>
          </h1>

          <div className="animate-rise mt-10 grid gap-3 [animation-delay:180ms] sm:grid-cols-3">
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

          <div className="animate-rise mt-9 flex flex-wrap items-center gap-3 [animation-delay:270ms]">
            <ShimmerButton text="Request Strategy Demo" duration={1.8} onClick={() => router.push("/#contact")}
              className="border-saffron/40 px-7 py-3.5 shadow-[0_0_0_4px_rgba(245,138,36,.08),0_20px_50px_-10px_rgba(245,138,36,.4)] dark:bg-[#0a1a44]/80 backdrop-blur-xl" />
            <a href="/case-studies" className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-[15px] font-medium text-white/90 backdrop-blur-xl transition-colors hover:bg-white/10">
              View case studies
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

        {/* original circular ring of leader portraits */}
        <div className="pointer-events-none absolute bottom-48 right-[-40px] hidden [perspective:1600px] lg:block xl:right-0">
          <div
            ref={(el) => { layers.current.people = el; }}
            className="pointer-events-auto origin-center [transform-style:preserve-3d] will-change-transform"
          >
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
