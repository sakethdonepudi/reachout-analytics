import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import { INDIA_STATES, PARTY_FILL, viewBoxFor } from "@/lib/india-states";
import type { PartyId } from "@/lib/parties";

/**
 * A single polished holding page for case studies that are being prepared.
 * All data and older dashboard code stays in the repository.
 */
export default function ComingSoon({
  party,
  stateName,
  stateCode,
  year,
}: {
  party: PartyId;
  stateName: string;
  stateCode: string;
  year: number;
}) {
  const fill = PARTY_FILL[party] ?? "#2563eb";
  const state = INDIA_STATES.find((item) => item.id === stateCode);
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--theme-bg)] px-4 pb-20 pt-28 text-[color:var(--theme-text)] sm:px-6 sm:pt-32">
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ backgroundImage: "radial-gradient(circle, var(--theme-border) 0.6px, transparent 0.8px)", backgroundSize: "26px 26px", maskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)", opacity: 0.55 }} />
      <div className="relative mx-auto w-full max-w-3xl">
        <Link href="/case-studies" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-4 text-[12.5px] font-semibold text-[color:var(--theme-text-2)] transition-colors hover:border-[color:var(--theme-text)] hover:text-[color:var(--theme-text)]">
          <ArrowLeft className="size-4" /> Back to case studies
        </Link>

        <section className="mt-8 overflow-hidden rounded-3xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-6 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.5)] sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <PartyMark party={party} size="xl" priority />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--theme-warning)]"><Clock3 className="size-3.5" /> Project in progress</p>
                <h1 className="mt-1 font-display text-[clamp(30px,5vw,48px)] font-semibold leading-[1.02] tracking-[-0.035em]">{party} · {stateName}</h1>
                <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--theme-text-3)]">{year}</p>
              </div>
            </div>
            <span className="rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--theme-text-2)]">Coming soon</span>
          </div>

          <div className="mt-7 grid items-center gap-6 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="grid h-[220px] place-items-center rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] p-4">
              {state ? (
                <svg viewBox={viewBoxFor(stateCode, 0.1)} role="img" aria-label={`${stateName} outline`} className="h-full w-full">
                  <path d={state.d} fill={fill} stroke={fill} strokeWidth="1.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              ) : null}
            </div>
            <div>
              <p className="text-[15px] leading-relaxed text-[color:var(--theme-text-2)]">This case study is being prepared. Please check back soon.</p>
              <Link href="/case-studies" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--theme-text)] px-5 text-[13px] font-semibold text-[color:var(--theme-text)] transition-colors hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-surface)]">
                <ArrowLeft className="size-4" /> Back to case studies
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
