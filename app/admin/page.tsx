"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, FileSpreadsheet, History, LayoutDashboard, LogOut, Loader2, Map as MapIcon, Settings, Table2, Upload, UserCog } from "lucide-react";
import { Logo } from "@/components/site/navbar";
import ThemeToggle from "@/components/site/theme-toggle";
import AboutEditor from "@/components/admin/about-editor";
import { cn } from "@/lib/utils";
import type { Row as PollRow } from "@/lib/poll-data";

type Counts = { total: number; valid: number; blank: number; invalid: number; recorded: number; estimated: number };
type Summary = { pollType: string; importId: string | null; counts: Counts; asOf: string | null };
type Shares = { denominator: number; shares: { party: string; count: number; pct: number }[] };
type CaseRecord = { id: string; slug: string; title: string; state: string; electionYear: number; published: boolean; description?: string };
type Meta = { importId: string; caseStudyId: string; pollType: string; filename: string; uploader: string; at: string; outcome: string; mode: string; inserted: number; skipped: number; counts: Counts; error?: string };
type Preview = { opinion: Counts; exit: Counts; warnings: { sheet: string; row: number; field: string; reason: string }[]; errors: { sheet: string; row: number; field: string; reason: string }[]; canCommit: boolean };
type Row_ = Record<string, unknown>;
type PinDistrictBlock = {
  district: string; districtBasis: string; total: number; valid: number;
  recordedPin: number; assigned: number; unresolved: number;
  byParty: Record<string, number>;
  byPin: { pin: string; total: number; valid: number; parties: Record<string, number> }[];
};
type PinScenarioSummary = {
  total: number; valid: number;
  recordedPin: number; eligible: number; assigned: number; unresolved: number; coverageAssigned: number;
  byBasis: Record<string, number>;
  byEligibleSource: Record<string, number>;
  byParty: Record<string, number>;
  byDistrict: PinDistrictBlock[];
  districtsWithoutCandidates: string[];
  unresolvedGeography: { noDistrict: number; noCandidates: string[] };
  ambiguousPins: string[];
  reference: { name: string; source: string; version: string; note: string };
  crosswalk: { constituencies: number; version: string; source: string };
  allocationVersion: string;
  reconcile: { assignedPlusUnresolved: number; eligible: number; ok: boolean; partyOk: boolean; pinDistrictOk: boolean };
};
type PinScenarioPreview = {
  ok: boolean; reason?: string; importId: string | null; includeEstimated: boolean;
  summary: PinScenarioSummary;
  baseline: { total: number; valid: number; shares: { party: string; count: number; pct: number }[] };
  appliedImportId: string | null; appliedAt: string | null; datasetChanged: boolean;
  allocationVersion: string; asOf: string | null;
};
type PinScenarioInfo = { appliedAt?: string; importId?: string; includeEstimated?: boolean; allocationVersion?: string; summary?: PinScenarioSummary } | null;

const PIN_BASIS_ROWS: { key: string; label: string }[] = [
  { key: "recorded", label: "Recorded PIN" },
  { key: "reference-derived", label: "Reference-derived" },
  { key: "district-assumption", label: "District-based assumption" },
  { key: "estimated-district-assumption", label: "Estimated district-based assumption" },
  { key: "coverage-zone-assumption", label: "Coverage/zone-based assumption" },
  { key: "unassigned", label: "Unassigned" },
];

