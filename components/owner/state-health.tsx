"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Eye, Loader2, Upload } from "lucide-react";
import { PartyMark } from "@/components/site/party-mark";
import { useReauth } from "@/components/auth/reauth-provider";
import type { DashboardState } from "@/lib/dashboard/data";

const stamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Never";

export default function StateHealth({ states, onUpload }: { states: DashboardState[]; onUpload: (slug: string) => void }) {
  const { requestReauth } = useReauth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function download(slug: string, retry = false) {
    setDownloading(slug); setError("");
    try {
      let response = await fetch(`/api/data/export?caseStudyId=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (response.status === 403 && !retry) {
        const payload = await response.json().catch(() => ({}));
        if (payload.code === "reauth_required") {
          if (await requestReauth()) return download(slug, true);
          setError("Re-authentication is needed to download data.");
          return;
        }
      }
      if (!response.ok) { setError("That state's data could not be downloaded."); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug}-poll-export.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { setError("That state's data could not be downloaded."); }
    finally { setDownloading(null); }
  }

  return (
    <section aria-label="State data health" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Data health</p>
          <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em] text-[#0B0B0C]">Seven states</h2>
        </div>
        {error && <p role="alert" className="text-[11.5px] text-[#B42318]">{error}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {states.map((state) => (
          <article key={state.slug} className="rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#EAEAEA]"><PartyMark party={state.party} size="sm" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[13.5px] font-semibold text-[#0B0B0C]">{state.stateName}</h3>
                <p className="text-[10.5px] text-[#6B6B6B]">{state.party}</p>
              </div>
              <span role="img" className={`mt-1 size-2 rounded-full ${state.poll || state.mappedRegions.length ? "bg-[#16A34A]" : "bg-[#D1D5DB]"}`} aria-label={state.poll || state.mappedRegions.length ? "Has data" : "No data"} />
            </div>
            <dl className="mt-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between gap-2"><dt className="text-[#6B6B6B]">Poll upload</dt><dd className="text-right text-[#555]">{state.poll ? `${stamp(state.poll.at)} · ${state.poll.rows.toLocaleString("en-IN")} rows` : "No poll data"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-[#6B6B6B]">Meta mapping</dt><dd className="max-w-[58%] truncate text-right text-[#555]">{state.mappedRegions.length ? state.mappedRegions.map((region) => region.label).join(", ") : "No Meta report"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link href={`/case-studies/${state.slug}?view=social`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#CFCFCF] px-2.5 text-[10.5px] font-semibold text-[#0B0B0C] hover:border-[#0B0B0C]"><Eye className="size-3" />View</Link>
              <button type="button" onClick={() => void download(state.slug)} disabled={Boolean(downloading)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#CFCFCF] px-2.5 text-[10.5px] font-semibold text-[#0B0B0C] hover:border-[#0B0B0C] disabled:opacity-50">{downloading === state.slug ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}Download data</button>
              <button type="button" onClick={() => onUpload(state.slug)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#0B0B0C] px-2.5 text-[10.5px] font-semibold text-white"><Upload className="size-3" />Upload</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
