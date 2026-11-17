import { Suspense } from "react";
import { getDashboardAnalytics, getDashboardShell } from "@/lib/dashboard/data";
import OwnerDashboard from "@/components/owner/owner-dashboard";
import MetaAnalytics, { AnalyticsSkeleton } from "@/components/owner/meta-analytics";

export const metadata = { title: "Dashboard | ReachOut Analytics" };
export const dynamic = "force-dynamic";

async function AnalyticsSection() {
  const data = await getDashboardAnalytics();
  return <MetaAnalytics data={data} />;
}

export default async function DashboardPage() {
  const shell = await getDashboardShell();
  return (
    <main className="min-h-0 bg-[#FAFAFA] px-4 py-6 text-[#0B0B0C] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1440px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">Owner control centre</p>
            <h1 className="mt-1 font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] text-[#0B0B0C]">Dashboard</h1>
            <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Upload poll data, publish the Meta report, and watch the last published numbers.</p>
          </div>
          {shell.version && <p className="text-[11.5px] text-[#6B6B6B]">Report uploaded {new Date(shell.version.uploadedAt).toLocaleString("en-IN")} · version {shell.version.number}</p>}
        </header>
        <OwnerDashboard shell={shell}>
          <Suspense fallback={<AnalyticsSkeleton />}>
            <AnalyticsSection />
          </Suspense>
        </OwnerDashboard>
      </div>
    </main>
  );
}
