import Link from "next/link";
import { ArrowUpRight, BarChart3, BookOpenCheck, Globe2, Search } from "lucide-react";

function PoliticalVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_10%,rgba(123,140,255,.24),transparent_62%)]" />
      <svg viewBox="0 0 620 460" fill="none" className="absolute -right-16 top-2 h-[112%] w-[86%] opacity-90 transition-transform duration-700 group-hover:translate-x-2">
        <g stroke="#7fd7bd" strokeWidth="1" opacity=".22">
          <path d="M-20 110C84 44 154 164 250 96S428 12 660 84" />
          <path d="M-20 140C92 74 164 194 260 126S444 42 660 114" />
          <path d="M-20 170C100 104 174 224 270 156S460 72 660 144" />
        </g>
        <g stroke="var(--about-lime)" strokeWidth="1" opacity=".3">
          <path d="M-20 340C86 250 154 388 258 300S430 190 660 286" />
          <path d="M-20 372C94 282 166 420 270 332S448 222 660 318" />
          <path d="M-20 404C102 314 178 452 282 364S466 254 660 350" />
        </g>
        <g stroke="#7fd7bd" strokeWidth="1" opacity=".42">
          <path d="M-20 246C72 176 132 286 222 218S382 124 660 202" />
          <path d="M-20 276C78 206 142 316 232 248S396 154 660 232" />
          <path d="M-20 306C84 236 152 346 242 278S410 184 660 262" />
        </g>
        <g fill="var(--about-lime)">
          <circle cx="258" cy="300" r="4.5" />
          <circle cx="282" cy="364" r="3" opacity=".7" />
          <circle cx="430" cy="240" r="3.4" opacity=".6" />
        </g>
        <circle cx="258" cy="300" r="22" stroke="var(--about-lime)" strokeWidth="1" opacity=".35" />
        <circle cx="258" cy="300" r="42" stroke="var(--about-lime)" strokeWidth="1" opacity=".14" />
        <path d="M160 190L258 300L356 236" stroke="#1d9e75" strokeWidth="1.4" strokeDasharray="4 6" opacity=".55" />
        <g fill="#1d9e75" opacity=".7">
          <circle cx="160" cy="190" r="2.4" />
          <circle cx="356" cy="236" r="2.4" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(4,8,28,.65))]" />
    </div>
  );
}

function DataVisual() {
  const bars = [38, 62, 50, 84, 70, 58, 92];
  return (
    <div className="relative rounded-2xl border border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)] p-3" aria-hidden>
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--about-blue-ink)]">Signal over time</span>
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[var(--about-blue)]" />Prepared
        </span>
      </div>
      <svg viewBox="0 0 360 190" fill="none" className="h-auto w-full" aria-hidden>
        <g stroke="var(--about-grid)" strokeWidth="1">
          <path d="M30 32H342M30 72H342M30 112H342M30 152H342" />
        </g>
        <g fill="var(--about-blue)">
          {bars.map((height, i) => (
            <rect
              key={i}
              x={40 + i * 42}
              y={152 - height}
              width="18"
              height={height}
              rx="4"
              opacity={i === 6 ? 0 : i === 3 ? 0.95 : 0.18}
            />
          ))}
        </g>
        <rect x={40 + 6 * 42} y={152 - bars[6]} width="18" height={bars[6]} rx="4" fill="var(--about-lime)" />
        <path d="M49 122C91 114 133 96 175 106S259 80 301 92S330 70 342 60" stroke="var(--about-blue)" strokeWidth="2" strokeLinecap="round" opacity=".85" />
        <g fill="var(--about-panel)" stroke="var(--about-blue)" strokeWidth="2">
          <circle cx="49" cy="122" r="3.2" />
          <circle cx="175" cy="106" r="3.2" />
          <circle cx="301" cy="92" r="3.2" />
        </g>
        <path d="M30 152H342" stroke="var(--about-blue-line)" strokeWidth="1.4" />
        <g fill="var(--about-blue-ink)" fontSize="8" fontWeight="700" letterSpacing="1">
          {["J", "F", "M", "A", "M", "J", "J"].map((m, i) => (
            <text key={i} x={49 + i * 42} y={168} textAnchor="middle" opacity=".55">{m}</text>
          ))}
        </g>
      </svg>
    </div>
  );
}

