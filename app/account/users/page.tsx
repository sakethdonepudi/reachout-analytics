import Navbar from "@/components/site/navbar";
import UsersClient from "./users-client";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePageSession("/account/users", ["owner"]);
  return (
    <>
      <Navbar />
      <main className="app-chrome min-h-screen bg-white pt-28 text-[var(--p-ink)] sm:pt-32">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <UsersClient />
        </div>
      </main>
    </>
  );
}
