import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import TnSurveyDashboard from "@/components/case-studies/tamil-nadu/tn-survey-dashboard";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";
import { getSurveyCached } from "@/lib/survey/store";
import { tnClientModel } from "@/lib/survey/tn-view-dto";
import type { SocialFilter } from "@/lib/survey/social-types";

export const metadata: Metadata = {
  title: "AIADMK · Tamil Nadu | ReachOut Analytics",
  description:
    "Tamil Nadu opinion, exit and result survey analysis with vote share, voter profiles, district and assembly maps, zone swing and seats by zone.",
  openGraph: {
    title: "AIADMK · Tamil Nadu | ReachOut Analytics",
    description: "Tamil Nadu opinion, exit and result survey analysis.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/tamil-nadu.png", width: 1200, height: 630, alt: "AIADMK · Tamil Nadu case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/tamil-nadu.png"] },
};

export const preferredRegion = "bom1";

function resolveView(view?: string): "op" | "ex" | "social" {
  if (view === "social") return "social";
  if (view === "ex" || view === "exit") return "ex";
  return "op";
}

export default async function TamilNaduCaseStudyPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; slot?: string; profile?: string; match?: string; kind?: string; place?: string; label?: string; value?: string; average?: string; group?: string }>;
}) {
  const params = await searchParams;
  if (params.view === "rs") redirect("/case-studies/tamil-nadu?view=op");
  const session = await requirePageSession("/case-studies/tamil-nadu");
  if (!(await caseAllowed(session, "tamil-nadu"))) redirect("/no-access");
  const owner = session.role === "owner";
  const record = await getSurveyCached("tamil-nadu");
  const initialView = resolveView(params.view);
  const model = record ? tnClientModel(record.data, initialView, params.slot ?? "all") : null;
  const socialFilter: SocialFilter | null = params.match
    ? {
      match: params.match as SocialFilter["match"],
      kind: params.kind,
      place: params.place,
      label: params.label,
      value: params.value,
      average: params.average,
      group: params.group,
    }
    : null;

  if (!model) {
    return (
      <main className="min-h-0 bg-white">
        <div className="mx-auto max-w-[1240px] px-4 pt-4 sm:px-6">
          <Link href="/case-studies" className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#CFCFCF] bg-white px-3 py-1.5 text-[12px] text-[#6B6B6B] hover:border-[#0B0B0C] hover:text-[#0B0B0C]"><ArrowLeft className="size-3.5" /> Back to Case Studies</Link>
        </div>
        <NotUploaded label="Tamil Nadu survey dashboard" owner={owner} />
      </main>
    );
  }

  return (
    <>
      <h1 className="sr-only">AIADMK · Tamil Nadu</h1>
      <TnSurveyDashboard
        model={model}
        owner={owner}
        initialView={initialView}
        initialSlot={params.slot ?? "all"}
        initialProfile={params.profile ?? ""}
        initialSocialFilter={socialFilter}
      />
    </>
  );
}
