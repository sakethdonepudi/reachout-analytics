"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import { SURVEY_STATES } from "@/lib/survey/types";
import { cn } from "@/lib/utils";

type Period = { key: string; label: string; n: number; from: string; to: string; months?: string[] };
type Preview = { periods: Period[]; n_total: number; state: string; stateName: string };

export default function SurveyUploadCard() {
  const router = useRouter();
  const { requestReauth } = useReauth();
  const input = useRef<HTMLInputElement>(null);
  const [stateSlug, setStateSlug] = useState("tamil-nadu");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "parse" | "publish">("");
  const [error, setError] = useState("");
  const [published, setPublished] = useState<number | null>(null);

  async function send(next: File | null, confirm = false) {
    if (!next) return;
    setFile(next); setError(""); setPublished(null);
    if (!/\.html?$/i.test(next.name)) { setError("Choose the survey dashboard .html file."); return; }
    setBusy(confirm ? "publish" : "parse"); if (!confirm) setPreview(null);
    const form = new FormData(); form.append("file", next); form.append("state", stateSlug); if (confirm) form.append("confirm", "1");
    try {
      let response = await fetch("/api/survey/upload", { method: "POST", body: form });
      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        if (payload.code === "reauth_required") {
          if (!(await requestReauth())) throw new Error("Re-authentication is needed to publish a survey dashboard.");
          response = await fetch("/api/survey/upload", { method: "POST", body: form });
        }
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(typeof payload.error === "string" ? payload.error : "That survey dashboard could not be read.");
      if (confirm) {
        setPublished(Number(payload.version ?? 0));
        setPreview(null);
        router.refresh();
      } else {
        setPreview(payload.preview as Preview);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That survey dashboard could not be read.");
    } finally { setBusy(""); }
  }

  function chooseState(next: string) {
    setStateSlug(next); setFile(null); setPreview(null); setError(""); setPublished(null);
    if (input.current) input.current.value = "";
  }

  return (
    <section id="survey-upload" className="scroll-mt-24 rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)]" aria-labelledby="survey-upload-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">Survey dashboard</p>
          <h2 id="survey-upload-title" className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-[#0B0B0C]">HTML survey dashboard</h2>
          <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Preview the periods and months, then publish the state survey dashboard from the source HTML.</p>
        </div>
        <FileUp className="size-5 shrink-0 text-[#6B6B6B]" aria-hidden />
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]">State</p>
        <div className="mt-1 inline-flex rounded-full bg-[#F4F4F5] p-1" role="group" aria-label="Survey state">
          {Object.values(SURVEY_STATES).map((state) => (
            <button key={state.slug} type="button" onClick={() => chooseState(state.slug)} aria-pressed={stateSlug === state.slug} className={cn("min-h-8 rounded-full px-3 text-[11.5px] font-semibold transition-colors", stateSlug === state.slug ? "bg-white text-[#0B0B0C] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[#6B6B6B] hover:text-[#0B0B0C]")}>{state.name}</button>
          ))}
        </div>
      </div>

      <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void send(event.dataTransfer.files?.[0] ?? null); }} className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#CFCFCF] bg-[#FAFAFA] px-4 py-4 text-center transition-colors hover:border-[#0B0B0C] focus-within:ring-2 focus-within:ring-[#0B0B0C]/40">
        <span className="sr-only">Choose the survey dashboard HTML file</span>
        <Upload className="size-5 text-[#6B6B6B]" aria-hidden />
        <span className="mt-2 text-[13px] font-semibold text-[#0B0B0C]">{file ? file.name : "Drop the survey dashboard HTML here"}</span>
        <span className="mt-1 text-[11.5px] text-[#6B6B6B]">.html, up to 4 MB</span>
        <input ref={input} type="file" accept=".html,text/html" className="sr-only" aria-label="Survey dashboard HTML" onChange={(event) => void send(event.target.files?.[0] ?? null)} />
      </label>

      <p className="mt-2 text-[11.5px] text-[#6B6B6B]">HTML only. The page fills its cards, months, sub-periods and profile tabs from the uploaded dashboard.</p>

      {busy === "parse" && <p role="status" className="mt-3 flex items-center gap-2 text-[12px] text-[#6B6B6B]"><Loader2 className="size-3.5 animate-spin" /> Reading the dashboard...</p>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-[#B42318]/30 bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{error}</p>}
      {published != null && <div role="status" className="mt-3 rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4] p-3 text-[12.5px] text-[#166534]"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden />Survey dashboard published.</p><p className="mt-1">Version {published}. The Tamil Nadu and Andhra Pradesh case studies now use it.</p></div>}

      {preview && (
        <div className="mt-4 rounded-xl border border-[#EAEAEA] p-3">
          <p className="text-[12px] font-semibold text-[#0B0B0C]">Preview · {preview.stateName}</p>
          <p className="mt-1 text-[11.5px] text-[#6B6B6B]">{new Intl.NumberFormat("en-IN").format(preview.n_total)} responses · {preview.periods.length} periods</p>
          <ul className="mt-2 space-y-1 text-[11px] text-[#555]">
            {preview.periods.map((period) => <li key={period.key}><b className="text-[#0B0B0C]">{period.label}</b>: {new Intl.NumberFormat("en-IN").format(period.n)} · {period.from || "—"} to {period.to || "—"}{period.months?.length ? <> · {period.months.join(", ")}</> : null}</li>)}
          </ul>
          <button type="button" onClick={() => void send(file, true)} disabled={busy !== ""} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#0B0B0C] px-4 text-[12px] font-semibold text-white disabled:opacity-40">{busy === "publish" ? <Loader2 className="size-3.5 animate-spin" /> : null}Publish survey dashboard</button>
        </div>
      )}
    </section>
  );
}
