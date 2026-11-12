import Link from "next/link";
import { after } from "next/server";
import Navbar from "@/components/site/navbar";
import OwnerDashboard from "@/components/meta/owner-dashboard";
import { requirePageSession } from "@/lib/require-session";
import { getMetaDb, getWorkspaceConnection } from "@/lib/meta/store";
import { getSyncHealth } from "@/lib/meta/sync-health";
import { listCases } from "@/lib/case-registry";
import { listUsers } from "@/lib/users";
import { maybeBackgroundSync } from "@/lib/meta/background";

export const dynamic = "force-dynamic";

function relative(value: string | null | undefined): string {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

export default async function DashboardPage() {
  const session = await requirePageSession("/dashboard", ["owner"]);
  after(() => maybeBackgroundSync());
  const db = await getMetaDb();
  const connection = await getWorkspaceConnection();
  const [users, cases, health] = await Promise.all([
    listUsers(),
    listCases().catch(() => []),
    db ? getSyncHealth(db).catch(() => null) : null,
  ]);
  let liveCampaigns = 0;
  let pendingTags = 0;
  let allAccounts = 0;
  let ownAccounts = 0;
  if (db) {
    if (connection?.adAccounts.length) {
      liveCampaigns = await db.collection("meta_campaigns").countDocuments({ accountId: { $in: connection.adAccounts.map((account) => account.id) }, effectiveStatus: "ACTIVE" }).catch(() => 0);
    }
    pendingTags = await db.collection("meta_campaign_tags").countDocuments({ confirmed: false }).catch(() => 0);
    allAccounts = await db.collection("meta_accounts").countDocuments({}).catch(() => 0);
    ownAccounts = connection?.adAccounts.length ?? 0;
  }
  const activeClients = users.filter((user) => user.role === "client" && user.status === "active").length;
  const activeOwners = users.filter((user) => user.role === "owner" && user.status === "active").length;
  const expires = connection?.expiresAt ? Math.max(0, Math.round((new Date(connection.expiresAt).getTime() - Date.now()) / 60_000)) : null;
  const lastOutcome = health?.latest?.outcome ?? "—";

  const kpis = [
    { label: "Meta ad accounts", value: connection ? `${ownAccounts} this session · ${allAccounts} synced` : `${allAccounts} synced` },
    { label: "Active clients", value: String(activeClients) },
    { label: "Active owners", value: String(activeOwners) },
    { label: "Live campaigns", value: String(liveCampaigns) },
    { label: "Tags to confirm", value: String(pendingTags) },
    { label: "Meta connection", value: connection ? `Connected as ${connection.metaUserName} · ${Math.floor((expires ?? 0) / 60)}h ${(expires ?? 0) % 60}m` : "Connect Meta Ads" },
    { label: "Last sync", value: `${lastOutcome} · ${relative(health?.latest?.finishedAt ?? null)}` },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-24 text-foreground sm:pt-28">
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="type-micro text-[var(--accent-brass-strong)]">Owner home</p>
              <h1 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Dashboard</h1>
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">Signed in as {session.displayName ?? "Owner"}</p>
          </div>

          <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-3 py-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{kpi.label}</dt>
                <dd className="mt-1 text-[14px] font-semibold">{kpi.value}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-6" aria-label="Meta Ads overview">
            <OwnerDashboard />
          </section>

          <section className="mt-8" aria-label="Case studies">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">Case studies</h2>
              <Link href="/dashboard/case-studies" className="text-[11.5px] font-semibold text-[var(--accent-brass-strong)]">Case studies dashboard</Link>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {cases.map((record) => (
                <Link key={record.id} href={`/case-studies/${record.slug}`} className="min-w-[220px] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-4 transition hover:border-[var(--accent-brass)]/50">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{record.state} · {record.electionYear}</p>
                  <p className="mt-1 font-semibold">{record.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{record.status === "published" ? "Published" : "Draft"}{record.description ? ` · ${record.description.slice(0, 60)}` : ""}</p>
                </Link>
              ))}
              {!cases.length && <p className="text-[12px] text-[var(--text-muted)]">No case studies registered.</p>}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
