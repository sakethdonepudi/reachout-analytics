import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, LEGACY_COOKIE, getSessionByToken, type Session } from "@/lib/auth";
import { roleHome, type Role } from "@/lib/access";

/**
 * Server-component guard. Supports both the new __Host- cookie and the legacy
 * cookie so existing sessions keep working during the transition.
 */
export async function requirePageSession(returnTo: string, allowed: Role[] = ["owner", "client"]): Promise<Session> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? (COOKIE !== LEGACY_COOKIE ? jar.get(LEGACY_COOKIE)?.value : undefined);
  const session = await getSessionByToken(token);
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!allowed.includes(session.role)) redirect(roleHome(session.role));
  return session;
}