const EMPTY: Counts = { total: 0, valid: 0, blank: 0, invalid: 0, recorded: 0, estimated: 0 };
const SECTIONS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "cases", label: "Case Studies", Icon: MapIcon },
  { id: "poll", label: "Poll Data", Icon: Table2 },
  { id: "history", label: "Import History", Icon: History },
  { id: "content", label: "Website Content", Icon: UserCog },
  { id: "settings", label: "Settings", Icon: Settings },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export default function AdminPortal() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [caseId, setCaseId] = useState("tamil-nadu");
  const [section, setSection] = useState<SectionId>("overview");

  const [pollType, setPollType] = useState<"opinion" | "exit">("exit");
  const [view, setView] = useState<"recorded" | "scenario">("recorded");
  const [sum, setSum] = useState<{ opinion: Summary | null; exit: Summary | null; opinionShares: Shares; exitShares: Shares } | null>(null);
  const [records, setRecords] = useState<Row_[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [filters, setFilters] = useState({ status: "", geographyBasis: "", district: "", q: "" });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Meta[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsed, setParsed] = useState<{ opinion: PollRow[]; exit: PollRow[]; headers: { opinion: string[]; exit: string[] } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pinPreview, setPinPreview] = useState<PinScenarioPreview | null>(null);
  const [pinScenario, setPinScenario] = useState<PinScenarioInfo>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinIncludeEstimated, setPinIncludeEstimated] = useState(true);
  const [pinConfirm, setPinConfirm] = useState(false);

  const activeCase = useMemo(() => cases.find((c) => c.id === caseId), [cases, caseId]);

  useEffect(() => {
    fetch("/api/auth/session").then(async (r) => {
      if (!r.ok) { router.replace("/login"); return; }
      setReady(true);
    });
    fetch("/api/admin/case-studies").then(async (r) => { if (r.ok) setCases((await r.json()).cases); });
  }, [router]);

  const loadSummary = useCallback(async () => {
    const r = await fetch(`/api/data/summary?caseStudyId=${encodeURIComponent(caseId)}&view=${view}`);
    if (r.ok) setSum(await r.json());
  }, [caseId, view]);
  const loadRecords = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ caseStudyId: caseId, pollType, skip: String(skip), limit: "50", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    const r = await fetch(`/api/data/records?${qs}`);
    if (r.ok) { const d = await r.json(); setRecords(d.records); setTotal(d.total); }
    setLoading(false);
  }, [caseId, pollType, skip, filters]);
  const loadHistory = useCallback(async () => {
    const r = await fetch(`/api/data/history?caseStudyId=${encodeURIComponent(caseId)}`);
    if (r.ok) setHistory((await r.json()).history);
  }, [caseId]);
  const loadPinScenario = useCallback(async () => {
    const r = await fetch(`/api/data/pin-scenario?caseStudyId=${encodeURIComponent(caseId)}&pollType=${pollType}&includeEstimated=${pinIncludeEstimated ? 1 : 0}`);
    if (r.ok) { const d = await r.json(); setPinPreview(d.preview ?? null); setPinScenario(d.scenario ?? null); }
  }, [caseId, pollType, pinIncludeEstimated]);

  useEffect(() => { if (ready) loadSummary(); }, [ready, loadSummary]);
  useEffect(() => { if (ready && section === "poll") { loadRecords(); loadPinScenario(); } }, [ready, section, loadRecords, loadPinScenario]);
  useEffect(() => { if (ready && (section === "history" || section === "overview")) loadHistory(); }, [ready, section, loadHistory]);
  useEffect(() => { setSkip(0); }, [caseId, pollType]);

  const active = pollType === "opinion" ? sum?.opinion : sum?.exit;
  const shares = pollType === "opinion" ? sum?.opinionShares : sum?.exitShares;
  const c = active?.counts ?? EMPTY;

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }
  async function togglePublish(rec: CaseRecord) {
    const r = await fetch("/api/admin/case-studies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rec.id, patch: { published: !rec.published } }) });
    if (r.ok) { const d = await r.json(); setCases((cs) => cs.map((x) => (x.id === rec.id ? d.case : x))); }
  }
  async function saveTitle(rec: CaseRecord, title: string) {
    const r = await fetch("/api/admin/case-studies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: rec.id, patch: { title } }) });
    if (r.ok) { const d = await r.json(); setCases((cs) => cs.map((x) => (x.id === rec.id ? d.case : x))); }
  }

  async function parseSelected() {
    if (!file) { setMessage("Choose an .xlsx file first."); return; }
    if (!/\.xlsx$/i.test(file.name)) { setMessage("Only .xlsx workbooks are accepted."); return; }
    setBusy(true); setMessage("");
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const missing = ["Opinion Poll", "Exit Poll"].filter((n) => !wb.SheetNames.includes(n));
      if (missing.length) throw new Error(`Missing required sheet(s): ${missing.join(", ")}`);
      const { validateSheet } = await import("@/lib/poll-data");
      const { applyCanonicalPin } = await import("@/lib/pin");
      // Canonicalise recognised PIN header aliases into "PIN Code" (text preserved)
      // before chunking, so the browser path matches the server path exactly.
      const opinion = (XLSX.utils.sheet_to_json(wb.Sheets["Opinion Poll"], { defval: "", raw: true }) as PollRow[]).map((r) => applyCanonicalPin(r));
      const exit = (XLSX.utils.sheet_to_json(wb.Sheets["Exit Poll"], { defval: "", raw: true }) as PollRow[]).map((r) => applyCanonicalPin(r));
      const ov = validateSheet("Opinion Poll", opinion);
      const ev = validateSheet("Exit Poll", exit);
      const issues = [...ov.issues, ...ev.issues];
      setParsed({ opinion, exit, headers: { opinion: opinion.length ? Object.keys(opinion[0]) : [], exit: exit.length ? Object.keys(exit[0]) : [] } });
      setPreview({
        opinion: { total: ov.total, valid: ov.valid, blank: ov.blank, invalid: ov.invalid, recorded: ov.recorded, estimated: ov.estimated },
        exit: { total: ev.total, valid: ev.valid, blank: ev.blank, invalid: ev.invalid, recorded: ev.recorded, estimated: ev.estimated },
        warnings: issues.filter((i) => i.severity === "warning").slice(0, 200),
        errors: issues.filter((i) => i.severity === "error").slice(0, 200),
        canCommit: !issues.some((i) => i.severity === "error"),
      });
      const pinLine = `PIN codes — exit: ${ev.pinOk.toLocaleString("en-IN")} ok, ${ev.pinBlank.toLocaleString("en-IN")} blank, ${ev.pinInvalid.toLocaleString("en-IN")} not six digits${ev.pinConflicts ? `, ${ev.pinConflicts} conflicting` : ""}.`;
      setMessage(`Parsed ${file.name}. ${pinLine} ${!issues.some((i) => i.severity === "error") ? "Ready to import." : "Resolve errors before importing."}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not parse the workbook"); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!parsed || !file) return;
    setBusy(true); setMessage("Importing…");
    const CHUNK = 1200;
    try {
      for (const pt of ["opinion", "exit"] as const) {
        const rows = pt === "opinion" ? parsed.opinion : parsed.exit;
        const headers = pt === "opinion" ? parsed.headers.opinion : parsed.headers.exit;
        if (rows.length === 0) {
          const r = await fetch("/api/data/import/rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseStudyId: caseId, pollType: pt, mode, headers, rows: [], final: true, filename: file.name, totalInserted: 0 }) });
          const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.error || "Import failed");
          continue;
        }
        let importId: string | undefined; let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK); const final = i + CHUNK >= rows.length;
          const r = await fetch("/api/data/import/rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseStudyId: caseId, pollType: pt, mode, importId, headers, rows: chunk, final, filename: file.name, totalInserted: inserted + chunk.length }) });
          const d = await r.json(); if (!r.ok || !d.ok) throw new Error(d.error || "Import failed");
          importId = d.importId; inserted += d.inserted;
          setMessage(`Importing… ${pt === "exit" ? "Exit" : "Opinion"} ${Math.min(i + CHUNK, rows.length).toLocaleString("en-IN")} / ${rows.length.toLocaleString("en-IN")}`);
        }
      }
      setMessage("Import complete. Review the preview, then publish to make it public.");
      setPreview(null); setParsed(null); setFile(null);
      await loadSummary(); await loadHistory();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }

  async function applyPinScenario() {
    if (!pinConfirm) { setPinMsg("Tick the confirmation box to commit the allocation."); return; }
    setPinBusy(true); setPinMsg("Applying…");
    try {
      const r = await fetch("/api/data/pin-scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseStudyId: caseId, pollType, includeEstimated: pinIncludeEstimated, confirm: true }) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Apply failed");
      setPinPreview(d.preview); setPinMsg("Assumed-PIN allocation committed to storage and the two-sheet Excel export."); setPinConfirm(false);
      await loadPinScenario();
    } catch (e) { setPinMsg(e instanceof Error ? e.message : "Apply failed"); }
    finally { setPinBusy(false); }
  }

  const card = (label: string, value: number) => (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    </div>
  );

  if (!ready) return <main className="grid min-h-[100svh] place-items-center bg-background text-muted-foreground"><Loader2 className="size-5 animate-spin" /></main>;

  const pageCount = Math.max(1, Math.ceil(total / 50));
  const page = Math.floor(skip / 50) + 1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4"><Logo /><span className="hidden text-[12px] text-muted-foreground sm:block">Admin</span></div>
          <div className="flex items-center gap-2">
            <label className="hidden items-center gap-2 text-[12.5px] text-muted-foreground sm:flex">
              Case study
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="rounded-lg border border-border bg-elevated/60 px-2.5 py-1.5 text-foreground">
                {cases.map((cs) => <option key={cs.id} value={cs.id}>{cs.title} · {cs.electionYear}</option>)}
              </select>
            </label>
            <Link href="/" className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">Site</Link>
            <ThemeToggle className="size-9" />
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/60"><LogOut className="size-3.5" /> Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-5 py-6">
        {/* section nav */}
        <nav className="hidden w-52 shrink-0 flex-col gap-1 lg:flex" aria-label="Admin sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSection(id)} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium transition-colors", section === id ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
          <div className="mt-3 rounded-xl border border-border p-3 text-[11.5px] text-muted-foreground">
            <p className="font-semibold text-foreground/80">{activeCase?.title ?? "—"}</p>
            <p>{activeCase?.state} · {activeCase?.electionYear}</p>
            <p className={cn("mt-1", activeCase?.published ? "text-[#2fbf4a]" : "text-saffron-2")}>{activeCase?.published ? "Published" : "Draft (private)"}</p>
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          {/* mobile section selector */}
          <div className="mb-4 flex flex-wrap gap-2 lg:hidden">
            {SECTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => setSection(id)} className={cn("rounded-full border px-3 py-1.5 text-[12.5px]", section === id ? "border-saffron/60 bg-saffron/10 text-foreground" : "border-border text-muted-foreground")}>{label}</button>
            ))}
          </div>

          {section === "overview" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Overview · {activeCase?.title}</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Publication: {activeCase?.published ? "published — visible on the public dashboard" : "draft — private until published"}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {card("Total", c.total)}{card("Valid party", c.valid)}{card("Blank", c.blank)}{card("Invalid", c.invalid)}{card("Recorded district", c.recorded)}{card("Estimated district", c.estimated)}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Exit shown below; switch dataset in Poll Data. Last import: {active?.asOf ? new Date(active.asOf).toLocaleString() : "none"}. Registry: {cases.length} case studies.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {SECTIONS.map(({ id, label }) => (
                  <button key={id} onClick={() => setSection(id)} className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground">{label}</button>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><History className="size-4" /> Recent imports</h2>
                {history.length === 0 ? <p className="mt-2 text-[12.5px] text-muted-foreground">No imports for this case study.</p> : (
                  <ul className="mt-3 space-y-2 text-[12px]">
                    {history.slice(0, 5).map((h) => (
                      <li key={h.importId} className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
                        <span className="truncate">{h.filename} · {h.pollType}</span>
                        <span className="shrink-0 text-muted-foreground">{new Date(h.at).toLocaleDateString()} · {h.outcome} · +{h.inserted}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "cases" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Case Studies</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Select a case study (top-right) then manage its Opinion and Exit poll datasets in Poll Data. Publishing makes aggregates public.</p>
              <ul className="mt-5 space-y-2">
                {cases.map((cs) => (
                  <li key={cs.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", cs.id === caseId ? "border-saffron/50 bg-saffron/[0.06]" : "border-border bg-card/50")}>
                    <button onClick={() => { setCaseId(cs.id); }} className="min-w-0 flex-1 text-left">
                      <p className="font-display text-[15px] font-semibold">{cs.title}</p>
                      <p className="text-[12px] text-muted-foreground">{cs.state} · {cs.electionYear} · {cs.slug}</p>
                    </button>
                    <input defaultValue={cs.title} onBlur={(e) => { if (e.target.value !== cs.title) saveTitle(cs, e.target.value); }} className="w-48 rounded-lg border border-border bg-elevated/60 px-2.5 py-1.5 text-[12.5px]" aria-label={`Title for ${cs.title}`} />
                    <button onClick={() => togglePublish(cs)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold", cs.published ? "border-[#2fbf4a]/60 bg-[#2fbf4a]/15 text-[#2fbf4a]" : "border-border text-muted-foreground")}>
                      {cs.published ? "Published" : "Publish"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section === "poll" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Poll Data · {activeCase?.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl border border-border bg-card/60 p-1 text-[13px] font-semibold">
                  {(["opinion", "exit"] as const).map((t) => (
                    <button key={t} onClick={() => setPollType(t)} className={cn("rounded-lg px-3 py-1.5", pollType === t ? "bg-elevated text-foreground" : "text-muted-foreground")}>{t === "opinion" ? "Opinion Poll" : "Exit Poll"}</button>
                  ))}
                </div>
                <div className="inline-flex rounded-xl border border-border bg-card/60 p-1 text-[13px] font-semibold">
                  {(["recorded", "scenario"] as const).map((v) => (
                    <button key={v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5", view === v ? "bg-elevated text-foreground" : "text-muted-foreground")}>{v === "recorded" ? "Recorded" : "Estimated scenario"}</button>
                  ))}
                </div>
                <div className="ml-auto flex gap-2">
                  <a href="/api/data/template" className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] hover:bg-elevated"><FileSpreadsheet className="size-4" /> Template</a>
                  <a href={`/api/data/export?caseStudyId=${encodeURIComponent(caseId)}`} className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-[12.5px] hover:bg-elevated"><Download className="size-4" /> Export</a>
                </div>
              </div>

              {view === "scenario" && <p className="mt-3 rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12.5px] text-saffron-2">Includes estimated districts — records without recorded geography are allocated to a scenario district and are not verified respondent locations.</p>}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {card("Total", c.total)}{card("Valid party", c.valid)}{card("Blank", c.blank)}{card("Invalid", c.invalid)}{card("Recorded", c.recorded)}{card("Estimated", c.estimated)}
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Percentages use valid party responses as the denominator ({shares?.denominator.toLocaleString("en-IN") ?? 0}).{active?.asOf ? ` Last import ${new Date(active.asOf).toLocaleString()}.` : " No dataset imported yet — public page shows its empty state."}</p>

              {shares && shares.shares.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {shares.shares.map((s) => (
                    <li key={s.party} className="flex items-center gap-3 text-[13px]">
                      <span className="w-52 shrink-0 truncate text-foreground/80">{s.party}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated"><span className="block h-full rounded-full bg-saffron" style={{ width: `${s.pct}%` }} /></span>
                      <span className="w-28 text-right tabular-nums text-muted-foreground">{s.count.toLocaleString("en-IN")} · {s.pct}%</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input placeholder="Search Response ID…" value={filters.q} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, q: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] outline-none focus:border-saffron/60" />
                    <select value={filters.status} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, status: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-2.5 py-2 text-[13px]"><option value="">All statuses</option><option value="valid">Valid</option><option value="blank">Blank</option><option value="invalid">Invalid</option></select>
                    <select value={filters.geographyBasis} onChange={(e) => { setSkip(0); setFilters((f) => ({ ...f, geographyBasis: e.target.value })); }} className="rounded-xl border border-border bg-elevated/60 px-2.5 py-2 text-[13px]"><option value="">All geography</option><option value="Recorded or source-mapped district">Recorded</option><option value="Estimated allocation">Estimated</option></select>
                    <span className="ml-auto text-[12px] text-muted-foreground">{total.toLocaleString("en-IN")} records</span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-[12.5px]">
                      <thead><tr className="text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {["Response ID", "Party", "Status", "District", "Estimated", "Geography basis"].map((h) => <th key={h} className="border-b border-border px-2 py-2 font-semibold">{h}</th>)}
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
                          </tr>
                        ))}
                        {records.length === 0 && <tr><td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">{loading ? "Loading…" : "No records"}</td></tr>}
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

                <div className="rounded-2xl border border-border bg-card/60 p-4">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Upload className="size-4" /> Import workbook</h2>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">One workbook with Opinion Poll + Exit Poll. Committed as a draft; publish in Case Studies to make it public.</p>
                  <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setParsed(null); setMessage(""); }} className="mt-3 block w-full text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-foreground" />
                  <div className="mt-3 flex gap-2 text-[12.5px]">
                    {(["append", "replace"] as const).map((m) => (
                      <label key={m} className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5", mode === m ? "border-saffron/60 bg-saffron/10" : "border-border")}>
                        <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {m === "append" ? "Append" : "Replace"}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy} onClick={parseSelected} className="flex-1 rounded-xl border border-border px-3 py-2 text-[12.5px] font-medium hover:bg-elevated disabled:opacity-60">{busy ? "Working…" : "Validate & preview"}</button>
                    <button disabled={busy || !preview?.canCommit} onClick={commitImport} className="flex-1 rounded-xl bg-saffron px-3 py-2 text-[12.5px] font-semibold text-[#241203] disabled:opacity-50">Confirm import</button>
                  </div>
                  {message && <p className="mt-3 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[12px]">{message}</p>}
                  {preview && (
                    <div className="mt-3 space-y-2 text-[12px]">
                      <div className="rounded-lg border border-border p-2.5"><p className="font-semibold">Opinion Poll</p><p className="text-muted-foreground">{preview.opinion.total} rows · {preview.opinion.valid} valid · {preview.opinion.blank} blank · {preview.opinion.invalid} invalid</p></div>
                      <div className="rounded-lg border border-border p-2.5"><p className="font-semibold">Exit Poll</p><p className="text-muted-foreground">{preview.exit.total} rows · {preview.exit.valid} valid · {preview.exit.blank} blank · {preview.exit.invalid} invalid · {preview.exit.recorded} recorded · {preview.exit.estimated} estimated</p></div>
                      {preview.errors.length > 0 && <p className="text-saffron-2">{preview.errors.length} error(s) — resolve before importing</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Assumed PIN scenario */}
              <div className="mt-5 rounded-2xl border border-border bg-card/60 p-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><MapIcon className="size-4" /> Assumed PIN scenario</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Optional. The original “PIN Code”, district fields, party choices and Response IDs are preserved. Records without a PIN are distributed <b>evenly</b> across the district’s verified candidate PINs, separately within each party group, using a stable Response-ID order — <b>a neutral illustrative allocation, not a recovered respondent location</b>, never calibrated to results. A versioned allocation is stored in separate fields and the two-sheet Excel export.
                </p>

                <label className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <input type="checkbox" checked={pinIncludeEstimated} onChange={(e) => { setPinIncludeEstimated(e.target.checked); setPinConfirm(false); }} />
                  Include estimated districts (fallback when there is no recorded district)
                </label>

                {pinPreview?.ok ? (
                  <>
                    <p className="mt-2 text-[11.5px] text-muted-foreground">Reference: {pinPreview.summary.reference.name} · <span className="break-all">{pinPreview.summary.reference.source}</span> · <b>version {pinPreview.summary.reference.version}</b></p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Constituency crosswalk: {pinPreview.summary.crosswalk.constituencies} entries · {pinPreview.summary.crosswalk.version}{pinPreview.summary.crosswalk.constituencies === 0 ? " — none bundled, district-candidate fallback used" : ""}</p>
                    {pinPreview.datasetChanged && (
                      <p className="mt-2 rounded-lg border border-saffron/40 bg-saffron/10 px-3 py-2 text-[12px] text-saffron-2">The active dataset changed since the last allocation — regenerate the preview before committing.</p>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        ["Recorded PIN", pinPreview.summary.recordedPin],
                        ["Eligible (no PIN)", pinPreview.summary.eligible],
                        ["Assigned", pinPreview.summary.assigned],
                        ["Unresolved", pinPreview.summary.unresolved],
                        ["Total", pinPreview.summary.total],
                        ["Valid party", pinPreview.summary.valid],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl border border-border bg-elevated/40 px-3 py-2">
                          <p className="font-display text-lg font-semibold tabular-nums text-foreground">{Number(value).toLocaleString("en-IN")}</p>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{String(label)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-muted-foreground">
                      <span>Responses {pinPreview.summary.total === pinPreview.baseline.total ? "✓ unchanged" : "⚠ changed"} ({pinPreview.baseline.total.toLocaleString("en-IN")})</span>
                      <span>Valid party {pinPreview.summary.valid === pinPreview.baseline.valid ? "✓ unchanged" : "⚠ changed"} ({pinPreview.baseline.valid.toLocaleString("en-IN")})</span>
                      <span>{pinPreview.summary.reconcile.ok ? "✓ assigned + unresolved = eligible" : "⚠ reconciliation failed"}</span>
                      <span>{pinPreview.summary.reconcile.partyOk ? "✓ party totals reconcile" : "⚠ party totals differ"}</span>
                      <span>{pinPreview.summary.reconcile.pinDistrictOk ? "✓ PIN totals = district totals" : "⚠ PIN/district mismatch"}</span>
                      <span>Coverage-assigned: <b className="tabular-nums text-foreground/85">{pinPreview.summary.coverageAssigned.toLocaleString("en-IN")}</b></span>
                      <span>Allocation version: <b className="text-foreground/85">{pinPreview.allocationVersion}</b></span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {PIN_BASIS_ROWS.map(({ key, label }) => (
                        <div key={key} className="rounded-xl border border-border bg-elevated/40 px-3 py-2">
                          <p className="font-display text-base font-semibold tabular-nums text-foreground">{(pinPreview.summary.byBasis[key] ?? 0).toLocaleString("en-IN")}</p>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    {pinPreview.summary.byDistrict.length > 0 && (
                      <details className="mt-3 rounded-xl border border-border bg-elevated/30 p-3">
                        <summary className="cursor-pointer text-[12.5px] font-semibold text-foreground/85">Totals by district and PIN ({pinPreview.summary.byDistrict.length} districts)</summary>
                        <div className="mt-2 max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin]">
                          <ul className="space-y-1.5 text-[12px]">
                            {pinPreview.summary.byDistrict.map((d) => (
                              <li key={d.district || "unassigned"} className="rounded-lg border border-border/60 p-2">
                                <details>
                                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <b className="text-foreground/85">{d.district || "Unassigned district"}</b>
                                    <span className="text-muted-foreground">{d.districtBasis}</span>
                                    <span className="text-muted-foreground">total {d.total.toLocaleString("en-IN")}</span>
                                    <span className="text-muted-foreground">assigned {d.assigned.toLocaleString("en-IN")}</span>
                                    <span className="text-muted-foreground">unresolved {d.unresolved.toLocaleString("en-IN")}</span>
                                    <span className="text-muted-foreground">{d.byPin.length} PINs</span>
                                  </summary>
                                  {d.byPin.length > 0 && (
                                    <ul className="mt-1.5 space-y-0.5 pl-3">
                                      {d.byPin.map((p) => (
                                        <li key={p.pin} className="flex items-center gap-3 text-muted-foreground">
                                          <span className="tabular-nums text-foreground/75">{p.pin}</span>
                                          <span>total {p.total.toLocaleString("en-IN")}</span>
                                          <span>valid {p.valid.toLocaleString("en-IN")}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </details>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}

                    {(pinPreview.summary.unresolvedGeography.noDistrict > 0 || pinPreview.summary.districtsWithoutCandidates.length > 0 || pinPreview.summary.ambiguousPins.length > 0) && (
                      <div className="mt-2 space-y-1 text-[11.5px] text-saffron-2">
                        {pinPreview.summary.unresolvedGeography.noDistrict > 0 && <p>Unresolved geography (no district and no zone): {pinPreview.summary.unresolvedGeography.noDistrict.toLocaleString("en-IN")} responses</p>}
                        {pinPreview.summary.districtsWithoutCandidates.length > 0 && <p>Unresolved districts (no reference candidates): {pinPreview.summary.districtsWithoutCandidates.join(", ")}</p>}
                        {pinPreview.summary.ambiguousPins.length > 0 && <p>Ambiguous PIN↔district mappings excluded from candidates: {pinPreview.summary.ambiguousPins.join(", ")}</p>}
                      </div>
                    )}

                    <label className="mt-3 flex items-center gap-2 text-[12.5px] text-foreground/85">
                      <input type="checkbox" checked={pinConfirm} onChange={(e) => setPinConfirm(e.target.checked)} />
                      I confirm I want to commit this assumed-PIN allocation (storage + Excel export).
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button onClick={loadPinScenario} className="rounded-xl border border-border px-3 py-2 text-[12.5px] hover:bg-elevated">Refresh preview</button>
                      <button disabled={pinBusy || !pinConfirm} onClick={applyPinScenario} className="rounded-xl bg-saffron px-3 py-2 text-[12.5px] font-semibold text-[#241203] disabled:opacity-50">{pinBusy ? "Applying…" : "Apply assumed-PIN scenario"}</button>
                      {pinScenario?.appliedAt && <span className="text-[11.5px] text-muted-foreground">Last applied {new Date(pinScenario.appliedAt).toLocaleString()}{pinScenario.allocationVersion ? ` · ${pinScenario.allocationVersion}` : ""}</span>}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-[12.5px] text-muted-foreground">{pinPreview?.reason ?? "No active dataset for this poll type."}</p>
                )}
                {pinMsg && <p className="mt-2 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-[12px]">{pinMsg}</p>}
              </div>
            </div>
          )}

          {section === "history" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Import History</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Scoped to {activeCase?.title}. Uploader, timestamp, filename, counts and outcome.</p>
              {history.length === 0 ? <p className="mt-4 text-[13px] text-muted-foreground">No imports yet for this case study.</p> : (
                <ul className="mt-4 space-y-2 text-[12.5px]">
                  {history.map((h) => (
                    <li key={h.importId} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{h.filename} · {h.pollType}</span>
                        <span className={h.outcome === "success" ? "text-[#2fbf4a]" : "text-saffron-2"}>{h.outcome} · {h.mode}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{new Date(h.at).toLocaleString()} · {h.uploader} · +{h.inserted}{h.skipped ? ` · ${h.skipped} skipped` : ""}{h.error ? ` · ${h.error}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {section === "content" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Website Content</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Edit the public About page. Case-study titles and publication are managed in Case Studies.</p>
              <div className="mt-5"><AboutEditor /></div>
              <p className="mt-5 max-w-2xl rounded-xl border border-saffron/30 bg-saffron/10 px-3 py-2 text-[12px] text-saffron-2">
                ⚠ The contact email and phone on the site are still placeholders (configured in <code>lib/cases.ts</code>). Supply verified values and they’ll be applied.
              </p>
            </div>
          )}

          {section === "settings" && (
            <div>
              <h1 className="font-display text-2xl font-semibold">Settings</h1>
              <div className="mt-5 max-w-xl space-y-3 text-[13px]">
                <div className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="font-semibold">Session</p>
                  <p className="mt-1 text-muted-foreground">Signed in as the single admin account. Sessions are httpOnly, expire after 7 days, and are revoked on logout.</p>
                  <button onClick={logout} className="mt-3 rounded-lg border border-border px-3 py-1.5 text-[12.5px] hover:bg-elevated">Sign out</button>
                </div>
                <div className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="font-semibold">Data migration</p>
                  <p className="mt-1 text-muted-foreground">Legacy rows are tagged to the Tamil Nadu case study automatically when the registry loads. Datasets are never mixed across case studies.</p>
                </div>
                <div className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="font-semibold">Environment</p>
                  <p className="mt-1 text-muted-foreground">Secrets are server-side only (ADMIN_PASSWORD, ADMIN_SESSION_SECRET, MONGODB_URI). They are never exposed to the browser. Uploads and exports are admin-only.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
