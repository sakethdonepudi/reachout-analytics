import "server-only";

import { randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { Collection } from "mongodb";
import { getMongo } from "@/lib/mongodb";
import { checkPassword } from "@/lib/password-policy";
import type { SealedSecret } from "@/lib/secure-box";
import type { Role } from "@/lib/access";
import type { CaseRecord } from "@/lib/case-registry";

const DB = process.env.MONGODB_DB || "reachout";
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

export type ClientScope = { caseStudies: string[]; states: string[]; parties: string[] };
export type UserStatus = "active" | "disabled";

export type UserDoc = {
  _id: string;
  username: string;
  displayName: string;
  organisation?: string | null;
  role: Role;
  passwordHash: string;
  totpSecret: SealedSecret | null;
  totpEnabled: boolean;
  totpRequired: boolean;
  recoveryCodes: string[];
  lastTotpStep: number | null;
  clientScope: ClientScope;
  status: UserStatus;
  mustChangePassword: boolean;
  failedLogins: number;
  lockedUntil: Date | null;
  createdBy: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastLoginDevice: string | null;
};

export type PublicUser = Omit<UserDoc, "passwordHash" | "totpSecret" | "recoveryCodes" | "lastTotpStep">;

export function sanitizeUser(user: UserDoc): PublicUser {
  const { passwordHash: _passwordHash, totpSecret: _totpSecret, recoveryCodes: _recoveryCodes, lastTotpStep: _lastTotpStep, ...rest } = user;
  return rest;
}

async function collection(): Promise<Collection<UserDoc> | null> {
  const promise = getMongo();
  if (!promise) return null;
  try {
    const client = await promise;
    const col = client.db(DB).collection<UserDoc>("users");
    await col.createIndex({ username: 1 }, { unique: true }).catch(() => {});
    await col.createIndex({ role: 1, status: 1 }).catch(() => {});
    return col;
  } catch {
    return null;
  }
}

export function normaliseUsername(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function validUsername(value: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(value);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON);
}

export async function verifyPasswordHash(passwordHash: string, password: string): Promise<boolean> {
  if (!passwordHash) return false;
  try { return await verify(passwordHash, password); } catch { return false; }
}

export async function countOwners(): Promise<number> {
  const col = await collection();
  if (!col) return 0;
  return col.countDocuments({ role: "owner" });
}

export async function countActiveOwners(): Promise<number> {
  const col = await collection();
  if (!col) return 0;
  return col.countDocuments({ role: "owner", status: "active", totpEnabled: true });
}

export async function findUserByUsername(username: string): Promise<UserDoc | null> {
  const col = await collection();
  if (!col) return null;
  return col.findOne({ username: normaliseUsername(username) });
}

export async function getUser(id: string): Promise<UserDoc | null> {
  const col = await collection();
  if (!col) return null;
  return col.findOne({ _id: id });
}

export async function listUsers(): Promise<PublicUser[]> {
  const col = await collection();
  if (!col) return [];
  const rows = await col.find({}).sort({ role: 1, username: 1 }).toArray();
  return rows.map(sanitizeUser);
}

export async function createUser(input: {
  username: string;
  displayName: string;
  organisation?: string | null;
  role: Role;
  password: string;
  totpRequired?: boolean;
  clientScope?: Partial<ClientScope>;
  createdBy: string | null;
}): Promise<{ ok: true; user: UserDoc } | { ok: false; error: string }> {
  const username = normaliseUsername(input.username);
  if (!validUsername(username)) return { ok: false, error: "Username must be 3-32 characters: a-z, 0-9, dot, underscore or hyphen." };
  const displayName = String(input.displayName ?? "").trim();
  if (displayName.length < 2 || displayName.length > 80) return { ok: false, error: "Display name must be 2-80 characters." };
  const policy = checkPassword(input.password, username);
  if (!policy.ok) return { ok: false, error: policy.error ?? "Invalid password." };
  const col = await collection();
  if (!col) return { ok: false, error: "Database not configured" };
  if (await col.findOne({ username })) return { ok: false, error: "That username is already taken." };
  if (await col.countDocuments({ role: "owner" }) === 0 && input.role !== "owner") return { ok: false, error: "The first account must be an owner." };
  const now = new Date();
  const user: UserDoc = {
    _id: randomUUID(),
    username,
    displayName,
    organisation: input.organisation?.trim() || null,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    totpSecret: null,
    totpEnabled: false,
    totpRequired: input.role === "owner" ? true : Boolean(input.totpRequired),
    recoveryCodes: [],
    lastTotpStep: null,
    clientScope: {
      caseStudies: [...new Set(input.clientScope?.caseStudies ?? [])],
      states: [...new Set(input.clientScope?.states ?? [])],
      parties: [...new Set(input.clientScope?.parties ?? [])],
    },
    status: "active",
    mustChangePassword: true,
    failedLogins: 0,
    lockedUntil: null,
    createdBy: input.createdBy,
    createdAt: now,
    lastLoginAt: null,
    lastLoginDevice: null,
  };
  await col.insertOne(user);
  return { ok: true, user };
}

export async function updateUser(id: string, patch: Partial<Pick<UserDoc,
  "displayName" | "organisation" | "role" | "status" | "totpRequired" | "clientScope">>): Promise<PublicUser | null> {
  const col = await collection();
  if (!col) return null;
  const set: Record<string, unknown> = {};
  for (const key of ["displayName", "organisation", "role", "status", "totpRequired", "clientScope"] as const) {
    if (patch[key] !== undefined) set[key] = patch[key];
  }
  if (patch.role === "owner") set.totpRequired = true;
  if (!Object.keys(set).length) return null;
  const result = await col.findOneAndUpdate({ _id: id }, { $set: set }, { returnDocument: "after" });
  return result ? sanitizeUser(result) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  const col = await collection();
  if (!col) return false;
  const result = await col.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function setPassword(id: string, password: string, username: string, options: { mustChange: boolean }): Promise<{ ok: boolean; error?: string }> {
  const policy = checkPassword(password, username);
  if (!policy.ok) return { ok: false, error: policy.error };
  const col = await collection();
  if (!col) return { ok: false, error: "Database not configured" };
  await col.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password), mustChangePassword: options.mustChange, failedLogins: 0, lockedUntil: null } });
  return { ok: true };
}

