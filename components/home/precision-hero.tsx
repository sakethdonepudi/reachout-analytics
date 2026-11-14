import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CaseOrbit, { type OrbitCase } from "@/components/home/case-orbit";

export default function PrecisionHero({ cases }: { cases: OrbitCase[] }) {
  return (
    <section className="pointer-events-auto relative z-10 bg-white pt-16">
      <div className="hero-stack mx-auto flex min-h-[calc(100svh-64px)] max-w-[1440px] flex-col px-6 pb-16 pt-12 sm:px-10 lg:grid lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] lg:items-center lg:gap-16 lg:px-16 lg:pb-[9vh] lg:pt-[2vh]">
        <div className="w-full max-w-[560px]">
          <h1 className="font-display text-[#0B0B0C]">
            <span className="block whitespace-nowrap text-[clamp(48px,6vw,96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
              Find the
            </span>
            <span className="block whitespace-nowrap text-[clamp(48px,6vw,96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
              signal<span className="text-[#8A8A8A]">.</span>
            </span>
          </h1>
          <p className="mt-5 text-[clamp(22px,2.2vw,32px)] font-medium leading-[1.1] tracking-[-0.03em] text-[#555]">
            See the detail.
          </p>
          <p className="mt-7 max-w-[34ch] text-[18px] leading-relaxed text-[#6B6B6B] sm:text-[20px]">
            Explore data from statewide trends down to individual districts.
          </p>
          <Link
            href="/case-studies"
            className="motion-cta group mt-9 flex min-h-14 w-full items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-[#0B0B0C] px-7 text-[15px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2 sm:inline-flex sm:w-auto"
          >
            Explore case studies
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-12 w-full lg:mt-0 lg:justify-self-end">
          <CaseOrbit cases={cases} />
        </div>
      </div>
    </section>
  );
}
