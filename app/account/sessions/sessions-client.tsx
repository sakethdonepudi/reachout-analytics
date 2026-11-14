"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { announceOpening } from "@/lib/use-navigate";

type Session = { id: string; device: string; ip: string; lastSeen: string; createdAt: string; current: boolean };

export default function SessionsClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/account/sessions", { cache: "no-store" });
    if (!response.ok) { setError("Could not load sessions."); return; }
    const data = await response.json();
    setSessions(data.sessions ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function end(id: string) {
    setBusy(id);
    await fetch(`/api/account/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy("");
    await load();
  }

  async function endAll() {
    if (!window.confirm("Sign out of every session, including Meta connections?")) return;
    const started = performance.now();
    setBusy("all");
    announceOpening("Signing out", true);
    await fetch("/api/account/sessions?all=1", { method: "DELETE" });
    const remaining = 320 - (performance.now() - started);
    window.setTimeout(() => window.location.assign("/login"), Math.max(0, remaining));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="type-micro text-[var(--accent-brass-strong)]">Account</p>
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Sessions</h1>
        <p className="mt-2 text-[13.5px] text-[var(--text-muted)]">Every session ends automatically after 10 minutes without activity.</p>
      </div>
      {error && <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <h2 className="type-h3">Active sessions</h2>
          <button type="button" onClick={() => void endAll()} disabled={busy === "all"} className="min-h-10 rounded-[var(--radius-control)] border border-[#B42318]/40 px-3 text-[11.5px] font-semibold text-[#B42318] disabled:opacity-50">Sign out everywhere</button>
        </div>
        <ul className="divide-y divide-[var(--border-hairline)]/70">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold">{session.device}{session.current && <Badge tone="success">This session</Badge>}</p>
                <p className="text-[10.5px] text-[var(--text-muted)]">{session.ip} · last seen {new Date(session.lastSeen).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => void end(session.id)} disabled={busy === session.id} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[var(--border-hairline)] px-2.5 text-[11px] font-semibold disabled:opacity-50">
                {busy === session.id && <Loader2 className="size-3 animate-spin" />} Sign out
              </button>
            </li>
          ))}
          {!sessions.length && <li className="px-4 py-6 text-[12px] text-[var(--text-muted)]">No sessions found.</li>}
        </ul>
      </Card>
    </div>
  );
}
