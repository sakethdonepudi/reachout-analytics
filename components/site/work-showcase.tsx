"use client";

import Link from "next/link";
import { CASES, caseUrl } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import Reveal from "@/components/site/reveal";
import TickRule from "@/components/precision/tick-rule";
import SectionHeader from "@/components/precision/section-header";
import { PrecisionCardLink } from "@/components/precision/precision-card";

function yearFor(slug: string, title: string): number {
  const match = `${slug} ${title}`.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  if (slug === "telangana") return 2028;
  return 2026;
}

export default function WorkShowcase() {
  return (
    <section id="work" className="pointer-events-auto relative scroll-mt-24 bg-[var(--p-bg-alt)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <TickRule />
        <div className="mt-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <SectionHeader
            eyebrow="Our work"
            title="Campaigns across India"
            lead="Selected election programmes, shown for illustration only. No endorsement or ongoing client relationship is implied."
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--p-muted)]">{CASES.length} case studies</span>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CASES.map((item, index) => (
            <Reveal key={item.slug} delay={Math.min(index, 6) * 40} className="h-full">
              <PrecisionCardLink href={caseUrl(item.slug)} label={`Open ${item.party} · ${item.stateName} case study`} className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PartyMark party={item.party} size="md" />
                    <div className="min-w-0">
                      <p className="font-display text-[16px] font-semibold leading-tight text-[var(--p-ink)]">{item.party} · {item.stateName}</p>
                      <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--p-muted)]">{yearFor(item.slug, item.title)}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[var(--p-line)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--p-muted)]">{item.badge}</span>
                </div>
                <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-[var(--p-ink-2)]">{item.summary}</p>
                <span className="mt-5 flex items-center justify-between border-t border-[var(--p-line)] pt-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--p-ink)]">
                  View case study <span className="text-[var(--p-ink)]" aria-hidden>↗</span>
                </span>
              </PrecisionCardLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
