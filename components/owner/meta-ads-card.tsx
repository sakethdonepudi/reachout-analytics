"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, History, Loader2, RefreshCw, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import MappingEditor from "@/components/ads-desk/mapping-editor";
import type { AdsParse } from "@/lib/ads-desk/parse";
import { cn } from "@/lib/utils";

type Version = { _id: string; uploadedAt: string; uploadedBy?: string; sha256?: string; fileName: string; status: string; takenAt: string };
type Preview = { versionId: string; regions: { key: string; label: string; totals: AdsParse["regions"][number]["totals"] }[]; takenAt: string };

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;

export default function MetaAdsCard({
  versions,
  unmapped,
  cases,
  activeId,
}: {
  versions: Version[];
  unmapped: string[];
  cases: { id: string; slug: string; title: string }[];
  activeId: string | null;
}) {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [published, setPublished] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(unmapped.length > 0);

  async function upload(file: File) {
    if (!/\.html?$/i.test(file.name)) { setError("Choose the .html file exported from Ads Manager."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("That report is larger than 15 MB."); return; }
    setBusy("upload"); setError(""); setPublished(false); setMessage("Uploading 0%"); setPreview(null); setProgress(0);
    const form = new FormData(); form.append("file", file);
    const csrf = document.cookie.split("; ").find((item) => item.startsWith("ro_csrf="))?.split("=")[1] ?? "";
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/ads/upload");
      xhr.setRequestHeader("x-csrf-token", decodeURIComponent(csrf));
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const pct = Math.round((event.loaded / event.total) * 100);
        setProgress(pct); setMessage(`Uploading ${pct}%`);
      };
      xhr.onload = () => {
        setMessage("Parsing...");
        try {
          const payload = JSON.parse(xhr.responseText || "{}");
          if (xhr.status < 200 || xhr.status >= 300) { setError(payload.error ?? "The report could not be read."); return; }
          setPreview({ versionId: payload.versionId, regions: payload.preview.regions, takenAt: payload.preview.takenAt });
          setMessage("Parsed. Review the regions, then publish.");
        } catch { setError("The report could not be read."); }
      };
      xhr.onerror = () => setError("The upload was interrupted. Try again.");
      xhr.onloadend = () => { setBusy(""); setProgress(null); resolve(); };
      xhr.send(form);
    });
  }

  async function publish(versionId: string, retry = false) {
    setBusy(versionId); setError(""); setMessage("Publishing...");
    try {
      const response = await fetch("/api/ads/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return publish(versionId, true);
        setError("Re-authentication is needed to publish.");
        return;
      }
      if (!response.ok) { setError(typeof payload.error === "string" ? payload.error : "The report could not be published."); return; }
      setPublished(true); setPreview(null); setMessage(""); router.refresh();
    } catch { setError("The report could not be published."); }
    finally { setBusy(""); }
  }

  async function rollback(versionId: string, retry = false) {
    if (!retry && !window.confirm("Make this version the active report?")) return;
    setBusy(versionId); setError(""); setMessage("Rolling back...");
    try {
      const response = await fetch("/api/ads/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return rollback(versionId, true);
        setError("Re-authentication is needed to roll back.");
        return;
      }
      if (!response.ok) { setError(typeof payload.error === "string" ? payload.error : "The rollback failed."); return; }
      setPublished(false); setMessage("Rolled back. The dashboard now uses this version."); router.refresh();
    } catch { setError("The rollback failed."); }
    finally { setBusy(""); }
  }

  const current = versions.find((version) => version._id === activeId) ?? versions.find((version) => version.status === "active") ?? null;
  const previous = versions.filter((version) => version._id !== current?._id).slice(0, 5);

  return (
    <section className="rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]" aria-labelledby="meta-upload-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Meta ads</p>
          <h2 id="meta-upload-title" className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">HTML report</h2>
          <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Publish the Ads Manager export. The last version stays available.</p>
        </div>
        <History className="size-5 shrink-0 text-[#6B6B6B]" aria-hidden />
      </div>

      <label
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void upload(file); }}
        className={cn("mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-[#0B0B0C]/40", dragging ? "border-[#0B0B0C] bg-[#F4F4F5]" : "border-[#CFCFCF] bg-[#FAFAFA] hover:border-[#0B0B0C]")}
      >
        <span className="sr-only">Choose the Ads Manager HTML report</span>
        <Upload className="size-5 text-[#6B6B6B]" aria-hidden />
        <span className="mt-2 text-[13px] font-semibold text-[#0B0B0C]">Drop the HTML report here or choose a file</span>
        <span className="mt-1 text-[11.5px] text-[#6B6B6B]">.html exported from Ads Manager, up to 15 MB</span>
        <input type="file" accept=".html,text/html" className="sr-only" aria-label="Ads Manager HTML report" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      </label>

      {busy === "upload" && <p role="status" className="mt-3 flex items-center gap-2 text-[12px] text-[#6B6B6B]"><Loader2 className="size-3.5 animate-spin" /> {message} {progress != null ? `(${progress}%)` : ""}</p>}
      {message && busy !== "upload" && !published && <p role="status" className="mt-3 text-[12px] text-[#555]">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{error}</p>}
      {published && (
        <div role="status" className="mt-3 rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4] p-3 text-[12.5px] text-[#166534]">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden />Report published.</p>
          <a href="#meta-analytics" className="mt-1 inline-flex min-h-9 items-center underline underline-offset-4">View the analytics below</a>
        </div>
      )}

      {preview && (
        <div className="mt-4 rounded-xl border border-[#EAEAEA] p-3">
          <p className="text-[12px] font-semibold text-[#0B0B0C]">Preview · {preview.takenAt}</p>
          <ul className="mt-2 space-y-1 text-[11.5px] text-[#555]">
            {preview.regions.map((region) => <li key={region.key}><b className="text-[#0B0B0C]">{region.label}</b>: {region.totals.accounts} accounts, {region.totals.campaigns} campaigns, {money(region.totals.spend)}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void publish(preview.versionId)} disabled={Boolean(busy)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0B0B0C] px-4 text-[12px] font-semibold text-white disabled:opacity-40">{busy === preview.versionId ? <Loader2 className="size-3.5 animate-spin" /> : null}Publish</button>
            <button type="button" onClick={() => { setPreview(null); setMessage(""); }} className="min-h-10 rounded-lg border border-[#CFCFCF] px-4 text-[12px] font-semibold text-[#555]">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <button type="button" onClick={() => setMappingOpen((value) => !value)} aria-expanded={mappingOpen} className="flex w-full items-center justify-between rounded-lg border border-[#EAEAEA] px-3 py-2 text-left text-[12px] font-semibold text-[#0B0B0C]">
          <span>Map regions {unmapped.length > 0 ? `(${unmapped.length} unmapped)` : ""}</span>
          <ChevronDown className={cn("size-4 transition-transform", mappingOpen && "rotate-180")} aria-hidden />
        </button>
        {mappingOpen && <div className="mt-2"><MappingEditor cases={cases} /></div>}
      </div>

      <div className="mt-4 rounded-xl border border-[#EAEAEA] p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-[#0B0B0C]">Versions</p>
          {current && <span className="rounded-full bg-[#0B0B0C] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white">Current</span>}
        </div>
        {current ? (
          <div className="mt-2 rounded-lg bg-[#FAFAFA] px-2.5 py-2 text-[11.5px] text-[#555]">
            <p className="font-semibold text-[#0B0B0C]">{current.fileName}</p>
            <p className="mt-0.5">Covers {current.takenAt} · uploaded {new Date(current.uploadedAt).toLocaleString("en-IN")} by {current.uploadedBy ?? "owner"}</p>
          </div>
        ) : <p className="mt-2 text-[11.5px] text-[#6B6B6B]">No report published yet.</p>}
        {previous.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {previous.map((version) => (
              <li key={version._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#EAEAEA] px-2.5 py-2 text-[11px] text-[#555]">
                <span className="min-w-0"><b className="text-[#0B0B0C]">{version.fileName}</b><span className="ml-1 text-[#6B6B6B]">{version.status}</span><span className="block text-[10.5px]">{version.takenAt} · {new Date(version.uploadedAt).toLocaleString("en-IN")}</span></span>
                <button type="button" onClick={() => void rollback(version._id)} disabled={Boolean(busy)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#CFCFCF] px-2.5 text-[10.5px] font-semibold text-[#0B0B0C] disabled:opacity-40">{busy === version._id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Roll back</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
