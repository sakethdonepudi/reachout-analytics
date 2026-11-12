import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import EnrollClient from "./enroll-client";
import { PENDING_COOKIE } from "@/lib/pending-auth";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EnrollPage() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  const session = await getSessionByToken(token);
  const pending = jar.get(PENDING_COOKIE)?.value;
  if (!session && !pending) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[var(--surface-canvas)] px-5 text-[var(--text-primary)]">
        <div className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-7">
          <h1 className="type-h1">This sign-in step timed out</h1>
          <p className="mt-2 text-[13px] text-[var(--text-muted)]">Sign in again with your temporary password.</p>
          <a href="/login" className="mt-5 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[13px] font-semibold text-[var(--text-on-brass)]">Sign in again</a>
        </div>
      </main>
    );
  }
  return <EnrollClient />;
}
