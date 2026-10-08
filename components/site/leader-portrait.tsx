"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties } from "react";
import type { Leader } from "@/lib/cases";
import { caseUrl } from "@/lib/cases";
import { startRouteTransition } from "@/lib/route-transition";
import { cn } from "@/lib/utils";

type Props = {
  leader: Leader;
  className?: string;
  style?: CSSProperties;
  size?: "sm" | "md" | "lg";
  /** disable the link (e.g. when the portrait is used on its own case page) */
  static?: boolean;
};

const SIZES = {
  sm: "h-[190px] w-[140px]",
  md: "h-[236px] w-[172px]",
  lg: "h-[400px] w-[300px]",
};

/**
 * 3D portrait: the cut-out photo sits in front of a glass frame and the head
 * breaks out over the top edge. The card tilts toward the pointer, a glare
 * follows the cursor, and the name plate floats nearest to the viewer.
 */
export default function LeaderPortrait({ leader, className, style, size = "md", static: isStatic }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, mx: 50, my: 30 });
  const [failed, setFailed] = useState(false);
  const showPhoto = !!leader.photo && !failed;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (0.5 - py) * 18, y: (px - 0.5) * 22, mx: px * 100, my: py * 100 });
  };

  const body = (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0, mx: 50, my: 30 })}
      className={cn("relative transition-transform duration-300 ease-out [transform-style:preserve-3d]", SIZES[size])}
      style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      {/* coloured glow behind */}
      <div
        className="absolute inset-x-[-18%] bottom-[-10%] top-[20%] rounded-[48px] opacity-55 blur-3xl transition-opacity duration-500 group-hover:opacity-90"
        style={{
          transform: "translateZ(-60px)",
          background:
            "radial-gradient(55% 55% at 25% 35%, rgba(255,153,51,.7), transparent 70%), radial-gradient(55% 55% at 80% 80%, rgba(47,191,74,.5), transparent 70%)",
        }}
        aria-hidden
      />

      {/* glass frame (lower 80%) */}
      <div className="absolute inset-x-0 bottom-0 top-[20%] overflow-hidden rounded-[26px] border border-white/15 bg-gradient-to-b from-[#2a5fc4]/80 via-[#11306f]/80 to-[#060f29] shadow-[0_40px_70px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl">
        <div
          className="absolute inset-0 opacity-50"
          style={{ background: "repeating-radial-gradient(circle at 50% 30%, rgba(255,255,255,.13) 0 1px, transparent 1px 20px)" }}
          aria-hidden
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" aria-hidden />
        {!showPhoto && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-gradient-saffron font-serif text-6xl italic">{leader.initials}</span>
          </div>
        )}
      </div>

      {/* cut-out photo — head breaks out of the frame */}
      {showPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={leader.photo}
          alt={leader.name}
          onError={() => setFailed(true)}
          draggable={false}
          className="pointer-events-none absolute inset-x-[4%] bottom-0 h-[100%] w-[92%] select-none object-contain object-bottom drop-shadow-[0_18px_24px_rgba(0,0,0,.55)] transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ transform: "translateZ(34px)", transformOrigin: "50% 100%" }}
        />
      )}

      {/* bottom fade + glare, in front of the photo */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] rounded-b-[26px] bg-gradient-to-t from-[#050b1f] via-[#050b1f]/70 to-transparent"
        style={{ transform: "translateZ(36px)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[20%] rounded-[26px] opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100"
        style={{ transform: "translateZ(38px)", background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.6), transparent 45%)` }}
        aria-hidden
      />

      {/* name plate */}
      <div className="absolute inset-x-3 bottom-3" style={{ transform: "translateZ(60px)" }}>
        <div className={cn("truncate font-display font-semibold leading-tight text-white", size === "lg" ? "text-xl" : "text-[13px]")}>
          {leader.name}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/65">
          <span className="rounded-full bg-saffron/25 px-1.5 py-px font-bold tracking-wide text-saffron-2">{leader.party}</span>
          <span className="truncate">{leader.role}</span>
        </div>
      </div>
    </div>
  );

  if (isStatic) return <div className={cn("group relative [perspective:1000px]", className)} style={style}>{body}</div>;

  return (
    <Link
      href={caseUrl(leader.caseSlug)}
      className={cn("group relative block [perspective:1000px] focus:outline-none", className)}
      style={style}
      aria-label={`${leader.name} (${leader.party}) — view case study`}
    >
      {body}
    </Link>
  );
}
