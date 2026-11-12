import "server-only";

import type { Collection, Db } from "mongodb";
import { getMongo } from "@/lib/mongodb";
import { tryDecryptToken, type EncryptedToken } from "@/lib/meta/crypto";
import { connectionExpiresAt, isConnectionExpired } from "@/lib/meta/insights";
import { revokeMetaToken } from "@/lib/meta/oauth";
import { audit } from "@/lib/audit";
import { findUserByUsername, getUser, type UserDoc } from "@/lib/users";

const DB = process.env.MONGODB_DB || "reachout";
const WORKSPACE_ID = "workspace";
const HOLDER_SETTING_ID = "meta_holder";
export const META_HOLDER_USERNAME = "venkatk";

export type MetaAdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
export type MetaPage = { id: string; name: string };
export type ConnectionStatus = "active" | "expired" | "revoked";

/** One workspace-wide Meta connection, held by one owner. */
export type MetaConnectionDoc = {
  _id: string;
  holderUserId: string;
  metaUserId: string;
  metaUserName: string;
  ownerEmail: string;
  token: EncryptedToken | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  declinedScopes: string[];
  grantedAssets: string[];
  account: { id: string; name: string };
  adAccounts: MetaAdAccount[];
  pages: MetaPage[];
  enabledAdAccounts: string[];
  connectedAt: string;
  expiresAt?: string;
  lastSyncAt: string | null;
  lastCheckAt: string | null;
  status: ConnectionStatus;
};

export type MetaConnectionInput = Omit<MetaConnectionDoc, "_id" | "expiresAt" | "lastCheckAt" | "status" | "declinedScopes" | "grantedAssets"> & {
  declinedScopes?: string[];
  grantedAssets?: string[];
  expiresAt?: string;
};

