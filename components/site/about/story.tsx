"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList, Database, Globe2, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAPTERS = [
  {
    id: "chapter-collect",
    n: "01",
    kicker: "Collect",
    title: "Start with the question, then gather the evidence.",
    body:
      "Survey responses, field records and public sources are cleaned, checked and brought into one working structure.",
    tags: ["Surveys", "Field records", "Public sources"],
    output: "One working dataset",
  },
  {
    id: "chapter-analyse",
    n: "02",
    kicker: "Analyse",
    title: "Group, compare and test what the records are saying.",
    body:
      "The same evidence becomes a map, a trend or a model that shows where the pattern actually sits.",
    tags: ["Grouping", "Comparison", "Mapping"],
    output: "A pattern you can inspect",
  },
  {
    id: "chapter-explain",
    n: "03",
    kicker: "Explain",
    title: "Reduce it to the decision in front of you.",
    body:
      "A simple comparison, the caveats that matter and a clear takeaway your team can act on.",
    tags: ["Comparison", "Caveats", "Recommendation"],
    output: "A clear takeaway",
  },
] as const;

function StageLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[color:var(--about-blue-ink)] backdrop-blur">
      <span className="size-1.5 rounded-full bg-[var(--about-lime)]" aria-hidden />
      {children}
    </span>
  );
}

function CollectVisual() {
  const sources = [
    { label: "Field survey", Icon: ClipboardList },
    { label: "Source records", Icon: Database },
    { label: "Public data", Icon: Globe2 },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-3.5">
      <div className="grid grid-cols-3 gap-2">
        {sources.map(({ label, Icon }) => (
          <div key={label} className="rounded-xl border border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)] px-2.5 py-3 text-center">
            <Icon className="mx-auto size-4 text-[color:var(--about-blue-ink)]" aria-hidden />
            <p className="mt-2 text-[10px] font-semibold leading-tight text-foreground/80">{label}</p>
          </div>
        ))}
      </div>

      <svg viewBox="0 0 320 34" fill="none" className="mx-auto h-6 w-full max-w-[300px]" aria-hidden>
        <path d="M44 2C44 18 132 12 160 30" stroke="var(--about-blue-line)" strokeWidth="1.2" />
        <path d="M160 2V30" stroke="var(--about-blue-line)" strokeWidth="1.2" />
        <path d="M276 2C276 18 188 12 160 30" stroke="var(--about-blue-line)" strokeWidth="1.2" />
        <circle cx="160" cy="30" r="2.4" fill="var(--about-lime)" />
      </svg>

      <div className="space-y-1.5">
        {[
          { label: "Response", width: "w-[82%]" },
          { label: "Record", width: "w-[66%]" },
          { label: "Response", width: "w-[74%]" },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] px-2.5 py-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[var(--about-blue)]" aria-hidden />
            <span className="w-14 shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{row.label}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[color:var(--about-blue-soft)]" aria-hidden>
              <span className={cn("block h-full rounded-full bg-[color:var(--about-blue-line)]", row.width)} />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-2 border-t border-[color:var(--about-blue-line)] pt-3">
        <span className="size-2 rounded-full bg-[var(--about-lime)]" aria-hidden />
        <span className="text-[11px] font-semibold text-foreground/80">One working dataset</span>
        <span className="ml-auto text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">Illustrative</span>
      </div>
    </div>
  );
}

function AnalyseVisual() {
  const bars = [
    { a: 54, b: 42 },
    { a: 72, b: 58 },
    { a: 46, b: 66 },
    { a: 84, b: 62 },
    { a: 60, b: 78 },
    { a: 68, b: 50 },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--about-blue-ink)]">Grouped comparison</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Records compared across six groups</p>
        </div>
        <div className="flex items-center gap-3 text-[9.5px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[var(--about-blue)]" />Group A</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[color:var(--about-blue)]/35" />Group B</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] p-3">
        <svg viewBox="0 0 320 190" fill="none" className="h-auto w-full" aria-hidden>
          <g stroke="var(--about-grid)" strokeWidth="1">
            <path d="M28 34H304M28 74H304M28 114H304M28 154H304" />
          </g>
          <g fill="var(--about-blue)">
            {bars.map((bar, i) => {
              const x = 38 + i * 44;
              return (
                <g key={i}>
                  <rect x={x} y={154 - bar.a} width="12" height={bar.a} rx="3" opacity=".9" />
                  <rect x={x + 15} y={154 - bar.b} width="12" height={bar.b} rx="3" opacity=".28" />
                </g>
              );
            })}
          </g>
          <rect x={38 + 4 * 44 + 15} y={154 - bars[4].b} width="12" height={bars[4].b} rx="3" fill="var(--about-lime)" />
          <path d="M28 154H304" stroke="var(--about-blue-line)" strokeWidth="1.4" />
          <g fill="var(--about-blue-ink)" fontSize="8" fontWeight="700" letterSpacing="1">
            {bars.map((_, i) => (
              <text key={i} x={44 + i * 44} y={168} textAnchor="middle" opacity=".55">{`G${i + 1}`}</text>
            ))}
          </g>
        </svg>
      </div>

      <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-[var(--about-lime)]" aria-hidden />
        The same records, grouped and compared.
      </div>
    </div>
  );
}

