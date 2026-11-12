"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import { MetaTagging } from "@/components/meta/meta-tagging";
import { SyncHealth } from "@/components/meta/sync-health";
import { cn } from "@/lib/utils";

type AdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
type Page = { id: string; name: string };
type Status = {
  connected: boolean;
  accountName: string | null;
  metaUserName: string | null;
  holderUserId: string | null;
  holderName: string | null;
  isHolder: boolean;
  status: "active" | "expired" | "revoked" | null;
  declinedScopes: string[];
  permissions: string[];
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  adAccounts: AdAccount[];
  pages: Page[];
  enabledAdAccounts: string[];
  expiresSoon: boolean;
  expiresAt: string | null;
  expired: boolean;
  reconnectRequired: boolean;
  keyVersion: string | null;
};
type AuditRow = { at: string; action: string; email: string | null; role: string | null; ipHash?: string };

const EMPTY: Status = {
  connected: false, accountName: null, metaUserName: null, holderUserId: null, holderName: null, isHolder: false, status: null, declinedScopes: [], permissions: [], tokenExpiresAt: null, lastSyncAt: null,
  connectedAt: null, adAccounts: [], pages: [], enabledAdAccounts: [], expiresSoon: false,
  expiresAt: null, expired: false, reconnectRequired: false, keyVersion: null,
};

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function expiryLabel(value: string): string {
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60_000));
  const days = Math.floor(minutes / 1440);
  if (days > 0) return `expires in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `expires in ${hours}h ${minutes % 60}m`;
}

export default function MetaSettings({ metaConfigured = true, approvedScopes = [] }: { metaConfigured?: boolean; approvedScopes?: string[] }) {
  const [status, setStatus] = useState<Status>(EMPTY);
  const [recent, setRecent] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { requestReauth } = useReauth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, auditRes, sessionRes] = await Promise.all([
        fetch("/api/meta/owner/status", { cache: "no-store" }),
        fetch("/api/meta/owner/audit?limit=50", { cache: "no-store" }),
        fetch("/api/auth/session", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data.status ?? EMPTY);
        setSelected((data.status?.enabledAdAccounts ?? []) as string[]);
        setRecent(Boolean(data.recent));
      }
      if (auditRes.ok) setAudit((await auditRes.json()).rows ?? []);
      if (sessionRes.ok) {
        const data = await sessionRes.json();
        setRecent(Boolean(data.recent));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setMessage("Meta connected. Choose the ad accounts to sync.");
    const errorCode = params.get("error");
    if (errorCode) {
      const reason = params.get("reason") ?? "";
      if (errorCode === "state") setError("This connect attempt is no longer valid. Start again.");
      else if (errorCode === "session") setError("Your session could not be verified. Sign in and try again.");
      else if (errorCode === "expired") setError("The connect attempt expired. Start again.");
      else if (errorCode === "facebook") {
        if (reason === "access_denied") setError("You cancelled or declined permissions.");
        else if (reason === "app_role") setError("This Facebook profile isn't added to the ReachOut Meta app. Ask the app admin to add you under App roles.");
        else if (reason === "redirect") setError("Redirect URL not allowed in the Meta app settings.");
        else setError(`Facebook error ${reason.replace(/_/g, " ")}`);
      } else setError("Meta connection could not be completed. Please try again.");
    }
    void load();
  }, [load]);

  function toggleAccount(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function reauthNow() {
    const ok = await requestReauth();
    if (ok) await load();
  }

  async function startConnect() {
    const session = await fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (!session?.recent) {
      const ok = await requestReauth();
      if (!ok) return;
    }
    window.location.assign("/api/meta/owner/connect/start?next=/meta-ads/settings");
  }

  async function saveSelection(retry = false) {
    setBusy("save"); setError(""); setMessage("");
    try {
      const res = await fetch("/api/meta/owner/connect/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountIds: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "reauth_required") {
        const ok = retry ? false : await requestReauth();
        if (!ok) { setError("Re-authentication required."); return; }
        await saveSelection(true);
        return;
      }
      if (!res.ok) throw new Error("Could not save the ad account selection");
      setMessage("Ad account selection saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the selection");
    } finally { setBusy(""); }
  }

  async function disconnect(retry = false) {
    if (!retry && !window.confirm("Disconnect Meta and revoke the granted permissions?")) return;
    setBusy("disconnect"); setError(""); setMessage("");
    try {
      const res = await fetch("/api/meta/owner/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "reauth_required") {
        const ok = retry ? false : await requestReauth();
        if (!ok) { setError("Re-authentication required."); return; }
        await disconnect(true);
        return;
      }
      if (!res.ok) throw new Error("Could not disconnect Meta");
      setMessage("Meta disconnected and permissions revoked.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Meta");
    } finally { setBusy(""); }
  }

  return (
    <>
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <Link href="/meta-ads" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Meta Ads
          </Link>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--accent-brass-strong)]">Owner settings</p>
          <h1 className="mt-2 font-display text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.03em]">Meta connection</h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Connect once with Facebook Login for Business. Tokens are encrypted at rest and never sent back to the browser.
          </p>

          {!metaConfigured && (
            <div role="status" className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300">
              <p className="font-semibold">Meta app not configured</p>
              <p className="mt-1 text-[12.5px]">Set META_APP_ID and META_APP_SECRET to enable Meta Ads. The rest of the site is unaffected.</p>
            </div>
          )}
          {error && <p role="alert" className="mt-5 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}
          {message && <p role="status" className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-300">{message}</p>}
          {status.expiresSoon && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-[13px] text-[var(--accent-brass-strong)]">
              <span>The Meta token expires within 7 days.</span>
              <button type="button" onClick={() => void startConnect()} className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-[12px] font-semibold text-[#241203]">
                <RefreshCw className="size-3.5" /> Reconnect Meta
              </button>
            </div>
          )}
          {status.reconnectRequired && (
            <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-600 dark:text-rose-400">
              <span>The stored Meta token can no longer be decrypted.</span>
              <button type="button" onClick={() => void startConnect()} className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-[12px] font-semibold text-[#241203]">
                <RefreshCw className="size-3.5" /> Reconnect Meta
              </button>
            </div>
          )}

          <section className="mt-8 rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Connection</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">{loading ? "Loading…" : status.expired || status.reconnectRequired ? "Reconnect Meta" : status.connected ? status.accountName ?? "Meta connected" : "Not connected"}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {status.expired || status.status === "expired" || status.status === "revoked"
                    ? "The Meta connection is no longer active. The account holder must reconnect."
                    : status.reconnectRequired
                      ? "The stored Meta token can no longer be decrypted. The account holder must reconnect."
                      : status.connected
                        ? `${status.isHolder ? `Connected as ${status.metaUserName ?? "Meta user"}` : `Connected by ${status.holderName ?? "the Meta account holder"}`} · ${status.enabledAdAccounts.length} ad account(s) enabled${status.expiresAt ? ` · ${expiryLabel(status.expiresAt)}` : ""}`
                        : "The Meta account holder has not connected an account yet."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {status.isHolder && (!recent ? (
                  <button type="button" onClick={() => void reauthNow()} disabled={!metaConfigured} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] disabled:cursor-not-allowed disabled:opacity-50">
                    <ShieldCheck className="size-4" /> Re-authenticate
                  </button>
                ) : (
                  <button type="button" onClick={() => window.location.assign("/api/meta/owner/connect/start")} disabled={!metaConfigured} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] disabled:cursor-not-allowed disabled:opacity-50">
                    <PlugZap className="size-4" /> {status.connected || status.expired || status.reconnectRequired ? "Reconnect Meta" : "Connect Meta Ads"}
                  </button>
                ))}
                {status.isHolder && status.connected && (
                  <button type="button" onClick={() => void disconnect()} disabled={busy === "disconnect"} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-60 dark:text-rose-400">
                    {busy === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />} Disconnect
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">
              Facebook connects whichever profile is logged in on this browser. Choose all the businesses, ad accounts and Pages you want ReachOut to read.
            </p>
            {status.isHolder && !status.connected && (
              <p className="mt-2 text-[11.5px] text-muted-foreground">To use a different profile, log out of facebook.com in this browser first, or use a private window.</p>
            )}
            {status.isHolder && status.declinedScopes.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] p-3 text-[12px]">
                <p className="font-semibold">Declined permissions: {status.declinedScopes.join(", ")}</p>
                <a href="/api/meta/owner/connect/start?rerequest=1" className="mt-2 inline-flex min-h-9 items-center rounded-full border border-current px-3 text-[11px] font-bold uppercase tracking-[0.08em]">Grant again</a>
              </div>
            )}
            {status.isHolder && (
              <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[12px] font-semibold text-[var(--accent-brass-strong)] underline decoration-dotted underline-offset-4">Manage what ReachOut can access</a>
            )}

            {status.connected && (
              <dl className="mt-6 grid gap-4 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-muted-foreground">Permissions</dt><dd className="mt-1 font-medium">{status.permissions.filter((permission) => approvedScopes.includes(permission)).join(", ") || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Token expiry</dt><dd className="mt-1 font-medium">{fmt(status.tokenExpiresAt)}</dd></div>
                <div><dt className="text-muted-foreground">Last sync</dt><dd className="mt-1 font-medium">{fmt(status.lastSyncAt)}</dd></div>
                <div><dt className="text-muted-foreground">Connected</dt><dd className="mt-1 font-medium">{fmt(status.connectedAt)}</dd></div>
              </dl>
            )}
          </section>

          <SyncHealth />

          {status.connected && !status.reconnectRequired && (
            <section className="mt-6 rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Ad accounts</p>
                  <h2 className="mt-2 font-display text-xl font-semibold">Choose what to sync</h2>
                </div>
                <button type="button" onClick={() => void saveSelection()} disabled={busy === "save"} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold hover:bg-elevated disabled:opacity-60">
                  {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save selection
                </button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {status.adAccounts.map((account) => (
                  <label key={account.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-[13px]", selected.includes(account.id) ? "border-saffron/50 bg-saffron/5" : "border-border")}>
                    <input type="checkbox" checked={selected.includes(account.id)} onChange={() => toggleAccount(account.id)} className="mt-0.5 size-4 accent-[var(--saffron)]" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{account.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{account.accountId} · {account.currency ?? "—"} · status {account.status ?? "—"}</span>
                    </span>
                  </label>
                ))}
                {!status.adAccounts.length && <p className="text-[13px] text-muted-foreground">No ad accounts were returned by Meta.</p>}
              </div>
              {status.pages.length > 0 && (
                <p className="mt-4 text-[11px] text-muted-foreground">Pages granted: {status.pages.map((page) => page.name).join(", ")}</p>
              )}
            </section>
          )}

          <section id="tagging" className="mt-6 scroll-mt-24 rounded-3xl border border-border bg-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Tagging</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Campaign tags</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Naming rules suggest a state and party. Confirm the suggestions or edit them inline. Clients only see confirmed tags.</p>
            <div className="mt-4"><MetaTagging /></div>
          </section>

          <section className="mt-6 rounded-3xl border border-border bg-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Notifications</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Alerts</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Status changes, payment issues, spend-cap alerts and zero-delivery campaigns are stored in MongoDB for the dashboard.</p>
            <span className="mt-4 inline-flex min-h-8 items-center rounded-full border border-border px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">WhatsApp delivery disabled</span>
          </section>

          <section className="mt-6 rounded-3xl border border-border bg-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Sensitive actions</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Owner re-authentication</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Meta connect or disconnect, the party map and exports require the owner password again if your last sign-in was more than 15 minutes ago.</p>
            <button type="button" onClick={() => void reauthNow()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-elevated">
              <ShieldCheck className="size-4" /> Re-authenticate
            </button>
          </section>

          <section className="mt-6 rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent-brass-strong)]">Audit</p>
                <h2 className="mt-2 font-display text-xl font-semibold">Recent security events</h2>
              </div>
              <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold hover:bg-elevated"><RefreshCw className="size-3.5" /> Refresh</button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[540px] border-collapse text-[11.5px]">
                <thead><tr className="border-b border-border text-left text-[9px] uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">IP hash</th></tr></thead>
                <tbody>{audit.map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-t border-border/60">
                    <td className="px-3 py-1.5 text-muted-foreground">{fmt(row.at)}</td>
                    <td className="px-3 py-1.5 font-medium">{row.action}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.role ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{row.ipHash ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

    </>
  );
}
