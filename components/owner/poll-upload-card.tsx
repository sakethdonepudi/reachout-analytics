"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { CASES } from "@/lib/cases";
import { PARTIES } from "@/lib/parties";
import { PartyMark } from "@/components/site/party-mark";
import { useReauth } from "@/components/auth/reauth-provider";
import { validateSheet, type Row, type SheetValidation } from "@/lib/poll-data";
import { cn } from "@/lib/utils";

type PollType = "opinion" | "exit";
type Parsed = { rows: Row[]; headers: string[]; validation: SheetValidation; opinionRows: number; exitRows: number };
type TgPreview = { ok: boolean; rows?: number; error?: string; hashMatches?: boolean; warnings?: string[]; expectedHash?: string; uploadedHash?: string };
type HistoryRow = { at: string; filename: string; inserted: number; counts?: { total?: number }; outcome?: string };

const MAX_MB = 20;

const STATE_DISTRICTS: Record<string, string[]> = {
  "north-east-elections": ["kamrup", "dibrugarh", "guwahati", "jorhat", "silchar", "imphal", "shillong"],
  "tamil-nadu": ["chennai", "coimbatore", "madurai", "salem", "tiruchirappalli", "tirunelveli", "vellore"],
  telangana: ["hyderabad", "warangal", "karimnagar", "nizamabad", "khammam", "nalgonda", "medak"],
  "andhra-pradesh-2024": ["guntur", "visakhapatnam", "krishna", "kurnool", "chittoor", "kadapa", "nellore"],
  gujarat: ["ahmedabad", "surat", "vadodara", "rajkot", "bhavnagar", "jamnagar", "gandhinagar"],
  bihar: ["patna", "gaya", "muzaffarpur", "bhagalpur", "darbhanga", "purnia", "nalanda"],
  "karnataka-2023": ["bengaluru", "mysuru", "belagavi", "dharwad", "mangaluru", "hubballi", "kalaburagi"],
};

function caseFor(slug: string) {
  return CASES.find((item) => item.slug === slug) ?? null;
}

function detectWrongState(rows: Row[], selected: string): { slug: string; party: string; state: string } | null {
  if (!rows.length || !selected) return null;
  const haystack = rows.slice(0, 400).map((row) => ["State", "District", "District Original", "Assembly Constituency", "Assembly Constituency Original"].map((key) => String(row[key] ?? "").toLowerCase()).join(" ")).join(" ");
  const scores = Object.entries(STATE_DISTRICTS).map(([slug, districts]) => ({ slug, score: districts.filter((name) => haystack.includes(name)).length }));
  const selectedScore = scores.find((item) => item.slug === selected)?.score ?? 0;
  const other = scores.filter((item) => item.slug !== selected).sort((a, b) => b.score - a.score)[0];
  if (!other || other.score < 2 || other.score <= selectedScore) return null;
  const item = caseFor(other.slug);
  return item ? { slug: item.slug, party: item.party, state: item.stateName } : null;
}

function parseFile(buffer: ArrayBuffer): { opinion: Row[]; exit: Row[]; headers: Record<PollType, string[]> } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const read = (name: string): Row[] => {
    const sheet = workbook.Sheets[name];
    return sheet ? XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: true }) : [];
  };
  const opinion = read("Opinion Poll");
  const exit = read("Exit Poll");
  const first = workbook.SheetNames[0];
  const fallback = !opinion.length && !exit.length && first ? read(first) : [];
  return {
    opinion,
    exit: exit.length ? exit : fallback,
    headers: {
      opinion: opinion.length ? Object.keys(opinion[0]) : [],
      exit: (exit.length ? exit : fallback).length ? Object.keys((exit.length ? exit : fallback)[0]) : [],
    },
  };
}

