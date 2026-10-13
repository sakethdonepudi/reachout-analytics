"use client";

import { useState } from "react";
import Link from "next/link";
import type { Leader } from "@/lib/cases";
import { caseUrl } from "@/lib/cases";
import { cn } from "@/lib/utils";

/**
 * A single refined circular portrait disc. The face is always front-facing
 * (never rotated edge-on); depth is expressed only through scale/opacity by the
 * orbiting parent. The active disc shows a readable name + party/state caption.
 */
export default function LeaderDisc({
  leader,
  size = 116,
  active = false,
  ring = false,
  className,
}: {
  leader: Leader;
  size?: number;
  active?: boolean;
  /** saffron ring without the floating caption (e.g. the mobile strip) */
  ring?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!leader.photo && !failed;

  return (
    <Link
      href={caseUrl(leader.caseSlug)}
      aria-label={`${leader.name} (${leader.party}) — view case study`}
      className={cn("group pointer-events-auto block focus:outline-none", className)}
      style={{ width: size }}
    >
      <span
        className={cn(
          "relative block overflow-hidden rounded-full border transition-colors",
          active || ring ? "border-saffron/70" : "border-white/20",
        )}
        style={{ width: size, height: size }}
      >
        {/* navy disc, so the cut-out portrait always sits on a calm surface */}
        <span className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_18%,#1c3f7e,#0a1836_72%)]" aria-hidden />
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={leader.photo}
            alt={leader.name}
            draggable={false}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full select-none object-cover object-top drop-shadow-[0_10px_16px_rgba(0,0,0,.5)]"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-serif text-3xl italic text-gradient-saffron">{leader.initials}</span>
        )}
        {/* soft inner ring for a defined silhouette */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" aria-hidden />
      </span>

      {active && (
        <span data-leader-caption className="pointer-events-none absolute left-1/2 top-full mt-3 block w-[188px] -translate-x-1/2 text-center [text-shadow:0_2px_14px_rgba(0,0,0,.75)]">
          <span className="block font-display text-[13px] font-semibold leading-tight text-white">{leader.name}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] text-white/70">
            <span className="rounded-full bg-saffron/25 px-1.5 py-px font-bold tracking-wide text-saffron-2">{leader.party}</span>
            <span>{leader.role}</span>
          </span>
        </span>
      )}
    </Link>
  );
}
