"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileJson, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   Telangana six-workbook pack import (admin only).

   The manifest hashes, 119-AC vote totals, 2028 cutoff counts, comparison
   row counts/numeric leaders and exact Entry ID/AC device join are checked
   before one activation record is written. The bundled validated snapshot
   is what the public page serves; no workbook formula text is evaluated.
   ===================================================================== */

type Expected = { key: string; name: string; sha256: string; description: string; expected?: { acs?: number; total?: number; rows?: number; cutoffRows?: number } };
type FileCheck = { key: string; name: string; present: boolean; sha256: string; expectedSha256: string; hashMatches: boolean; checks: string[]; warnings: string[]; error?: string };
type Preview = {
  ok: boolean; version: string; files: FileCheck[]; missing: string[]; warnings: string[];
  counts: {
    years: Record<string, { acs: number; total: number; winners: number }>;
    comparison?: { assemblies: number; swings: number; statistics: number; predictions: number };
    devices?: { rows: number; cutoffRows: number; uniqueEntryIds: number; acs: number; brandRows: number; totalEntries: number };
  };
};
type Meta = {
  importId: string; version: string; at: string; uploader: string; outcome: string;
  files: { key: string; name: string; sha256: string }[]; counts: Preview["counts"]; warnings: string[]; error?: string;
};
type Status = { configured: boolean; expected: Expected[]; active: Meta | null; history: Meta[] };

