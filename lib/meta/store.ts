import { getMongo } from "@/lib/mongodb";
import { tryDecryptToken, type EncryptedToken } from "@/lib/meta/crypto";
import { connectionExpiresAt, isConnectionExpired } from "@/lib/meta/insights";
import { revokeMetaToken } from "@/lib/meta/oauth";
import { audit } from "@/lib/audit";

const DB = process.env.MONGODB_DB || "reachout";
const ID = "owner";

export type MetaAdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
export type MetaPage = { id: string; name: string };

export type MetaConnectionDoc = {
  _id: string;
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

export type PublicMetaStatus = {
  connected: boolean;
  accountName: string | null;
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

async function coll() {
  const db = await database();
  if (!db) return null;
  return db.collection<MetaConnectionDoc>("meta_connection");
}

export async function getConnectionDoc(): Promise<MetaConnectionDoc | null> {
  try {
    const col = await coll();
    if (!col) return null;
    return await col.findOne({ _id: ID });
  } catch {
    // A missing collection, unavailable database or malformed connection is
    // treated as "not connected" by the status UI, never as a 500.
    return null;
  }
}

export async function saveConnection(doc: Omit<MetaConnectionDoc, "_id" | "expiresAt"> & { expiresAt?: string }): Promise<MetaConnectionDoc> {
  const col = await coll();
  if (!col) throw new Error("Database not configured");
  const expiresAt = doc.expiresAt ?? (doc.connectedAt ? connectionExpiresAt(doc.connectedAt) : undefined);
  const full: MetaConnectionDoc = { _id: ID, ...doc, ...(expiresAt ? { expiresAt } : {}) };
  await col.replaceOne({ _id: ID }, full, { upsert: true });
  return full;
}

export async function deleteConnection(): Promise<void> {
  const col = await coll();
  if (col) await col.deleteOne({ _id: ID });
}

export async function setEnabledAdAccounts(ids: string[]): Promise<MetaConnectionDoc | null> {
  const col = await coll();
  if (!col) return null;
  await col.updateOne({ _id: ID }, { $set: { enabledAdAccounts: ids } });
  return getConnectionDoc();
}

export async function markSynced(at = new Date().toISOString()): Promise<void> {
  const col = await coll();
  if (col) await col.updateOne({ _id: ID }, { $set: { lastSyncAt: at } });
}

function disconnectedStatus(expired = false): PublicMetaStatus {
  return {
    connected: false, accountName: null, permissions: [], tokenExpiresAt: null,
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
  const decrypted = tryDecryptToken(doc.token);
  if (decrypted.ok) {
    try { await revokeMetaToken(decrypted.token); } catch { /* ciphertext is removed below */ }
  }
  await deleteConnection();
  await audit({ action: "meta_connection_expired", role: "owner" });
}

export async function getMetaDb() {
  try {
    return await database();
  } catch {
    return null;
  }
}

export async function getMetaStatus(): Promise<PublicMetaStatus> {
  try {
    const doc = await getConnectionDoc();
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
