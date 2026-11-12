import Navbar from "@/components/site/navbar";
import UsersClient from "./users-client";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePageSession("/account/users", ["owner"]);
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-28 text-foreground sm:pt-32">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <UsersClient />
        </div>
      </main>
    </>
  );
}
