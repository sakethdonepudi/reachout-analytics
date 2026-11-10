import { tryDecryptToken } from "@/lib/meta/crypto";
import { getConnectionDoc } from "@/lib/meta/store";

const GRAPH = "https://graph.facebook.com/v21.0";

/** The stored token cannot be decrypted; the owner must reconnect Meta. */
export class MetaReconnectError extends Error {
  constructor() {
    super("Reconnect Meta");
    this.name = "MetaReconnectError";
  }
}

/** Decrypt only inside this module, at call time. Never return the token. */
async function accessToken(): Promise<string> {
  const doc = await getConnectionDoc();
  if (doc?.token) {
    const result = tryDecryptToken(doc.token);
    if (result.ok) return result.token;
    throw new MetaReconnectError();
  }
  if (process.env.META_SYSTEM_USER_TOKEN) return process.env.META_SYSTEM_USER_TOKEN;
  throw new Error("Meta is not connected");
}

export async function graphGet<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await accessToken();
  const url = new URL(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta request failed (${res.status})`);
  return data as T;
}

export async function revokeMetaPermissions(): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`${GRAPH}/me/permissions`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) throw new Error("Meta permission revoke failed");
}