function ExplainVisual() {
  const rows = [
    { label: "Group A", value: 58, tone: "blue" as const },
    { label: "Group B", value: 82, tone: "lime" as const },
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="rounded-2xl border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--about-blue-ink)]">Side-by-side</p>
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[58px_1fr_30px] items-center gap-2.5">
              <span className="text-[10.5px] font-semibold text-foreground/75">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-[color:var(--about-blue-soft)]">
                <span
                  className={cn("block h-full rounded-full", row.tone === "lime" ? "bg-[var(--about-lime)]" : "bg-[var(--about-blue)]")}
                  style={{ width: `${row.value}%` }}
                />
              </span>
              <span className="text-right text-[10px] font-semibold tabular-nums text-muted-foreground">{row.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-[color:var(--about-blue-line)] pt-2 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Illustrative comparison</p>
      </div>

      <div
        className="rounded-2xl border border-[color:var(--about-blue-line)] p-4"
        style={{ backgroundColor: "color-mix(in srgb, var(--about-lime) 16%, transparent)" }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--about-blue-ink)]">The takeaway</p>
        <p className="mt-1.5 font-display text-[17px] font-semibold leading-snug tracking-[-0.02em] text-foreground">
          Group B leads on the measure that matters.
        </p>
        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          A short, defensible conclusion — with the caveats kept visible.
        </p>
      </div>
    </div>
  );
}

const VISUAL_LABELS = [
  "Illustration: survey responses, field records and public sources coming together into one working dataset. Illustrative data only.",
  "Illustration: records grouped and compared across six groups in a simple bar chart. Illustrative data only.",
  "Illustration: a side-by-side comparison and a clear takeaway. Illustrative data only.",
];

export function StoryVisual({ variant, compact = false }: { variant: number; compact?: boolean }) {
  const chapter = CHAPTERS[variant] ?? CHAPTERS[0];

  return (
    <div
      role="img"
      aria-label={VISUAL_LABELS[variant] ?? VISUAL_LABELS[0]}
      className={cn("about-story-visual relative overflow-hidden rounded-[26px] border border-[color:var(--about-blue-line)] bg-[color:var(--about-panel)] shadow-[0_24px_60px_-44px_rgba(8,6,62,.4)]", compact ? "aspect-[4/5]" : "aspect-square")}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--about-grid) 1px, transparent 1px), linear-gradient(90deg, var(--about-grid) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pt-3.5 sm:px-5">
        <StageLabel>Illustrative view</StageLabel>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{chapter.kicker}</span>
      </div>
      <div key={variant} className="about-stage absolute inset-0 px-4 pb-5 pt-[4.5rem] sm:px-5 sm:pt-20">
        {variant === 0 && <CollectVisual />}
        {variant === 1 && <AnalyseVisual />}
        {variant === 2 && <ExplainVisual />}
      </div>
    </div>
  );
}

export default function AboutStory() {
  const [active, setActive] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const nodes = chapterRefs.current.filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.chapter);
          if (Number.isFinite(index)) setActive(index);
        }
      },
      { rootMargin: "-44% 0px -44% 0px", threshold: 0 },
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, []);

  return (
    <section id="story" className="relative scroll-mt-24 border-t border-border bg-card/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div>
            <p className="about-eyebrow">How the work unfolds</p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(34px,5vw,64px)] font-semibold leading-[.98] tracking-[-0.04em]">
              From a question <br className="hidden sm:block" />
              to a decision.
            </h2>
          </div>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted-foreground lg:pb-2">
            Every engagement follows the same thread: gather the evidence, find the pattern, make it clear. The illustrations below are illustrative, not live client data.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,.96fr)_minmax(0,1.04fr)] lg:gap-16">
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <StoryVisual variant={active} />
              <nav aria-label="Story chapters" className="mt-5 grid gap-2">
                {CHAPTERS.map((chapter, index) => (
                  <a
                    key={chapter.id}
                    href={`#${chapter.id}`}
                    aria-current={active === index ? "step" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--about-blue)]/40",
                      active === index
                        ? "border-[color:var(--about-blue-line)] bg-[color:var(--about-blue-soft)]"
                        : "border-transparent hover:bg-elevated",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full text-[10px] font-bold transition-colors",
                        active === index
                          ? "bg-[var(--about-lime)] text-[var(--about-lime-ink)]"
                          : "bg-elevated text-muted-foreground",
                      )}
                    >
                      {chapter.n}
                    </span>
                    <span className={cn("text-[12.5px] font-semibold", active === index ? "text-foreground" : "text-muted-foreground")}>
                      {chapter.kicker}
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">Jump</span>
                  </a>
                ))}
              </nav>
            </div>
          </div>

          <div>
            {CHAPTERS.map((chapter, index) => (
              <article
                key={chapter.id}
                id={chapter.id}
                data-chapter={index}
                ref={(node) => {
                  chapterRefs.current[index] = node;
                }}
                className="scroll-mt-28 border-t border-border py-10 first:border-t-0 first:pt-0 lg:flex lg:min-h-[64vh] lg:flex-col lg:justify-center lg:py-12"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full border text-[11px] font-bold transition-colors",
                      active === index
                        ? "border-transparent bg-[var(--about-lime)] text-[var(--about-lime-ink)]"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {chapter.n}
                  </span>
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{chapter.kicker}</span>
                </div>
                <h3 className="mt-5 max-w-lg font-display text-[clamp(24px,2.8vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em]">
                  {chapter.title}
                </h3>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{chapter.body}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {chapter.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-foreground/70">
                  <LineChart className="size-3.5 text-[color:var(--about-blue-ink)]" aria-hidden />
                  Output: {chapter.output}
                </p>
                <div className="mt-8 lg:hidden">
                  <StoryVisual variant={index} compact />
                </div>
              </article>
            ))}
            {/* Keeps the sticky visual in place while the final chapter is read. */}
            <div className="hidden lg:block lg:h-[18vh]" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
