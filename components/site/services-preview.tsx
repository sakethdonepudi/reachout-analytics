import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, Database } from "lucide-react";
import Reveal from "@/components/site/reveal";
import TickRule from "@/components/precision/tick-rule";
import SectionHeader from "@/components/precision/section-header";

const PREVIEW = [
  {
    Icon: ChartNoAxesCombined,
    title: "Political Intelligence",
    body: "Survey research, geographic analysis, vote-share and swing studies, campaign research and election dashboards.",
    href: "/services#political-intelligence",
  },
  {
    Icon: Database,
    title: "Data & Business Analytics",
    body: "Data preparation, business intelligence, predictive modelling, governance, marketing analytics and practical training.",
    href: "/services#data-analytics",
  },
];

export default function ServicesPreview() {
  return (
    <section id="services-preview" className="pointer-events-auto relative z-10 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <TickRule />
        <div className="mt-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow="Services"
            title="Two practices. One decision-focused team."
            lead="Research and analytics for political programmes, alongside data and business capability for organisations of every kind."
          />
          <Link href="/services" className="inline-flex min-h-10 shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--p-ink)] underline-offset-4 hover:underline">
            See all services <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 grid gap-0 border-y border-[var(--p-line)] md:grid-cols-2 md:divide-x md:divide-[var(--p-line)]">
          {PREVIEW.map(({ Icon, title, body, href }, index) => (
            <Reveal key={title} delay={Math.min(index, 6) * 40}>
              <Link href={href} className="group flex h-full flex-col p-6 transition-colors hover:bg-[var(--p-bg-alt)] sm:p-8">
                <span className="grid size-10 place-items-center rounded-xl border border-[var(--p-line)] bg-white text-[var(--p-ink)]">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-5 font-display text-[clamp(24px,2.4vw,32px)] font-bold tracking-[-0.03em] text-[var(--p-ink)]">{title}</h3>
                <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[var(--p-ink-2)]">{body}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--p-ink)]">
                  Explore <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
