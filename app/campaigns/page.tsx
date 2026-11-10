import Link from "next/link";
import { ArrowRight, BarChart3, LockKeyhole } from "lucide-react";
import Navbar from "@/components/site/navbar";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requirePageSession("/campaigns", ["owner", "client"]);
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-32 text-foreground">
        <div className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-saffron-2">Client workspace</p>
          <h1 className="mt-3 font-display text-[clamp(34px,5vw,64px)] font-semibold tracking-[-0.03em]">Campaigns</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Campaign reporting lives here for approved client accounts. Cost fields are only available to the ReachOut owner.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/case-studies" className="group rounded-3xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <BarChart3 className="size-6 text-saffron" />
              <h2 className="mt-4 font-display text-xl font-semibold">Election case studies</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Open the protected state selector and dashboards.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-saffron-2">Open <ArrowRight className="size-3.5" /></span>
            </Link>
            <div className="rounded-3xl border border-border bg-card p-6">
              <LockKeyhole className="size-6 text-saffron" />
              <h2 className="mt-4 font-display text-xl font-semibold">Protected reporting</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">Spend and budget controls are restricted to the owner role.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
