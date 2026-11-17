import type { ReactNode } from "react";
import { cookies } from "next/headers";
import OwnerShell from "@/components/owner/owner-shell";
import Navbar from "@/components/site/navbar";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const session = await getSessionByToken(jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value);
  if (!session) return <>{children}</>;
  const user = session.userId ? await getUser(session.userId) : null;
  if (session.role === "owner") {
    return (
      <OwnerShell displayName={session.displayName ?? user?.displayName ?? "Owner"} username={user?.username ?? "owner"}>
        {children}
      </OwnerShell>
    );
  }
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
