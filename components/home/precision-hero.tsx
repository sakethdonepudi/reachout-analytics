import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CaseOrbit, { type OrbitCase } from "@/components/home/case-orbit";

export default function PrecisionHero({ cases }: { cases: OrbitCase[] }) {
  return (
    <section className="pointer-events-auto relative z-10 bg-white pt-16">
      <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-[1440px] flex-col justify-start px-6 py-12 sm:px-10 lg:grid lg:grid-cols-[42%_58%] lg:items-start lg:gap-10 lg:px-16">
        <div className="max-w-[620px]">
          <h1 className="font-display text-[#0B0B0C]">
            <span className="block text-[clamp(44px,5.6vw,86px)] font-extrabold leading-[0.9] tracking-[-0.045em]">
              Find the
            </span>
            <span className="block pl-[0.62em] text-[clamp(44px,5.6vw,86px)] font-extrabold leading-[0.9] tracking-[-0.045em]">
              signal<span className="text-[#8A8A8A]">.</span>
            </span>
            <span className="mt-5 flex items-center justify-end gap-4 sm:mt-7">
              <span className="hidden h-px flex-1 bg-[#CFCFCF] sm:block" aria-hidden />
              <span className="text-right text-[clamp(21px,2.2vw,30px)] font-medium leading-[1.1] tracking-[-0.03em] text-[#555]">
                See the detail.
              </span>
            </span>
          </h1>
          <p className="mt-7 max-w-[30ch] text-[18px] leading-relaxed text-[#6B6B6B] sm:text-[20px]">
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