export type PublicMetaStatus = {
  connected: boolean;
  accountName: string | null;
  metaUserName: string | null;
  holderUserId: string | null;
  holderName: string | null;
  isHolder: boolean;
  status: ConnectionStatus | null;
  permissions: string[];
  declinedScopes: string[];
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

async function connections(): Promise<Collection<MetaConnectionDoc> | null> {
  const db = await database();
  if (!db) return null;
  return db.collection<MetaConnectionDoc>("meta_connection");
}

export async function getMetaDb() {
  try { return await database(); } catch { return null; }
}

/** Resolve the configured holder, defaulting to the venkatk account once. */
export async function getMetaHolder(): Promise<UserDoc | null> {
  const db = await database();
  if (!db) return null;
  const setting = await db.collection<{ _id: string; userId?: string }>("settings").findOne({ _id: HOLDER_SETTING_ID });
  if (setting?.userId) return getUser(setting.userId);
  const user = await findUserByUsername(META_HOLDER_USERNAME);
  if (!user) return null;
  await db.collection<{ _id: string; userId?: string }>("settings").updateOne(
    { _id: HOLDER_SETTING_ID },
    { $setOnInsert: { userId: user._id } },
    { upsert: true },
  );
  return user;
}

export async function getMetaHolderUserId(): Promise<string | null> {
  return (await getMetaHolder())?._id ?? null;
}

export async function isMetaHolder(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const holder = await getMetaHolder();
  return Boolean(holder && holder._id === userId && holder.role === "owner" && holder.status === "active");
}

export async function setMetaHolderUserId(userId: string): Promise<void> {
  const db = await database();
  if (!db) throw new Error("Database not configured");
  const user = await getUser(userId);
  if (!user || user.role !== "owner") throw new Error("The Meta holder must be an active owner.");
  const current = await getMetaHolder();
  await db.collection<{ _id: string; userId?: string }>("settings").updateOne({ _id: HOLDER_SETTING_ID }, { $set: { userId } }, { upsert: true });
  if (current && current._id !== userId) await revokeWorkspaceConnection("holder-changed");
}

export async function getWorkspaceConnection(): Promise<MetaConnectionDoc | null> {
  try {
    const col = await connections();
    if (!col) return null;
    return await col.findOne({ _id: WORKSPACE_ID });
  } catch { return null; }
}

export async function saveWorkspaceConnection(input: MetaConnectionInput): Promise<MetaConnectionDoc> {
  const col = await connections();
  if (!col) throw new Error("Database not configured");
  const existing = await col.findOne({ _id: WORKSPACE_ID });
  if (existing?.token) await revokeConnection(existing);
  const expiresAt = input.expiresAt ?? (input.connectedAt ? connectionExpiresAt(input.connectedAt) : undefined);
  const full: MetaConnectionDoc = {
    _id: WORKSPACE_ID,
    ...input,
    declinedScopes: input.declinedScopes ?? [],
    grantedAssets: input.grantedAssets ?? [],
    status: "active",
    lastCheckAt: new Date().toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  };
  await col.replaceOne({ _id: WORKSPACE_ID }, full, { upsert: true });
  return full;
}

async function revokeConnection(doc: MetaConnectionDoc | null): Promise<void> {
  if (!doc?.token) return;
  const decrypted = tryDecryptToken(doc.token);
  if (decrypted.ok) {
    try { await revokeMetaToken(decrypted.token); } catch { /* ciphertext removed below */ }
  }
}

export async function deleteWorkspaceConnection(): Promise<MetaConnectionDoc | null> {
  const col = await connections();
  if (!col) return null;
  const doc = await col.findOne({ _id: WORKSPACE_ID });
  if (doc) await col.deleteOne({ _id: WORKSPACE_ID });
  return doc;
}

/** Holder-initiated disconnect, holder change, revoke or expiry. */
export async function revokeWorkspaceConnection(reason: "disconnect" | "holder-changed" | "revoked" | "expired"): Promise<void> {
  const doc = await deleteWorkspaceConnection();
  if (doc) await revokeConnection(doc);
  await audit({ action: reason === "disconnect" ? "meta_disconnect" : "meta_connection_expired", role: "owner", meta: { reason } }).catch(() => {});
}

export async function markWorkspaceConnection(status: "expired" | "revoked", reason: string): Promise<void> {
  const col = await connections();
  if (!col) return;
  const doc = await col.findOne({ _id: WORKSPACE_ID });
  if (!doc) return;
  await revokeConnection(doc);
  await col.updateOne({ _id: WORKSPACE_ID }, { $set: { status, token: null, lastCheckAt: new Date().toISOString() } });
  await audit({ action: "meta_connection_expired", role: "owner", meta: { reason, status } }).catch(() => {});
}

export async function markWorkspaceSynced(at = new Date().toISOString()): Promise<void> {
  const col = await connections();
  if (col) await col.updateOne({ _id: WORKSPACE_ID }, { $set: { lastSyncAt: at, lastCheckAt: at } });
}

export async function setEnabledAdAccounts(ids: string[]): Promise<MetaConnectionDoc | null> {
  const col = await connections();
  if (!col) return null;
  await col.updateOne({ _id: WORKSPACE_ID }, { $set: { enabledAdAccounts: ids } });
  return getWorkspaceConnection();
}

function disconnectedStatus(expired = false): PublicMetaStatus {
  return {
    connected: false, accountName: null, metaUserName: null, holderUserId: null, holderName: null, isHolder: false,
    status: null, permissions: [], declinedScopes: [], tokenExpiresAt: null, lastSyncAt: null, connectedAt: null,
    adAccounts: [], pages: [], enabledAdAccounts: [], expiresSoon: false, expiresAt: null, expired,
    reconnectRequired: false, keyVersion: null,
  };
}

export function publicStatus(doc: MetaConnectionDoc | null, holder: UserDoc | null, viewerUserId?: string): PublicMetaStatus {
  if (!doc || !doc.account) return disconnectedStatus();
  const decrypted = doc.token ? tryDecryptToken(doc.token) : { ok: false as const, reason: "reconnect" as const };
  const reconnectRequired = doc.status === "active" && !decrypted.ok;
  const expires = doc.tokenExpiresAt ? new Date(doc.tokenExpiresAt).getTime() : null;
  const expiresSoon = expires != null && expires - Date.now() < 7 * 24 * 60 * 60 * 1000;
  const expiresAt = doc.expiresAt ?? null;
  const expired = doc.status !== "active" || isConnectionExpired(expiresAt);
  return {
    connected: doc.status === "active" && !expired,
    accountName: doc.account?.name ?? null,
    metaUserName: doc.metaUserName ?? null,
    holderUserId: doc.holderUserId ?? null,
    holderName: holder?.displayName ?? null,
    isHolder: Boolean(viewerUserId && doc.holderUserId === viewerUserId),
    status: doc.status,
    permissions: Array.isArray(doc.scopes) ? doc.scopes : [],
    declinedScopes: Array.isArray(doc.declinedScopes) ? doc.declinedScopes : [],
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

export async function getMetaStatus(viewerUserId?: string): Promise<PublicMetaStatus> {
  try {
    const [doc, holder] = await Promise.all([getWorkspaceConnection(), getMetaHolder()]);
    if (!doc) return disconnectedStatus();
    if (doc.status === "active" && doc.expiresAt && isConnectionExpired(doc.expiresAt)) {
      await markWorkspaceConnection("expired", "connection-expired");
      return publicStatus(await getWorkspaceConnection(), holder, viewerUserId);
    }
    return publicStatus(doc, holder, viewerUserId);
  } catch { return disconnectedStatus(); }
}
