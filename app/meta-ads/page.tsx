import Navbar from "@/components/site/navbar";
import OwnerDashboard from "@/components/meta/owner-dashboard";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function MetaAdsPage() {
  await requirePageSession("/meta-ads", ["owner"]);
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-28 text-foreground sm:pt-32">
        <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 sm:px-6 lg:px-8">
          <OwnerDashboard />
        </div>
      </main>
    </>
  );
}
