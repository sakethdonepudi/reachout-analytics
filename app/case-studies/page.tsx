import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/site/navbar";
import { CASES, caseUrl } from "@/lib/cases";
import { PartyMark } from "@/components/site/party-mark";
import { requirePageSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Case Studies — ReachOut Analytics",
  description: "Protected state selector for ReachOut election case studies.",
};

export const dynamic = "force-dynamic";

export default async function CaseStudiesIndex() {
  await requirePageSession("/case-studies");

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Protected workspace</p>
          <h1 className="mt-3 font-display text-[clamp(34px,5vw,64px)] font-semibold tracking-[-0.03em]">Case Studies</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Select a state to open its protected election intelligence dashboard.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CASES.map((c) => {
              return (
                <Link key={c.slug} href={caseUrl(c.slug)} className="glass group flex flex-col rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-saffron/40 bg-saffron/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-saffron-2">{c.badge}</span>
                    <span className="flex items-center gap-2"><PartyMark party={c.party} size="sm" /><span className="text-[11px] font-bold text-muted-foreground">{c.party}</span></span>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold">{c.title}</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">{c.stateName}</p>
                  <p className="mt-3 line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">{c.summary}</p>
                  <span className="mt-5 inline-flex items-center gap-2 self-start rounded-full bg-foreground px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-background transition-transform group-hover:translate-x-0.5">
                    View Case Study <ArrowUpRight className="size-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>

        </div>
      </main>
    </>
  );
}
