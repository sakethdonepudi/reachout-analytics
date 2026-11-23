"use client";

import { useRef, useState, type ReactNode } from "react";
import PollUploadCard from "@/components/owner/poll-upload-card";
import MetaAdsCard from "@/components/owner/meta-ads-card";
import MetaAnalytics from "@/components/owner/meta-analytics";
import StateHealth from "@/components/owner/state-health";
import SurveyUploadCard from "@/components/owner/survey-upload-card";
import DownloadDataButton from "@/components/owner/download-data-button";
import type { DashboardShell } from "@/lib/dashboard/data";

export default function OwnerDashboard({ shell, children }: { shell: DashboardShell; children: ReactNode }) {
  const [uploadSlug, setUploadSlug] = useState<string | null>(null);
  const pollRef = useRef<HTMLDivElement>(null);

  function startUpload(slug: string) {
    setUploadSlug(slug);
    pollRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Owner dashboard</p>
          <h1 className="mt-0.5 font-display text-[24px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">Data and uploads</h1>
        </div>
        <DownloadDataButton label="Download Tamil Nadu data" />
      </div>
      <div ref={pollRef} className="scroll-mt-24 grid items-start gap-4 lg:grid-cols-2">
        <PollUploadCard initialSlug={uploadSlug} />
        <MetaAdsCard versions={shell.versions} unmapped={shell.unmapped} cases={shell.cases} activeId={shell.activeId} />
      </div>
      <SurveyUploadCard />
      {children}
      <StateHealth states={shell.states} onUpload={startUpload} />
    </div>
  );
}
