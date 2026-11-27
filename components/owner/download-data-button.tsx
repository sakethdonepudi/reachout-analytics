"use client";

import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";

export default function DownloadDataButton({ state = "tamil-nadu", label = "Download data" }: { state?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/survey/download?state=${state}`);
      if (!response.ok) throw new Error("That data could not be downloaded.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${state}-survey-export.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That data could not be downloaded.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--theme-text)] px-3 text-[11px] font-semibold text-[color:var(--theme-text)] hover:bg-[color:var(--theme-text)] hover:text-[color:var(--theme-surface)] disabled:opacity-50">
        <ArrowDownToLine className="size-3.5" /> {busy ? "Preparing..." : label}
      </button>
      {error && <span role="alert" className="text-[11px] text-[color:var(--theme-negative)]">{error}</span>}
    </div>
  );
}
