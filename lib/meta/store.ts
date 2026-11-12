import "server-only";

import { randomBytes } from "node:crypto";
import type { Collection, Db } from "mongodb";
import { getMongo } from "@/lib/mongodb";
import { tryDecryptToken, type EncryptedToken } from "@/lib/meta/crypto";
import { connectionExpiresAt, isConnectionExpired } from "@/lib/meta/insights";
import { revokeMetaToken } from "@/lib/meta/oauth";
import { audit } from "@/lib/audit";

const DB = process.env.MONGODB_DB || "reachout";
const LEGACY_ID = "owner";

export type MetaAdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
export type MetaPage = { id: string; name: string };

/**
 * One Meta connection per signed-in owner session. The token is encrypted at
 * rest and is only decrypted inside server-only modules.
 */
export type MetaConnectionDoc = {
  _id: string;
  sid: string;
  metaUserId: string;
  metaUserName: string;
  ownerEmail: string;
  token: EncryptedToken;
  tokenExpiresAt: string | null;
  scopes: string[];
  account: { id: string; name: string };
  adAccounts: MetaAdAccount[];
  pages: MetaPage[];
  enabledAdAccounts: string[];
  connectedAt: string;
  expiresAt?: string;
  lastSyncAt: string | null;
};

export type MetaConnectionInput = Omit<MetaConnectionDoc, "_id" | "expiresAt" | "metaUserId" | "metaUserName"> & {
  metaUserId: string;
  metaUserName: string;
  expiresAt?: string;
};

export type PublicMetaStatus = {
  connected: boolean;
  accountName: string | null;
  metaUserName: string | null;
  permissions: string[];
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  adAccounts: MetaAdAccount[];
  pages: MetaPage[];
  enabledAdAccounts: string[];
  expiresSoon: boolean;
  expiresAt: string | null;
  expired: boolean;
  reconnectRequired: boolean;
  keyVersion: string | null;
};

async function database() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB);
}

async function coll(): Promise<Collection<MetaConnectionDoc> | null> {
  const db = await database();
  if (!db) return null;
  const collection = db.collection<MetaConnectionDoc>("meta_connection");
  await collection.createIndex({ sid: 1 }, { unique: true, sparse: true }).catch(() => {});
  return collection;
}

/** The pre-session document is deleted without reading or migrating its token. */
async function deleteLegacyConnection(db: Db): Promise<void> {
  await db.collection("meta_connection").deleteOne({ _id: LEGACY_ID } as never).catch(() => {});
}

export async function getMetaDb() {
  try {
    return await database();
  } catch {
    return null;
  }
}

export async function getConnectionBySid(sid: string | undefined): Promise<MetaConnectionDoc | null> {
  if (!sid) return null;
  try {
    const db = await database();
    const col = await coll();
    if (!db || !col) return null;
    await deleteLegacyConnection(db);
    return await col.findOne({ sid });
  } catch {
    return null;
  }
}

export async function getConnectionById(id: string): Promise<MetaConnectionDoc | null> {
  try {
    const col = await coll();
    if (!col) return null;
    return await col.findOne({ _id: id });
  } catch {
    return null;
  }
}

/** Active connections for the cron. Expired documents are revoked and removed. */
export async function getActiveConnections(): Promise<MetaConnectionDoc[]> {
  try {
    const db = await database();
    const col = await coll();
    if (!db || !col) return [];
    await deleteLegacyConnection(db);
    const docs = await col.find({ sid: { $exists: true } }).toArray();
    const active: MetaConnectionDoc[] = [];
    for (const doc of docs) {
      const expiresAt = doc.expiresAt ?? (doc.connectedAt ? connectionExpiresAt(doc.connectedAt) : null);
      if (isConnectionExpired(expiresAt)) {
        await expireConnection(doc);
        continue;
      }
      active.push(doc);
    }
    return active;
  } catch {
    return [];
  }
}

/** Any active connection, used only server-side for read-only media proxying. */
export async function getAnyActiveConnection(): Promise<MetaConnectionDoc | null> {
  const connections = await getActiveConnections();
  return connections[0] ?? null;
}

export async function saveConnection(input: MetaConnectionInput): Promise<MetaConnectionDoc> {
  const col = await coll();
  if (!col) throw new Error("Database not configured");
  const existing = await col.findOne({ sid: input.sid });
  if (existing) {
    await revokeConnection(existing);
    await col.deleteOne({ _id: existing._id });
  }
  const expiresAt = input.expiresAt ?? (input.connectedAt ? connectionExpiresAt(input.connectedAt) : undefined);
  const full: MetaConnectionDoc = {
    _id: randomBytes(24).toString("base64url"),
    ...input,
    metaUserId: input.metaUserId,
    metaUserName: input.metaUserName,
    ...(expiresAt ? { expiresAt } : {}),
  };
  await col.insertOne(full);
  return full;
}

