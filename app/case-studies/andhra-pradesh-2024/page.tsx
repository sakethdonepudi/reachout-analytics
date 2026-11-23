import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CaseStudyTabs from "@/components/ads-desk/case-study-tabs";
import SocialPanel from "@/components/ads-desk/social-panel";
import StateMap from "@/components/case-studies/shared/state-map";
import PartyCard from "@/components/case-studies/shared/party-card";
import CaseBackLink from "@/components/site/case-back-link";
import SurveyCasePanel from "@/components/case-studies/survey-dashboard/survey-case-panel";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import { socialForCase } from "@/lib/ads-desk/mapping";
import { caseBySlug, resolveCaseTab, tabsForCase } from "@/lib/cases";
import { getSurveyCached } from "@/lib/survey/store";
import { pickSurveyPeriod, surveyForRole } from "@/lib/survey/dto";

export const metadata: Metadata = {
  title: "TDP · Andhra Pradesh | ReachOut Analytics",
  description: "Andhra Pradesh opinion, exit and post-poll survey analysis with vote share, voter profiles, zone swing and seats by zone.",
  openGraph: { title: "TDP · Andhra Pradesh | ReachOut Analytics", description: "Andhra Pradesh survey analysis.", images: [{ url: "https://reachout-analytics.vercel.app/og/andhra-pradesh-2024.png", width: 1200, height: 630, alt: "TDP · Andhra Pradesh case study" }] },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/andhra-pradesh-2024.png"] },
};

export const dynamic = "force-dynamic";

export default async function AndhraPradeshCaseStudyPage({ searchParams }: { searchParams: Promise<{ view?: string; period?: string; profile?: string; year?: string }> }) {
  const { view, period, profile, year } = await searchParams;
  const session = await requirePageSession("/case-studies/andhra-pradesh-2024");
  if (!(await caseAllowed(session, "andhra-pradesh-2024"))) redirect("/no-access");
  const tabs = tabsForCase(caseBySlug("andhra-pradesh-2024"));
  const initialTab = resolveCaseTab(view, tabs);
  const social = await socialForCase("andhra-pradesh-2024", session.role === "owner");
  const record = await getSurveyCached("andhra-pradesh-2024");
  const surveyPeriod = record ? pickSurveyPeriod(record.data, period ?? (view === "exit" ? "ex" : "op")) : null;
  const survey = record ? surveyForRole(record.data, session.role === "owner", { period: surveyPeriod, profile, year }) : null;
  const c = caseBySlug("andhra-pradesh-2024");

  return (
    <>
      <h1 className="sr-only">TDP · Andhra Pradesh</h1>
      <CaseStudyTabs
        tabs={tabs}
        initialTab={initialTab}
        party="TDP"
        stateName="Andhra Pradesh"
        panels={{
          exit: (
            <main className="relative min-h-0 bg-white text-[var(--p-ink)]">
              <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6"><CaseBackLink className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12.5px] text-[#6B6B6B]"><span aria-hidden>←</span> Back to Case Studies</CaseBackLink></div>
              <SurveyCasePanel data={survey} stateName="Andhra Pradesh" stateSlug="andhra-pradesh-2024" view="exit" initialPeriod={surveyPeriod} initialProfile={profile} initialYear={year} owner={session.role === "owner"} />
            </main>
          ),
          opinion: (
            <main className="relative min-h-0 bg-white text-[var(--p-ink)]">
              <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6"><CaseBackLink className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12.5px] text-[#6B6B6B]"><span aria-hidden>←</span> Back to Case Studies</CaseBackLink></div>
              <div className="mx-auto grid max-w-[1200px] items-start gap-6 px-4 pb-2 pt-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <StateMap stateCode={c?.state ?? "ap"} stateName="Andhra Pradesh" year={2024} party="TDP" />
                <div><PartyCard party="TDP" state="Andhra Pradesh" className="max-w-[320px]" /><p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#555]">Survey analysis of the Andhra Pradesh 2024 opinion, exit and post-poll rounds, with voter profiles, zone swing and seats by zone.</p></div>
              </div>
              <SurveyCasePanel data={survey} stateName="Andhra Pradesh" stateSlug="andhra-pradesh-2024" view="opinion" initialPeriod={surveyPeriod} initialProfile={profile} initialYear={year} owner={session.role === "owner"} />
            </main>
          ),
          social: <SocialPanel regions={social} period={period ?? null} />,
        }}
      />
    </>
  );
}
