import Link from "next/link";
import { ArrowRight, PlugZap, ShieldCheck } from "lucide-react";
import Navbar from "@/components/site/navbar";
import { requirePageSession } from "@/lib/require-session";
import { getMetaStatus } from "@/lib/meta/store";
import { MetaSyncControls } from "@/components/meta/meta-sync-controls";
import { expiresWithinHour } from "@/lib/meta/insights";

export const dynamic = "force-dynamic";

function connectionPill(status: Awaited<ReturnType<typeof getMetaStatus>>): { label: string; tone: string } {
  if (status.expired) return { label: "Reconnect", tone: "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]" };
  if (!status.connected) return { label: "Connect Meta Ads", tone: "border-[var(--accent-brass)]/40 bg-[var(--accent-brass-soft)] text-[var(--accent-brass-strong)]" };
  const minutes = status.expiresAt ? Math.max(0, Math.round((new Date(status.expiresAt).getTime() - Date.now()) / 60_000)) : null;
  const soon = minutes != null && minutes <= 60;
  const hours = minutes == null ? null : Math.floor(minutes / 60);
  return {
    label: minutes == null ? "Connected" : `Connected · expires in ${hours}h ${minutes % 60}m`,
    tone: soon
      ? "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]"
      : "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]",
  };
}

export default async function MetaAdsPage() {
  await requirePageSession("/meta-ads", ["owner"]);
  const status = await getMetaStatus();
  const pill = connectionPill(status);
  const soon = status.connected && status.expiresAt ? expiresWithinHour(status.expiresAt) : false;
  const minutesLeft = status.expiresAt ? Math.max(0, Math.round((new Date(status.expiresAt).getTime() - Date.now()) / 60_000)) : null;
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Owner workspace</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[clamp(34px,5vw,64px)] font-semibold tracking-[-0.03em]">Meta Ads</h1>
            <Link href="/meta-ads/settings" className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.08em] ${pill.tone}`}>{pill.label}</Link>
            <div className="ml-auto"><MetaSyncControls connected={status.connected} expired={status.expired} lastSyncAt={status.lastSyncAt} /></div>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Connect the ReachOut Meta account once, choose the ad accounts to sync, and keep campaign reporting fed by the connection.
          </p>

          {(status.expiresSoon || status.reconnectRequired) && (
            <div className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-[13px] text-saffron-2">
              {status.reconnectRequired
                ? "The stored Meta token can no longer be decrypted. Reconnect Meta to restore sync."
                : "The Meta token expires within 7 days. Reconnect to avoid losing the sync."}
            </div>
          )}

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">Connection</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold">
                    {status.connected ? status.accountName ?? "Meta connected" : "Not connected"}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {status.connected
                      ? `${status.enabledAdAccounts.length} of ${status.adAccounts.length} ad accounts enabled.`
                      : "Connect with Facebook Login for Business to authorise ads_read, business management and page access."}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${status.connected ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground"}`}>
                  {status.connected ? "Connected" : "Offline"}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/meta-ads/settings" className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2.5 text-sm font-semibold text-[#241203] transition hover:brightness-105">
                  <PlugZap className="size-4" /> {status.connected ? "Manage connection" : "Connect Meta Ads"}
                </Link>
                <Link href="/case-studies" className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-elevated">
                  Case studies <ArrowRight className="size-4" />
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-2">
                <ShieldCheck className="size-3.5" /> Security
              </div>
              <ul className="mt-4 space-y-2.5 text-[13px] text-muted-foreground">
                <li>Tokens are encrypted with AES-256-GCM and never returned to the browser.</li>
                <li>Owner actions require a sign-in within the last 15 minutes.</li>
                <li>Disconnect revokes the granted Meta permissions.</li>
              </ul>
            </section>
          </div>

          {!status.connected && (
            <p className="mt-6 text-[12px] text-muted-foreground">
              Meta app review may be required before the requested scopes work for accounts outside your app’s test users.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
