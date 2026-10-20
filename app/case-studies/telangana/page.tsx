import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";

export const metadata: Metadata = {
  title: "Telangana — 2028 Vote Intention | ReachOut Analytics",
  description:
    "Interactive Telangana assembly-level opinion model: 2028 vote intention against the 2023 election result, with district and assembly drilldown across 119 constituencies.",
};

export default function TelanganaCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TelanganaDashboard />
    </>
  );
}
