import type { Metadata } from "next";
import Navbar from "@/components/site/navbar";
import TelanganaDashboard from "@/components/case-studies/telangana/telangana-dashboard";

export const metadata: Metadata = {
  title: "Telangana — Election Intelligence | ReachOut Analytics",
  description:
    "Interactive Telangana assembly-level opinion survey: 2028 vote intention, 2018 and 2023 actual results, device metadata and 119 assembly constituencies.",
};

export default function TelanganaCaseStudyPage() {
  return (
    <>
      <Navbar />
      <TelanganaDashboard />
    </>
  );
}
