"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { UpdatedAt } from "@/components/ui/updated-at";

export function MetaSyncControls({ connected, expired, lastSyncAt }: {
  connected: boolean;
  expired: boolean;
  lastSyncAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = useCallback(async (manual: boolean) => {
    if (busy) return;
    setBusy(true);
    if (manual) setMessage("");
    try {
      const response = await fetch("/api/meta/owner/sync", { method: "POST" });
      if (response.status === 429) {
        if (manual) setMessage("Try again in a minute.");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (manual) setMessage(data.skipped === "locked" ? "A sync is already running." : "Sync could not start.");
        return;
      }
      router.refresh();
    } catch {
      if (manual) setMessage("Sync could not start.");
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

  useEffect(() => {
    if (!connected || expired) return;
    const stale = !lastSyncAt || Date.now() - new Date(lastSyncAt).getTime() > 15 * 60 * 1000;
    if (stale) void run(false);
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [connected, expired, lastSyncAt, run, router]);

  if (!connected || expired) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <UpdatedAt at={lastSyncAt} />
      {message && <span className="text-[11px] text-[var(--text-muted)]">{message}</span>}
      <button
        type="button"
        onClick={() => void run(true)}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-raised)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />} Refresh
      </button>
    </div>
  );
}