const short = (h: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");
const n = (v: number) => v.toLocaleString("en-IN");

export default function TelanganaAdmin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/telangana/pack");
    if (r.ok) setStatus(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(confirm: boolean) {
    if (!files.length) return;
    setBusy(true); setMsg(confirm ? "Publishing…" : "Validating six workbooks…");
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.set("confirm", confirm ? "1" : "0");
      const r = await fetch("/api/admin/telangana/pack", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg(d.error || "Pack validation failed");
        if (d.preview) setPreview(d.preview);
        return;
      }
      if (!confirm) {
        setPreview(d.preview);
        setMsg(`Read ${files.length} workbook(s). ${d.preview.ok ? "All hashes and counts reconcile — ready to publish." : "Resolve the highlighted issues."}`);
      } else {
        setMsg(`Activated ${d.result.version} · ${d.result.files.length} workbooks. The bundled validated snapshot now reports this activation.`);
        setPreview(null); setFiles([]);
        await load();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Pack import failed");
    } finally { setBusy(false); }
  }

  async function revert() {
    if (!confirm("Deactivate the pack activation and return to the bundled validated snapshot?")) return;
    setBusy(true); setMsg("Reverting…");
    try {
      const r = await fetch("/api/admin/telangana/pack", { method: "DELETE" });
      const d = await r.json();
      setMsg(r.ok && d.ok ? "Reverted to the bundled validated snapshot." : d.error || "Revert failed");
      await load();
    } finally { setBusy(false); }
  }

  const active = status?.active;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Telangana six-workbook pack</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted-foreground">
              Stage the 2014, 2018, 2023 and 2028 workbooks, the comparison/swing workbook and the device enrichment together.
              Preview re-hashes every file and reconciles 119 ACs, the supplied vote totals, the 2028 cutoff counts, the swing
              statistics/numeric leaders and the exact Entry ID/AC device join. Publish activates one record atomically; the
              bundled validated aggregates remain what the public page serves.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/admin/telangana/export?format=xlsx" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40">
              <FileSpreadsheet className="size-3.5" /> Aggregates .xlsx
            </a>
            <a href="/api/admin/telangana/export?format=json" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40">
              <FileJson className="size-3.5" /> Provenance .json
            </a>
            <button type="button" onClick={revert} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 disabled:opacity-50">
              <RotateCcw className="size-3.5" /> Bundled snapshot
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Database" value={status?.configured ? "Connected" : "Not configured"} />
          <Stat label="Active source" value={active ? "Admin pack" : "Bundled snapshot"} />
          <Stat label="Pack version" value={active?.version ?? "tg-2014-2028-v1"} />
          <Stat label="Last published" value={active ? new Date(active.at).toLocaleString() : "—"} />
        </div>

        <div className="mt-3 rounded-xl border border-border bg-background/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1 font-semibold text-foreground/80"><ShieldCheck className="size-3.5" /> Required workbooks</p>
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {(status?.expected ?? []).map((f) => (
              <div key={f.key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-foreground/75">{f.name}</span>
                <span className="text-[10px]">{[f.expected?.acs ? `${f.expected.acs} ACs` : "", f.expected?.total ? `${n(f.expected.total)} votes` : "", f.expected?.rows ? `${n(f.expected.rows)} rows` : "", f.expected?.cutoffRows ? `${n(f.expected.cutoffRows)} cutoff` : ""].filter(Boolean).join(" · ")}</span>
                <code className="text-[9.5px]">{short(f.sha256)}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-3 py-1.5 text-[12px] font-medium">
            <FileSpreadsheet className="size-3.5" />
            {files.length ? `${files.length} workbooks selected` : "Choose six .xlsx files"}
            <input type="file" accept=".xlsx" multiple className="hidden"
              onChange={(e) => { setFiles([...(e.target.files ?? [])]); setPreview(null); setMsg(""); }} />
          </label>
          <button type="button" onClick={() => run(false)} disabled={!files.length || busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 disabled:opacity-50">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Preview
          </button>
          <button type="button" onClick={() => run(true)} disabled={!files.length || !preview?.ok || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-[12px] font-semibold text-[#241203] hover:brightness-105 disabled:opacity-40">
            Publish
          </button>
          {msg && <span className="text-[11.5px] text-muted-foreground">{msg}</span>}
        </div>

        {files.length > 0 && !preview && (
          <p className="mt-2 text-[10.5px] text-muted-foreground">Selected: {files.map((f) => f.name).join(" · ")}</p>
        )}

        {preview && (
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-background/60 p-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn("rounded-full border px-2 py-0.5 font-medium", preview.ok ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-rose-500/40 text-rose-600 dark:text-rose-400")}>
                {preview.ok ? "Pack reconciles" : "Pack blocked"}
              </span>
              {preview.missing.length > 0 && <span className="text-rose-600 dark:text-rose-400">Missing: {preview.missing.join(", ")}</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[10.5px]">
                <thead><tr className="text-left text-[9px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1">Workbook</th><th className="px-2 py-1">SHA-256</th><th className="px-2 py-1">Checks</th><th className="px-2 py-1">Warnings</th></tr></thead>
                <tbody>
                  {preview.files.map((f) => (
                    <tr key={f.key} className="border-t border-border/60 align-top">
                      <td className="max-w-[210px] px-2 py-1.5"><span className="block truncate font-medium" title={f.name}>{f.name}</span><span className="text-[9px] text-muted-foreground">{f.present ? "present" : "missing"}</span></td>
                      <td className="px-2 py-1.5"><span className={cn("font-medium", f.hashMatches ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{f.present ? (f.hashMatches ? "matches" : "mismatch") : "—"}</span><br /><code className="text-[9px] text-muted-foreground" title={f.sha256}>{short(f.sha256)}</code></td>
                      <td className="px-2 py-1.5 text-muted-foreground">{f.checks.join(" · ") || "—"}</td>
                      <td className="max-w-[240px] px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">{f.warnings.join("; ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-2 text-[10.5px] text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/70">Historical years</p>
                {Object.entries(preview.counts.years).map(([y, v]) => <p key={y}>{y}: {v.acs} ACs · {n(v.total)} votes · {v.winners} winners</p>)}
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/70">Comparison workbook</p>
                {preview.counts.comparison ? <p>{preview.counts.comparison.assemblies} history rows · {preview.counts.comparison.swings} swing rows · {preview.counts.comparison.statistics} stats · {preview.counts.comparison.predictions} predictions</p> : <p>—</p>}
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-foreground/70">Device enrichment</p>
                {preview.counts.devices ? <p>{n(preview.counts.devices.rows)} matched · {n(preview.counts.devices.cutoffRows)} cutoff · {preview.counts.devices.uniqueEntryIds} unique IDs · {preview.counts.devices.acs} ACs</p> : <p>—</p>}
              </div>
            </div>
            {preview.warnings.length > 0 && <ul className="list-disc space-y-1 pl-4 text-[10.5px] text-amber-700 dark:text-amber-400">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold">Pack history</h3>
        {!status?.history.length && <p className="mt-1 text-[12px] text-muted-foreground">No pack activation yet — the bundled validated snapshot is live.</p>}
        <div className="mt-2 overflow-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">Version</th><th className="px-2 py-1.5">Files</th><th className="px-2 py-1.5">Outcome</th><th className="px-2 py-1.5">By</th><th className="px-2 py-1.5">Note</th></tr></thead>
            <tbody>
              {(status?.history ?? []).map((h) => (
                <tr key={h.importId + h.at} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-2 py-1.5">{new Date(h.at).toLocaleString()}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{h.version}</td>
                  <td className="px-2 py-1.5">{h.files.length}</td>
                  <td className={cn("px-2 py-1.5 font-medium", h.outcome === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{h.outcome}</td>
                  <td className="px-2 py-1.5">{h.uploader}</td>
                  <td className="max-w-[260px] truncate px-2 py-1.5 text-muted-foreground" title={h.error}>{h.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Raw answers and Entry IDs remain admin-only. Public pages expose aggregates and provenance only.</p>
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
