import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@/components/site/brand";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NoAccessPage() {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  const home = session?.role === "owner" ? "/dashboard" : "/";
  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-6 text-[var(--text-primary)]">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-8 text-center shadow-[var(--shadow-soft)]">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="type-h2 mt-7">Access restricted</h1>
        <p className="type-small mt-2 text-[var(--text-muted)]">This account does not have access.</p>
        <Link href={home} className="mt-6 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--r-navy)] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--r-navy)]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
