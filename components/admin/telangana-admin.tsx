"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   Telangana scenario import (admin only).

   The mapper reads the workbook by header (2028 party ← column B, AC
   number ← the leading integer, group ← "AC District (from AC column)").
   Adjusted C/D values are preserved as provenance and never used as the
   2028 party. Preview writes nothing; Publish admits only after every row
   has been inserted, so a failed import cannot replace the live dataset.
   ===================================================================== */

type Meta = {
  importId: string; caseStudy: string; pollType: string; basis: string; filename: string;
  uploader: string; at: string; outcome: string; mode: string; rows: number;
  answered: number; blank: number; acs: number; groups: number; error?: string;
};
type Preview = {
  ok: boolean; error?: string; sheet: string; headers: string[]; rows: number;
  answered: number; blank: number; acs: number; groups: number;
  byParty: Record<string, number>; missingAc: number; missingGroup: number;
  duplicatedSourceRows: number; adjusted2023Present: number; warnings: string[];
  expected: { rows: number; answered: number; blank: number };
};

export default function TelanganaAdmin() {
  const [status, setStatus] = useState<{ configured: boolean; active: Meta | null; history: Meta[] } | null>(null);
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
      fd.set("mode", "replace");
      fd.set("confirm", confirm ? "1" : "0");
      const r = await fetch("/api/admin/telangana/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { setMsg(d.error || "Import failed"); if (d.preview) setPreview(d.preview); return; }
      if (!confirm) {
        setPreview(d.preview);
        setMsg(`Parsed ${file.name}. ${d.preview.ok ? "Ready to publish." : "Resolve the errors before publishing."}`);
      } else {
        setMsg(`Published ${d.result.rows.toLocaleString("en-IN")} rows (${d.result.answered.toLocaleString("en-IN")} answered). The public aggregates now use this import.`);
        setPreview(null); setFile(null);
        await load();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally { setBusy(false); }
  }

  async function revert() {
    if (!confirm("Revert the public Telangana aggregates to the bundled baseline?")) return;
    setBusy(true); setMsg("Reverting…");
    try {
      const r = await fetch("/api/admin/telangana/import", { method: "DELETE" });
      const d = await r.json();
      setMsg(r.ok && d.ok ? "Reverted to the bundled baseline." : d.error || "Revert failed");
      await load();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Telangana scenario import</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
              Publish a 2028 opinion-survey scenario workbook. The mapper reads column B for the 2028 party, the leading integer of
              “Assembly Constituency” for the AC number and “AC District (from AC column)” for the analytical grouping. Columns C/D are
              kept as provenance only. Repeated rows are retained with a deterministic scenario id — they are not new respondents.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/api/admin/telangana/export" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40">
              <Download className="size-3.5" /> Export
            </a>
            <button type="button" onClick={revert} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted/40 disabled:opacity-50">
              <RotateCcw className="size-3.5" /> Revert to bundled
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Database" value={status?.configured ? "Connected" : "Not configured"} />
          <Stat label="Active source" value={status?.active ? (status.active.importId === "bundled-baseline" ? "Bundled baseline" : "Admin import") : "Bundled baseline"} />
          <Stat label="Rows / answered" value={status?.active ? `${status.active.rows.toLocaleString("en-IN")} / ${status.active.answered.toLocaleString("en-IN")}` : "30,000 / 27,460"} />
          <Stat label="Last published" value={status?.active ? new Date(status.active.at).toLocaleString() : "—"} />
        </div>

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
              <span>Rows <b>{preview.rows.toLocaleString("en-IN")}</b></span>
              <span>Answered <b>{preview.answered.toLocaleString("en-IN")}</b></span>
              <span>Blank <b>{preview.blank.toLocaleString("en-IN")}</b></span>
              <span>ACs <b>{preview.acs}</b></span>
              <span>Groups <b>{preview.groups}</b></span>
              <span>Repeated source rows <b>{preview.duplicatedSourceRows.toLocaleString("en-IN")}</b></span>
              <span>Adjusted C/D present <b>{preview.adjusted2023Present.toLocaleString("en-IN")}</b></span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {Object.entries(preview.byParty).map(([p, n]) => (
                <span key={p} className="rounded-full border border-border px-2 py-0.5">{p} <b>{n.toLocaleString("en-IN")}</b></span>
              ))}
            </div>
            {(preview.missingAc > 0 || preview.missingGroup > 0) && (
              <p className="mt-2 text-[11.5px] text-rose-600 dark:text-rose-400">
                {preview.missingAc} rows have no valid AC number{preview.missingGroup ? `; ${preview.missingGroup} have no district grouping` : ""}. Publishing is blocked.
              </p>
            )}
            {preview.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-700 dark:text-amber-400">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <p className="mt-2 text-[10.5px] text-muted-foreground">
              Expected from the supplied pack: {preview.expected.rows.toLocaleString("en-IN")} rows · {preview.expected.answered.toLocaleString("en-IN")} answered · {preview.expected.blank.toLocaleString("en-IN")} blank.
              A row-count difference is a warning, not an error.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold">Import history</h3>
        {!status?.history.length && <p className="mt-1 text-[12px] text-muted-foreground">No Telangana imports yet — the bundled baseline is live.</p>}
        <div className="mt-2 overflow-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5">When</th><th className="px-2 py-1.5">File</th><th className="px-2 py-1.5">Outcome</th>
                <th className="px-2 py-1.5 text-right">Rows</th><th className="px-2 py-1.5 text-right">Answered</th><th className="px-2 py-1.5">By</th><th className="px-2 py-1.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {(status?.history ?? []).map((h) => (
                <tr key={h.importId + h.at} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-2 py-1.5">{new Date(h.at).toLocaleString()}</td>
                  <td className="max-w-[180px] truncate px-2 py-1.5" title={h.filename}>{h.filename}</td>
                  <td className={cn("px-2 py-1.5 font-medium", h.outcome === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{h.outcome}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{h.rows.toLocaleString("en-IN")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{h.answered.toLocaleString("en-IN")}</td>
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
