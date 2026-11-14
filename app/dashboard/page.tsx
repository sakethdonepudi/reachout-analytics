import Navbar from "@/components/site/navbar";
import AdsDesk from "@/components/ads-desk/ads-desk";
import { requirePageSession } from "@/lib/require-session";
import { getActiveVersion, listVersions } from "@/lib/ads-desk/store";
import { unmappedRegions } from "@/lib/ads-desk/mapping";
import { withOwnerLinks } from "@/lib/ads-desk/owner-view";
import { getClientLinks } from "@/lib/ads-desk/settings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageSession("/dashboard", ["owner"]);
  const [active, versions, unmapped, clientLinks] = await Promise.all([getActiveVersion(), listVersions(12), unmappedRegions(), getClientLinks()]);
  return (
    <>
      <Navbar />
      <main className="app-chrome min-h-screen bg-white pt-24 text-[var(--p-ink)] sm:pt-28">
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="type-micro text-[var(--accent-brass-strong)]">Owner home</p>
              <h1 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Ads Desk</h1>
            </div>
            <a href="/dashboard/case-studies" className="footer-link text-[12px] font-semibold text-[var(--accent-brass-strong)]">Case studies dashboard</a>
          </div>
          <div className="mt-5"><AdsDesk data={active ? withOwnerLinks(active.data) : null} versions={versions.map((version) => ({ _id: version._id, uploadedAt: version.uploadedAt, uploadedBy: version.uploadedBy, sha256: version.sha256, fileName: version.fileName, status: version.status, takenAt: version.takenAt }))} defaultRegion="tn2026" unmapped={unmapped} clientLinks={clientLinks} /></div>
        </div>
      </main>
    </>
  );
}
