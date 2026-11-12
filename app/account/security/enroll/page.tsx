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
  if (!session && !pending) redirect("/login");
  return <EnrollClient />;
}
