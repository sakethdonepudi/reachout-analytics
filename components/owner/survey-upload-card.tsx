"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, History, Loader2, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import { indianUnits } from "@/lib/ads-desk/format";
import { cn } from "@/lib/utils";
import type { SurveyVersionRow } from "@/lib/survey/store";

type Month = { label: string; n: number };
type Period = { key: string; label: string; n: number; from: string; to: string; months: Month[] };
type Preview = {
  periods: Period[];
  n_total: number;
  state: string;
  stateName: string;
  range: string;
  ads: { campaigns: number; accounts: number; reach: number; engagements: number; range: string; label: string };
};

const stamp = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
const MAX = 15 * 1024 * 1024;

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--theme-text-3)]">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[color:var(--theme-text)]">{value}</p>
      {note && <p className="mt-0.5 truncate text-[10.5px] text-[color:var(--theme-text-3)]">{note}</p>}
    </div>
  );
}

export default function SurveyUploadCard({ state, stateName, versions }: { state: string; stateName: string; versions: SurveyVersionRow[] }) {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "parse" | "publish" | "rollback">("");
  const [error, setError] = useState("");
  const [published, setPublished] = useState<number | null>(null);
  const [restored, setRestored] = useState<number | null>(null);
  const current = versions.find((version) => version.active) ?? versions[0] ?? null;

  async function send(next: File | null, confirm = false) {
    if (!next) return;
    setFile(next);
    setError("");
    setPublished(null);
    setRestored(null);
    if (!/\.html$/i.test(next.name)) { setError("Choose the state dashboard .html file."); return; }
    if (next.size > MAX) { setError("That file is larger than 15 MB."); return; }
    setBusy(confirm ? "publish" : "parse");
    if (!confirm) setPreview(null);
    const form = new FormData();
    form.append("file", next);
    form.append("state", state);
    if (confirm) form.append("confirm", "1");
    try {
      let response = await fetch("/api/survey/upload", { method: "POST", body: form });
      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        if (payload.code === "reauth_required") {
          if (!(await requestReauth())) throw new Error("Re-authentication is needed to publish a dashboard.");
          response = await fetch("/api/survey/upload", { method: "POST", body: form });
        }
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(typeof payload.error === "string" ? payload.error : "That dashboard could not be read.");
      if (confirm) {
        setPublished(Number(payload.version ?? 0));
        setPreview(null);
        setFile(null);
        if (input.current) input.current.value = "";
        router.refresh();
      } else {
        setPreview(payload.preview as Preview);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That dashboard could not be read.");
    } finally {
      setBusy("");
    }
  }

  async function rollback(version: number, retry = false) {
    setBusy("rollback");
    setError("");
    setRestored(null);
    try {
      const response = await fetch("/api/survey/rollback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, version }) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return rollback(version, true);
        throw new Error("Re-authentication is needed to restore a version.");
      }
      if (!response.ok || !payload.ok) throw new Error(typeof payload.error === "string" ? payload.error : "That version could not be restored.");
      setRestored(version);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That version could not be restored.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]" aria-labelledby={`upload-${state}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-text-3)]">Live state dashboard</p>
          <h2 id={`upload-${state}`} className="mt-1 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--theme-text)]">{stateName}: upload dashboard HTML</h2>
          <p className="mt-1 text-[12.5px] text-[color:var(--theme-text-3)]">One .html file publishes survey data and social ads for this state.</p>
        </div>
        <FileUp className="size-5 shrink-0 text-[color:var(--theme-text-3)]" aria-hidden />
      </div>

      <div className="mt-4 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--theme-text-3)]">Current live version</p>
        {current ? (
          <div className="mt-1 min-w-0">
            <p className="truncate text-[12.5px] font-semibold text-[color:var(--theme-text)]" title={current.fileName}>{current.fileName}</p>
            <p className="mt-0.5 text-[11px] text-[color:var(--theme-text-3)]">v{current.version} · {stamp(current.uploadedAt)} · {current.uploadedBy ?? "Owner"}</p>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-[color:var(--theme-text-3)]">No dashboard published yet.</p>
        )}
      </div>

      <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void send(event.dataTransfer.files?.[0] ?? null); }} className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--theme-border)] bg-[color:var(--theme-surface-2)] px-4 py-4 text-center transition-colors hover:border-[color:var(--theme-text)] focus-within:ring-2 focus-within:ring-[color:var(--theme-link)]">
        <span className="sr-only">Choose the {stateName} dashboard HTML file</span>
        <Upload className="size-5 text-[color:var(--theme-text-3)]" aria-hidden />
        <span className="mt-2 max-w-full truncate text-[13px] font-semibold text-[color:var(--theme-text)]">{file ? file.name : `Drop ${stateName} dashboard HTML here`}</span>
        <span className="mt-1 text-[11.5px] text-[color:var(--theme-text-3)]">.html only, up to 15 MB</span>
        <input ref={input} type="file" accept=".html,text/html" className="sr-only" aria-label={`${stateName} dashboard HTML`} onChange={(event) => void send(event.target.files?.[0] ?? null)} />
      </label>

      {busy === "parse" && <p role="status" className="mt-3 flex items-center gap-2 text-[12px] text-[color:var(--theme-text-3)]"><Loader2 className="size-3.5 animate-spin" /> Reading the dashboard...</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-[color:var(--theme-negative)]/30 bg-[color:var(--theme-negative-soft)] px-3 py-2 text-[12px] text-[color:var(--theme-negative)]">{error}</p>}
      {published != null && <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-[color:var(--theme-positive)]/30 bg-[color:var(--theme-positive-soft)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--theme-positive)]"><CheckCircle2 className="size-4" aria-hidden />Published version {published} for {stateName}.</p>}
      {restored != null && <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-[color:var(--theme-positive)]/30 bg-[color:var(--theme-positive-soft)] px-3 py-2 text-[12.5px] font-semibold text-[color:var(--theme-positive)]"><CheckCircle2 className="size-4" aria-hidden />Restored version {restored} for {stateName}.</p>}

      {preview && (
        <div className="mt-4 rounded-xl border border-[color:var(--theme-border)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-[color:var(--theme-text)]">Preview · {preview.stateName}</p>
            <span className="text-[11px] text-[color:var(--theme-text-3)]">{new Intl.NumberFormat("en-IN").format(preview.n_total)} responses</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Campaigns" value={new Intl.NumberFormat("en-IN").format(preview.ads.campaigns)} note={preview.ads.label} />
            <Metric label="Ad accounts" value={new Intl.NumberFormat("en-IN").format(preview.ads.accounts)} />
            <Metric label="Reach" value={indianUnits(preview.ads.reach)} />
            <Metric label="Engagement" value={indianUnits(preview.ads.engagements)} />
            <Metric label="Date range" value={preview.range || "Not stated"} />
            <Metric label="Periods" value={String(preview.periods.length)} note={`${preview.periods.reduce((sum, period) => sum + period.months.length, 0)} months`} />
          </div>
          <ul className="mt-3 space-y-2 text-[11.5px] text-[color:var(--theme-text-2)]">
            {preview.periods.map((period) => (
              <li key={period.key} className="rounded-lg border border-[color:var(--theme-border)] px-2.5 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <b className="text-[color:var(--theme-text)]">{period.label}</b>
                  <span className="tabular-nums">{new Intl.NumberFormat("en-IN").format(period.n)} responses</span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-[color:var(--theme-text-3)]">{[period.from, period.to].filter(Boolean).join(" to ") || "Dates not stated"}</p>
                {period.months.length > 0 && <p className="mt-1 flex flex-wrap gap-1.5">{period.months.map((month) => <span key={month.label} className="rounded-full bg-[color:var(--theme-surface-2)] px-2 py-0.5 text-[10px] tabular-nums text-[color:var(--theme-text-3)]">{month.label} · {new Intl.NumberFormat("en-IN").format(month.n)}</span>)}</p>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => void send(file, true)} disabled={busy !== ""} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[color:var(--theme-selected)] px-4 text-[12px] font-semibold text-[color:var(--theme-selected-ink)] disabled:opacity-40">
            {busy === "publish" ? <Loader2 className="size-3.5 animate-spin" /> : null}Publish {stateName} dashboard
          </button>
        </div>
      )}

      {versions.length > 0 && (
        <details className="mt-4 rounded-xl border border-[color:var(--theme-border)] px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-semibold text-[color:var(--theme-text-2)]"><History className="size-3.5" /> Version history ({versions.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {versions.map((version) => (
              <li key={version.version} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[color:var(--theme-surface-2)] px-2.5 py-1.5 text-[11px]">
                <span className="min-w-0">
                  <span className="font-semibold text-[color:var(--theme-text)]">v{version.version}</span>
                  <span className="ml-2 text-[color:var(--theme-text-3)]">{stamp(version.uploadedAt)} · {version.uploadedBy ?? "Owner"}</span>
                  <span className="mt-0.5 block truncate text-[color:var(--theme-text-3)]" title={version.fileName}>{version.fileName}</span>
                </span>
                {version.active ? <span className="rounded-full border border-[color:var(--theme-border)] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--theme-text-2)]">Live</span> : <button type="button" onClick={() => void rollback(version.version)} disabled={busy !== ""} className={cn("inline-flex min-h-8 items-center rounded-full border border-[color:var(--theme-border)] px-2.5 text-[10.5px] font-semibold text-[color:var(--theme-link)] hover:border-[color:var(--theme-link)] disabled:opacity-40", busy === "rollback" && "opacity-50")}>Restore</button>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
