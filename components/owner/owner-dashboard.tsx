"use client";

import SurveyUploadCard from "@/components/owner/survey-upload-card";
import DownloadDataButton from "@/components/owner/download-data-button";
import type { SurveyVersionRow } from "@/lib/survey/store";

export default function OwnerDashboard({ tamilNadu, andhraPradesh, karnataka, telangana }: { tamilNadu: SurveyVersionRow[]; andhraPradesh: SurveyVersionRow[]; karnataka: SurveyVersionRow[]; telangana: SurveyVersionRow[] }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-text-3)]">Owner dashboard</p>
          <h1 className="mt-0.5 font-display text-[24px] font-semibold tracking-[-0.02em] text-[color:var(--theme-text)]">Data and uploads</h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-[color:var(--theme-text-3)]">One HTML per live state. Each upload publishes the survey periods, months, profiles and social ads together.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadDataButton state="tamil-nadu" label="Download Tamil Nadu data" />
          <DownloadDataButton state="andhra-pradesh-2024" label="Download Andhra Pradesh data" />
          <DownloadDataButton state="karnataka" label="Download Karnataka data" />
          <DownloadDataButton state="telangana" label="Download Telangana data" />
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <SurveyUploadCard state="tamil-nadu" stateName="Tamil Nadu" versions={tamilNadu} />
        <SurveyUploadCard state="andhra-pradesh-2024" stateName="Andhra Pradesh" versions={andhraPradesh} />
        <SurveyUploadCard state="karnataka" stateName="Karnataka" versions={karnataka} />
        <SurveyUploadCard state="telangana" stateName="Telangana" versions={telangana} />
      </div>
    </div>
  );
}
