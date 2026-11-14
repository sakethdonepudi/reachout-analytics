import { cookies } from "next/headers";
import { COOKIE, LEGACY_COOKIE, getSessionByToken } from "@/lib/auth";
import { getUser } from "@/lib/users";
import { CASES } from "@/lib/cases";
import { listCases } from "@/lib/case-registry";
import PublicNavbar from "./public-navbar";
import ClientNavbar from "./client-navbar";
import OwnerNavbar from "./owner-navbar";

export const dynamic = "force-dynamic";

function yearFor(slug: string): number {
  const match = slug.match(/(20\d{2})/);
  return match ? Number(match[1]) : 2026;
}

export default async function Navbar() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? jar.get(LEGACY_COOKIE)?.value;
  const session = await getSessionByToken(token);
  if (!session) return <PublicNavbar />;
  const user = session.userId ? await getUser(session.userId) : null;
  const displayName = session.displayName ?? user?.displayName ?? "Account";
  const username = user?.username ?? "account";
  const signInAt = new Date(session.iat).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const lastLoginAt = user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  const registry = await listCases().catch(() => []);
  const bySlug = new Map(registry.map((row) => [row.slug, row]));
  if (session.role === "owner") {
    const cases = CASES.map((item) => ({
      slug: item.slug,
      title: item.title,
      state: item.stateName,
      party: item.party,
      year: bySlug.get(item.slug)?.electionYear ?? yearFor(item.slug),
      draft: (bySlug.get(item.slug)?.status ?? "draft") !== "published",
    }));
    return (
      <OwnerNavbar
        displayName={displayName}
        username={username}
        signInAt={signInAt}
        lastLoginAt={lastLoginAt}
        lastLoginDevice={user?.lastLoginDevice ?? null}
        cases={cases}
      />
    );
  }

  const cases = CASES.map((item) => ({
    slug: item.slug,
    title: item.title,
    state: item.stateName,
    party: item.party,
    year: bySlug.get(item.slug)?.electionYear ?? yearFor(item.slug),
    draft: false,
  }));
  return (
    <ClientNavbar
      displayName={displayName}
      username={username}
      organisation={user?.organisation ?? null}
      signInAt={signInAt}
      lastLoginAt={lastLoginAt}
      lastLoginDevice={user?.lastLoginDevice ?? null}
      cases={cases}
    />
  );
}
