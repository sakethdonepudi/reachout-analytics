import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import { caseUrl } from "@/lib/cases";
import type { PartyId } from "@/lib/parties";
import { TAMIL_NADU_MAP, TELANGANA_MAP, type MapPreview } from "@/lib/about-maps";

function MapArt({ map }: { map: MapPreview }) {
  return (
    <div className="about-work-map relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-[.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(140,155,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(140,155,255,.14) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_62%_38%,rgba(76,92,255,.34),transparent_70%)]" aria-hidden />
      <svg viewBox={`0 0 ${map.width} ${map.height}`} fill="none" className="relative h-auto w-full" aria-hidden>
        {map.shapes.map((shape, index) => (
          <path
            key={`${shape.name}-${index}`}
            d={shape.d}
            fill={shape.highlight ? "var(--about-lime)" : `var(--about-work-map-${shape.tone})`}
            stroke="var(--about-work-map-line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            fillRule="evenodd"
            opacity={shape.highlight ? 0.96 : 1}
          />
        ))}
        {map.shapes
          .filter((shape) => shape.highlight)
          .map((shape) => (
            <g key={`mark-${shape.name}`}>
              <circle cx={shape.cx} cy={shape.cy} r="16" stroke="var(--about-lime)" strokeWidth="1" opacity=".45" />
              <circle cx={shape.cx} cy={shape.cy} r="3.2" fill="var(--about-lime)" stroke="#07103a" strokeWidth="1.4" />
            </g>
          ))}
        <g stroke="var(--about-lime)" strokeWidth="1" opacity=".32">
          <path d="M18 40V18H40" />
          <path d={`M${map.width - 40} ${map.height - 18}H${map.width - 18}V${map.height - 40}`} />
        </g>
      </svg>
    </div>
  );
}

const WORK: Array<{
  slug: string;
  state: string;
  party: PartyId;
  map: MapPreview;
  summary: string;
}> = [
  {
    slug: "tamil-nadu",
    state: "Tamil Nadu",
    party: "AIADMK",
    map: TAMIL_NADU_MAP,
    summary: "Assembly-level survey analysis, district drilldown and a constituency view across Tamil Nadu.",
  },
  {
    slug: "telangana",
    state: "Telangana",
    party: "BRS",
    map: TELANGANA_MAP,
    summary: "2014–2028 assembly history, swing analysis and a constituency-level view across Telangana.",
  },
];

export default function AboutWork() {
  return (
    <section id="work" className="scroll-mt-24 border-t border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="about-eyebrow">Selected work</p>
            <h2 className="mt-4 font-display text-[clamp(34px,5vw,64px)] font-semibold leading-[.98] tracking-[-0.04em]">See the work.</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Two state-level views from the election intelligence work. These are lightweight previews with illustrative shading — open a case study for the full dashboard.
            </p>
          </div>
          <Link
            href="/case-studies"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:text-[color:var(--about-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/40"
          >
            All case studies <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {WORK.map((work) => (
            <Link
              key={work.slug}
              href={caseUrl(work.slug)}
              className="group flex flex-col overflow-hidden rounded-[30px] border border-border bg-card p-2.5 transition duration-300 hover:-translate-y-1 hover:border-[color:var(--about-blue-line)] hover:shadow-[0_30px_70px_-48px_rgba(8,6,62,.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/50"
            >
              <div className="relative overflow-hidden rounded-[22px] bg-[var(--about-deep)]">
                <MapArt map={work.map} />
                <div className="absolute left-3.5 top-3.5 flex items-center gap-2.5">
                  <PartyMark party={work.party} size="sm" />
                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 backdrop-blur">
                    <span className="block text-[10px] font-bold leading-tight text-white">{work.party}</span>
                    <span className="block text-[9px] leading-tight text-white/55">{work.state}</span>
                  </span>
                </div>
                <span className="absolute right-3.5 top-3.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.16em] text-white/60 backdrop-blur">
                  District preview
                </span>
                <span className="absolute bottom-3.5 left-3.5 inline-flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/55">
                  <span className="size-1.5 rounded-full bg-[var(--about-lime)]" aria-hidden />
                  State view
                </span>
              </div>

              <div className="flex flex-1 flex-col px-3 pb-3 pt-5 sm:px-4">
                <h3 className="font-display text-[clamp(24px,3vw,34px)] font-semibold leading-none tracking-[-0.03em]">{work.state}</h3>
                <p className="mt-2.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{work.summary}</p>
                <span className="mt-5 inline-flex min-h-11 items-center gap-1.5 border-t border-border pt-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors group-hover:text-[color:var(--about-blue-ink)]">
                  Explore case study
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--about-blue-solid)] text-white transition-transform group-hover:translate-x-0.5">
                    <ArrowUpRight className="size-3.5" />
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
