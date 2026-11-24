import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import TnSurveyDashboard from "@/components/case-studies/tamil-nadu/tn-survey-dashboard";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import { getSurveyCached } from "@/lib/survey/store";
import { apClientModel } from "@/lib/survey/ap-view-dto";
import { AP_CONFIG } from "@/lib/case-study/config";
import type { SocialFilter } from "@/lib/survey/social-types";

export const metadata: Metadata = {
  title: "TDP · Andhra Pradesh | ReachOut Analytics",
  description: "Andhra Pradesh opinion, exit and post-poll survey analysis with vote share, voter profiles, region swing, a 3D constituency map and seats by zone.",
  openGraph: { title: "TDP · Andhra Pradesh | ReachOut Analytics", description: "Andhra Pradesh survey analysis.", images: [{ url: "https://reachout-analytics.vercel.app/og/andhra-pradesh-2024.png", width: 1200, height: 630, alt: "TDP · Andhra Pradesh case study" }] },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/andhra-pradesh-2024.png"] },
};

export const preferredRegion = "bom1";

function resolveView(view?: string, period?: string): string {
  if (view === "social") return "social";
  if (period === "rd" || period === "post" || period === "post-poll") return "rd";
  if (period === "ex" || period === "exit") return "ex";
  if (view === "rd" || view === "post" || view === "post-poll") return "rd";
  if (view === "ex" || view === "exit") return "ex";
  return "op";
}

export default async function AndhraPradeshCaseStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; slot?: string; profile?: string; match?: string; kind?: string; place?: string; label?: string; value?: string; average?: string; group?: string }>;
}) {
  const params = await searchParams;
  const session = await requirePageSession("/case-studies/andhra-pradesh-2024");
  if (!(await caseAllowed(session, "andhra-pradesh-2024"))) redirect("/no-access");
  const owner = session.role === "owner";
  const record = await getSurveyCached("andhra-pradesh-2024");
  const initialView = resolveView(params.view, params.period);
  const model = record ? apClientModel(record.data, initialView, params.slot ?? "all") : null;
  const socialFilter: SocialFilter | null = params.match
    ? { match: params.match as SocialFilter["match"], kind: params.kind, place: params.place, label: params.label, value: params.value, average: params.average, group: params.group }
    : null;

  if (!model) {
    return (
      <main className="min-h-0 bg-white">
        <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-6">
          <Link href="/case-studies" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] text-[#6B6B6B] hover:border-[#0B0B0C] hover:text-[#0B0B0C]"><ArrowLeft className="size-3.5" /> Back to Case Studies</Link>
        </div>
        <NotUploaded label="Andhra Pradesh survey dashboard" owner={owner} />
      </main>
    );
  }

  return (
    <>
      <h1 className="sr-only">TDP · Andhra Pradesh</h1>
      <TnSurveyDashboard model={model} owner={owner} config={AP_CONFIG} initialView={initialView} initialSlot={params.slot ?? "all"} initialProfile={params.profile ?? ""} initialSocialFilter={socialFilter} />
    </>
  );
}
