import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";

export const metadata: Metadata = {
  title: "Telangana — ReachOut's Election Intelligence",
  description:
    "Interactive Telangana assembly election history: 2014, 2018 and 2023 actual winners, the 2028 prediction, survey-round projections and swing analysis across 119 constituencies.",
};

export default function TelanganaCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TelanganaDashboard />
    </>
  );
}
