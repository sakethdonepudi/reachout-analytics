"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Leader } from "@/lib/cases";
import { caseUrl } from "@/lib/cases";
import { cn } from "@/lib/utils";

/**
 * One circular portrait on the orbit. The parent only translates/scales the
 * box that holds it, so a disc is never rotated edge-on and the face always
 * stays front-facing. The active disc carries the saffron rim and opens its
 * case study; a supporting disc is a button that pulls itself forward.
 */
export default function LeaderDisc({
  leader,
  active,
  onActivate,
  className,
}: {
  leader: Leader;
  active: boolean;
  onActivate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const showPhoto = !!leader.photo && !failed;

  return (
    <button
      type="button"
      onClick={() => (active ? router.push(caseUrl(leader.caseSlug)) : onActivate?.())}
      aria-label={active ? `${leader.name} (${leader.party}) — view case study` : `Bring ${leader.name} forward`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative block h-full w-full cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
    >
      <span
        className={cn(
          "relative block h-full w-full overflow-hidden rounded-full transition duration-500",
          active
            ? "border-2 border-saffron shadow-[0_0_0_7px_rgba(245,138,36,.10),0_26px_64px_-20px_rgba(245,138,36,.55),0_12px_30px_-12px_rgba(0,0,0,.65)]"
            : "border border-white/15 shadow-[0_18px_44px_-22px_rgba(0,0,0,.85)]",
        )}
      >
        {/* navy disc, so the cut-out portrait always sits on a calm surface */}
        <span className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_18%,#1c3f7e,#0a1836_72%)]" aria-hidden />
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={leader.photo}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full select-none object-cover object-top"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-serif text-3xl italic text-gradient-saffron">{leader.initials}</span>
        )}
        {/* soft inner ring for a defined silhouette */}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" aria-hidden />
      </span>
    </button>
  );
}
