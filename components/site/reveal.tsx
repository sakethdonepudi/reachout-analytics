"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Fades/slides children in when they enter the viewport (reduced-motion safe). */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    // Content stays visible unless JS confirms it is below the fold, so it is
    // never hidden when animations are unavailable.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      el.classList.add("is-visible");
      return;
    }
    el.classList.add("reveal-hidden");
    const reveal = () => {
      el.classList.remove("reveal-hidden");
      el.classList.add("is-visible");
    };
    // Safety net: never leave content hidden if the observer doesn't fire.
    const fallback = window.setTimeout(reveal, 2500);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.transitionDelay = `${delay}ms`;
            reveal();
            window.clearTimeout(fallback);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => { window.clearTimeout(fallback); io.disconnect(); };
  }, [delay]);
  return (
    <div ref={ref} className={cn("reveal", className)}>
      {children}
    </div>
  );
}
