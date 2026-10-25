"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Map as MapIcon, RefreshCw } from "lucide-react";

const GROUPS = ["TVK", "AIADMK+BJP+PMK+AMMK", "DMK+INC+VCK", "NTK", "NOTA"] as const;
type Counts = Record<(typeof GROUPS)[number], number>;
type Survey = { valid: number; counts: Counts; shares: Record<string, number> };
type Preview = {
  bundleVersion: string;
  allocationVersion: string;
  method: string;
  sourceImportId: string;
  sourceHash: string;
  priority: string;
  recorded: { assembly: Counts; district: Counts; districtOnly: Counts; unlocated: Counts; statewide: Counts };
  allocated: { districtOnly: Counts; unlocated: Counts };
  combined: { assembly: Counts; district: Counts; statewide: Counts };
  reconcile: { assemblyRecorded: number; districtOnlyAllocated: number; unlocatedAllocated: number; combinedAssembly: number; combinedDistrict: number; combinedStatewide: number; partyTotalsUnchanged: boolean; acDistrictEqual: boolean; districtStateEqual: boolean; noDoubleCount: boolean };
  workbook: { projectedSeats: Counts; accuracy: number; note: string };
  districts: { name: string; acs: number; recorded: Survey; allocatedDistrictOnly: Counts; allocatedUnlocated: Counts; combined: Survey & { leader: string | null; marginPp: number }; projectedSeats: Counts }[];
  published: { publishedAt: string; allocationVersion: string; sourceImportId: string; sourceHash: string; matchesCurrent: boolean } | null;
};
const total = (c: Counts) => GROUPS.reduce((s, g) => s + (c[g] ?? 0), 0);
const n = (v: number) => v.toLocaleString("en-IN");

