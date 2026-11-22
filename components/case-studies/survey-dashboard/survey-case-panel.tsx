"use client";

import { usePathname, useRouter } from "next/navigation";
import type { SurveyData } from "@/lib/survey/types";
import SurveyBody from "./survey-body";

export default function SurveyCasePanel({
  data,
  stateName,
  stateSlug,
  view,
  initialPeriod,
  initialProfile,
  owner = false,
}: {
  data: SurveyData | null;
  stateName: string;
  stateSlug: string;
  view: "opinion" | "exit";
  initialPeriod?: string | null;
  initialProfile?: string | null;
  owner?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (!data) {
    return <div className="px-6 py-16 text-center text-[13px] text-[#6B6B6B]">Survey dashboard not uploaded yet.</div>;
  }
  function openSocial(period: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("view", "social");
    params.set("period", period === "rs" || period === "rd" ? "post" : period);
    params.delete("expand");
    params.delete("profile");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function go(period: string, profile?: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    params.set("period", period);
    if (profile) params.set("profile", profile);
    else params.delete("profile");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-4 sm:px-6">
      <SurveyBody
        data={data}
        stateSlug={stateSlug}
        stateName={stateName}
        initialPeriod={initialPeriod ?? (view === "exit" ? "ex" : "op")}
        initialProfile={initialProfile ?? undefined}
        onPeriodChange={(period) => go(period)}
        onProfileChange={(profile) => go(initialPeriod ?? (view === "exit" ? "ex" : "op"), profile)}
        onOpenSocial={openSocial}
        owner={owner}
      />
    </div>
  );
}