export default function PollUploadCard({ initialSlug = null }: { initialSlug?: string | null }) {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pollType, setPollType] = useState<PollType>("exit");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [tgPreview, setTgPreview] = useState<TgPreview | null>(null);
  const [busy, setBusy] = useState<"" | "parse" | "upload">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ rows: number; skipped: number; slug: string } | null>(null);
  const [wrongState, setWrongState] = useState<{ slug: string; party: string; state: string } | null>(null);
  const [confirmedMismatch, setConfirmedMismatch] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [last, setLast] = useState<HistoryRow | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (initialSlug) { setSlug(initialSlug); setSuccess(null); }
  }, [initialSlug]);

  useEffect(() => {
    if (!slug) { setLast(null); return; }
    let alive = true;
    fetch(`/api/data/history?caseStudyId=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (alive && data?.history?.[0]) setLast(data.history[0] as HistoryRow); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug, refreshKey]);

  const resetPreview = () => { setParsed(null); setTgPreview(null); setWrongState(null); setConfirmedMismatch(false); setError(""); setSuccess(null); };

  const loadFile = useCallback(async (next: File | null) => {
    if (!next) return;
    resetPreview();
    setFile(next);
    if (next.size > MAX_MB * 1024 * 1024) { setError(`That file is larger than ${MAX_MB} MB.`); setFile(null); return; }
    if (!/\.(xlsx|xls|csv)$/i.test(next.name)) { setError("Choose an .xlsx, .xls or .csv workbook."); setFile(null); return; }
    setBusy("parse");
    try {
      const buffer = await next.arrayBuffer();
      const sheets = parseFile(buffer);
      const rows = sheets.exit.length ? sheets.exit : sheets.opinion;
      const type: PollType = sheets.exit.length ? "exit" : "opinion";
      const validation = validateSheet(type === "opinion" ? "Opinion Poll" : "Exit Poll", rows);
      setParsed({ rows, headers: sheets.headers[type], validation, opinionRows: sheets.opinion.length, exitRows: sheets.exit.length });
      setPollType(type);
      if (!slug) setError("");
    } catch {
      setFile(null);
      setError("That workbook could not be read. Check it opens in Excel and try again.");
    } finally { setBusy(""); }
  }, [slug]);

  // Telangana uses the strict October importer. Preview it on the server.
  useEffect(() => {
    if (!file || slug !== "telangana") { setTgPreview(null); return; }
    let alive = true;
    setBusy("parse"); setError(""); setTgPreview(null);
    const form = new FormData(); form.append("file", file);
    fetch("/api/admin/telangana/import", { method: "POST", body: form })
      .then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!alive) return;
        const preview = (data.preview ?? {}) as TgPreview;
        setTgPreview({ ...preview, ok: Boolean(ok && data.ok && preview.ok) });
        if (!ok || !preview.ok) setError(preview.error ?? data.error ?? "This workbook does not match the Telangana contract.");
      })
      .catch(() => { if (alive) setError("Could not preview the Telangana workbook."); })
      .finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [file, slug]);

  useEffect(() => {
    if (!parsed || !slug || slug === "telangana") { setWrongState(null); return; }
    setWrongState(detectWrongState(parsed.rows, slug));
    setConfirmedMismatch(false);
  }, [parsed, slug]);

  const selected = slug ? caseFor(slug) : null;
  const differentPoll = parsed ? parsed.opinionRows > 0 && parsed.exitRows > 0 : false;
  const rows = parsed?.rows ?? [];
  const validation = parsed?.validation ?? null;
  const errors = validation?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = validation?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const valid = slug === "telangana" ? Boolean(tgPreview?.ok) : Boolean(validation && validation.total > 0 && errors.length === 0);
  const canUpload = Boolean(file && slug && valid && !busy && (!wrongState || confirmedMismatch));

  function chooseState(next: string) {
    setSlug(next);
    setConfirmedMismatch(false);
    setSuccess(null);
  }

  async function postChunks(): Promise<{ rows: number; skipped: number }> {
    if (!parsed || !slug) throw new Error("Choose a workbook and a state first.");
    const total = rows.length;
    let importId: string | undefined;
    let inserted = 0;
    for (let index = 0; index < total; index += 500) {
      const chunk = rows.slice(index, index + 500);
      const final = index + 500 >= total;
      const body = { caseStudyId: slug, pollType, mode: "replace", importId, headers: parsed.headers, rows: chunk, final, filename: file?.name, totalInserted: inserted + chunk.length };
      let response = await fetch("/api/data/import/rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        if (payload.code === "reauth_required") {
          if (!(await requestReauth())) throw new Error("Re-authentication is needed to upload data.");
          response = await fetch("/api/data/import/rows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        }
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The workbook could not be uploaded.");
      importId = payload.importId ?? importId;
      inserted += Number(payload.inserted ?? 0);
      if (final) {
        const meta = payload.meta as { inserted?: number; skipped?: number } | null;
        return { rows: Number(meta?.inserted ?? inserted), skipped: Number(meta?.skipped ?? 0) };
      }
    }
    return { rows: inserted, skipped: 0 };
  }

  async function upload() {
    if (!file || !slug || !canUpload) return;
    setBusy("upload"); setError(""); setSuccess(null);
    try {
      if (slug === "telangana") {
        const form = new FormData(); form.append("file", file); form.append("confirm", "1");
        let response = await fetch("/api/admin/telangana/import", { method: "POST", body: form });
        if (response.status === 403) {
          const payload = await response.json().catch(() => ({}));
          if (payload.code === "reauth_required") {
            if (!(await requestReauth())) throw new Error("Re-authentication is needed to upload data.");
            response = await fetch("/api/admin/telangana/import", { method: "POST", body: form });
          }
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(typeof payload.error === "string" ? payload.error : payload.result?.error ?? "The Telangana workbook could not be uploaded.");
        setSuccess({ rows: Number(tgPreview?.rows ?? 0), skipped: 0, slug });
      } else {
        const result = await postChunks();
        setSuccess({ ...result, slug });
      }
      setRefreshKey((value) => value + 1);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The workbook could not be uploaded.");
    } finally { setBusy(""); }
  }

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <section id="poll-upload" className="scroll-mt-24 rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]" aria-labelledby="poll-upload-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Poll data</p>
          <h2 id="poll-upload-title" className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">Excel / CSV</h2>
          <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Upload one state at a time. The rows go only to that state.</p>
        </div>
        <FileSpreadsheet className="size-5 shrink-0 text-[#6B6B6B]" aria-hidden />
      </div>

      <label
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void loadFile(event.dataTransfer.files?.[0] ?? null); }}
        className={cn("mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-[#0B0B0C]/40", dragging ? "border-[#0B0B0C] bg-[#F4F4F5]" : "border-[#CFCFCF] bg-[#FAFAFA] hover:border-[#0B0B0C]")}
      >
        <span className="sr-only">Choose an Excel or CSV poll workbook</span>
        <Upload className="size-5 text-[#6B6B6B]" aria-hidden />
        <span className="mt-2 text-[13px] font-semibold text-[#0B0B0C]">{file ? file.name : "Drop a workbook here or choose a file"}</span>
        <span className="mt-1 text-[11.5px] text-[#6B6B6B]">.xlsx, .xls or .csv, up to {MAX_MB} MB</span>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Poll workbook" onChange={(event) => void loadFile(event.target.files?.[0] ?? null)} />
      </label>

      {file && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]">Which state?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CASES.map((item) => {
              const active = slug === item.slug;
              return (
                <button key={item.slug} type="button" onClick={() => chooseState(item.slug)} aria-pressed={active} className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C]/40", active ? "border-[#0B0B0C] bg-[#0B0B0C] text-white" : "border-[#EAEAEA] bg-white text-[#555] hover:border-[#0B0B0C]")}>
                  <PartyMark party={item.party} size="sm" />
                  {item.party} {item.stateName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {file && differentPoll && slug !== "telangana" && (
        <div className="mt-3 inline-flex rounded-full bg-[#F4F4F5] p-1" role="group" aria-label="Poll type">
          {(["exit", "opinion"] as const).map((type) => (
            <button key={type} type="button" onClick={() => setPollType(type)} aria-pressed={pollType === type} className={cn("min-h-8 rounded-full px-3 text-[11.5px] font-semibold", pollType === type ? "bg-white text-[#0B0B0C] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#6B6B6B]")}>{type === "exit" ? "Exit poll" : "Opinion poll"}</button>
          ))}
        </div>
      )}

      {wrongState && !confirmedMismatch && (
        <div role="alert" className="mt-4 rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
          <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />This looks like {wrongState.party} {wrongState.state} data.</p>
          <p className="mt-1">Upload it to {wrongState.state} instead?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setSlug(wrongState.slug); setConfirmedMismatch(false); }} className="min-h-9 rounded-lg bg-[#0B0B0C] px-3 text-[11.5px] font-semibold text-white">Use {wrongState.state}</button>
            <button type="button" onClick={() => setConfirmedMismatch(true)} className="min-h-9 rounded-lg border border-[#92400E]/30 px-3 text-[11.5px] font-semibold">Keep {selected?.stateName}</button>
          </div>
        </div>
      )}

      {busy === "parse" && <p role="status" className="mt-4 flex items-center gap-2 text-[12px] text-[#6B6B6B]"><Loader2 className="size-3.5 animate-spin" /> Reading the workbook...</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{error}</p>}
      {success && (
        <div role="status" className="mt-4 rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4] p-3 text-[12.5px] text-[#166534]">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden />Uploaded to {caseFor(success.slug)?.stateName}.</p>
          <p className="mt-1">{success.rows.toLocaleString("en-IN")} rows added{success.skipped ? `, ${success.skipped.toLocaleString("en-IN")} skipped` : ""}.</p>
          <Link href={`/case-studies/${success.slug}`} className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-[#166534]/30 px-3 text-[11.5px] font-semibold">View {caseFor(success.slug)?.stateName} case study</Link>
        </div>
      )}

      {file && slug && (parsed || tgPreview) && (
        <div className="mt-4 rounded-xl border border-[#EAEAEA] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#0B0B0C]">Preview</p>
            <a href={`/api/data/template?caseStudyId=${slug}`} className="inline-flex min-h-9 items-center gap-1.5 text-[11.5px] font-semibold text-[#0B0B0C] underline-offset-4 hover:underline"><Download className="size-3.5" aria-hidden />Download template</a>
          </div>
          {slug === "telangana" ? (
            <div className="mt-2 text-[12px] text-[#555]">
              {tgPreview?.ok ? <><p className="text-[#166534] font-semibold">{Number(tgPreview.rows ?? 0).toLocaleString("en-IN")} rows match the Telangana contract.</p><p className="mt-1">Hash check: {tgPreview.hashMatches ? "matches the expected workbook" : "different from the expected workbook"}.</p></> : <p>{tgPreview?.error ?? "Checking the Telangana workbook..."}</p>}
              {tgPreview?.warnings?.length ? <ul className="mt-1 list-inside list-disc text-[11.5px] text-[#92400E]">{tgPreview.warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            </div>
          ) : validation ? (
            <>
              <p className="mt-1 text-[11.5px] text-[#6B6B6B]">{validation.headers.length} columns · {validation.total.toLocaleString("en-IN")} rows · {validation.valid.toLocaleString("en-IN")} valid · {validation.invalid.toLocaleString("en-IN")} invalid</p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-[#EAEAEA]">
                <table className="owner-table w-full min-w-[560px] border-collapse text-left text-[11px]">
                  <thead className="bg-[#FAFAFA] text-[9px] uppercase tracking-[0.08em] text-[#6B6B6B]"><tr>{validation.headers.slice(0, 8).map((header) => <th key={header} className="px-2 py-1.5 font-semibold">{header}</th>)}</tr></thead>
                  <tbody>{previewRows.map((row, index) => <tr key={index} className="border-t border-[#EAEAEA]">{validation.headers.slice(0, 8).map((header) => <td key={header} className="max-w-[160px] truncate px-2 py-1.5">{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {errors.length > 0 && <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[11.5px] text-[#B42318]">{errors.slice(0, 20).map((issue, index) => <li key={`${issue.row}-${issue.field}-${index}`}>Row {issue.row}, {issue.field}: {issue.reason}</li>)}</ul>}
              {!errors.length && warnings.length > 0 && <p className="mt-2 text-[11.5px] text-[#92400E]">{warnings.length} warning{warnings.length === 1 ? "" : "s"}. Errors must be fixed before upload.</p>}
            </>
          ) : null}
        </div>
      )}

      {last && <p className="mt-3 text-[11.5px] text-[#6B6B6B]">Last upload: {new Date(last.at).toLocaleString("en-IN")} · {last.filename} · {Number(last.counts?.total ?? last.inserted).toLocaleString("en-IN")} rows</p>}

      <button type="button" onClick={() => void upload()} disabled={!canUpload} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B0B0C] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
        {busy === "upload" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {selected ? `Upload to ${selected.stateName}` : "Choose a state to upload"}
      </button>
    </section>
  );
}
