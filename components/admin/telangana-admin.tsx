"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   Telangana October workbook import (admin only).

   The new schema is Data (Entry ID, Entry Date, AC No, AC Name, District,
   Zone, 2023 Vote, 2028 Vote) plus the 2023 ECI and projection sheets.
   Preview writes nothing; Publish re-checks the contract SHA-256 and only
   then atomically activates the validated snapshot. Formulas are never
   evaluated.
   ===================================================================== */

type Meta = {
  importId: string; version: string; sourceHash: string; filename: string; uploader: string;
  at: string; outcome: string; rows: number; distinctEntryIds: number; cutoffRows: number;
  answered2028: number; blank2028: number; answeredRecall2023: number; blankRecall2023: number;
  acs: number; districts: number; overrideVersion: string; error?: string;
};
type Contract = {
  version: string; sourceFile: string; sourceHash: string; cutoff: string; shrinkFactor: number;
  overrideVersion: string; devicesAvailable: boolean; pinDataAvailable: boolean;
  counts: { sourceIds: number; cutoffRows: number; answered2028: number; blank2028: number; answeredRecall2023: number; blankRecall2023: number; acs: number; districts: number };
  parties: string[];
};
type Preview = {
  ok: boolean; error?: string; sheet: string; version: string; expectedHash: string; uploadedHash: string;
  hashMatches: boolean; cutoff: string; rows: number; distinctEntryIds: number; cutoffRows: number;
  answered2028: number; blank2028: number; answeredRecall2023: number; blankRecall2023: number;
  acs: number; districts: number; missingAc: number; matchesPackaged: boolean; warnings: string[];
  expected: Contract["counts"];
};
type Status = { configured: boolean; contract: Contract; active: Meta | null; history: Meta[] };

