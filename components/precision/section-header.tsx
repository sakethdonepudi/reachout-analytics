import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function SectionHeader({
  eyebrow,
  title,
  lead,
  align = "left",
  headingLevel = 2,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--p-muted)]">{eyebrow}</p>
      <Heading className="mt-3 font-display text-[clamp(32px,4vw,56px)] font-bold leading-[1.02] tracking-[-0.03em] text-[var(--p-ink)]">{title}</Heading>
      {lead && <p className={cn("mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[var(--p-ink-2)]", align === "center" && "mx-auto")}>{lead}</p>}
    </div>
  );
}
