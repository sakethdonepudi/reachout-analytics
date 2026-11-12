import "server-only";

import type { NextRequest } from "next/server";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";

export const PENDING_COOKIE = "ro_pending";
const TTL_MS = 3 * 60 * 1000;

export type PendingPurpose = "totp" | "password" | "enroll";
export type PendingAuth = { userId: string; purpose: PendingPurpose; next?: string | null };

export function setPendingCookie(response: Response, payload: PendingAuth) {
  const token = signPayload(payload as unknown as Record<string, unknown>, process.env.ADMIN_SESSION_SECRET ?? "", TTL_MS);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=180${secure}`);
}

export function readPending(req: NextRequest): PendingAuth | null {
  return verifyPayload<PendingAuth>(req.cookies.get(PENDING_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET ?? "");
}

export function clearPendingCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
