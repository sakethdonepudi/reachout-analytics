import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import CompanyExperience from "@/components/site/company-marquee";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";

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

export default function TelanganaCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TelanganaDashboard />
      <CompanyExperience />
    </>
  );
}
