import { cn } from "@/lib/utils";

const DOTS = "radial-gradient(circle, #CFCFCF 0.7px, transparent 0.9px)";

/** Faint silver geometry: dot grid, ellipse arcs and calibration ticks. */
export default function GeoBackdrop({
  className,
  mask = "left",
  arcs = true,
}: {
  className?: string;
  mask?: "left" | "right" | "top" | "none";
  arcs?: boolean;
}) {
  const maskImage = mask === "left"
    ? "linear-gradient(to right, transparent 0%, #000 38%)"
    : mask === "right"
      ? "linear-gradient(to left, transparent 0%, #000 38%)"
      : mask === "top"
        ? "linear-gradient(to bottom, transparent 0%, #000 32%)"
        : undefined;
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ maskImage, WebkitMaskImage: maskImage }}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: DOTS, backgroundSize: "24px 24px" }} />
      {arcs && (
        <svg viewBox="0 0 600 600" className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2" fill="none">
          <g stroke="#CFCFCF" strokeWidth="0.8">
            <ellipse cx="300" cy="300" rx="260" ry="190" transform="rotate(-22 300 300)" />
            <ellipse cx="300" cy="300" rx="214" ry="152" strokeDasharray="2 4" transform="rotate(-22 300 300)" />
            <ellipse cx="300" cy="300" rx="168" ry="116" transform="rotate(-22 300 300)" />
            <line x1="300" y1="20" x2="300" y2="580" strokeDasharray="1 5" />
            <line x1="20" y1="300" x2="580" y2="300" strokeDasharray="1 5" />
          </g>
        </svg>
      )}
    </div>
  );
}
