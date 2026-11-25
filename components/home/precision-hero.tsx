import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import CaseOrbit, { type OrbitCase } from "@/components/home/case-orbit";

export default function PrecisionHero({ cases }: { cases: OrbitCase[] }) {
  return (
    <section className="pointer-events-auto relative z-10 bg-[color:var(--theme-bg)] pt-16">
      <div className="hero-stack mx-auto flex min-h-[calc(100svh-64px)] max-w-[1440px] flex-col px-6 pb-16 pt-12 sm:px-10 lg:grid lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-center lg:gap-16 lg:px-16 lg:pb-[9vh] lg:pt-[2vh]">
        <div className="w-full max-w-[560px]">
          <span className="mb-5 flex w-fit items-center gap-2 rounded-full border border-[color:var(--theme-border)] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-text)]">
            <ChartNoAxesCombined className="size-3.5" strokeWidth={1.8} aria-hidden />
            Political Analysis
          </span>
          <h1 className="font-display text-[color:var(--theme-text)]">
            <span className="block whitespace-nowrap text-[clamp(48px,6vw,96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
              Find the
            </span>
            <span className="block whitespace-nowrap text-[clamp(48px,6vw,96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
              signal<span className="text-[color:var(--theme-text-3)]">.</span>
            </span>
          </h1>
          <p className="mt-5 text-[clamp(22px,2.2vw,32px)] font-medium leading-[1.1] tracking-[-0.03em] text-[color:var(--theme-text-2)]">
            See the detail.
          </p>
          <p className="mt-7 max-w-[34ch] text-[18px] leading-relaxed text-[color:var(--theme-text-2)] sm:text-[20px]">
            Election intelligence from statewide vote share down to every district and assembly.
          </p>
          <a
            href="#work"
            className="motion-cta group mt-9 flex min-h-14 w-full items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-[color:var(--theme-text)] px-7 text-[15px] font-semibold text-[color:var(--theme-text)] transition-colors hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-link)] focus-visible:ring-offset-2 sm:inline-flex sm:w-auto"
          >
            Explore case studies
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" />
          </a>
        </div>

        <div className="mt-12 w-full lg:mt-0 lg:justify-self-end">
          <CaseOrbit cases={cases} />
        </div>
      </div>
    </section>
  );
}
