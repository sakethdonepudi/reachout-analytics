import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import PartyCard from "@/components/case-studies/shared/party-card";
import StateMap from "@/components/case-studies/shared/state-map";
import { CASES, CAPABILITIES, UPCOMING, caseBySlug, caseUrl, resolveCaseTab, tabsForCase } from "@/lib/cases";
import { requirePageSession } from "@/lib/require-session";
import SocialPanel from "@/components/ads-desk/social-panel";
import CaseStudyTabs from "@/components/ads-desk/case-study-tabs";
import CaseBackLink from "@/components/site/case-back-link";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import { socialForCase } from "@/lib/ads-desk/mapping";
import { caseAllowed } from "@/lib/session-scope";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function yearFor(slug: string): number {
  const match = slug.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  if (slug === "telangana") return 2028;
  if (slug === "north-east-elections") return 2026;
  return 2026;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = caseBySlug(slug);
  const u = UPCOMING.find((x) => x.slug === slug);
  const title = c ? `${c.party} · ${c.stateName} | ReachOut Analytics` : `${u?.title ?? "Case study"} | ReachOut Analytics`;
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

export default async function CaseStudyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ view?: string }> }) {
  const { slug } = await params;
  const { view } = await searchParams;
  const session = await requirePageSession(`/case-studies/${slug}`);
  if (!(await caseAllowed(session, slug))) redirect("/no-access");
  const social = await socialForCase(slug, session.role === "owner");
  const c = caseBySlug(slug);
  const tabs = tabsForCase(c);
  const initialTab = resolveCaseTab(view, tabs);
  const upcoming = UPCOMING.find((u) => u.slug === slug);
  if (!c && !upcoming) notFound();

  const idx = c ? CASES.indexOf(c) : -1;
  const next = CASES[(idx + 1) % CASES.length];

  return (
    <>
      <h1 className="sr-only">{c ? `${c.party} · ${c.stateName}` : upcoming!.title}</h1>
      <CaseStudyTabs
        tabs={tabs}
        initialTab={initialTab}
        party={c?.party}
        stateName={c?.stateName}
        panels={{
          ...(tabs.includes("exit") ? { exit: <NotUploaded label="Exit poll data" owner={session.role === "owner"} /> } : {}),
          opinion: (
      <main className="app-chrome relative min-h-0 overflow-hidden bg-[color:var(--theme-bg)] text-[color:var(--theme-text)]">
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-0 sm:px-10">
          <CaseBackLink className="tap inline-flex items-center gap-2 rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-1.5 text-[12.5px] text-[color:var(--theme-text-2)] transition-colors hover:border-[color:var(--theme-text)] hover:text-[color:var(--theme-text)]">
            <ArrowLeft className="size-4" /> Back to case studies
          </CaseBackLink>

          <div className={`mt-8 grid items-start gap-6 ${c ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""}`}>
            {c && <StateMap stateCode={c.state} stateName={c.stateName} year={yearFor(c.slug)} party={c.party} />}
            <div>
              {c ? (
                <>
                  <PartyCard party={c.party} state={c.stateName} className="max-w-[320px]" />
                  <p className="mt-5 flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4 text-[color:var(--theme-text)]" /> {c.region}
                  </p>
                </>
              ) : (
                <span className="rounded-full border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--theme-text-2)]">Upcoming</span>
              )}
              <p className={c ? "mt-6 max-w-xl text-xl leading-relaxed text-foreground/80" : "mt-6 max-w-xl text-xl leading-relaxed text-foreground/80"}>
                {c?.summary ?? "We're preparing for this election cycle. Get in touch to discuss how data can shape your campaign."}
              </p>
            </div>
          </div>

          {c && (
            <>
              <h2 className="mt-24 font-display text-3xl font-semibold tracking-tight">What we delivered</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {c.tags.map((t, i) => (
                  <div key={t} className="report-card p-4">
                    <span className="text-[11px] font-semibold text-[color:var(--theme-text-3)]">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-2 text-[15px] font-semibold text-[color:var(--theme-text)]">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{CAPABILITIES[t] ?? ""}</p>
                  </div>
                ))}
              </div>

            </>
          )}

          {c && (
            <div className="mt-16 flex items-center justify-end border-t border-border pt-10">
              <Link href={caseUrl(next.slug)} className="tap group flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground">
                Next: <b className="font-display text-lg text-foreground">{next.title}</b>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          )}
        </div>
      </main>
          ),
          social: <SocialPanel regions={social} />,
        }}
      />
    </>
  );
}
