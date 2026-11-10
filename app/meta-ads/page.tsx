import Link from "next/link";
import { ArrowRight, PlugZap, ShieldCheck } from "lucide-react";
import Navbar from "@/components/site/navbar";
import { requirePageSession } from "@/lib/require-session";
import { getMetaStatus } from "@/lib/meta/store";

export const dynamic = "force-dynamic";

export default async function MetaAdsPage() {
  await requirePageSession("/meta-ads", ["owner"]);
  const status = await getMetaStatus();
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Owner workspace</p>
          <h1 className="mt-3 font-display text-[clamp(34px,5vw,64px)] font-semibold tracking-[-0.03em]">Meta Ads</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Connect the ReachOut Meta account once, choose the ad accounts to sync, and keep campaign reporting fed by the connection.
          </p>

          {status.expiresSoon && (
            <div className="mt-6 rounded-2xl border border-saffron/40 bg-saffron/10 px-4 py-3 text-[13px] text-saffron-2">
              The Meta token expires within 7 days. Reconnect to avoid losing the sync.
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
                      : "Connect with Facebook Login for Business to authorise ads_read, insights, pages and Instagram access."}
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