export default function TamilNaduAdmin() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/tamil-nadu/allocation", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load allocation preview");
      setPreview(d.preview);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load allocation preview"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function publish() {
    if (!confirm) { setMessage("Tick the confirmation box before publishing."); return; }
    setPublishing(true); setMessage("Publishing…");
    try {
      const r = await fetch("/api/admin/tamil-nadu/allocation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Publish failed");
      setPreview(d.preview);
      setConfirm(false);
      setMessage("Allocation published. The public aggregate endpoint now serves this version.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Publish failed"); }
    finally { setPublishing(false); }
  }

  if (loading && !preview) return <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-[12px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading geographic allocation preview…</div>;
  if (!preview) return <div className="mt-4 rounded-xl border border-border bg-card/60 px-4 py-3 text-[12px] text-muted-foreground">{message || "No allocation preview available."}</div>;

  const ok = preview.reconcile.partyTotalsUnchanged && preview.reconcile.acDistrictEqual && preview.reconcile.districtStateEqual && preview.reconcile.noDoubleCount;
  return (
    <section className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><MapIcon className="size-4" /> Tamil Nadu geographic allocation</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Aggregate allocation of the existing 882 district-only and 19,867 location-missing votes. Recorded source counts are preserved separately.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/tamil-nadu/export?format=xlsx" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11.5px] hover:bg-elevated"><Download className="size-3.5" /> Export allocation</a>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11.5px] hover:bg-elevated"><RefreshCw className="size-3.5" /> Refresh preview</button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-elevated/30 p-3 text-[11.5px] text-muted-foreground">
        <p><b className="text-foreground/85">Method:</b> {preview.method}</p>
        <p className="mt-1"><b className="text-foreground/85">Version:</b> <span className="font-mono">{preview.allocationVersion}</span> · <b className="text-foreground/85">Source import:</b> <span className="font-mono">{preview.sourceImportId}</span> · <b className="text-foreground/85">Priority:</b> {preview.priority}</p>
        <p className="mt-1"><b className="text-foreground/85">Source SHA-256:</b> <span className="break-all font-mono">{preview.sourceHash}</span></p>
        <p className="mt-1">{preview.published ? <>Published {new Date(preview.published.publishedAt).toLocaleString()} · {preview.published.allocationVersion} · {preview.published.matchesCurrent ? "✓ matches current bundle" : "⚠ published version differs from current bundle"}</> : "Not published yet. The build snapshot remains active until publish."}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Recorded assembly", preview.reconcile.assemblyRecorded],
          ["District-only allocated", preview.reconcile.districtOnlyAllocated],
          ["Unlocated allocated", preview.reconcile.unlocatedAllocated],
          ["Combined assembly", preview.reconcile.combinedAssembly],
          ["Combined district", preview.reconcile.combinedDistrict],
          ["Combined statewide", preview.reconcile.combinedStatewide],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-elevated/40 px-3 py-2"><p className="font-display text-lg font-semibold tabular-nums">{n(Number(value))}</p><p className="text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground">{String(label)}</p></div>)}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-[10.5px]"><caption className="sr-only">Party allocation totals</caption>
          <thead><tr className="bg-muted/30 text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">Party / group</th><th className="px-2 py-1.5 text-right">Recorded assembly</th><th className="px-2 py-1.5 text-right">District-only</th><th className="px-2 py-1.5 text-right">Unlocated</th><th className="px-2 py-1.5 text-right">Combined</th></tr></thead>
          <tbody>{GROUPS.map((g) => <tr key={g} className="border-t border-border/60"><td className="px-2 py-1 font-medium">{g}</td><td className="px-2 py-1 text-right tabular-nums">{n(preview.recorded.assembly[g])}</td><td className="px-2 py-1 text-right tabular-nums">{n(preview.allocated.districtOnly[g])}</td><td className="px-2 py-1 text-right tabular-nums">{n(preview.allocated.unlocated[g])}</td><td className="px-2 py-1 text-right font-semibold tabular-nums">{n(preview.combined.statewide[g])}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px]">
        <span className={ok ? "text-[#2fbf4a]" : "text-rose-500"}>{ok ? "✓ reconciliation passed" : "⚠ reconciliation failed"}</span>
        <span className={preview.reconcile.partyTotalsUnchanged ? "text-[#2fbf4a]" : "text-rose-500"}>{preview.reconcile.partyTotalsUnchanged ? "✓ party totals unchanged" : "⚠ party totals changed"}</span>
        <span className={preview.reconcile.acDistrictEqual ? "text-[#2fbf4a]" : "text-rose-500"}>{preview.reconcile.acDistrictEqual ? "✓ AC = district" : "⚠ AC/district mismatch"}</span>
        <span className={preview.reconcile.districtStateEqual ? "text-[#2fbf4a]" : "text-rose-500"}>{preview.reconcile.districtStateEqual ? "✓ district = state" : "⚠ district/state mismatch"}</span>
        <span className={preview.reconcile.noDoubleCount ? "text-[#2fbf4a]" : "text-rose-500"}>{preview.reconcile.noDoubleCount ? "✓ no double count" : "⚠ double count"}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <div className="max-h-64 overflow-auto">
          <table className="w-full min-w-[680px] border-collapse text-[10.5px]">
            <caption className="sr-only">District geographic allocation reconciliation</caption>
            <thead className="sticky top-0 z-10 bg-card"><tr className="text-left text-[8.5px] uppercase tracking-wide text-muted-foreground"><th className="px-2 py-1.5">District</th><th className="px-2 py-1.5 text-right">ACs</th><th className="px-2 py-1.5 text-right">Recorded</th><th className="px-2 py-1.5 text-right">District-only</th><th className="px-2 py-1.5 text-right">Unlocated</th><th className="px-2 py-1.5 text-right">Combined</th><th className="px-2 py-1.5">Combined leader</th></tr></thead>
            <tbody>{preview.districts.map((d) => <tr key={d.name} className="border-t border-border/60"><td className="px-2 py-1 font-medium">{d.name}</td><td className="px-2 py-1 text-right tabular-nums text-muted-foreground">{d.acs}</td><td className="px-2 py-1 text-right tabular-nums">{n(d.recorded.valid)}</td><td className="px-2 py-1 text-right tabular-nums">{n(total(d.allocatedDistrictOnly))}</td><td className="px-2 py-1 text-right tabular-nums">{n(total(d.allocatedUnlocated))}</td><td className="px-2 py-1 text-right font-semibold tabular-nums">{n(d.combined.valid)}</td><td className="px-2 py-1 text-muted-foreground">{d.combined.leader ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">Recorded-only values, workbook-original adjusted projections and all allocation components are included in the Excel/JSON export. Historical and Actual 2026 results are unchanged.</p>
      <label className="mt-3 flex items-center gap-2 text-[12px]"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I confirm I want to publish this allocation to the public Tamil Nadu aggregate endpoint.</label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={publishing || !confirm || !ok} onClick={() => void publish()} className="rounded-xl bg-saffron px-3 py-2 text-[12.5px] font-semibold text-[#241203] disabled:opacity-50">{publishing ? "Publishing…" : "Publish allocation"}</button>
        {message && <span className="text-[11.5px] text-muted-foreground">{message}</span>}
      </div>
    </section>
  );
}
