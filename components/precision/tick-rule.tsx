import { cn } from "@/lib/utils";

/** A thin rule with calibration ticks. */
export default function TickRule({ className, count = 28 }: { className?: string; count?: number }) {
  return (
    <div className={cn("relative h-3 w-full", className)} aria-hidden>
      <span className="absolute inset-x-0 top-0 h-px bg-[var(--p-line)]" />
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="absolute top-0 w-px bg-[var(--p-geo)]"
          style={{ left: `${(index / (count - 1)) * 100}%`, height: index % 5 === 0 ? "8px" : "4px" }}
        />
      ))}
    </div>
  );
}
