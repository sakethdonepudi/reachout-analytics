import { PartyMark } from "@/components/site/party-mark";
import { PARTIES, type PartyId } from "@/lib/parties";
import { cn } from "@/lib/utils";

/** The shared case-study identity card used in every left rail. */
export default function PartyCard({
  party,
  state,
  className,
}: {
  party: PartyId;
  state: string;
  className?: string;
}) {
  const info = PARTIES[party];
  return (
    <div className={cn("flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[#E6E6E6] bg-white p-3", className)}>
      <PartyMark party={party} size="md" />
      <div className="min-w-0">
        <p className="font-display text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0B0B0C]">{info.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] leading-tight text-[#6B6B6B]">{state}</p>
      </div>
    </div>
  );
}
