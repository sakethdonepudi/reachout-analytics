import { getMongo } from "@/lib/mongodb";
import type { EncryptedToken } from "@/lib/meta/crypto";

const DB = process.env.MONGODB_DB || "reachout";
const ID = "owner";

export type MetaAdAccount = { id: string; accountId: string; name: string; status: number | null; currency: string | null };
export type MetaPage = { id: string; name: string; instagramId?: string | null; instagramUsername?: string | null };

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
  keyVersion: string | null;
};

async function coll() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB).collection<MetaConnectionDoc>("meta_connection");
}

export async function getConnectionDoc(): Promise<MetaConnectionDoc | null> {
  const col = await coll();
  if (!col) return null;
  return col.findOne({ _id: ID });
}

export async function saveConnection(doc: Omit<MetaConnectionDoc, "_id">): Promise<MetaConnectionDoc> {
  const col = await coll();
  if (!col) throw new Error("Database not configured");
  const full: MetaConnectionDoc = { _id: ID, ...doc };
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

export function publicStatus(doc: MetaConnectionDoc | null): PublicMetaStatus {
  if (!doc) {
    return {
      connected: false, accountName: null, permissions: [], tokenExpiresAt: null,
      lastSyncAt: null, connectedAt: null, adAccounts: [], pages: [], enabledAdAccounts: [],
      expiresSoon: false, keyVersion: null,
    };
  }
  const expires = doc.tokenExpiresAt ? new Date(doc.tokenExpiresAt).getTime() : null;
  const expiresSoon = expires != null && expires - Date.now() < 7 * 24 * 60 * 60 * 1000;
  return {
    connected: true,
    accountName: doc.account.name,
    permissions: doc.scopes,
    tokenExpiresAt: doc.tokenExpiresAt,
    lastSyncAt: doc.lastSyncAt,
    connectedAt: doc.connectedAt,
    adAccounts: doc.adAccounts,
    pages: doc.pages,
    enabledAdAccounts: doc.enabledAdAccounts,
    expiresSoon,
    keyVersion: doc.token.keyVersion,
  };
}

export async function getMetaStatus(): Promise<PublicMetaStatus> {
  return publicStatus(await getConnectionDoc());
}
