import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, Database } from "lucide-react";
import Reveal from "@/components/site/reveal";

const PREVIEW = [
  {
    Icon: ChartNoAxesCombined,
    title: "Political Intelligence",
    body: "Survey research, geographic analysis, vote-share and swing studies, campaign research and election dashboards.",
    href: "/services#political-intelligence",
    points: ["Opinion polls & exit-poll analysis", "District and constituency intelligence", "Survey data workflows"],
  },
  {
    Icon: Database,
    title: "Data & Business Analytics",
    body: "Data preparation, business intelligence, predictive modelling, governance, marketing analytics and practical training.",
    href: "/services#data-analytics",
    points: ["Dashboards and business insights", "Machine learning & modelling", "Corporate analytics training"],
  },
];

export default function ServicesPreview() {
  return (
    <section id="services-preview" className="pointer-events-auto relative z-10 border-t border-border bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Services</p>
            <h2 className="mt-3 font-display text-[clamp(28px,3.8vw,46px)] font-semibold tracking-[-0.03em]">Two practices. One decision-focused team.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Research and analytics for political programmes, alongside data and business capability for organisations of every kind.</p>
          </div>
          <Link href="/services" className="inline-flex shrink-0 items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:text-saffron-2">Explore all services<ArrowUpRight className="size-4" /></Link>
        </Reveal>

        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {PREVIEW.map(({ Icon, title, body, href, points }, i) => (
            <Reveal key={title} delay={i * 80}>
              <Link href={href} className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:border-saffron/35 hover:shadow-[0_22px_50px_-32px_rgba(15,20,30,.4)]">
                <span className="grid size-11 place-items-center rounded-xl border border-border bg-elevated text-saffron-2"><Icon className="size-5" /></span>
                <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
                <ul className="mt-4 space-y-1.5 text-[12.5px] text-foreground/75">{points.map((p) => <li key={p} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[#2fbf4a]" />{p}</li>)}</ul>
                <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground">View services<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
