import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import TnSurveyDashboard from "@/components/case-studies/tamil-nadu/tn-survey-dashboard";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import { getSurveyCached } from "@/lib/survey/store";
import { kaClientModel, kaSocialOverview } from "@/lib/survey/ka-view-dto";
import { latestMonthFromData } from "@/lib/survey/post-poll";
import { KA_CONFIG } from "@/lib/case-study/config";
import type { SocialFilter } from "@/lib/survey/social-types";

export const metadata: Metadata = {
  title: "Karnataka 2028 · Live Tracking Survey | ReachOut Analytics",
  description: "Karnataka 2028 live tracking survey with vote share, voter profiles, region swing and seats by region.",
  openGraph: {
    title: "Karnataka 2028 · Live Tracking Survey | ReachOut Analytics",
    description: "Karnataka 2028 live tracking survey with vote share, voter profiles, region swing and seats by region.",
    url: "https://reachout-analytics.vercel.app/case-studies/karnataka",
    images: [{ url: "https://reachout-analytics.vercel.app/og/karnataka.png", width: 1200, height: 630, alt: "Karnataka 2028 live tracking survey case study" }],
  },
  twitter: { card: "summary_large_image", title: "Karnataka 2028 · Live Tracking Survey", description: "Karnataka 2028 live tracking survey with vote share, voter profiles, region swing and seats by region.", images: ["https://reachout-analytics.vercel.app/og/karnataka.png"] },
};

export const preferredRegion = "bom1";

export default async function KarnatakaCaseStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; slot?: string; profile?: string; match?: string; kind?: string; place?: string; label?: string; value?: string; average?: string; group?: string }>;
}) {
  const params = await searchParams;
  if (params.view && params.view !== "social" && params.view !== "rd") redirect("/case-studies/karnataka");
  const session = await requirePageSession("/case-studies/karnataka");
  if (!(await caseAllowed(session, "karnataka"))) redirect("/no-access");
  const owner = session.role === "owner";
  const record = await getSurveyCached("karnataka");
  const initialView = params.view === "social" ? "social" : "rd";
  if (record && !params.slot) {
    const latest = latestMonthFromData(record.data, "rd", false);
    if (latest !== "all") {
      const query = new URLSearchParams();
      for (const key of ["profile", "match", "kind", "place", "label", "value", "average", "group"] as const) {
        const value = params[key];
        if (value) query.set(key, value);
      }
      query.set("view", initialView === "social" ? "social" : "rd");
      query.set("slot", latest);
      redirect(`/case-studies/karnataka?${query.toString()}`);
    }
  }
  const initialSlot = params.slot ?? (record ? latestMonthFromData(record.data, "rd", false) : "all");
  const model = record ? kaClientModel(record.data, initialView, initialSlot) : null;
  const socialOverview = record ? await kaSocialOverview(record.data, owner) : null;
  const socialFilter: SocialFilter | null = params.match && params.match !== "target"
    ? { match: params.match as SocialFilter["match"], kind: params.kind, place: params.place, label: params.label, value: params.value, average: params.average, group: params.group }
    : null;

  if (!model) {
    return (
      <main className="min-h-0 bg-white">
        <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-6">
          <Link href="/case-studies" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] text-[#6B6B6B] hover:border-[#0B0B0C] hover:text-[#0B0B0C]"><ArrowLeft className="size-3.5" /> Back to Case Studies</Link>
        </div>
        <NotUploaded label="Karnataka survey dashboard" owner={owner} />
      </main>
    );
  }

  return (
    <>
      <h1 className="sr-only">Karnataka 2028 · Live Tracking Survey</h1>
      <TnSurveyDashboard model={model} owner={owner} config={KA_CONFIG} initialView={initialView} initialSlot={initialSlot} initialProfile={params.profile ?? ""} initialSocialFilter={socialFilter} initialSocialOverview={socialOverview} />
    </>
  );
}
