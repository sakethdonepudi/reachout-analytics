"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import AnalysisShell from "@/components/case-studies/shared/analysis-shell";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import type { SurveyData } from "@/lib/survey/types";
import SurveyBody from "./survey-body";

export default function SurveyDashboard({
  open,
  onClose,
  data,
  stateName,
  view,
  initialPeriod,
  initialProfile,
  owner = false,
}: {
  open: boolean;
  onClose: () => void;
  data: SurveyData | null;
  stateName: string;
  view: "opinion" | "exit";
  initialPeriod?: string;
  initialProfile?: string;
  owner?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const period = initialPeriod ?? (view === "exit" ? "ex" : "op");
  const current = data?.periods[period] ?? data?.periods[view === "exit" ? "ex" : "op"];
  const socialPeriod = period === "rs" || period === "rd" ? "post" : period;
  const scrollKey = `ro:survey-scroll:${pathname}`;

  useEffect(() => {
    if (!open) return;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(scrollKey) ?? 0); } catch { saved = 0; }
    if (!saved) return;
    try { sessionStorage.removeItem(scrollKey); } catch { /* storage can be blocked */ }
    const restore = () => {
      const scroller = document.querySelector<HTMLElement>("[data-analysis-shell] .overflow-y-auto");
      if (scroller) scroller.scrollTop = saved;
    };
    restore();
    const frame = requestAnimationFrame(restore);
    const timer = window.setTimeout(restore, 220);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [open, scrollKey]);

  function go(nextPeriod: string, nextProfile?: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    params.set("expand", "1");
    params.set("period", nextPeriod);
    if (nextProfile) params.set("profile", nextProfile);
    else params.delete("profile");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function openSocial() {
    const scroller = document.querySelector<HTMLElement>("[data-analysis-shell] .overflow-y-auto");
    try { sessionStorage.setItem(scrollKey, String(scroller?.scrollTop ?? 0)); } catch { /* storage can be blocked */ }
    const params = new URLSearchParams(window.location.search);
    params.set("view", "social");
    params.set("period", socialPeriod);
    params.delete("expand");
    params.delete("period");
    params.set("period", socialPeriod);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <AnalysisShell
      open={open}
      onClose={onClose}
      eyebrow="Survey analysis"
      title={`${stateName} survey dashboard`}
      subtitle={current ? `${current.label} · ${new Intl.NumberFormat("en-IN").format(current.n)} responses${current.from ? ` · ${current.from} to ${current.to}` : ""}` : "Not uploaded yet"}
      contentClassName="space-y-4"
    >
      {data ? (
        <SurveyBody
          data={data}
          stateSlug={stateName === "Andhra Pradesh" ? "andhra-pradesh-2024" : "tamil-nadu"}
          stateName={stateName}
          initialPeriod={period}
          initialProfile={initialProfile}
          onPeriodChange={(next) => go(next)}
          onProfileChange={(next) => go(period, next)}
          onOpenSocial={openSocial}
          owner={owner}
        />
      ) : (
        <NotUploaded label="Survey dashboard" owner={owner} />
      )}
    </AnalysisShell>
  );
}
