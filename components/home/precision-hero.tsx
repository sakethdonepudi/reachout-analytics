import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CaseOrbit, { type OrbitCase } from "@/components/home/case-orbit";

export default function PrecisionHero({ cases }: { cases: OrbitCase[] }) {
  return (
    <section className="pointer-events-auto relative z-10 bg-white pt-16">
      <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-[1440px] flex-col justify-start px-6 py-12 sm:px-10 lg:grid lg:grid-cols-[42%_58%] lg:items-start lg:gap-10 lg:px-16">
        <div className="max-w-[560px]">
          <h1 className="font-display text-[clamp(46px,5.2vw,84px)] font-bold leading-[0.95] tracking-[-0.035em] text-[#0B0B0C]">
            <span className="block whitespace-nowrap">Find the signal.</span>
            <span className="block whitespace-nowrap">See the detail.</span>
          </h1>
          <p className="mt-7 max-w-[30ch] text-[20px] leading-relaxed text-[#6B6B6B] sm:text-[22px]">
            Explore data from statewide trends down to individual districts.
          </p>
          <Link href="/case-studies" className="motion-cta group mt-9 inline-flex min-h-14 items-center gap-3 rounded-[14px] border-[1.5px] border-[#0B0B0C] px-7 text-[15px] font-semibold text-[#0B0B0C] transition-colors hover:bg-[#0B0B0C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">
            Explore case studies
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-10 w-full lg:mt-0 lg:justify-self-end">
          <CaseOrbit cases={cases} />
        </div>
      </div>
    </section>
  );
}
