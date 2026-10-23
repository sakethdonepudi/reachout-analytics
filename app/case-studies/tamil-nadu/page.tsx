import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";

export const metadata: Metadata = {
  title: "Tamil Nadu — ReachOut's Election Intelligence",
  description:
    "Interactive Tamil Nadu assembly election intelligence: 2011, 2016 and 2021 verified results, the 2026 exit-poll survey, a 3D district and assembly map, and survey-round analysis.",
};

export default function TamilNaduCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TamilNaduDashboard />
    </>
  );
}