function ResearchVisual() {
  return (
    <div className="relative h-[240px] w-full sm:h-[260px]" aria-hidden>
      <div className="absolute left-[2%] top-4 w-[58%] -rotate-[4deg] rounded-xl border border-border bg-elevated p-4 shadow-[0_18px_40px_-28px_rgba(8,6,62,.45)] transition-transform duration-500 group-hover:-rotate-[6deg] group-hover:-translate-y-1">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Discussion</p>
        <div className="mt-3 space-y-1.5">
          <span className="block h-1.5 w-[88%] rounded-full bg-foreground/15" />
          <span className="block h-1.5 w-[74%] rounded-full bg-foreground/12" />
          <span className="block h-1.5 w-[92%] rounded-full bg-foreground/10" />
          <span className="block h-1.5 w-[62%] rounded-full bg-foreground/10" />
        </div>
        <div className="mt-4 rounded-md bg-[#1d9e7555] px-2 py-1.5">
          <span className="block h-1.5 w-[76%] rounded-full bg-[#5e7200]/50" />
        </div>
        <p className="mt-3 text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Annotated</p>
      </div>

      <div className="absolute right-[1%] top-12 w-[55%] rotate-[3deg] rounded-xl border border-border bg-card p-4 shadow-[0_22px_50px_-30px_rgba(8,6,62,.5)] transition-transform duration-500 group-hover:rotate-[5deg] group-hover:-translate-y-1">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--about-blue-ink)]">Findings</p>
        <div className="mt-3 space-y-1.5">
          <span className="block h-1.5 w-[80%] rounded-full bg-foreground/18" />
          <span className="block h-1.5 w-[92%] rounded-full bg-foreground/12" />
          <span className="block h-1.5 w-[68%] rounded-full bg-foreground/12" />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)] px-2 py-1.5">
          <Search className="size-3 text-[color:var(--about-blue-ink)]" />
          <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[color:var(--about-blue-ink)]">Check the claim</span>
        </div>
      </div>

      <svg viewBox="0 0 340 240" fill="none" className="absolute inset-0 h-full w-full">
        <path d="M112 78C142 60 182 68 206 92" stroke="var(--about-blue)" strokeWidth="1.2" strokeDasharray="3 5" opacity=".5" />
        <circle cx="112" cy="78" r="3" fill="var(--about-lime)" />
        <circle cx="206" cy="92" r="3" fill="var(--about-blue)" />
      </svg>

      <span className="absolute bottom-0 left-[4%] rounded-full border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--about-blue-ink)]">
        Evidence → argument
      </span>
    </div>
  );
}

export default function AboutPractices() {
  return (
    <section id="practices" className="relative scroll-mt-24 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div>
            <p className="about-eyebrow">Three practices</p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(34px,5vw,64px)] font-semibold leading-[.98] tracking-[-0.04em]">
              Different questions.
              <br />
              One way of working.
            </h2>
          </div>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground lg:pb-2">
            Political intelligence, business analytics and research support each get their own visual language — because the questions are not the same.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <article className="group relative flex min-h-[420px] flex-col overflow-hidden rounded-[30px] bg-[var(--about-deep)] p-6 text-white shadow-[0_30px_70px_-46px_rgba(8,6,62,.7)] sm:p-8 lg:col-span-7 lg:min-h-[470px]">
            <PoliticalVisual />
            <div className="relative flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.05] px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/70">
                <span className="size-1.5 rounded-full bg-[var(--about-lime)]" aria-hidden />
                Practice 01
              </span>
              <Globe2 className="size-5 text-white/45" aria-hidden />
            </div>
            <span className="pointer-events-none absolute right-5 top-14 font-display text-[118px] font-semibold leading-none tracking-[-0.06em] text-white/[.055] sm:text-[150px]">01</span>
            <div className="relative mt-auto max-w-lg pt-24">
              <h3 className="font-display text-[clamp(30px,4vw,48px)] font-semibold leading-[.98] tracking-[-0.03em]">Political Intelligence</h3>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/65">
                Research, geographic analysis and reporting for campaigns and political organisations — built on the evidence available to the project.
              </p>
              <Link
                href="/services#political-intelligence"
                className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:border-[#1d9e75]/60 hover:text-[color:var(--about-lime)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d9e75]/50"
              >
                Explore political intelligence <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </article>

          <article className="group flex flex-col rounded-[30px] border border-border bg-card p-5 shadow-[0_24px_60px_-46px_rgba(8,6,62,.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-6 lg:col-span-5 lg:mt-10">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)] px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--about-blue-ink)]">
                <span className="size-1.5 rounded-full bg-[var(--about-blue)]" aria-hidden />
                Practice 02
              </span>
              <BarChart3 className="size-5 text-[color:var(--about-blue-ink)]" aria-hidden />
            </div>
            <div className="mt-5">
              <DataVisual />
            </div>
            <div className="mt-6">
              <h3 className="font-display text-[clamp(26px,3vw,36px)] font-semibold leading-[1.02] tracking-[-0.03em]">Data &amp; Business Analytics</h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                From a reliable dataset to a dashboard, model or forecast, scoped around the decision you need to make.
              </p>
              <Link
                href="/services#data-analytics"
                className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:text-[color:var(--about-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/40"
              >
                Explore data analytics <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </article>

          <article className="group grid gap-7 rounded-[30px] border border-border bg-card p-6 shadow-[0_24px_60px_-46px_rgba(8,6,62,.3)] sm:p-8 lg:col-span-12 lg:grid-cols-[1.02fr_.98fr] lg:items-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)] px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--about-blue-ink)]">
                  <span className="size-1.5 rounded-full bg-[var(--about-blue)]" aria-hidden />
                  Practice 03
                </span>
                <BookOpenCheck className="size-5 text-[color:var(--about-blue-ink)]" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-[clamp(26px,3.4vw,40px)] font-semibold leading-[1.02] tracking-[-0.03em]">Research &amp; Content</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Proposal guidance, thesis and dissertation support, statistical analysis, research editing and clear business writing.
              </p>
              <Link
                href="/services/research-content"
                className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:text-[color:var(--about-blue-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/40"
              >
                Explore research &amp; content <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <ResearchVisual />
          </article>
        </div>
      </div>
    </section>
  );
}
