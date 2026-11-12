"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Outcome = "ok" | "partial" | "failed";
type Health = {
  latest: {
    runId: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    trigger: "cron" | "manual";
    outcome: Outcome;
    status: string;
    error: string | null;
    backfill: boolean;
    daysResynced: number;
    counts: {
      accounts: number;
      campaigns: number;
      adsets: number;
      ads: number;
      creatives: number;
      dailyInsightRows: number;
      rangeInsightRows: number;
    };
    tagging: { confirmed: number; unconfirmed: number; untagged: number };
    reachCheck: { rangeKey: "7d"; rangeReach: number | null; dailySum: number | null; warning: boolean };
    clientVisibleCampaigns: number;
    connectionExpiresAt: string | null;
  } | null;
  connectionExpiresAt: string | null;
  metaUserName: string | null;
  serverTime: string;
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function fmtDuration(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function fmtCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN");
}

function fmtRemaining(expiresAt: string | null, now: number): string {
  if (!expiresAt) return "—";
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return "expired";
  const minutes = Math.floor(remaining / 60_000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const OUTCOME_TONE: Record<Outcome, "success" | "warning" | "danger"> = {
  ok: "success",
  partial: "warning",
  failed: "danger",
};

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border px-3 py-2.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-[15px] font-semibold tabular-nums", warn && "text-amber-700 dark:text-amber-300")}>{value}</dd>
    </div>
  );
}

export function SyncHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/meta/owner/sync-health", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load sync health");
      const payload = await response.json();
      setHealth(payload.health ?? null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load sync health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const latest = health?.latest ?? null;
  const expiresAt = health?.connectionExpiresAt ?? latest?.connectionExpiresAt ?? null;
  const reach = latest?.reachCheck;

  return (
    <section id="sync-health" className="mt-6 scroll-mt-24 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Sync health</p>
          <h2 className="mt-2 font-display text-xl font-semibold">Last sync run</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">Owner-only operational summary. Stored for the last 30 runs.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Meta user: <span className="font-semibold text-foreground">{health?.metaUserName ?? "—"}</span></p>
        </div>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-semibold text-muted-foreground">
          <Clock className="size-3.5" aria-hidden /> Connection {fmtRemaining(expiresAt, now)}
        </span>
      </div>

      {loading && !health ? (
        <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> Loading sync health…
        </p>
      ) : error && !health ? (
        <p role="alert" className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">{error}</p>
      ) : !latest ? (
        <p className="mt-4 text-[12px] text-muted-foreground">No sync run has been recorded yet.</p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={OUTCOME_TONE[latest.outcome]}>{latest.outcome}</Badge>
            <span className="text-[12px] font-semibold capitalize">{latest.trigger}</span>
            <span className="text-[12px] text-muted-foreground">
              {fmtDate(latest.startedAt)} → {latest.finishedAt ? fmtDate(latest.finishedAt) : "—"} · {fmtDuration(latest.durationMs)}
            </span>
          </div>

          {latest.error && (
            <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 break-words dark:text-rose-300">
              {latest.error}
            </p>
          )}

          <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="Ad accounts" value={fmtCount(latest.counts.accounts)} />
            <Stat label="Campaigns" value={fmtCount(latest.counts.campaigns)} />
            <Stat label="Ad sets" value={fmtCount(latest.counts.adsets)} />
            <Stat label="Ads" value={fmtCount(latest.counts.ads)} />
            <Stat label="Creatives" value={fmtCount(latest.counts.creatives)} />
            <Stat label="Daily insight rows" value={fmtCount(latest.counts.dailyInsightRows)} />
            <Stat label="Range insight rows" value={fmtCount(latest.counts.rangeInsightRows)} />
            <Stat label="Days re-synced" value={fmtCount(latest.daysResynced)} />
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Tagging totals</p>
              <dl className="mt-2 grid grid-cols-3 gap-2">
                <Stat label="Confirmed" value={fmtCount(latest.tagging.confirmed)} />
                <Stat label="Unconfirmed" value={fmtCount(latest.tagging.unconfirmed)} warn={latest.tagging.unconfirmed > 0} />
                <div className="rounded-2xl border border-border px-3 py-2.5">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Untagged</dt>
                  <dd className="mt-1 text-[15px] font-semibold tabular-nums">
                    <a href="#tagging" className="underline decoration-dotted underline-offset-4 hover:text-[var(--accent-brass-strong)]">{fmtCount(latest.tagging.untagged)}</a>
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Clients see {fmtCount(latest.clientVisibleCampaigns)} campaign(s) with confirmed tags.</p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Reach check · 7-day range</p>
              <dl className="mt-2 grid grid-cols-2 gap-2">
                <Stat label="Range reach (all_days)" value={fmtCount(reach?.rangeReach)} />
                <Stat label="Sum of daily reach" value={fmtCount(reach?.dailySum)} />
              </dl>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Range reach is the true figure; daily reach overlaps, so the sum is higher.</p>
              {reach?.warning && (
                <p role="status" className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Range reach is higher than the daily sum. Check the range rows.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
