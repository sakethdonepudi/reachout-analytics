"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, FileSpreadsheet, LogOut, Loader2, Upload } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import { cn } from "@/lib/utils";

type Counts = { total: number; valid: number; blank: number; invalid: number; recorded: number; estimated: number };
type Summary = { pollType: "opinion" | "exit"; importId: string | null; counts: Counts; asOf: string | null };
type Shares = { denominator: number; shares: { party: string; count: number; pct: number }[] };
type Record_ = Record<string, unknown>;
type Meta = { importId: string; filename: string; uploader: string; at: string; outcome: string; mode: string; inserted: number; skipped: number; counts: Counts; error?: string };
type Preview = { file: string; preview: { opinion: Counts; exit: Counts; warnings: { sheet: string; row: number; field: string; reason: string }[]; errors: { sheet: string; row: number; field: string; reason: string }[]; canCommit: boolean } };

const EMPTY: Counts = { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 };

export default function DataPortal() {
  const router = useRouter();
  const [session, setSession] = useState<{ email: string; role: "admin" | "viewer" } | null>(null);
  const [ready, setReady] = useState(false);

  const [pollType, setPollType] = useState<"opinion" | "exit">("exit");
  const [view, setView] = useState<"recorded" | "scenario">("recorded");
  const [sum, setSum] = useState<{ opinion: Summary | null; exit: Summary | null; opinionShares: Shares; exitShares: Shares } | null>(null);
  const [records, setRecords] = useState<Record_[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [filters, setFilters] = useState({ party: "", status: "", geographyBasis: "", district: "", q: "" });
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [preview, setPreview] = useState<Preview["preview"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Meta[]>([]);

  useEffect(() => {
    fetch("/api/auth/session").then(async (r) => {
      if (!r.ok) { router.replace("/login"); return; }
      const d = await r.json();
      setSession({ email: d.email, role: d.role });
      setReady(true);
    });
  }, [router]);

  const loadSummary = useCallback(async () => {
    const r = await fetch(`/api/data/summary?view=${view}`);
    if (r.ok) setSum(await r.json());
  }, [view]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ pollType, skip: String(skip), limit: "50", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    const r = await fetch(`/api/data/records?${qs}`);
    if (r.ok) { const d = await r.json(); setRecords(d.records); setTotal(d.total); }
    setLoading(false);
  }, [pollType, skip, filters]);

  useEffect(() => { if (ready) loadSummary(); }, [ready, loadSummary]);
  useEffect(() => { if (ready) loadRecords(); }, [ready, loadRecords]);
  useEffect(() => {
    if (ready && session?.role === "admin") fetch("/api/data/history").then(async (r) => { if (r.ok) setHistory((await r.json()).history); });
  }, [ready, session]);

  const active = pollType === "opinion" ? sum?.opinion : sum?.exit;
  const shares = pollType === "opinion" ? sum?.opinionShares : sum?.exitShares;
  const c = active?.counts ?? EMPTY;

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }

  async function runImport(confirm: boolean) {
    if (!file) { setMessage("Choose an .xlsx file first."); return; }
    setBusy(true); setMessage("");
    const fd = new FormData();
    fd.set("file", file); fd.set("mode", mode); fd.set("confirm", confirm ? "1" : "0");
    try {
      const r = await fetch("/api/data/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { setMessage(d.error || "Import failed"); if (d.preview) setPreview(d.preview); if (d.errors) setPreview((p) => p && { ...p, errors: d.errors }); return; }
      if (confirm) { setMessage(`Imported. Exit: +${d.results?.[1]?.inserted ?? 0}, Opinion: +${d.results?.[0]?.inserted ?? 0} rows.`); setPreview(null); await loadSummary(); await loadRecords(); }
      else { setPreview(d.preview); setMessage(`Validated ${d.file}. ${d.preview.canCommit ? "Ready to import." : "Resolve errors before importing."}`); }
    } catch { setMessage("Import failed"); }
    finally { setBusy(false); }
  }

  const pageCount = Math.max(1, Math.ceil(total / 50));
  const page = Math.floor(skip / 50) + 1;

  const card = (label: string, value: number) => (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );

  if (!ready) return <main className="grid min-h-[100svh] place-items-center bg-background text-muted-foreground"><Loader2 className="size-5 animate-spin" /></main>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4"><Logo /><span className="hidden text-[12px] text-muted-foreground sm:block">Data portal</span></div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[12px] text-muted-foreground sm:block">{session?.email} · {session?.role}</span>
            <Link href="/" className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">Site</Link>
            <ThemeToggle className="size-9" />
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        {/* controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-border bg-card/60 p-1 text-[13px] font-semibold">
            {(["opinion", "exit"] as const).map((t) => (
              <button key={t} onClick={() => { setPollType(t); setSkip(0); }} className={cn("rounded-lg px-3 py-1.5 capitalize", pollType === t ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground")}>{t === "opinion" ? "Opinion Poll" : "Exit Poll"}</button>
            ))}
          </div>
          <div className="inline-flex rounded-xl border border-border bg-card/60 p-1 text-[13px] font-semibold">
            {(["recorded", "scenario"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5", view === v ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground")}>{v === "recorded" ? "Recorded geography" : "Estimated scenario"}</button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <a href="/api/data/template" className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] hover:bg-elevated"><FileSpreadsheet className="size-4" /> Template</a>
            <a href="/api/data/export" className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] hover:bg-elevated"><Download className="size-4" /> Export Excel</a>
          </div>
        </div>

        {view === "scenario" && (
          <p className="mt-3 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">Includes estimated districts — records without recorded geography are allocated to a scenario district and are not verified respondent locations.</p>
        )}

        {/* summary cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {card("Total records", c.total)}
          {card("Valid party", c.valid)}
          {card("Blank party", c.blank)}
          {card("Invalid party", c.invalid)}
          {card("Recorded district", c.recorded)}
          {card("Estimated district", c.estimated)}
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Percentages use valid party responses as the denominator ({shares?.denominator.toLocaleString("en-IN") ?? 0}).
          {active?.asOf ? ` Last import ${new Date(active.asOf).toLocaleString()}.` : " No dataset imported yet."}
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {/* party shares */}
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Party shares · {view === "scenario" ? "estimated scenario" : "recorded geography"}</h2>
              {shares && shares.shares.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {shares.shares.map((s) => (
                    <li key={s.party} className="flex items-center gap-3 text-[13px]">
                      <span className="w-48 shrink-0 truncate text-foreground/80">{s.party}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} /></span>
                      <span className="w-24 text-right tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-[13px] text-muted-foreground">No data available for {pollType === "opinion" ? "Opinion Poll" : "Exit Poll"} yet.</p>}
            </div>

            {/* records */}
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input placeholder="Search Response ID…" value={filters.q} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, q: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] outline-none focus:border-saffron/60" />
                <select value={filters.status} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, status: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-2.5 py-2 text-[13px]"><option value="">All statuses</option><option value="valid">Valid</option><option value="blank">Blank</option><option value="invalid">Invalid</option></select>
                <select value={filters.geographyBasis} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, geographyBasis: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-2.5 py-2 text-[13px]"><option value="">All geography</option><option value="Recorded or source-mapped district">Recorded</option><option value="Estimated allocation">Estimated</option></select>
                <input placeholder="District…" value={filters.district} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, district: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] outline-none focus:border-saffron/60" />
                <span className="ml-auto text-[12px] text-muted-foreground">{total.toLocaleString("en-IN")} records</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-[12.5px]">
                  <thead><tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {["Response ID", "Party", "Status", "District", "Estimated", "Geography basis", "Zone"].map((h) => <th key={h} className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={(r["Response ID"] as string) || i} className="border-b border-border/60">
                        <td className="px-2 py-1.5 tabular-nums">{String(r["Response ID"] ?? "")}</td>
                        <td className="px-2 py-1.5">{String(r["Party"] ?? "")}</td>
                        <td className="px-2 py-1.5">{String(r["Response Status"] ?? "")}</td>
                        <td className="px-2 py-1.5">{String(r["District"] ?? "—")}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{String(r["Estimated District"] ?? "—")}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{String(r["Geography Basis"] ?? "—")}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{String(r["Zone"] ?? "—")}</td>
                      </tr>
                    ))}
                    {records.length === 0 && <tr><td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">{loading ? "Loading…" : "No records"}</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12.5px]">
                <span className="text-muted-foreground">Page {page} / {pageCount}</span>
                <div className="flex gap-2">
                  <button disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - 50))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Previous</button>
                  <button disabled={skip + 50 >= total} onClick={() => setSkip((s) => s + 50)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-50">Next</button>
                </div>
              </div>
            </div>
          </div>

          {/* import (admin) + history */}
          <aside className="space-y-4">
            {session?.role === "admin" && (
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Upload className="size-4" /> Import Excel</h2>
                <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setMessage(""); }} className="mt-3 block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-foreground" />
                <div className="mt-3 flex gap-2 text-[12.5px]">
                  {(["append", "replace"] as const).map((m) => (
                    <label key={m} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5", mode === m ? "border-saffron/60 bg-saffron/10" : "border-border")}>
                      <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {m === "append" ? "Append" : "Replace dataset"}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-muted-foreground">{mode === "replace" ? "Replaces the active dataset atomically (each poll type separately)." : "Adds new rows; duplicate Response IDs are rejected."}</p>
                <div className="mt-3 flex gap-2">
                  <button disabled={busy} onClick={() => runImport(false)} className="flex-1 rounded-xl border border-border px-3 py-2 text-[12.5px] font-medium hover:bg-elevated disabled:opacity-60">{busy ? "Validating…" : "Validate & preview"}</button>
                  <button disabled={busy || !preview?.canCommit} onClick={() => runImport(true)} className="flex-1 rounded-xl bg-saffron px-3 py-2 text-[12.5px] font-semibold text-[#241203] disabled:opacity-50">Confirm import</button>
                </div>
                {message && <p className="mt-3 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[12px]">{message}</p>}
                {preview && (
                  <div className="mt-3 space-y-2 text-[12px]">
                    <div className="rounded-lg border border-border p-2.5">
                      <p className="font-semibold">Opinion Poll</p>
                      <p className="text-muted-foreground">{preview.opinion.total} rows · {preview.opinion.valid} valid · {preview.opinion.blank} blank · {preview.opinion.invalid} invalid</p>
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                      <p className="font-semibold">Exit Poll</p>
                      <p className="text-muted-foreground">{preview.exit.total} rows · {preview.exit.valid} valid · {preview.exit.blank} blank · {preview.exit.invalid} invalid · {preview.exit.recorded} recorded · {preview.exit.estimated} estimated</p>
                    </div>
                    {preview.errors.length > 0 && <p className="text-saffron-2">{preview.errors.length} error(s) — see report</p>}
                  </div>
                )}
              </div>
            )}

            {session?.role === "admin" && (
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Import history</h2>
                {history.length === 0 ? <p className="mt-2 text-[12.5px] text-muted-foreground">No imports yet.</p> : (
                  <ul className="mt-3 space-y-2 text-[12px]">
                    {history.map((h) => (
                      <li key={h.importId + h.at} className="rounded-lg border border-border p-2.5">
                        <p className="truncate font-medium">{h.filename}</p>
                        <p className="text-muted-foreground">{new Date(h.at).toLocaleString()} · {h.uploader}</p>
                        <p className={cn(h.outcome === "success" ? "text-[#2fbf4a]" : "text-saffron-2")}>{h.outcome} · {h.mode} · +{h.inserted}{h.skipped ? ` · ${h.skipped} skipped` : ""}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-dashed border-border p-4 text-[11.5px] leading-relaxed text-muted-foreground">
              Recorded geography uses the <b className="text-foreground/80">District</b> field. The estimated scenario uses <b className="text-foreground/80">District for Scenario</b> and is clearly labelled. Survey shares are not calibrated against election results here.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
