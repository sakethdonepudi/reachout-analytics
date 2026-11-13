"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useReauth } from "@/components/auth/reauth-provider";
import { useNavigate } from "@/lib/use-navigate";

export default function SecurityClient({ enabled, required }: { enabled: boolean; required: boolean }) {
  const navigate = useNavigate();
  const { requestReauth } = useReauth();
  const [busy, setBusy] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function regenerate(retry = false) {
    setBusy("recovery"); setError("");
    try {
      const response = await fetch("/api/account/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "recovery" }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data.code === "reauth_required" && !retry) {
        if (await requestReauth()) return regenerate(true);
      }
      if (!response.ok) { setError(typeof data.error === "string" ? data.error : "Could not regenerate codes."); return; }
      setCodes(data.recoveryCodes ?? []);
    } finally { setBusy(""); }
  }

  async function replace() {
    if (!window.confirm("Replace the authenticator? You will scan a new QR code.")) return;
    if (!(await requestReauth())) return;
    setBusy("replace");
    await fetch("/api/account/totp", { method: "DELETE" });
    navigate.replace("/account/security/enroll");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="type-micro text-[var(--accent-brass-strong)]">Account</p>
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Security</h1>
      </div>
      {error && <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="type-h3 flex items-center gap-2"><ShieldCheck className="size-4" /> Authenticator app</h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Time-based one-time codes from Google Authenticator or Microsoft Authenticator.</p>
          </div>
          <Badge tone={enabled ? "success" : required ? "warning" : "neutral"}>{enabled ? "Enrolled" : required ? "Required" : "Not enrolled"}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!enabled ? (
            <a href="/account/security/enroll" className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[12.5px] font-semibold text-[var(--text-on-brass)]">Set up authenticator</a>
          ) : (
            <>
              <button type="button" onClick={() => void replace()} disabled={busy === "replace"} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-4 text-[12.5px] font-semibold disabled:opacity-60">{busy === "replace" && <Loader2 className="size-3.5 animate-spin" />} Replace authenticator</button>
              <button type="button" onClick={() => void regenerate()} disabled={busy === "recovery"} className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-4 text-[12.5px] font-semibold disabled:opacity-60">{busy === "recovery" ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />} Regenerate recovery codes</button>
            </>
          )}
        </div>
      </Card>

      {codes && (
        <Card className="p-5">
          <h2 className="type-h3">New recovery codes</h2>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">Shown once. Each code works once.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-[13px]">{codes.map((code) => <li key={code} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2">{code}</li>)}</ul>
          <label className="mt-4 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="size-4 accent-[var(--accent-brass)]" /> I have saved these codes.</label>
          <button type="button" disabled={!saved} onClick={() => { setCodes(null); setSaved(false); }} className="mt-3 min-h-10 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[12.5px] font-semibold text-[var(--text-on-brass)] disabled:opacity-50">Done</button>
        </Card>
      )}
    </div>
  );
}
