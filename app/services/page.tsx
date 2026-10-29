import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight, ArrowUpRight, BarChart3, BookOpenCheck, ChartNoAxesCombined,
  CircleCheck, ClipboardCheck, Database, FileChartColumn, Gauge, GraduationCap,
  LineChart, MapPinned, Network, Radar, ScanSearch, ShieldCheck, Sparkles, Target,
  TrendingUp, UsersRound,
} from "lucide-react";
import Navbar from "@/components/site/navbar";
import Reveal from "@/components/site/reveal";
import ServicesEnquiry from "@/components/site/services-enquiry";
import { CONTACT } from "@/lib/cases";
import {
  CONSULTING_EXPERIENCE, DATA_SERVICES, POLITICAL_SERVICES, TRAINING_EXPERIENCE,
  serviceHref, type ServiceArea, type ServiceIcon,
} from "@/lib/services";

export const metadata: Metadata = {
  title: "Services — ReachOut Analytics",
  description: "Political intelligence, survey analysis, data analytics, predictive modelling, dashboards and corporate training from ReachOut Analytics.",
};

const ICONS: Record<ServiceIcon, typeof BarChart3> = {
  poll: ChartNoAxesCombined, map: MapPinned, swing: TrendingUp, research: ScanSearch,
  dashboard: Gauge, database: Database, analytics: BarChart3, bi: FileChartColumn,
  ml: Network, mining: Radar, insight: Sparkles, security: ShieldCheck,
  marketing: Target, training: GraduationCap, statistics: BookOpenCheck,
};

const PROCESS = [
  { n: "01", title: "Understand", body: "Define the question, scope and desired outcome.", Icon: Target },
  { n: "02", title: "Prepare", body: "Collect, validate and organise the available data.", Icon: ClipboardCheck },
  { n: "03", title: "Analyse", body: "Investigate patterns and build suitable models.", Icon: LineChart },
  { n: "04", title: "Deliver", body: "Present dashboards, findings and practical recommendations.", Icon: UsersRound },
];

const ANCHORS = [
  ["Political Intelligence", "#political-intelligence"],
  ["Data & Business Analytics", "#data-analytics"],
  ["Experience", "#experience"],
  ["Process", "#process"],
  ["Enquiry", "#enquiry"],
] as const;

