"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, PlugZap, RefreshCw, ShieldCheck, Trash2, Unplug, UserPlus } from "lucide-react";
import Navbar from "@/components/site/navbar";
import { cn } from "@/lib/utils";

type AdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
type Page = { id: string; name: string; instagramId?: string | null; instagramUsername?: string | null };
type Status = {
  connected: boolean;
  accountName: string | null;
  permissions: string[];
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  adAccounts: AdAccount[];
  pages: Page[];
  enabledAdAccounts: string[];
  expiresSoon: boolean;
  keyVersion: string | null;
};
type AuditRow = { at: string; action: string; email: string | null; role: string | null; ipHash?: string };

const EMPTY: Status = {
  connected: false, accountName: null, permissions: [], tokenExpiresAt: null, lastSyncAt: null,
  connectedAt: null, adAccounts: [], pages: [], enabledAdAccounts: [], expiresSoon: false, keyVersion: null,
};

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function MetaSettings({ metaConfigured = true }: { metaConfigured?: boolean }) {
  const [status, setStatus] = useState<Status>(EMPTY);
  const [recent, setRecent] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, clientsRes, auditRes, sessionRes] = await Promise.all([
        fetch("/api/meta/owner/status", { cache: "no-store" }),
        fetch("/api/meta/owner/clients", { cache: "no-store" }),
        fetch("/api/meta/owner/audit?limit=50", { cache: "no-store" }),
        fetch("/api/auth/session", { cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setStatus(data.status ?? EMPTY);
        setSelected((data.status?.enabledAdAccounts ?? []) as string[]);
        setRecent(Boolean(data.recent));
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setOwners(data.owners ?? []);
        setClients(data.clients ?? []);
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
    if (params.get("error")) setError("Meta connection could not be completed. Please try again.");
    void load();
  }, [load]);

  function toggleAccount(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function reauth() {
    window.location.assign("/api/auth/google/start?next=/meta-ads/settings");
  }

  async function saveSelection() {
    setBusy("save"); setError(""); setMessage("");
    try {
      const res = await fetch("/api/meta/owner/connect/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountIds: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "reauth_required") { setError("Re-authenticate to change Meta settings."); return; }
      if (!res.ok) throw new Error("Could not save the ad account selection");
      setMessage("Ad account selection saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the selection");
    } finally { setBusy(""); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Meta and revoke the granted permissions?")) return;
    setBusy("disconnect"); setError(""); setMessage("");
    try {
      const res = await fetch("/api/meta/owner/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === "reauth_required") { setError("Re-authenticate to disconnect Meta."); return; }
      if (!res.ok) throw new Error("Could not disconnect Meta");
      setMessage("Meta disconnected and permissions revoked.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect Meta");
    } finally { setBusy(""); }
  }

  async function addClient() {
    setBusy("client"); setError(""); setMessage("");
    try {
      const res = await fetch("/api/meta/owner/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add the client email");
      setClients(data.clients ?? []);
      setEmail("");
      setMessage("Client email added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the client email");
    } finally { setBusy(""); }
  }

  async function removeClient(value: string) {
    setBusy(`remove:${value}`); setError(""); setMessage("");
    try {
      const res = await fetch(`/api/meta/owner/clients?email=${encodeURIComponent(value)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove the client email");
      setClients(data.clients ?? []);
      setMessage("Client email removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the client email");
    } finally { setBusy(""); }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <Link href="/meta-ads" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Meta Ads
          </Link>
          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Owner settings</p>
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-[13px] text-saffron-2">
              <span>The Meta token expires within 7 days.</span>
              <button type="button" onClick={reauth} className="inline-flex items-center gap-1.5 rounded-lg bg-saffron px-3 py-1.5 text-[12px] font-semibold text-[#241203]">
                <RefreshCw className="size-3.5" /> Reconnect
              </button>
            </div>
          )}

          <section className="mt-8 rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Connection</p>
                <h2 className="mt-2 font-display text-2xl font-semibold">{loading ? "Loading…" : status.connected ? status.accountName ?? "Meta connected" : "Not connected"}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {status.connected ? `${status.enabledAdAccounts.length} ad account(s) enabled · key ${status.keyVersion ?? "—"}` : "Authorise the ReachOut Meta app to start syncing."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!recent ? (
                  <button type="button" onClick={reauth} disabled={!metaConfigured} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] disabled:cursor-not-allowed disabled:opacity-50">
                    <ShieldCheck className="size-4" /> Re-authenticate
                  </button>
                ) : (
                  <button type="button" onClick={() => window.location.assign("/api/meta/owner/connect/start")} disabled={!metaConfigured} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] disabled:cursor-not-allowed disabled:opacity-50">
                    <PlugZap className="size-4" /> {status.connected ? "Reconnect Meta" : "Connect Meta Ads"}
                  </button>
                )}
                {status.connected && (
                  <button type="button" onClick={disconnect} disabled={busy === "disconnect"} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-600 disabled:opacity-60 dark:text-rose-400">
                    {busy === "disconnect" ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />} Disconnect
                  </button>
                )}
              </div>
            </div>

            {status.connected && (
              <dl className="mt-6 grid gap-4 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-muted-foreground">Permissions</dt><dd className="mt-1 font-medium">{status.permissions.join(", ") || "—"}</dd></div>
                <div><dt className="text-muted-foreground">Token expiry</dt><dd className="mt-1 font-medium">{fmt(status.tokenExpiresAt)}</dd></div>
                <div><dt className="text-muted-foreground">Last sync</dt><dd className="mt-1 font-medium">{fmt(status.lastSyncAt)}</dd></div>
                <div><dt className="text-muted-foreground">Connected</dt><dd className="mt-1 font-medium">{fmt(status.connectedAt)}</dd></div>
              </dl>
            )}
          </section>

          {status.connected && (
            <section className="mt-6 rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Ad accounts</p>
                  <h2 className="mt-2 font-display text-xl font-semibold">Choose what to sync</h2>
                </div>
                <button type="button" onClick={saveSelection} disabled={busy === "save"} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold hover:bg-elevated disabled:opacity-60">
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

          <section className="mt-6 rounded-3xl border border-border bg-card p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Access</p>
            <h2 className="mt-2 font-display text-xl font-semibold">Client emails</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Owner emails come from <code className="rounded bg-muted px-1">OWNER_EMAILS</code> and cannot be removed here. Added clients can open case studies and campaigns.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" type="email" className="min-w-0 flex-1 rounded-xl border border-border bg-elevated/60 px-3.5 py-2.5 text-[13px] outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20" />
              <button type="button" onClick={addClient} disabled={busy === "client" || !email} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] disabled:opacity-60">
                {busy === "client" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add client
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Owners (env)</p>
                <ul className="mt-2 space-y-1 text-[12.5px]">{owners.map((owner) => <li key={owner} className="rounded-lg border border-border/60 px-2.5 py-1.5">{owner}</li>)}</ul>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Clients</p>
                <ul className="mt-2 space-y-1 text-[12.5px]">{clients.map((client) => (
                  <li key={client} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5">
                    <span className="truncate">{client}</span>
                    <button type="button" onClick={() => removeClient(client)} disabled={busy === `remove:${client}`} aria-label={`Remove ${client}`} className="text-muted-foreground hover:text-rose-500">
                      {busy === `remove:${client}` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </li>
                ))}</ul>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Audit</p>
                <h2 className="mt-2 font-display text-xl font-semibold">Recent security events</h2>
              </div>
              <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold hover:bg-elevated"><RefreshCw className="size-3.5" /> Refresh</button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[540px] border-collapse text-[11.5px]">
                <thead><tr className="border-b border-border text-left text-[9px] uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2">Time</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th></tr></thead>
                <tbody>{audit.map((row, index) => (
                  <tr key={`${row.at}-${index}`} className="border-t border-border/60">
                    <td className="px-3 py-1.5 text-muted-foreground">{fmt(row.at)}</td>
                    <td className="px-3 py-1.5 font-medium">{row.action}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{row.role ?? "—"}</td>
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
