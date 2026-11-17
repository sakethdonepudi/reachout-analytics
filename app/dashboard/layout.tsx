import type { ReactNode } from "react";
import OwnerShell from "@/components/owner/owner-shell";
import { requirePageSession } from "@/lib/require-session";
import { getUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function OwnerDashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePageSession("/dashboard", ["owner"]);
  const user = session.userId ? await getUser(session.userId) : null;
  return (
    <OwnerShell displayName={session.displayName ?? user?.displayName ?? "Owner"} username={user?.username ?? "owner"}>
      {children}
    </OwnerShell>
  );
}
