import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import Navbar from "@/components/site/navbar";
import LeaderPortrait from "@/components/site/leader-portrait";
import CaseCta from "@/components/site/case-cta";
import { CASES, CAPABILITIES, UPCOMING, caseBySlug, caseUrl, leaderById } from "@/lib/cases";

export function generateStaticParams() {
  return [...CASES.map((c) => ({ slug: c.slug })), ...UPCOMING.map((u) => ({ slug: u.slug }))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  const u = UPCOMING.find((x) => x.slug === slug);
  return { title: `${c?.title ?? u?.title ?? "Case study"} — ReachOut Analytics` };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  const upcoming = UPCOMING.find((u) => u.slug === slug);
  if (!c && !upcoming) notFound();

  const leader = leaderById(c?.leaderId);
  const idx = c ? CASES.indexOf(c) : -1;
  const next = CASES[(idx + 1) % CASES.length];

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden bg-[#050b1f]">
        {/* ambient backdrop */}
        <div className="absolute inset-0 scale-110 bg-[url(/images/parliament.webp)] bg-cover bg-center opacity-25 blur-3xl" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_70%_20%,rgba(255,153,51,.18),transparent_60%),radial-gradient(60%_60%_at_10%_90%,rgba(47,191,74,.12),transparent_60%),linear-gradient(180deg,rgba(5,11,31,.4),#050b1f_70%)]" aria-hidden />
        <div className="grain absolute inset-0 opacity-[0.06] mix-blend-overlay" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36 sm:px-10">
          <Link href="/#tour" className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/80 hover:text-white">
            <ArrowLeft className="size-4" /> Back to the map
          </Link>

          <div className="mt-12 grid items-center gap-14 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="rounded-full border border-saffron/40 bg-saffron/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-saffron-2">
                {c ? `Case study · ${c.badge}` : "Upcoming"}
              </span>
              <h1 className="mt-6 font-display text-[clamp(44px,6vw,84px)] font-semibold leading-[0.98] tracking-[-0.035em]">
                {c?.title ?? upcoming!.title}
              </h1>
              {c && (
                <p className="mt-4 flex items-center gap-2 text-white/60">
                  <MapPin className="size-4 text-saffron-2" /> {c.region}
                  {c.party && <> · <b className="text-white/85">{c.party}</b></>}
                </p>
              )}
              <p className="mt-8 max-w-xl text-xl leading-relaxed text-white/80">
                {c?.summary ?? "We're preparing for this election cycle. Get in touch to discuss how data can shape your campaign."}
              </p>
            </div>
            {leader && (
              <div className="flex justify-center lg:justify-end">
                <LeaderPortrait leader={leader} size="lg" static />
              </div>
            )}
          </div>

          {c && (
            <>
              <h2 className="mt-24 font-display text-3xl font-semibold tracking-tight">What we delivered</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {c.tags.map((t, i) => (
                  <div key={t} className="glass rounded-2xl p-6">
                    <span className="font-serif text-4xl italic text-saffron-2">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 font-display text-lg font-semibold">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{CAPABILITIES[t] ?? ""}</p>
                  </div>
                ))}
              </div>

              {/* TODO: replace with verified results for this campaign */}
              <div className="glass mt-6 rounded-2xl border-dashed p-6 text-white/55">
                <b className="text-white/80">Results</b> — add verified outcomes for this campaign here (seats, vote share, accuracy of predictions).
              </div>
            </>
          )}

          <div className="mt-20 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-10 sm:flex-row sm:items-center">
            <CaseCta />
            {c && (
              <Link href={caseUrl(next.slug)} className="group flex items-center gap-3 text-white/70 hover:text-white">
                Next: <b className="font-display text-lg text-white">{next.title}</b>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