async function revokeConnection(doc: MetaConnectionDoc | null): Promise<void> {
  if (!doc?.token) return;
  const decrypted = tryDecryptToken(doc.token);
  if (decrypted.ok) {
    try { await revokeMetaToken(decrypted.token); } catch { /* ciphertext is removed below */ }
  }
}

export async function deleteConnectionBySid(sid: string | undefined): Promise<MetaConnectionDoc | null> {
  if (!sid) return null;
  const col = await coll();
  if (!col) return null;
  const doc = await col.findOne({ sid });
  if (doc) await col.deleteOne({ _id: doc._id });
  return doc;
}

export async function deleteConnectionById(id: string): Promise<MetaConnectionDoc | null> {
  const col = await coll();
  if (!col) return null;
  const doc = await col.findOne({ _id: id });
  if (doc) await col.deleteOne({ _id: doc._id });
  return doc;
}

/** Delete and revoke the connection owned by one session (logout, expiry). */
export async function cleanupSessionConnection(sid: string | undefined, reason: "logout" | "expired" | "idle" = "logout"): Promise<void> {
  const doc = await deleteConnectionBySid(sid);
  if (!doc) return;
  await revokeConnection(doc);
  await audit({
    action: "meta_disconnect",
    role: "owner",
    meta: { reason, metaUserName: doc.metaUserName },
  });
}

export async function setEnabledAdAccounts(sid: string | undefined, ids: string[]): Promise<MetaConnectionDoc | null> {
  const col = await coll();
  if (!col || !sid) return null;
  await col.updateOne({ sid }, { $set: { enabledAdAccounts: ids } });
  return getConnectionBySid(sid);
}

export async function markSynced(connectionId: string, at = new Date().toISOString()): Promise<void> {
  const col = await coll();
  if (col) await col.updateOne({ _id: connectionId }, { $set: { lastSyncAt: at } });
}

function disconnectedStatus(expired = false): PublicMetaStatus {
  return {
    connected: false, accountName: null, metaUserName: null, permissions: [], tokenExpiresAt: null,
    lastSyncAt: null, connectedAt: null, adAccounts: [], pages: [], enabledAdAccounts: [],
    expiresSoon: false, expiresAt: null, expired, reconnectRequired: false, keyVersion: null,
  };
}

export function publicStatus(doc: MetaConnectionDoc | null): PublicMetaStatus {
  if (!doc || !doc.account || !doc.token) return disconnectedStatus();

  const decrypted = tryDecryptToken(doc.token);
  const reconnectRequired = !decrypted.ok;
  const expires = doc.tokenExpiresAt ? new Date(doc.tokenExpiresAt).getTime() : null;
  const expiresSoon = expires != null && expires - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const expiresAt = doc.expiresAt ?? (doc.connectedAt ? connectionExpiresAt(doc.connectedAt) : null);
  const expired = isConnectionExpired(expiresAt);
  return {
    connected: !expired,
    accountName: doc.account?.name ?? null,
    metaUserName: doc.metaUserName ?? doc.account?.name ?? null,
    permissions: Array.isArray(doc.scopes) ? doc.scopes : [],
    tokenExpiresAt: doc.tokenExpiresAt ?? null,
    lastSyncAt: doc.lastSyncAt ?? null,
    connectedAt: doc.connectedAt ?? null,
    adAccounts: Array.isArray(doc.adAccounts) ? doc.adAccounts : [],
    pages: Array.isArray(doc.pages) ? doc.pages : [],
    enabledAdAccounts: Array.isArray(doc.enabledAdAccounts) ? doc.enabledAdAccounts : [],
    expiresSoon,
    expiresAt,
    expired,
    reconnectRequired,
    keyVersion: doc.token?.keyVersion ?? null,
  };
}

export async function expireConnection(doc: MetaConnectionDoc | null): Promise<void> {
  if (!doc) return;
  await revokeConnection(doc);
  await deleteConnectionById(doc._id);
  await audit({ action: "meta_connection_expired", role: "owner", meta: { metaUserName: doc.metaUserName } });
}

export async function getMetaStatus(sid: string | undefined): Promise<PublicMetaStatus> {
  try {
    const doc = await getConnectionBySid(sid);
    if (!doc) return disconnectedStatus();
    const expiresAt = doc.expiresAt ?? (doc.connectedAt ? connectionExpiresAt(doc.connectedAt) : null);
    if (isConnectionExpired(expiresAt)) {
      await expireConnection(doc);
      return disconnectedStatus(true);
    }
    return publicStatus(doc);
  } catch {
    return disconnectedStatus();
  }
}
