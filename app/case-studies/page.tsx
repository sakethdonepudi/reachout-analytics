import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/site/navbar";
import AdminLink from "@/components/site/admin-link";
import { CASES, UPCOMING, caseUrl, leaderById } from "@/lib/cases";

export const metadata: Metadata = {
  title: "Case Studies — ReachOut Analytics",
  description: "Election programmes and campaign analytics across India.",
};

export default function CaseStudiesIndex() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Case studies</p>
          <h1 className="mt-3 font-display text-[clamp(34px,5vw,64px)] font-semibold tracking-[-0.03em]">Campaigns across India</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Selected election programmes with their state and party associations. Shown for illustration only — no endorsement or ongoing client relationship is implied.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map((c) => {
              const leader = leaderById(c.leaderId);
              return (
                <Link key={c.slug} href={caseUrl(c.slug)} className="glass group flex flex-col rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-2">{c.badge}</span>
                    {c.party && <span className="text-[11px] font-bold text-muted-foreground">{c.party}</span>}
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold">{c.title}</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">{leader ? `${leader.name} · ${c.region}` : c.region}</p>
                  <p className="mt-3 line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground">{c.summary}</p>
                  <span className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">
                    View case study
                    <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-saffron to-[#e07617] text-[#241203] transition-transform group-hover:translate-x-0.5"><ArrowUpRight className="size-4" /></span>
                  </span>
                </Link>
              );
            })}
          </div>

          <h2 className="mt-16 font-display text-2xl font-semibold">Upcoming</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {UPCOMING.map((u) => (
              <Link key={u.slug} href={caseUrl(u.slug)} className="rounded-xl border border-dashed border-saffron/50 px-4 py-2 text-sm font-semibold text-foreground hover:bg-saffron/10">
                {u.title}
              </Link>
            ))}
          </div>

          <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-[13px] text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} ReachOut Analytics Pvt. Ltd.</span>
            <AdminLink />
          </footer>
        </div>
      </main>
    </>
  );
}
