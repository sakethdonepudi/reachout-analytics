import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TamilNaduDashboard from "@/components/case-studies/tamil-nadu/tamil-nadu-dashboard";

export const metadata: Metadata = {
  title: "Tamil Nadu — Election Intelligence | ReachOut Analytics",
  description:
    "Interactive Tamil Nadu election intelligence: district and pincode-level exit and opinion poll data with a live 3D district map.",
};

export default function TamilNaduCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TamilNaduDashboard />
    </>
  );
}
