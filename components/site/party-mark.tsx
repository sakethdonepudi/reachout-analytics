import { PARTIES, type PartyId } from "@/lib/parties";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const MARK_SIZE: Record<Size, string> = {
  sm: "size-10 rounded-lg p-1",
  md: "size-12 rounded-xl p-1.5",
  lg: "size-20 rounded-2xl p-2.5",
  xl: "size-28 rounded-3xl p-4",
};

const MARK_SCALE: Record<Size, number> = { sm: 0.82, md: 1, lg: 1.75, xl: 2.4 };

/** A neutral tile for the supplied party symbol. Original colours are untouched. */
export function PartyMark({
  party,
  size = "md",
  priority = false,
  className,
}: {
  party: PartyId;
  size?: Size;
  priority?: boolean;
  className?: string;
}) {
  const info = PARTIES[party];
  return (
    <span
      className={cn("grid shrink-0 place-items-center border border-black/[.06] bg-[#fbfaf7] shadow-[inset_0_1px_0_rgba(255,255,255,.8)]", MARK_SIZE[size], className)}
      title={info.fullName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={info.logo}
        alt={`${info.fullName} logo`}
        width={info.width}
        height={info.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="h-auto max-h-full w-auto max-w-full object-contain"
        style={{ maxHeight: info.opticalHeight * MARK_SCALE[size] }}
      />
    </span>
  );
}

export function PartyIdentity({
  party,
  state,
  size = "md",
  tone = "default",
  className,
}: {
  party: PartyId;
  state: string;
  size?: Size;
  tone?: "default" | "dark";
  className?: string;
}) {
  const info = PARTIES[party];
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <PartyMark party={party} size={size} />
      <div className="min-w-0">
        <p className={cn("font-display text-[14px] font-semibold leading-tight tracking-[-0.01em]", tone === "dark" ? "text-white" : "text-foreground")}>
          {info.name}
        </p>
        <p className={cn("mt-0.5 truncate text-[11.5px] leading-tight", tone === "dark" ? "text-white/55" : "text-muted-foreground")}>{state}</p>
      </div>
    </div>
  );
}
