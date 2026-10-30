"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PARTIES, type PoliticalIdentity } from "@/lib/parties";
import { caseUrl } from "@/lib/cases";
import { cn } from "@/lib/utils";

/**
 * One circular party identity on the home hero. The parent only translates and
 * scales this square box; logos never rotate or spin. The active disc opens its
 * case study, while a supporting disc pulls itself forward.
 */
export default function PartyDisc({
  identity,
  active,
  onActivate,
  className,
}: {
  identity: PoliticalIdentity;
  active: boolean;
  onActivate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const party = PARTIES[identity.party];
  const label = `${party.fullName}, ${identity.state}`;

  return (
    <button
      type="button"
      onClick={() => (active ? router.push(caseUrl(identity.caseSlug)) : onActivate?.())}
      aria-label={active ? `${label} — view case study` : `Bring ${label} forward`}
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
        <span className="absolute inset-0 bg-[#fbfaf7]" aria-hidden />
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={party.logo}
            alt={`${party.fullName} logo`}
            width={party.width}
            height={party.height}
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="absolute left-1/2 top-1/2 h-[52%] w-[56%] -translate-x-1/2 -translate-y-1/2 object-contain"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center font-display text-3xl font-semibold text-[#08063E]">{party.name}</span>
        )}
        <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/[.04]" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08063E]/90 via-[#08063E]/55 to-transparent pb-2 pt-7 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white">{party.name}</span>
        </span>
      </span>
    </button>
  );
}
