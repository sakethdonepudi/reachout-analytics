import OwnerDashboard from "@/components/owner/owner-dashboard";
import { listSurveyVersions } from "@/lib/survey/store";

export const metadata = { title: "Dashboard | ReachOut Analytics" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [tamilNadu, andhraPradesh] = await Promise.all([
    listSurveyVersions("tamil-nadu").catch(() => []),
    listSurveyVersions("andhra-pradesh-2024").catch(() => []),
  ]);
  return (
    <main className="min-h-screen bg-[color:var(--theme-bg)] px-4 py-6 text-[color:var(--theme-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1280px]">
        <header className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--theme-text-3)]">Owner control centre</p>
          <h1 className="mt-1 font-display text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.03em] text-[color:var(--theme-text)]">Dashboard</h1>
          <p className="mt-1 text-[12.5px] text-[color:var(--theme-text-3)]">Publish the Tamil Nadu and Andhra Pradesh dashboard HTML files and review the live versions.</p>
        </header>
        <OwnerDashboard tamilNadu={tamilNadu} andhraPradesh={andhraPradesh} />
      </div>
    </main>
  );
}