const short = (h: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
const n = (v: number) => v.toLocaleString("en-IN");

export default function TelanganaAdmin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/telangana/import");
    if (r.ok) setStatus(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(confirm: boolean) {
    if (!file) return;
    setBusy(true); setMsg(confirm ? "Publishing…" : "Reading workbook…");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("confirm", confirm ? "1" : "0");
      const r = await fetch("/api/admin/telangana/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "Import failed");
        if (d.preview) setPreview(d.preview);
        return;
      }
      if (!confirm) {
        setPreview(d.preview);
        setMsg(`Parsed ${file.name}. ${d.preview.ok ? "Hash and counts reconcile — ready to publish." : "Resolve the errors before publishing."}`);
      } else {
        setMsg(`Activated ${d.result.version} · ${n(d.result.rows)} rows · ${n(d.result.answered2028)} answered. The public snapshot now reports this import.`);
        setPreview(null); setFile(null);
        await load();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  async function revert() {
    if (!confirm("Deactivate the admin import and return to the bundled validated snapshot?")) return;
    setBusy(true); setMsg("Reverting…");
    try {
      const r = await fetch("/api/admin/telangana/import", { method: "DELETE" });
      const d = await r.json();
      setMsg(r.ok && d.ok ? "Reverted to the bundled validated snapshot." : d.error || "Revert failed");
      await load();
    } finally { setBusy(false); }
  }

  const c = status?.contract;
  const active = status?.active;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Telangana October workbook</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
              Import the <b>{c?.version ?? "tg-oct20-v1"}</b> workbook as a staged snapshot. The new <b>Data</b> sheet is read by
              header (Entry ID, Entry Date, AC No, District, 2023 Vote, 2028 Vote); preview reconciles the cutoff counts and
              verifies the file against the contract SHA-256. Publish activates atomically only when the hash matches the
              validated aggregate snapshot. No Excel formula is evaluated and no respondent rows are exposed publicly.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/admin/telangana/export" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40">
              <Download className="size-3.5" /> Export provenance
            </a>
            <button type="button" onClick={revert} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 disabled:opacity-50">
              <RotateCcw className="size-3.5" /> Bundled snapshot
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Database" value={status?.configured ? "Connected" : "Not configured"} />
          <Stat label="Active source" value={active ? (active.filename === "bundled-validated-snapshot" ? "Bundled snapshot" : "Admin import") : "Bundled snapshot"} />
          <Stat label="Active counts" value={active ? `${n(active.rows)} / ${n(active.distinctEntryIds)} IDs` : c ? `${n(c.counts.sourceIds)} / ${n(c.counts.sourceIds)} IDs` : "—"} />
          <Stat label="Last published" value={active ? new Date(active.at).toLocaleString() : "—"} />
        </div>

        {c && (
          <div className="mt-3 rounded-xl border border-border bg-background/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1 font-semibold text-foreground/80"><ShieldCheck className="size-3.5" /> Contract</span>
              <span>Version <b className="text-foreground/80">{c.version}</b></span>
              <span>Cutoff <b className="text-foreground/80">{c.cutoff}</b></span>
              <span>k = <b className="text-foreground/80">{c.shrinkFactor}</b></span>
              <span>Overrides <b className="text-foreground/80">{c.overrideVersion}</b></span>
              <span>Devices <b className="text-foreground/80">{c.devicesAvailable ? "available" : "not in source"}</b></span>
              <span>PINs <b className="text-foreground/80">{c.pinDataAvailable ? "available" : "not in source"}</b></span>
            </p>
            <p className="mt-1 break-all">SHA-256 <code className="text-[10.5px] text-foreground/70">{c.sourceHash}</code></p>
            <p className="mt-1">Expected snapshot: {n(c.counts.sourceIds)} IDs · {n(c.counts.cutoffRows)} rows after cutoff · {n(c.counts.answered2028)} answered 2028 · {n(c.counts.blank2028)} blank · {n(c.counts.answeredRecall2023)} recall 2023 · {c.counts.acs} ACs · {c.counts.districts} groups.</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-3 py-1.5 text-[12px] font-medium">
            <FileSpreadsheet className="size-3.5" />
            {file ? file.name : "Choose .xlsx"}
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMsg(""); }} />
          </label>
          <button type="button" onClick={() => run(false)} disabled={!file || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 disabled:opacity-50">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Preview
          </button>
          <button type="button" onClick={() => run(true)} disabled={!file || !preview?.ok || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-[12px] font-semibold text-[#241203] hover:brightness-105 disabled:opacity-40">
            Publish
          </button>
          {msg && <span className="text-[11.5px] text-muted-foreground">{msg}</span>}
        </div>

        {preview && (
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
              <span>Sheet <b>{preview.sheet}</b></span>
              <span>Rows <b>{n(preview.rows)}</b></span>
              <span>Entry IDs <b>{n(preview.distinctEntryIds)}</b></span>
              <span>After cutoff <b>{n(preview.cutoffRows)}</b></span>
              <span>Answered 2028 <b>{n(preview.answered2028)}</b></span>
              <span>Blank 2028 <b>{n(preview.blank2028)}</b></span>
              <span>Recall 2023 <b>{n(preview.answeredRecall2023)}</b></span>
              <span>ACs <b>{preview.acs}</b></span>
              <span>Groups <b>{preview.districts}</b></span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", preview.hashMatches ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-rose-500/40 text-rose-600 dark:text-rose-400")}>
                Hash {preview.hashMatches ? "matches contract" : "does not match"}
              </span>
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", preview.matchesPackaged ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>
                {preview.matchesPackaged ? "Counts reconcile" : "Counts differ"}
              </span>
              {preview.missingAc > 0 && <span className="rounded-full border border-rose-500/40 px-2 py-0.5 font-medium text-rose-600 dark:text-rose-400">{preview.missingAc} rows without AC</span>}
            </div>
            <p className="mt-1.5 break-all text-[10px] text-muted-foreground">Uploaded SHA-256 <code>{preview.uploadedHash}</code></p>
            {preview.error && <p className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-400">{preview.error}</p>}
            {preview.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-700 dark:text-amber-400">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold">Import history</h3>
        {!status?.history.length && <p className="mt-1 text-[12px] text-muted-foreground">No admin import for this contract yet — the bundled validated snapshot is live.</p>}
        <div className="mt-2 overflow-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">File</th><th className="px-2 py-1.5">Version</th>
                <th className="px-2 py-1.5">Hash</th><th className="px-2 py-1.5">Outcome</th>
                <th className="px-2 py-1.5 text-right">Rows</th><th className="px-2 py-1.5 text-right">Answered</th>
                <th className="px-2 py-1.5">By</th><th className="px-2 py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {(status?.history ?? []).map((h) => (
                <tr key={h.importId + h.at} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-2 py-1.5">{new Date(h.at).toLocaleString()}</td>
                  <td className="max-w-[170px] truncate px-2 py-1.5" title={h.filename}>{h.filename}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{h.version}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]" title={h.sourceHash}>{short(h.sourceHash)}</td>
                  <td className={cn("px-2 py-1.5 font-medium", h.outcome === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{h.outcome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{n(h.rows)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{n(h.answered2028)}</td>
                  <td className="px-2 py-1.5">{h.uploader}</td>
                  <td className="max-w-[220px] truncate px-2 py-1.5 text-muted-foreground" title={h.error}>{h.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-2">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold">{value}</p>
    </div>
  );
}
