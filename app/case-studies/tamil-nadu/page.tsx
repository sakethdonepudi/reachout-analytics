import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";

export const metadata: Metadata = {
  title: "Tamil Nadu — ReachOut's Election Intelligence",
  description:
    "Interactive Tamil Nadu assembly election intelligence: 2011, 2016 and 2021 historical comparisons, the final 2026 exit-poll aggregate analysis with documented geographic allocation, Actual 2026 seat results, a 3D district and assembly map, and geographic distributions.",
};

export default function TamilNaduCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TamilNaduDashboard />
    </>
  );
}
