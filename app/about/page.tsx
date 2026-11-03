import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Navbar, { Logo } from "@/components/site/navbar";
import CompanyExperience from "@/components/site/company-marquee";
import AboutHeroVisual from "@/components/site/about/hero-visual";
import AboutStory from "@/components/site/about/story";
import AboutPractices from "@/components/site/about/practices";
import AboutWork from "@/components/site/about/work";
import { CONTACT } from "@/lib/cases";
import { getAbout } from "@/lib/about-content";

// Content is stored in MongoDB and can be updated from the admin portal.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About Us — ReachOut Analytics",
  description:
    "How ReachOut Analytics uses surveys, statistics and interactive maps to turn questions about elections, business performance and research into clearer decisions.",
};

function Headline({ text }: { text: string }) {
  const match = text.match(/numbers/i);
  if (!match || match.index === undefined) return <>{text}</>;
  return (
    <>
      {text.slice(0, match.index)}
      <span className="about-mark">{text.slice(match.index, match.index + match[0].length)}</span>
      {text.slice(match.index + match[0].length)}
    </>
  );
}

export default async function AboutPage() {
  const c = await getAbout();

  return (
    <>
      <Navbar />
      <main className="about-page min-h-screen bg-background text-foreground">
        {/* opening statement */}
        <section className="relative overflow-hidden pb-16 pt-32 sm:pb-20 sm:pt-36">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-32 -top-24 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(23,20,245,.13),transparent_66%)] blur-2xl" />
            <div className="absolute -right-24 top-24 size-[440px] rounded-full bg-[radial-gradient(circle,rgba(201,250,0,.17),transparent_68%)] blur-2xl" />
            <div
              className="absolute inset-x-0 top-0 h-px opacity-70"
              style={{ background: "linear-gradient(90deg, transparent, var(--about-blue), var(--about-lime), transparent)" }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl px-6 sm:px-10">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Link href="/" className="transition-colors hover:text-foreground">Home</Link>
              <span aria-hidden>/</span>
              <span className="font-medium text-foreground/80">About Us</span>
            </nav>

            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,.96fr)] lg:items-center lg:gap-8">
              <div>
                <p className="about-eyebrow">{c.eyebrow}</p>
                <h1 className="mt-5 max-w-[12.5ch] font-display text-[clamp(46px,7.4vw,94px)] font-semibold leading-[.9] tracking-[-0.055em]">
                  <Headline text={c.headline} />
                </h1>
                <p className="mt-6 max-w-xl text-[clamp(16px,1.8vw,19px)] leading-relaxed text-muted-foreground">
                  {c.intro}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/#contact"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--about-blue-solid)] px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_18px_40px_-24px_rgba(23,20,245,.8)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Discuss your project <ArrowRight className="size-4" />
                  </Link>
                  <a
                    href="#work"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-card/70 px-6 py-3.5 text-[14px] font-semibold text-foreground transition hover:border-[color:var(--about-blue-line)] hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/40"
                  >
                    See the work <ArrowUpRight className="size-4" />
                  </a>
                </div>
                <p className="mt-7 text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Surveys <span className="mx-1.5 text-[color:var(--about-lime)]">·</span> Statistics <span className="mx-1.5 text-[color:var(--about-lime)]">·</span> Interactive maps
                </p>
              </div>

              <AboutHeroVisual />
            </div>
          </div>
        </section>

        <AboutStory />
        <AboutPractices />
        <AboutWork />

        <CompanyExperience className="border-t" />

        {/* closing invitation */}
        <section id="contact-cta" className="relative scroll-mt-24 overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 sm:px-10 sm:pb-24 sm:pt-20">
            <div className="relative overflow-hidden rounded-[34px] bg-[var(--about-deep)] px-6 py-12 text-white shadow-[0_34px_90px_-54px_rgba(8,6,62,.8)] sm:px-12 sm:py-16 lg:px-16">
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(140,155,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(140,155,255,.16) 1px, transparent 1px)",
                    backgroundSize: "42px 42px",
                  }}
                />
                <div className="absolute -right-20 -top-24 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(201,250,0,.22),transparent_66%)] blur-2xl" />
                <svg viewBox="0 0 900 360" fill="none" className="absolute inset-x-0 bottom-0 h-auto w-full opacity-70">
                  <g stroke="var(--about-lime)" strokeWidth="1" opacity=".22">
                    <path d="M-20 300C120 220 210 340 330 260S530 160 920 240" />
                    <path d="M-20 330C128 250 220 370 340 290S548 190 920 270" />
                  </g>
                  <g stroke="#8c9bff" strokeWidth="1" opacity=".3">
                    <path d="M-20 250C110 180 190 290 300 218S500 124 920 194" />
                    <path d="M-20 276C116 206 202 316 312 244S518 150 920 220" />
                  </g>
                </svg>
              </div>

              <div className="relative max-w-3xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--about-lime)]">Start a conversation</p>
                <h2 className="mt-4 font-display text-[clamp(34px,5.4vw,68px)] font-semibold leading-[.95] tracking-[-0.045em]">
                  {c.cta.title}
                </h2>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
                  {c.cta.body}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/#contact"
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--about-lime)] px-6 py-3.5 text-[14px] font-semibold text-[var(--about-lime-ink)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-lime)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--about-deep)]"
                  >
                    {c.cta.button} <ArrowRight className="size-4" />
                  </Link>
                  <a
                    href={`mailto:${CONTACT.email}`}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-[14px] font-semibold text-white/85 transition hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    Email us <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-9 sm:px-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <Logo className="h-[30px] w-[132px] sm:h-[34px] sm:w-[150px]" />
              <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] font-medium text-muted-foreground">
                <Link href="/services" className="transition-colors hover:text-foreground">Services</Link>
                <Link href="/services/research-content" className="transition-colors hover:text-foreground">Research &amp; Content</Link>
                <Link href="/case-studies" className="transition-colors hover:text-foreground">Case Studies</Link>
                <Link href="/about" className="transition-colors hover:text-foreground">About Us</Link>
                <Link href="/#contact" className="transition-colors hover:text-foreground">Contact</Link>
              </nav>
            </div>
            <p className="mt-6 text-[11.5px] text-muted-foreground">© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
