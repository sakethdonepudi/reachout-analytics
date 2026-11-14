"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TRANSITION_EVENT, type TransitionDetail, type TransitionMeta } from "@/lib/route-transition";
import { setCoverActive } from "@/lib/cover-state";

type Phase = "idle" | "covering" | "revealing";

const COVER_MS = 220; // cover-in animation; navigation starts immediately
const SETTLE_MS = 80; // let the destination commit under the cover
const REVEAL_MS = 240; // fade the cover away

/**
 * Full-screen cover used when moving from the map into a case study.
 * Mounted in the root layout so it survives client navigation and can
 * reveal the destination once the route has changed.
 */
export default function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [meta, setMeta] = useState<TransitionMeta | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const { href, meta: m } = (e as CustomEvent<TransitionDetail>).detail;
      if (!href) return;
      // honour reduced-motion: navigate immediately, no cover
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      setMeta(m);
      setPhase("covering");
      setCoverActive(true);
      // Navigate at time 0 and let the cover animate over the route swap.
      router.push(href);
    };
    window.addEventListener(TRANSITION_EVENT, onNavigate);
    return () => {
      window.removeEventListener(TRANSITION_EVENT, onNavigate);
    };
  }, [router]);

  // once the route actually changes, reveal the new page
  useEffect(() => {
    if (phaseRef.current !== "covering") return;
    const t = window.setTimeout(() => setPhase("revealing"), SETTLE_MS);
    const done = window.setTimeout(() => { setPhase("idle"); setCoverActive(false); }, SETTLE_MS + REVEAL_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(done);
    };
  }, [pathname]);

  if (phase === "idle" || !meta) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-loader)]"
      style={{
        animation: phase === "covering" ? `rt-in ${COVER_MS}ms cubic-bezier(.4,0,.2,1) forwards` : `rt-out ${REVEAL_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
        background: "linear-gradient(180deg,#04091c 0%,#071331 55%,#04091c 100%)",
      }}
      aria-hidden
    >
      <div className="grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,rgba(29,158,117,.14),transparent_65%)]" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        {meta.eyebrow && (
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-teal-deep">{meta.eyebrow}</span>
        )}
        <h2 className="mt-4 font-display text-[clamp(34px,6vw,68px)] font-semibold leading-[1] tracking-[-0.03em] text-white">
          {meta.title}
        </h2>
        {meta.subtitle && <p className="mt-4 text-sm text-white/55">{meta.subtitle}</p>}

        <div className="mt-9 h-px w-[min(360px,70vw)] overflow-hidden bg-white/10">
          <span
            className="block h-full w-full origin-left"
            style={{
              background: "linear-gradient(90deg,#1d9e75,#ffffff,#1d9e75)",
              animation: `rt-line ${COVER_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
