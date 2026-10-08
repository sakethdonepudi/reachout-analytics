"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TRANSITION_EVENT, type TransitionDetail, type TransitionMeta } from "@/lib/route-transition";

type Phase = "idle" | "covering" | "revealing";

const COVER_MS = 480; // time the overlay takes to cover before we navigate
const SETTLE_MS = 220; // let the new page paint under the cover
const REVEAL_MS = 620; // fade the cover away

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
  const coverTimer = useRef<number | null>(null);
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
      if (coverTimer.current) window.clearTimeout(coverTimer.current);
      coverTimer.current = window.setTimeout(() => router.push(href), COVER_MS);
    };
    window.addEventListener(TRANSITION_EVENT, onNavigate);
    return () => {
      window.removeEventListener(TRANSITION_EVENT, onNavigate);
      if (coverTimer.current) window.clearTimeout(coverTimer.current);
    };
  }, [router]);

  // once the route actually changes, reveal the new page
  useEffect(() => {
    if (phaseRef.current !== "covering") return;
    const t = window.setTimeout(() => setPhase("revealing"), SETTLE_MS);
    const done = window.setTimeout(() => setPhase("idle"), SETTLE_MS + REVEAL_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(done);
    };
  }, [pathname]);

  if (phase === "idle" || !meta) return null;

  return (
    <div
      className="fixed inset-0 z-[80]"
      style={{
        animation: phase === "covering" ? `rt-in ${COVER_MS}ms cubic-bezier(.4,0,.2,1) forwards` : `rt-out ${REVEAL_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
        background: "linear-gradient(180deg,#04091c 0%,#071331 55%,#04091c 100%)",
      }}
      aria-hidden
    >
      <div className="grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_40%,rgba(255,153,51,.14),transparent_65%)]" />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        {meta.eyebrow && (
          <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-saffron-2">{meta.eyebrow}</span>
        )}
        <h2 className="mt-4 font-display text-[clamp(34px,6vw,68px)] font-semibold leading-[1] tracking-[-0.03em] text-white">
          {meta.title}
        </h2>
        {meta.subtitle && <p className="mt-4 text-sm text-white/55">{meta.subtitle}</p>}

        <div className="mt-9 h-px w-[min(360px,70vw)] overflow-hidden bg-white/10">
          <span
            className="block h-full w-full origin-left"
            style={{
              background: "linear-gradient(90deg,#ff9933,#ffffff,#2fbf4a)",
              animation: `rt-line ${COVER_MS}ms cubic-bezier(.4,0,.2,1) forwards`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
