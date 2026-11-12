import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import CompanyExperience from "@/components/site/company-marquee";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
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
  if (!caseAllowed(session, "telangana")) redirect("/no-access");

  return (
    <>
      <Navbar />
      <TelanganaDashboard />
      <CompanyExperience />
    </>
  );
}
