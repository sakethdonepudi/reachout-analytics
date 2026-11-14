import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import SiteFooter from "@/components/site/site-footer";
import { CASES, caseUrl } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import { requirePageSession } from "@/lib/require-session";
import { visibleCases } from "@/lib/session-scope";
import { listCases } from "@/lib/case-registry";
import SectionHeader from "@/components/precision/section-header";
import TickRule from "@/components/precision/tick-rule";
import { PrecisionCardLink } from "@/components/precision/precision-card";

export const metadata: Metadata = {
  title: "Case Studies — ReachOut Analytics",
  description: "Protected state selector for ReachOut election case studies.",
};

export const dynamic = "force-dynamic";

function yearFor(slug: string, title: string): number {
  const match = `${slug} ${title}`.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  if (slug === "telangana") return 2028;
  return 2026;
}

export default async function CaseStudiesIndex() {
  const session = await requirePageSession("/case-studies");
  const visible = await visibleCases(session);
  const registry = await listCases().catch(() => []);
  const bySlug = new Map(registry.map((row) => [row.slug, row]));
  const ordered = CASES.filter((item) => visible.some((entry) => entry.slug === item.slug));

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white pt-28 text-[var(--p-ink)] sm:pt-32">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <TickRule />
          <SectionHeader
            eyebrow="Protected workspace"
            title="Case Studies"
            lead="Select a state to open its protected election intelligence dashboard."
            headingLevel={1}
            className="mt-10"
          />

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((item) => {
              const row = bySlug.get(item.slug);
              const published = (row?.status ?? "published") === "published";
              return (
                <PrecisionCardLink key={item.slug} href={caseUrl(item.slug)} className="h-full p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <PartyMark party={item.party} size="md" />
                      <div className="min-w-0">
                        <h2 className="font-display text-[17px] font-semibold leading-tight tracking-[-0.02em]">{item.party} · {item.stateName}</h2>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--p-muted)]">{yearFor(item.slug, item.title)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${published ? "border-[var(--p-line)] text-[var(--p-ink-2)]" : "border-dashed border-[var(--p-geo)] text-[var(--p-muted)]"}`}>
                      {published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-[var(--p-ink-2)]">{item.summary}</p>
                  <span className="mt-5 flex items-center justify-between border-t border-[var(--p-line)] pt-3 text-[10.5px] font-bold uppercase tracking-[0.14em]">
                    Open <span aria-hidden>↗</span>
                  </span>
                </PrecisionCardLink>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
