import "server-only";

import { getMongo } from "@/lib/mongodb";
import { tryDecryptToken } from "@/lib/meta/crypto";
import { META_GRAPH_VERSION, META_CONNECTION_TTL_MS } from "@/lib/meta/insights";
import { getWorkspaceConnection, markWorkspaceConnection, META_HOLDER_USERNAME } from "@/lib/meta/store";
import { META_SCOPES } from "@/lib/meta/oauth";

const DAY = 86_400_000;

async function notify(_id: string, kind: string, title: string, body: string, severity: "info" | "warning" | "danger" = "warning") {
  const promise = getMongo();
  if (!promise) return;
  const client = await promise;
  await client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string }>("meta_notifications").updateOne(
    { _id },
    { $setOnInsert: { _id, kind, severity, title, body, createdAt: new Date().toISOString(), read: false } },
    { upsert: true },
  ).catch(() => {});
}

async function markChecked(at = new Date().toISOString()) {
  const promise = getMongo();
  if (!promise) return;
  const client = await promise;
  await client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string }>("meta_connection").updateOne({ _id: "workspace" }, { $set: { lastCheckAt: at } }).catch(() => {});
}

/** Expiry reminders and one debug_token validity check. Safe to call daily. */
export async function checkWorkspaceHealth(): Promise<void> {
  const connection = await getWorkspaceConnection();
  if (!connection) return;
  if (connection.status !== "active") return;

  const expires = connection.expiresAt ? new Date(connection.expiresAt).getTime() : null;
  if (expires != null && expires <= Date.now()) {
    await markWorkspaceConnection("expired", "expiry-check");
    await notify(`workspace:expired:${connection.expiresAt}`, "meta_expired", "Meta connection expired", `The Meta connection held by ${META_HOLDER_USERNAME} expired.`, "danger");
    return;
  }
  if (expires != null) {
    const days = (expires - Date.now()) / DAY;
    if (days <= 1) await notify(`workspace:expiry:1d:${connection.expiresAt}`, "meta_expiry", "Meta connection expires tomorrow", "Reconnect Meta within one day to keep syncing.", "danger");
    else if (days <= 7) await notify(`workspace:expiry:7d:${connection.expiresAt}`, "meta_expiry", "Meta connection expires in 7 days", "Reconnect Meta within seven days to keep syncing.", "warning");
  }

  const decrypted = connection.token ? tryDecryptToken(connection.token) : { ok: false as const };
  if (!decrypted.ok) {
    await markWorkspaceConnection("revoked", "token-undecryptable");
    await notify(`workspace:revoked:${Date.now()}`, "meta_revoked", "Meta connection revoked", "The stored Meta token can no longer be used. The account holder must reconnect.", "danger");
    return;
  }
  const appToken = process.env.META_APP_ID && process.env.META_APP_SECRET ? `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` : "";
  if (!appToken) return;
  try {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token`);
    url.searchParams.set("input_token", decrypted.token);
    url.searchParams.set("access_token", appToken);
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { data?: { is_valid?: boolean; scopes?: string[]; expires_at?: number; data_access_expires_at?: number } };
    const data = payload.data;
    if (!response.ok || !data?.is_valid) {
      await markWorkspaceConnection("revoked", "debug-token-invalid");
      await notify(`workspace:revoked:${Date.now()}`, "meta_revoked", "Meta connection revoked", "Meta reports the token is no longer valid. The account holder must reconnect.", "danger");
      return;
    }
    const missing = META_SCOPES.filter((scope) => !(data.scopes ?? []).includes(scope));
    if (missing.length) {
      await markWorkspaceConnection("revoked", "scopes-removed");
      await notify(`workspace:scopes:${Date.now()}`, "meta_revoked", "Meta permissions removed", `Missing permissions: ${missing.join(", ")}. The account holder must grant again.`, "danger");
      return;
    }
    await markChecked();
  } catch {
    // Network errors are not evidence of revocation. The next daily check retries.
  }
}

export function connectionLifetime(connectedAt: string, tokenExpiresAt: string | null): string {
  const cap = new Date(connectedAt).getTime() + META_CONNECTION_TTL_MS;
  const token = tokenExpiresAt ? new Date(tokenExpiresAt).getTime() : Number.POSITIVE_INFINITY;
  return new Date(Math.min(cap, token)).toISOString();
}
