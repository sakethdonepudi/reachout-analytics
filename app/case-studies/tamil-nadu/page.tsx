import type { Metadata } from "next";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";
import { requirePageSession } from "@/lib/require-session";
import { redirect } from "next/navigation";
import { AMI_EXIT_POLL, ECI_ACTUAL, TN_OPINION_POLL } from "@/lib/tamil-nadu/comparison";
import { socialForCase } from "@/lib/ads-desk/mapping";
import { caseBySlug, resolveCaseTab, tabsForCase } from "@/lib/cases";
import { getSurveyCached } from "@/lib/survey/store";
import { pickSurveyPeriod, surveyForRole } from "@/lib/survey/dto";
import { surveyExitView, surveyOpinionView } from "@/lib/survey/tn-view";
import { getTamilNaduAggregates } from "@/lib/tamil-nadu/aggregates-server";
import { buildAdsSocial } from "@/lib/ads-desk/client-dto";
import { TVK_ACTUAL_SEATS, TVK_FORECASTERS } from "@/lib/tamil-nadu/forecasters";
import type { TnCaseData } from "@/lib/tamil-nadu/view-data";
import CaseStudyTabs from "@/components/ads-desk/case-study-tabs";
import SocialPanel from "@/components/ads-desk/social-panel";

export const metadata: Metadata = {
  title: "AIADMK · Tamil Nadu | ReachOut Analytics",
  description:
    "Interactive Tamil Nadu assembly election intelligence: survey vote shares, SAKET opinion-poll seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
  openGraph: {
    title: "AIADMK · Tamil Nadu | ReachOut Analytics",
    description: "Interactive Tamil Nadu assembly election intelligence: survey vote shares, SAKET opinion-poll seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/tamil-nadu.png", width: 1200, height: 630, alt: "AIADMK · Tamil Nadu case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/tamil-nadu.png"] },
};

export const dynamic = "force-dynamic";

export default async function TamilNaduCaseStudyPage({ searchParams }: { searchParams: Promise<{ view?: string; expand?: string; reason?: string; campaign?: string; period?: string; profile?: string }> }) {
  const { view, expand, campaign, period, profile } = await searchParams;
  const tabs = tabsForCase(caseBySlug("tamil-nadu"));
  const initialTab = resolveCaseTab(view, tabs);
  const session = await requirePageSession("/case-studies/tamil-nadu");
  const surveyRecord = await getSurveyCached("tamil-nadu");
  const surveyPeriod = surveyRecord ? pickSurveyPeriod(surveyRecord.data, period ?? (view === "exit" ? "ex" : "op")) : null;
  const survey = surveyRecord ? surveyForRole(surveyRecord.data, session.role === "owner", { period: surveyPeriod, profile }) : null;
  const socialRegions = await socialForCase("tamil-nadu", session.role === "owner");
  const aggregates = await getTamilNaduAggregates();
  const surveyOpinion = surveyRecord ? surveyOpinionView(surveyRecord.data, "op", "Tamil Nadu") : null;
  const surveyExit = surveyRecord ? surveyExitView(surveyRecord.data, "ex", "Tamil Nadu") : null;
  const caseData: TnCaseData = {
    exitPoll: surveyExit ?? AMI_EXIT_POLL,
    opinionPoll: surveyOpinion ?? TN_OPINION_POLL,
    actual: ECI_ACTUAL,
    social: socialRegions[0] ?? buildAdsSocial(null, "", session.role === "owner"),
    socialRegions,
    forecasters: TVK_FORECASTERS,
    forecastActualSeats: TVK_ACTUAL_SEATS,
  };

  return (
    <>
      <h1 className="sr-only">AIADMK · Tamil Nadu</h1>
      <CaseStudyTabs
        tabs={tabs}
        initialTab={initialTab}
        party="AIADMK"
        stateName="Tamil Nadu"
        panels={{
          exit: <TamilNaduDashboard caseData={caseData} aggregates={aggregates} owner={session.role === "owner"} pollType="exit" survey={survey} surveyPeriod={surveyPeriod} surveyProfile={profile ?? null} initialExpanded={expand === "1"} />,
          opinion: <TamilNaduDashboard caseData={caseData} aggregates={aggregates} owner={session.role === "owner"} pollType="opinion" survey={survey} surveyPeriod={surveyPeriod} surveyProfile={profile ?? null} initialExpanded={expand === "1"} />,
          social: <SocialPanel regions={socialRegions} campaign={campaign ?? null} period={period ?? null} />,
        }}
      />
    </>
  );
}
