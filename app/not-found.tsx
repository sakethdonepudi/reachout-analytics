import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@/components/site/brand";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import GeoBackdrop from "@/components/precision/geo-backdrop";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  const home = session?.role === "owner" ? "/dashboard" : "/";
  return (
    <main className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-white px-6 text-[var(--p-ink)]">
      <GeoBackdrop mask="none" className="opacity-70" />
      <div className="relative w-full max-w-md rounded-[16px] border border-[var(--p-line)] bg-white p-8 text-center shadow-[var(--p-shadow)]">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-7 font-display text-[clamp(32px,4vw,44px)] font-bold tracking-[-0.03em]">Page not found</h1>
        <p className="mt-2 text-[14px] text-[var(--p-ink-2)]">That page is not available.</p>
        <Link href={home} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[#0B0B0C] px-5 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B0B0C] focus-visible:ring-offset-2">
          Back to home
        </Link>
      </div>
    </main>
  );
}