function ServiceCard({ service, delay = 0 }: { service: ServiceArea; delay?: number }) {
  const Icon = ICONS[service.icon];
  return (
    <Reveal delay={delay} className="h-full">
      <article className="group flex h-full flex-col rounded-3xl border border-border bg-card p-5 transition duration-300 hover:-translate-y-1 hover:border-saffron/35 hover:shadow-[0_22px_50px_-32px_rgba(15,20,30,.4)]">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-border bg-elevated text-saffron-2 transition-colors group-hover:border-saffron/35">
            <Icon className="size-[18px]" />
          </span>
          {service.caseStudy && (
            <Link href={service.caseStudy.href} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-saffron-2">
              {service.caseStudy.label}<ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>
        <h3 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.015em]">{service.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{service.description}</p>
        <ul className="mt-4 space-y-1.5">
          {service.deliverables.map((d) => <li key={d} className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/75"><CircleCheck className="mt-0.5 size-3.5 shrink-0 text-[#2fbf4a]" />{d}</li>)}
        </ul>
        <Link href={serviceHref(service.title)} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/80 transition-colors hover:text-saffron-2">
          Discuss this service<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </article>
    </Reveal>
  );
}

function ExperienceGrid({ title, note, names }: { title: string; note: string; names: string[] }) {
  return (
    <div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">{note}</p>
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {names.map((name) => (
          <li key={name} className="grid min-h-14 place-items-center rounded-xl border border-border bg-card px-3 py-3 text-center font-display text-[14px] font-semibold tracking-[-0.01em] text-foreground/85 transition-colors hover:border-saffron/35 hover:bg-elevated/60">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative isolate overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-36">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_80%_10%,rgba(245,138,36,.12),transparent_65%),radial-gradient(55%_45%_at_8%_70%,rgba(47,191,74,.08),transparent_70%)]" aria-hidden />
          <svg className="service-contours animate-drift pointer-events-none absolute -right-32 top-12 -z-10 h-[520px] w-[820px] text-saffron/20 dark:text-saffron/25" viewBox="0 0 820 520" fill="none" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M-40 ${210 + i * 34} C 130 ${90 + i * 34}, 240 ${330 + i * 24}, 400 ${205 + i * 22} S 690 ${90 + i * 30}, 880 ${235 + i * 25}`} stroke="currentColor" strokeWidth="1" />)}
            <path d="M90 400 L220 280 L330 330 L470 170 L620 230 L760 100" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" />
            {[["220","280"],["330","330"],["470","170"],["620","230"]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r="3" fill="currentColor" />)}
          </svg>
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Link href="/" className="hover:text-foreground">Home</Link><span aria-hidden>/</span><span className="font-medium text-foreground/80">Services</span></nav>
            <Reveal className="mt-12 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Political Intelligence & Data Analytics</p>
              <h1 className="mt-4 font-display text-[clamp(42px,6vw,76px)] font-semibold leading-[.96] tracking-[-0.045em]">Clear insights.<br /><span className="text-gradient-saffron">Better decisions.</span></h1>
              <p className="mt-6 max-w-2xl text-[clamp(16px,1.8vw,19px)] leading-relaxed text-muted-foreground">From election research and campaign intelligence to business analytics and predictive modelling, we turn complex data into practical decisions.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#enquiry" className="inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-3 text-[14px] font-semibold text-[#241203] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">Discuss your project<ArrowRight className="size-4" /></a>
                <Link href="/case-studies" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-5 py-3 text-[14px] font-semibold text-foreground transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">Explore our work<ArrowUpRight className="size-4" /></Link>
              </div>
            </Reveal>
            <Reveal delay={120} className="mt-12 flex flex-wrap gap-2 border-t border-border pt-5">
              {ANCHORS.map(([label, href]) => <a key={href} href={href} className="rounded-full border border-border bg-card/65 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-saffron/40 hover:text-foreground">{label}</a>)}
            </Reveal>
          </div>
        </section>

        <section id="political-intelligence" className="scroll-mt-24 border-t border-border bg-card/35">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Practice 01</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Political Intelligence</h2></div>
              <div><p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">Research, geographic analysis and reporting for campaigns and political organisations. We describe analytical capability, not guaranteed electoral outcomes; conclusions remain dependent on the quality of available data and the wider campaign context.</p><Link href={serviceHref("Opinion polls & exit-poll analysis")} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-foreground hover:text-saffron-2">Discuss a political project<ArrowRight className="size-3.5" /></Link></div>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {POLITICAL_SERVICES.map((s, i) => <ServiceCard key={s.title} service={s} delay={i * 40} />)}
            </div>
          </div>
        </section>

        <section id="data-analytics" className="scroll-mt-24 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Practice 02</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Data & Business Analytics</h2></div>
              <div><p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">From preparing a reliable dataset to building a dashboard, model or training programme, our work is scoped around the decision you need to make and the evidence available.</p><Link href={serviceHref("Data analysis & preparation")} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-foreground hover:text-saffron-2">Discuss a data project<ArrowRight className="size-3.5" /></Link></div>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {DATA_SERVICES.map((s, i) => <ServiceCard key={s.title} service={s} delay={i * 35} />)}
            </div>
          </div>
        </section>

        <section id="experience" className="scroll-mt-24 border-t border-border bg-card/35">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Leadership experience</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Experience across industries</h2><p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Consulting and corporate training experience from our leadership team.</p></Reveal>
            <div className="mt-10 grid gap-10 lg:grid-cols-2">
              <Reveal><ExperienceGrid title="Leadership consulting experience" note="Named organisations reflect our leadership team's professional consulting experience. They are not presented as official partners or as ongoing ReachOut engagements." names={CONSULTING_EXPERIENCE} /></Reveal>
              <Reveal delay={90}><ExperienceGrid title="Leadership training experience" note="Named organisations reflect training delivered by our leadership team. Inclusion does not imply an ongoing relationship or endorsement." names={TRAINING_EXPERIENCE} /></Reveal>
            </div>
          </div>
        </section>

        <section id="process" className="scroll-mt-24 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">How we work</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">A clear, four-step process</h2></Reveal>
            <div className="relative mt-10 grid gap-4 md:grid-cols-4">
              <span className="pointer-events-none absolute left-[9%] right-[9%] top-8 hidden h-px overflow-hidden bg-gradient-to-r from-saffron/20 via-saffron/50 to-[#2fbf4a]/25 md:block" aria-hidden><span className="process-scan absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-saffron/80 to-transparent" /></span>
              {PROCESS.map(({ n, title, body, Icon }, i) => (
                <Reveal key={n} delay={i * 80}>
                  <div className="relative z-10 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-saffron/35">
                    <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-saffron/10 text-saffron-2"><Icon className="size-4" /></span><span className="font-display text-[11px] font-semibold text-muted-foreground">{n}</span></div>
                    <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="enquiry" className="scroll-mt-24 border-t border-border bg-[linear-gradient(180deg,transparent,rgba(245,138,36,.045))]">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="mx-auto max-w-2xl text-center"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Project enquiry</p><h2 className="mt-3 font-display text-[clamp(32px,4.2vw,52px)] font-semibold tracking-[-0.035em]">What would you like to solve?</h2><p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">Select a service area and tell us about the decision, data or capability you need.</p></Reveal>
            <div className="mt-10">
              <Suspense fallback={<div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">Loading enquiry form…</div>}>
                <ServicesEnquiry />
              </Suspense>
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="font-display text-lg font-semibold">Reach<span className="text-saffron">Out</span> Analytics</p><p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">{CONTACT.address}</p></div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-medium text-muted-foreground"><Link href="/services" className="hover:text-foreground">Services</Link><Link href="/case-studies" className="hover:text-foreground">Case Studies</Link><Link href="/about" className="hover:text-foreground">About Us</Link><Link href="/#contact" className="hover:text-foreground">Contact</Link></nav>
          </div>
          <div className="border-t border-border/70 py-4 text-center text-[11.5px] text-muted-foreground">© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</div>
        </footer>
      </main>
    </>
  );
}
