import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import SocialPanel from "@/components/ads-desk/social-panel";
import CaseStudyTabs from "@/components/ads-desk/case-study-tabs";
import { socialForCase } from "@/lib/ads-desk/mapping";
import { DATA as TELANGANA_DATA } from "@/lib/telangana/oct26";
import { getClientHistory } from "@/lib/telangana/history-server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Telangana — ReachOut's Election Intelligence",
  description:
    "Interactive Telangana assembly election history: 2014, 2018 and 2023 actual winners, the 2028 prediction, survey-round projections and swing analysis across 119 constituencies.",
  openGraph: {
    title: "Telangana — ReachOut's Election Intelligence",
    description: "Interactive Telangana assembly election history: 2014, 2018 and 2023 actual winners, the 2028 prediction, survey-round projections and swing analysis across 119 constituencies.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/telangana.png", width: 1200, height: 630, alt: "BRS · Telangana case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/telangana.png"] },
};

export const dynamic = "force-dynamic";

export default async function TelanganaCaseStudyPage() {
  const session = await requirePageSession("/case-studies/telangana");
  if (!(await caseAllowed(session, "telangana"))) redirect("/no-access");
  const social = await socialForCase("telangana", session.role === "owner");
  const history = getClientHistory();

  return (
    <>
      <Navbar />
      <CaseStudyTabs social={<main className="min-h-screen bg-background pt-16 text-foreground"><div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10"><SocialPanel regions={social} /></div></main>}>
        <TelanganaDashboard aggregates={TELANGANA_DATA} history={history} />
      </CaseStudyTabs>
    </>
  );
}
