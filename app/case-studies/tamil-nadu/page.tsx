import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";

export const metadata: Metadata = {
  title: "Tamil Nadu — ReachOut's Election Intelligence",
  description:
    "Interactive Tamil Nadu assembly election intelligence: survey vote shares, original and result-calibrated seat calls, Actual 2026 results, verified historical comparisons, a 3D district and assembly map, and district/assembly geographic analysis.",
};

export default function TamilNaduCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TamilNaduDashboard />
    </>
  );
}
