import Link from "next/link";
import Navbar from "@/components/site/navbar";
import { requirePageSession } from "@/lib/require-session";
import { getUser } from "@/lib/users";
import SecurityClient from "./security-client";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await requirePageSession("/account/security");
  const user = session.userId ? await getUser(session.userId) : null;
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-28 text-foreground sm:pt-32">
        <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
          <SecurityClient enabled={Boolean(user?.totpEnabled)} required={Boolean(user?.totpRequired)} />
          <p className="mt-5 text-[12px] text-[var(--text-muted)]"><Link href="/account/sessions" className="underline decoration-dotted underline-offset-4">View your sessions</Link> · <Link href="/account/password" className="underline decoration-dotted underline-offset-4">Change password</Link></p>
        </div>
      </main>
    </>
  );
}
