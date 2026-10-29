import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpenCheck, CheckCircle2, CircleCheck, FileText,
  FlaskConical, Globe2, GraduationCap, PenLine, ScrollText, Sparkles,
} from "lucide-react";
import Navbar, { Logo } from "@/components/site/navbar";
import Reveal from "@/components/site/reveal";
import ServicesEnquiry from "@/components/site/services-enquiry";
import { CONTACT } from "@/lib/cases";
import {
  QUALITY_STATEMENTS, RESEARCH_CATEGORIES, RESEARCH_SERVICES,
  type ResearchIcon,
} from "@/lib/research-content";

export const metadata: Metadata = {
  title: "Research & Content Services — ReachOut Analytics",
  description: "Research planning, statistical analysis, academic editing and professional content support from ReachOut Analytics.",
};

export const dynamic = "force-static";

const ICONS: Record<ResearchIcon, typeof FileText> = {
  proposal: Sparkles, thesis: GraduationCap, statistics: FlaskConical,
  article: ScrollText, report: FileText, web: Globe2,
};

const researchHref = (category: string) => `/services/research-content?service=${encodeURIComponent(category)}#enquiry`;

function ResearchCard({ service, index }: { service: (typeof RESEARCH_SERVICES)[number]; index: number }) {
  const Icon = ICONS[service.icon];
  return (
    <Reveal delay={index * 45} className="h-full">
      <article className="group flex h-full flex-col rounded-3xl border border-border bg-card p-5 transition duration-300 hover:-translate-y-1 hover:border-saffron/35 hover:shadow-[0_22px_50px_-32px_rgba(15,20,30,.4)]">
        <span className="grid size-10 place-items-center rounded-xl border border-border bg-elevated text-saffron-2"><Icon className="size-[18px]" /></span>
        <h3 className="mt-4 font-display text-[19px] font-semibold tracking-[-0.015em]">{service.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{service.description}</p>
        <ul className="mt-4 space-y-1.5">
          {service.deliverables.map((d) => <li key={d} className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground/75"><CircleCheck className="mt-0.5 size-3.5 shrink-0 text-[#2fbf4a]" />{d}</li>)}
        </ul>
        <Link href={researchHref(service.category)} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground/80 transition-colors hover:text-saffron-2">Discuss this service<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></Link>
      </article>
    </Reveal>
  );
}

export default function ResearchContentPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative isolate overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-36">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_82%_8%,rgba(47,191,74,.09),transparent_65%),radial-gradient(55%_50%_at_8%_70%,rgba(245,138,36,.1),transparent_70%)]" aria-hidden />
          <svg className="animate-drift pointer-events-none absolute -right-40 top-6 -z-10 h-[520px] w-[780px] text-foreground/10" viewBox="0 0 780 520" fill="none" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M-20 ${120 + i * 44} C 130 ${40 + i * 38}, 260 ${270 + i * 24}, 400 ${150 + i * 27} S 660 ${70 + i * 33}, 820 ${190 + i * 27}`} stroke="currentColor" strokeWidth="1" />)}
            <path d="M120 380 L230 280 L340 310 L470 170 L610 220 L740 120" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" />
          </svg>
          <div className="mx-auto max-w-6xl px-6 sm:px-10">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Link href="/" className="hover:text-foreground">Home</Link><span aria-hidden>/</span><Link href="/services" className="hover:text-foreground">Services</Link><span aria-hidden>/</span><span className="font-medium text-foreground/80">Research & Content</span></nav>
            <Reveal className="mt-12 max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Academic & professional support</p>
              <h1 className="mt-4 font-display text-[clamp(38px,5.6vw,72px)] font-semibold leading-[.98] tracking-[-0.045em]">Research & Content<br /><span className="text-gradient-saffron">Services</span></h1>
              <p className="mt-6 max-w-2xl text-[clamp(16px,1.8vw,19px)] leading-relaxed text-muted-foreground">Expert support for research planning, statistical analysis, academic editing and professional content—from an initial question to clearly communicated findings.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#enquiry" className="inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-3 text-[14px] font-semibold text-[#241203] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">Discuss your project<ArrowRight className="size-4" /></a>
                <a href="#research-services" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-5 py-3 text-[14px] font-semibold text-foreground transition hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60">Explore services<ArrowUpRight className="size-4" /></a>
              </div>
            </Reveal>
            <Reveal delay={100} className="mt-12 flex flex-wrap gap-2 border-t border-border pt-5">
              {[["Services", "#research-services"], ["Quality", "#quality"], ["Enquiry", "#enquiry"]].map(([label, href]) => <a key={href} href={href} className="rounded-full border border-border bg-card/65 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-saffron/40 hover:text-foreground">{label}</a>)}
            </Reveal>
          </div>
        </section>

        <section id="research-services" className="scroll-mt-24 border-t border-border bg-card/35">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Support for your work</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Research & content services</h2></div>
              <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">Practical support at each stage of a research or content project. Academic services support the researcher&apos;s own work using properly sourced or client-provided data.</p>
            </Reveal>
            <div className="mt-9 rounded-2xl border border-saffron/25 bg-saffron/5 p-4 text-[12.5px] leading-relaxed text-foreground/75 dark:bg-saffron/10">
              <b className="text-foreground">Academic integrity.</b> We support planning, analysis, editing and communication. We do not provide fabricated research, guaranteed publication or ghostwritten submissions. Datasets must be properly sourced or provided by the client.
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {RESEARCH_SERVICES.map((service, i) => <ResearchCard key={service.title} service={service} index={i} />)}
            </div>
          </div>
        </section>

        <section id="quality" className="scroll-mt-24 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Quality standards</p><h2 className="mt-3 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Care in every deliverable</h2></div>
              <p className="max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">We work to a clear quality standard and adapt the method to the research question, discipline and intended audience.</p>
            </Reveal>
            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUALITY_STATEMENTS.map((q, i) => <Reveal key={q} delay={i * 50}><div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-[13.5px] leading-relaxed text-foreground/80"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2fbf4a]" />{q}</div></Reveal>)}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/35">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
            <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Experience</p><h2 className="mt-2 font-display text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.025em]">Research, analytics and professional writing in one team.</h2></div>
              <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">Our research and content support draws on the same analytical team behind our political intelligence and business analytics work.</p>
            </Reveal>
          </div>
        </section>

        <section id="enquiry" className="scroll-mt-24 border-t border-border bg-[linear-gradient(180deg,transparent,rgba(245,138,36,.045))]">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 sm:py-20">
            <Reveal className="mx-auto max-w-2xl text-center"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-saffron-2">Project enquiry</p><h2 className="mt-3 font-display text-[clamp(32px,4.2vw,52px)] font-semibold tracking-[-0.035em]">What would you like to work on?</h2><p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">Tell us about your research question, content brief or the stage you are at. We will respond with a practical next step.</p></Reveal>
            <div className="mt-10">
              <Suspense fallback={<div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">Loading enquiry form…</div>}>
                <ServicesEnquiry categories={RESEARCH_CATEGORIES} groups={[{ label: "Research & Content Services", categories: RESEARCH_CATEGORIES }]} showOrganisation={false} />
              </Suspense>
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div><Logo /><p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted-foreground">{CONTACT.address}</p></div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-medium text-muted-foreground"><Link href="/services" className="hover:text-foreground">Services</Link><Link href="/services/research-content" className="hover:text-foreground">Research & Content</Link><Link href="/case-studies" className="hover:text-foreground">Case Studies</Link><Link href="/about" className="hover:text-foreground">About Us</Link><Link href="/#contact" className="hover:text-foreground">Contact</Link></nav>
          </div>
          <div className="border-t border-border/70 py-4 text-center text-[11.5px] text-muted-foreground">© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</div>
        </footer>
      </main>
    </>
  );
}
