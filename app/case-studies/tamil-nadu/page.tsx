import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import CompanyExperience from "@/components/site/company-marquee";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import { redirect } from "next/navigation";
import { AMI_EXIT_POLL, ECI_ACTUAL, TN_OPINION_POLL, TN_SOCIAL } from "@/lib/tamil-nadu/comparison";
import { TVK_ACTUAL_SEATS, TVK_FORECASTERS } from "@/lib/tamil-nadu/forecasters";
import type { TnCaseData } from "@/lib/tamil-nadu/view-data";

export const metadata: Metadata = {
  title: "Tamil Nadu — ReachOut's Election Intelligence",
  description:
    "Interactive Tamil Nadu assembly election intelligence: survey vote shares, SAKET opinion-poll seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
  openGraph: {
    title: "Tamil Nadu — ReachOut's Election Intelligence",
    description: "Interactive Tamil Nadu assembly election intelligence: survey vote shares, SAKET opinion-poll seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/tamil-nadu.png", width: 1200, height: 630, alt: "AIADMK · Tamil Nadu case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/tamil-nadu.png"] },
};

export const dynamic = "force-dynamic";

export default async function TamilNaduCaseStudyPage() {
  const session = await requirePageSession("/case-studies/tamil-nadu");
  const caseData: TnCaseData = {
    exitPoll: AMI_EXIT_POLL,
    opinionPoll: TN_OPINION_POLL,
    actual: ECI_ACTUAL,
    social: TN_SOCIAL,
    forecasters: TVK_FORECASTERS,
    forecastActualSeats: TVK_ACTUAL_SEATS,
  };

  return (
    <>
      <Navbar />
      <TamilNaduDashboard caseData={caseData} owner={session.role === "owner"} />
      <CompanyExperience />
    </>
  );
}
