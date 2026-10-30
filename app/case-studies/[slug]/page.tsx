import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import Navbar from "@/components/site/navbar";
import CaseCta from "@/components/site/case-cta";
import CompanyExperience from "@/components/site/company-marquee";
import { PartyIdentity, PartyMark } from "@/components/site/party-mark";
import { CASES, CAPABILITIES, UPCOMING, caseBySlug, caseUrl } from "@/lib/cases";

export function generateStaticParams() {
  // Tamil Nadu and Telangana have their own dedicated dashboard routes.
  return [
    ...CASES.filter((c) => c.slug !== "tamil-nadu" && c.slug !== "telangana").map((c) => ({ slug: c.slug })),
    ...UPCOMING.map((u) => ({ slug: u.slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  const u = UPCOMING.find((x) => x.slug === slug);
  const title = `${c?.title ?? u?.title ?? "Case study"} — ReachOut Analytics`;
  const description = c?.summary ?? "We're preparing for this election cycle. Get in touch to discuss how data can shape your campaign.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(c
        ? {
            images: [
              {
                url: `https://reachout-analytics.vercel.app/og/${c.slug}.png`,
                width: 1200,
                height: 630,
                alt: `${c.party} · ${c.stateName} case study`,
              },
            ],
          }
        : {}),
    },
    twitter: c
      ? { card: "summary_large_image", title, description, images: [`https://reachout-analytics.vercel.app/og/${c.slug}.png`] }
      : { card: "summary", title, description },
  };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  const upcoming = UPCOMING.find((u) => u.slug === slug);
  if (!c && !upcoming) notFound();

  const idx = c ? CASES.indexOf(c) : -1;
  const next = CASES[(idx + 1) % CASES.length];

  return (
    <>
      <Navbar />
      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_10%,rgba(245,138,36,0.08),transparent_60%)]" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-36 sm:px-10">
          <Link href="/#tour" className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/80 transition-colors hover:text-foreground">
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
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 text-saffron-2" /> {c.region}
                  </p>
                  <PartyIdentity party={c.party} state={c.stateName} size="sm" />
                </div>
              )}
              <p className="mt-8 max-w-xl text-xl leading-relaxed text-foreground/80">
                {c?.summary ?? "We're preparing for this election cycle. Get in touch to discuss how data can shape your campaign."}
              </p>
            </div>
            {c && (
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-[320px] rounded-3xl border border-border bg-card/80 p-7 text-center shadow-[0_24px_60px_-36px_rgba(15,20,30,.45)]">
                  <PartyMark party={c.party} size="xl" className="mx-auto" priority />
                  <p className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em]">{c.party}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">{c.stateName}</p>
                  <p className="mt-4 border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-saffron-2">Case study</p>
                </div>
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
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{CAPABILITIES[t] ?? ""}</p>
                  </div>
                ))}
              </div>

              {/* TODO: replace with verified results for this campaign */}
              <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-muted-foreground">
                <b className="text-foreground/80">Results</b> — add verified outcomes for this campaign here (seats, vote share, accuracy of predictions).
              </div>
            </>
          )}

          <CompanyExperience className="mt-20 border-t border-border" />

          <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-border pt-10 sm:flex-row sm:items-center">
            <CaseCta />
            {c && (
              <Link href={caseUrl(next.slug)} className="group flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground">
                Next: <b className="font-display text-lg text-foreground">{next.title}</b>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
