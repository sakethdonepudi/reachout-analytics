import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ComingSoon from "@/components/case-studies/shared/coming-soon";
import { requirePageSession } from "@/lib/require-session";
import { caseAllowed } from "@/lib/session-scope";

export const metadata: Metadata = {
  title: "BRS · Telangana | ReachOut Analytics",
  description: "Telangana assembly election history and the 2028 prediction. This case study is being prepared.",
  openGraph: {
    title: "BRS · Telangana | ReachOut Analytics",
    description: "Telangana assembly election history and the 2028 prediction. This case study is being prepared.",
    images: [{ url: "https://reachout-analytics.vercel.app/og/telangana.png", width: 1200, height: 630, alt: "BRS · Telangana case study" }],
  },
  twitter: { card: "summary_large_image", images: ["https://reachout-analytics.vercel.app/og/telangana.png"] },
};

export const dynamic = "force-dynamic";

export default async function TelanganaCaseStudyPage() {
  const session = await requirePageSession("/case-studies/telangana");
  if (!(await caseAllowed(session, "telangana"))) redirect("/no-access");
  return <ComingSoon party="BRS" stateName="Telangana" stateCode="tg" year={2028} />;
}