export async function setTemporaryPassword(id: string, password: string, username: string): Promise<{ ok: boolean; error?: string }> {
  return setPassword(id, password, username, { mustChange: true });
}

export async function enableTotp(id: string, secret: SealedSecret, recoveryHashes: string[]): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { totpSecret: secret, totpEnabled: true, recoveryCodes: recoveryHashes, lastTotpStep: null } });
}

export async function disableTotp(id: string): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { totpSecret: null, totpEnabled: false, recoveryCodes: [], lastTotpStep: null } });
}

export async function setTotpSecret(id: string, secret: SealedSecret): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { totpSecret: secret, totpEnabled: false, lastTotpStep: null } });
}

export async function setRecoveryCodes(id: string, recoveryHashes: string[]): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { recoveryCodes: recoveryHashes } });
}

export async function markTotpStep(id: string, step: number): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { lastTotpStep: step } });
}

export async function consumeRecoveryCode(id: string, codeHashIndex: number): Promise<void> {
  const user = await getUser(id);
  if (!user) return;
  const next = user.recoveryCodes.filter((_hash, index) => index !== codeHashIndex);
  await setRecoveryCodes(id, next);
}

export async function recordFailedLogin(id: string): Promise<{ locked: boolean; retryAfter: number }> {
  const col = await collection();
  if (!col) return { locked: false, retryAfter: 0 };
  const user = await getUser(id);
  if (!user) return { locked: false, retryAfter: 0 };
  const failed = user.failedLogins + 1;
  const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : user.lockedUntil;
  await col.updateOne({ _id: id }, { $set: { failedLogins: failed, lockedUntil } });
  return {
    locked: Boolean(lockedUntil && lockedUntil.getTime() > Date.now()),
    retryAfter: lockedUntil && lockedUntil.getTime() > Date.now() ? Math.ceil((lockedUntil.getTime() - Date.now()) / 1000) : 0,
  };
}

export async function clearFailedLogins(id: string): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { failedLogins: 0, lockedUntil: null } });
}

export async function touchLogin(id: string, device: string): Promise<void> {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: id }, { $set: { lastLoginAt: new Date(), lastLoginDevice: device.slice(0, 200), failedLogins: 0, lockedUntil: null } });
}

export function scopeAllowsCase(role: Role, scope: ClientScope | null | undefined, record: Pick<CaseRecord, "slug" | "state" | "title"> & { party?: string }): boolean {
  if (role === "owner") return true;
  if (!scope) return false;
  const { caseStudies = [], states = [], parties = [] } = scope;
  if (!caseStudies.length && !states.length && !parties.length) return false;
  return caseStudies.includes(record.slug) || states.includes(record.state) || (record.party ? parties.includes(record.party) : false);
}
