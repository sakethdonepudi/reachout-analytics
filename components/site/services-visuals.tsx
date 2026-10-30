"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MotifVariant = "political" | "data" | "research";

function useInView<T extends HTMLElement>(rootMargin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.16, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, onScreen };
}

/**
 * A restrained composite of contour lines, a connected network and a chart.
 * CSS animations only run while this block is on screen; reduced-motion users
 * see the finished drawing immediately.
 */
export function ServicesHeroVisual({ className }: { className?: string }) {
  const { ref, onScreen } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("service-hero-visual relative mx-auto w-full max-w-[540px]", onScreen && "is-live", className)}
    >
      <svg viewBox="0 0 760 560" fill="none" className="h-auto w-full overflow-visible" focusable="false">
        <defs>
          <linearGradient id="hero-line" x1="112" y1="360" x2="654" y2="130" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f58a24" />
            <stop offset=".52" stopColor="#ffb866" />
            <stop offset="1" stopColor="#2fbf4a" />
          </linearGradient>
          <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f58a24" stopOpacity=".2" />
            <stop offset="1" stopColor="#f58a24" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hero-glow" cx="0" cy="0" r="1" gradientTransform="translate(565 150) rotate(130) scale(330 280)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f58a24" stopOpacity=".16" />
            <stop offset=".62" stopColor="#2fbf4a" stopOpacity=".055" />
            <stop offset="1" stopColor="#f58a24" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="565" cy="150" r="330" fill="url(#hero-glow)" />

        <g className="hero-contours text-saffron" stroke="currentColor" strokeWidth="1" opacity=".34">
          <path d="M-25 190C96 104 196 238 330 158S562 36 786 150" />
          <path d="M-25 222C98 140 198 274 334 194S570 72 786 186" />
          <path d="M-25 254C104 176 204 310 342 230S580 108 786 222" />
          <path d="M-25 286C110 212 210 346 350 266S590 144 786 258" />
          <path d="M-25 318C116 248 216 382 358 302S600 180 786 294" opacity=".7" />
        </g>

        <g className="text-foreground" opacity=".09" stroke="currentColor">
          <path d="M74 156H686M74 246H686M74 336H686M74 426H686" />
          <path d="M176 66V474M298 66V474M420 66V474M542 66V474" />
        </g>

        <rect x="74" y="66" width="612" height="408" rx="26" className="fill-card" stroke="var(--border)" strokeWidth="1.2" />
        <path d="M100 101H254" stroke="var(--border)" strokeWidth="5" strokeLinecap="round" opacity=".75" />
        <path d="M100 112H190" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" opacity=".55" />
        <circle cx="652" cy="100" r="4.5" fill="#2fbf4a" opacity=".75" />
        <circle cx="634" cy="100" r="3.5" fill="#f58a24" opacity=".65" />

        <g className="text-foreground" opacity=".2" stroke="currentColor" strokeDasharray="2 7">
          <path d="M112 390H650" />
          <path d="M112 314H650" />
          <path d="M112 238H650" />
        </g>

        <g className="hero-bars">
          {[
            ["134", "50", "0ms"],
            ["184", "78", "80ms"],
            ["234", "108", "160ms"],
            ["284", "82", "240ms"],
            ["334", "126", "320ms"],
            ["384", "98", "400ms"],
          ].map(([x, h, delay], i) => (
            <rect
              key={x}
              className={cn("hero-bar", i % 2 === 0 ? "fill-saffron" : "fill-[#2fbf4a]")}
              x={x}
              y={440 - Number(h)}
              width="24"
              height={h}
              rx="7"
              opacity={i % 2 === 0 ? ".17" : ".14"}
              style={{ animationDelay: delay }}
            />
          ))}
        </g>

        <path
          d="M112 360C158 350 188 312 228 318S296 350 338 300S410 234 454 246S520 292 560 236S610 158 654 132V390H112Z"
          fill="url(#hero-area)"
          className="hero-area"
        />
        <path
          d="M112 360C158 350 188 312 228 318S296 350 338 300S410 234 454 246S520 292 560 236S610 158 654 132"
          stroke="url(#hero-line)"
          strokeWidth="2.6"
          strokeLinecap="round"
          pathLength="1"
          className="hero-draw"
        />

        <g className="hero-network">
          <g stroke="#2fbf4a" strokeWidth=".9" strokeDasharray="3 7" opacity=".42">
            <path d="M60 164L142 122L216 96" />
            <path d="M60 164L112 360" />
            <path d="M216 96L565 80L702 142" />
            <path d="M702 142L690 272L560 236" />
            <path d="M690 272L654 132" />
          </g>
          <g fill="#2fbf4a">
            {["60 164", "142 122", "216 96", "565 80", "702 142", "690 272"].map((point, i) => {
              const [cx, cy] = point.split(" ");
              return (
                <g key={point}>
                  <circle cx={cx} cy={cy} r="9" opacity=".08" className="hero-ring" style={{ animationDelay: `${i * 350}ms` }} />
                  <circle cx={cx} cy={cy} r="3.2" opacity=".75" />
                </g>
              );
            })}
          </g>
        </g>

        <g>
          {[
            ["228", "318", "120ms"],
            ["338", "300", "300ms"],
            ["454", "246", "480ms"],
            ["560", "236", "660ms"],
            ["654", "132", "840ms"],
          ].map(([cx, cy, delay], i) => (
            <g key={cx}>
              <circle cx={cx} cy={cy} r="10" fill="#f58a24" opacity=".1" className="hero-ring" style={{ animationDelay: delay }} />
              <circle cx={cx} cy={cy} r="4" fill={i > 3 ? "#2fbf4a" : "#f58a24"} stroke="var(--card)" strokeWidth="2" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Small, section-specific line illustrations. */
export function AreaMotif({ variant, className }: { variant: MotifVariant; className?: string }) {
  const { ref, onScreen } = useInView<HTMLDivElement>();

  const tone =
    variant === "political"
      ? "text-saffron-2"
      : variant === "data"
        ? "text-[#2fbf4a] dark:text-[#65df7a]"
        : "text-[#3a6ea5] dark:text-[#9cc0e8]";

  return (
    <div ref={ref} aria-hidden className={cn("area-motif shrink-0", tone, onScreen && "is-live", className)}>
      <svg viewBox="0 0 120 64" fill="none" className="h-full w-full overflow-visible">
        {variant === "political" && (
          <>
            <path className="motif-draw" pathLength="1" d="M3 37C20 19 36 46 53 29S84 10 117 27" stroke="currentColor" strokeWidth="1.2" opacity=".55" />
            <path className="motif-draw" pathLength="1" d="M3 47C21 29 38 56 54 39S86 20 117 37" stroke="currentColor" strokeWidth="1.2" opacity=".35" style={{ animationDelay: "160ms" }} />
            <path d="M28 48L48 28L67 39L88 19" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" opacity=".65" />
            <g fill="currentColor">
              <circle cx="28" cy="48" r="2.8" />
              <circle cx="48" cy="28" r="2.3" opacity=".7" />
              <circle cx="67" cy="39" r="2.6" />
              <circle cx="88" cy="19" r="2.2" opacity=".7" />
            </g>
          </>
        )}

        {variant === "data" && (
          <>
            <g fill="currentColor" opacity=".28">
              <rect className="motif-bar" x="12" y="38" width="9" height="18" rx="2.5" />
              <rect className="motif-bar" x="28" y="28" width="9" height="28" rx="2.5" style={{ animationDelay: "70ms" }} />
              <rect className="motif-bar" x="44" y="34" width="9" height="22" rx="2.5" style={{ animationDelay: "140ms" }} />
              <rect className="motif-bar" x="60" y="19" width="9" height="37" rx="2.5" style={{ animationDelay: "210ms" }} />
            </g>
            <path className="motif-draw" pathLength="1" d="M10 43L31 34L52 38L73 23L94 27L112 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <g fill="currentColor">
              <circle cx="31" cy="34" r="2.1" />
              <circle cx="73" cy="23" r="2.1" />
              <circle cx="112" cy="12" r="2.5" />
            </g>
          </>
        )}

        {variant === "research" && (
          <>
            <rect x="24" y="8" width="48" height="48" rx="5" stroke="currentColor" strokeWidth="1.3" opacity=".5" />
            <path d="M34 20H62M34 28H57M34 36H48" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
            <circle cx="79" cy="42" r="11" stroke="currentColor" strokeWidth="1.5" />
            <path className="motif-draw" pathLength="1" d="M87 50L101 62" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="68" cy="17" r="3" fill="currentColor" opacity=".8" className="motif-node" />
          </>
        )}
      </svg>
    </div>
  );
}

/** The process rail draws once its steps enter the viewport. */
export function ProcessConnector() {
  const { ref, onScreen } = useInView<HTMLDivElement>();
  const nodes = [9, 36.33, 63.67, 91];

  return (
    <div ref={ref} aria-hidden className={cn("process-connector pointer-events-none absolute left-0 right-0 top-9 hidden h-1 md:block", onScreen && "is-live")}>
      <span className="process-rail" />
      <span className="process-progress" />
      {nodes.map((left, i) => (
        <span
          key={left}
          className="process-node"
          style={{ left: `${left}%`, animationDelay: `${i * 130 + 180}ms` }}
        />
      ))}
    </div>
  );
}

/** A quiet visual bridge between the political and business practices. */
export function SectionBridge() {
  const { ref, onScreen } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn("section-bridge relative h-14 overflow-hidden border-t border-border bg-[linear-gradient(180deg,rgba(245,138,36,.035),rgba(47,191,74,.025)_62%,transparent)]", onScreen && "is-live")}
    >
      <span className="bridge-line" />
      <span className="bridge-dot bridge-dot-start" />
      <span className="bridge-dot bridge-dot-end" />
    </div>
  );
}
