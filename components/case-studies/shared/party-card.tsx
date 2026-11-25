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
    <div className={cn("flex w-full min-w-0 items-center gap-3 rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3", className)}>
      <PartyMark party={party} size="md" />
      <div className="min-w-0">
        <p className="font-display text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[color:var(--theme-text)]">{info.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] leading-tight text-[color:var(--theme-text-2)]">{state}</p>
      </div>
    </div>
  );
}
