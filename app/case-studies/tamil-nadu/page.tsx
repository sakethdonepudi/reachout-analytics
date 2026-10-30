import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import CompanyExperience from "@/components/site/company-marquee";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";

export const metadata: Metadata = {
  title: "Tamil Nadu — ReachOut's Election Intelligence",
  description:
    "Interactive Tamil Nadu assembly election intelligence: survey vote shares, original and result-calibrated seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
  openGraph: {
    title: "Tamil Nadu — ReachOut's Election Intelligence",
    description: "Interactive Tamil Nadu assembly election intelligence: survey vote shares, original and result-calibrated seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/tamil-nadu.png", width: 1200, height: 630, alt: "AIADMK · Tamil Nadu case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/tamil-nadu.png"] },
};

export default function TamilNaduCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TamilNaduDashboard />
      <CompanyExperience />
    </>
  );
}
