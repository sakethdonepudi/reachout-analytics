"use client";

import { caseLeadParties, caseTitle, isLiveCase, orderedCases, type CaseStudy, caseUrl } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import Reveal from "@/components/site/reveal";
import TickRule from "@/components/precision/tick-rule";
import SectionHeader from "@/components/precision/section-header";
import { PrecisionCardLink } from "@/components/precision/precision-card";
import { cn } from "@/lib/utils";

function CaseCard({ item, featured }: { item: CaseStudy; featured: boolean }) {
  const live = isLiveCase(item.slug);
  const badge = (
    <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.08em]", live ? "border-[var(--p-line)] text-[var(--p-ink-2)]" : "border-dashed border-[var(--p-geo)] text-[var(--p-muted)]")}>{live ? "Live" : "Coming soon"}</span>
  );
  return (
    <PrecisionCardLink
      href={caseUrl(item.slug)}
      label={live ? `Open ${caseTitle(item)} case study` : `Open ${caseTitle(item)} coming soon page`}
      className={cn("h-full", featured ? "p-6" : "border-dashed p-4")}
    >
      {featured ? (
        <>
          <div className="flex items-start gap-3">
            <span className="flex shrink-0 -space-x-2">{caseLeadParties(item).map((party) => <PartyMark key={party} party={party} size={caseLeadParties(item).length > 1 ? "md" : "lg"} />)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[20px] font-semibold leading-tight tracking-[-0.025em] text-[var(--p-ink)]">{caseTitle(item)}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--p-muted)]">{item.year}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {item.projectedLead ? <p className="text-[11px] font-medium text-[var(--p-muted)]">{item.projectedLead.label}</p> : <span />}
            {badge}
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-start gap-2.5">
            <span className="flex -space-x-2">{caseLeadParties(item).map((party) => <PartyMark key={party} party={party} size="sm" />)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[14.5px] font-semibold leading-tight text-[var(--p-ink)]">{caseTitle(item)}</p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-[var(--p-muted)]">{item.year}</p>
            </div>
          </div>
          {item.projectedLead && <p className="mt-1 text-[10px] font-medium text-[var(--p-muted)]">{item.projectedLead.label}</p>}
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
            lead="Tamil Nadu, Andhra Pradesh, Karnataka and Telangana are live. The remaining programmes are being prepared."
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--p-muted)]">{live.length} live · {coming.length} coming soon</span>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {live.map((item, index) => (
            <Reveal key={item.slug} delay={index * 40} className="h-full">
              <CaseCard item={item} featured />
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
