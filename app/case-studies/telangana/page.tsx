import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";

export const metadata: Metadata = {
  title: "Telangana — 2014 to 2028 Election Intelligence | ReachOut Analytics",
  description:
    "Interactive Telangana assembly election history: 2014, 2018 and 2023 actual winners, the 2028 prediction, swing statistics and device metadata across 119 constituencies.",
};

export default function TelanganaCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TelanganaDashboard />
    </>
  );
}
