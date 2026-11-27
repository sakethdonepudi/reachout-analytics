"use client";

import { isLiveCase, orderedCases, type CaseStudy, caseUrl } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import Reveal from "@/components/site/reveal";
import TickRule from "@/components/precision/tick-rule";
import SectionHeader from "@/components/precision/section-header";
import { PrecisionCardLink } from "@/components/precision/precision-card";
import { cn } from "@/lib/utils";

function yearFor(slug: string, title: string): number {
  const match = `${slug} ${title}`.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  if (slug === "telangana") return 2028;
  return 2026;
}

function CaseCard({ item, featured }: { item: CaseStudy; featured: boolean }) {
  const live = isLiveCase(item.slug);
  const badge = (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em]", live ? "border-[var(--p-line)] text-[var(--p-ink-2)]" : "border-dashed border-[var(--p-geo)] text-[var(--p-muted)]")}>{live ? "Live" : "Coming soon"}</span>
  );
  return (
    <PrecisionCardLink
      href={caseUrl(item.slug)}
      label={live ? `Open ${item.party} · ${item.stateName} case study` : `Open ${item.party} · ${item.stateName} coming soon page`}
      className={cn("h-full", featured ? "p-6" : "border-dashed p-4")}
    >
      {featured ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PartyMark party={item.party} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-[21px] font-semibold leading-tight tracking-[-0.025em] text-[var(--p-ink)]">{item.party} · {item.stateName}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--p-muted)]">{yearFor(item.slug, item.title)}</p>
            </div>
          </div>
          {badge}
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-2.5">
            <PartyMark party={item.party} size="sm" />
            <div className="min-w-0">
              <p className="font-display text-[14.5px] font-semibold leading-tight text-[var(--p-ink)]">{item.party} · {item.stateName}</p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-[var(--p-muted)]">{yearFor(item.slug, item.title)}</p>
            </div>
          </div>
          <div className="mt-2.5">{badge}</div>
        </div>
      )}
      <p className={cn("mt-4 leading-relaxed text-[var(--p-ink-2)]", featured ? "text-[14px]" : "line-clamp-2 text-[12px]")}>{item.summary}</p>
      <span className={cn("mt-5 flex items-center justify-between border-t border-[var(--p-line)] pt-3 font-bold uppercase tracking-[0.14em] text-[var(--p-ink)]", featured ? "text-[11px]" : "text-[10px]")}>
        {live ? "View case study" : "Coming soon"} <span aria-hidden>↗</span>
      </span>
    </PrecisionCardLink>
  );
}

export default function WorkShowcase() {
  const ordered = orderedCases();
  const live = ordered.filter((item) => isLiveCase(item.slug));
  const coming = ordered.filter((item) => !isLiveCase(item.slug));
  return (
    <section id="work" className="pointer-events-auto relative scroll-mt-24 bg-[var(--p-bg-alt)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <TickRule />
        <div className="mt-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow="Our work"
            title="Campaigns across India"
            lead="Tamil Nadu and Andhra Pradesh are live. The remaining programmes are being prepared."
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--p-muted)]">{live.length} live · {coming.length} coming soon</span>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {live.map((item, index) => (
            <Reveal key={item.slug} delay={index * 40} className="h-full">
              <CaseCard item={item} featured />
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {coming.map((item, index) => (
            <Reveal key={item.slug} delay={(live.length + index) * 35} className="h-full">
              <CaseCard item={item} featured={false} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
