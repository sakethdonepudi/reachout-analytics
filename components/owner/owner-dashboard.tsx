"use client";

import { useRef, useState, type ReactNode } from "react";
import PollUploadCard from "@/components/owner/poll-upload-card";
import MetaAdsCard from "@/components/owner/meta-ads-card";
import MetaAnalytics from "@/components/owner/meta-analytics";
import StateHealth from "@/components/owner/state-health";
import SurveyUploadCard from "@/components/owner/survey-upload-card";
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
