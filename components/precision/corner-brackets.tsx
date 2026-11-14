import { cn } from "@/lib/utils";

export default function CornerBrackets({ className, inset = -7 }: { className?: string; inset?: number }) {
  return (
    <span className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((side) => (
        <span key={side} className={cn("absolute size-3 border-[var(--p-ink)]", side)} style={{ margin: `${inset}px` }} />
      ))}
    </span>
  );
}
