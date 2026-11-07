import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, getSessionByToken, type Session } from "@/lib/auth";

/**
 * Server-component guard for protected case-study pages. Redirects logged-out
 * visitors to the login page with a safe internal return path.
 */
export async function requirePageSession(returnTo: string): Promise<Session> {
  const token = (await cookies()).get(COOKIE)?.value;
  const session = await getSessionByToken(token);
  if (!session || session.role !== "admin") {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
