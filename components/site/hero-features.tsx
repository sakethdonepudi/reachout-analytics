import { BriefcaseBusiness, Compass, Users } from "lucide-react";
import Reveal from "@/components/site/reveal";
import TickRule from "@/components/precision/tick-rule";
import SectionHeader from "@/components/precision/section-header";
import { PrecisionCard } from "@/components/precision/precision-card";

const FEATURES = [
  { Icon: BriefcaseBusiness, title: "Election Analysis", desc: "Survey design, constituency modelling and seat-level strategy, built on field data." },
  { Icon: Users, title: "Voter Insights", desc: "Segmentation, sentiment and targeting drawn from ongoing voter research." },
  { Icon: Compass, title: "Regional Intelligence", desc: "State and district research that helps campaigns focus where it counts." },
];

export default function HeroFeatures() {
  return (
    <section id="capabilities" className="relative z-10 bg-white">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-10 sm:pb-24">
        <TickRule />
        <SectionHeader
          eyebrow="What we do"
          title="Decision-grade intelligence, built on field data."
          lead="Three practices, one evidence base. Every map, poll and dashboard is built to answer a decision, not to decorate a deck."
          className="mt-10"
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, desc }, index) => (
            <Reveal key={title} delay={Math.min(index, 6) * 40} className="h-full">
              <PrecisionCard className="h-full p-6 hover:-translate-y-0.5">
                <span className="grid size-10 place-items-center rounded-xl border border-[var(--p-line)] bg-[var(--p-bg-alt)] text-[var(--p-ink)]">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--p-ink)]">{title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--p-ink-2)]">{desc}</p>
              </PrecisionCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
