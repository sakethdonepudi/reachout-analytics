import "server-only";

import type { NextRequest } from "next/server";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";

export const PENDING_COOKIE = "ro_pending";
const TOTP_TTL_MS = 3 * 60 * 1000;
const FIRST_LOGIN_TTL_MS = 15 * 60 * 1000;

export type PendingPurpose = "totp" | "password" | "enroll";
export type PendingAuth = { userId: string; purpose: PendingPurpose; next?: string | null };

export function pendingTtlMs(purpose: PendingPurpose): number {
  return purpose === "totp" ? TOTP_TTL_MS : FIRST_LOGIN_TTL_MS;
}

export function setPendingCookie(response: Response, payload: PendingAuth) {
  const ttl = pendingTtlMs(payload.purpose);
  const token = signPayload(payload as unknown as Record<string, unknown>, process.env.ADMIN_SESSION_SECRET ?? "", ttl);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${PENDING_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(ttl / 1000)}${secure}`);
}

export function readPending(req: NextRequest): PendingAuth | null {
  return verifyPayload<PendingAuth>(req.cookies.get(PENDING_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET ?? "");
}

export function clearPendingCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${PENDING_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
