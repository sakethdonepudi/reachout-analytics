import { tryDecryptToken } from "@/lib/meta/crypto";
import { connectionExpiresAt, isConnectionExpired, isRateLimited, retryDelayMs, META_GRAPH_VERSION } from "@/lib/meta/insights";
import { expireConnection, type MetaConnectionDoc } from "@/lib/meta/store";
import { revokeMetaToken } from "@/lib/meta/oauth";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const MAX_RETRIES = 4;

/** The stored token cannot be decrypted; the owner must reconnect Meta. */
export class MetaReconnectError extends Error {
  constructor() {
    super("Reconnect Meta");
    this.name = "MetaReconnectError";
  }
}

/** The 12-hour connection lifetime has elapsed; the token must not be used. */
export class MetaConnectionExpiredError extends Error {
  constructor() {
    super("Meta connection has expired");
    this.name = "MetaConnectionExpiredError";
  }
}

/** Decrypt only inside this module, at call time. Never return the token. */
async function accessToken(connection?: MetaConnectionDoc | null): Promise<string> {
  if (connection?.token) {
    const expiresAt = connection.expiresAt ?? (connection.connectedAt ? connectionExpiresAt(connection.connectedAt) : null);
    if (isConnectionExpired(expiresAt)) {
      await expireConnection(connection);
      throw new MetaConnectionExpiredError();
    }
    const result = tryDecryptToken(connection.token);
    if (result.ok) return result.token;
    throw new MetaReconnectError();
  }
  if (process.env.META_SYSTEM_USER_TOKEN) return process.env.META_SYSTEM_USER_TOKEN;
  throw new Error("Meta is not connected");
}

function usageIsHigh(header: string | null): boolean {
  if (!header) return false;
  try {
    const parsed = JSON.parse(header) as Record<string, Array<{ call_count?: number; total_cputime?: number; total_time?: number }>>;
    return Object.values(parsed).flat().some((value) => Math.max(value.call_count ?? 0, value.total_cputime ?? 0, value.total_time ?? 0) >= 90);
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function graphGet<T = unknown>(path: string, params: Record<string, string> = {}, connection?: MetaConnectionDoc | null, attempt = 0): Promise<T> {
  const token = await accessToken(connection);
  const url = new URL(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  const error = (data as { error?: { code?: number; message?: string } }).error;
  if (response.ok && !error) return data as T;

  const code = Number(error?.code ?? 0);
  const retryable = response.status === 429 || isRateLimited(code) || usageIsHigh(response.headers.get("x-business-use-case-usage"));
  if (retryable && attempt < MAX_RETRIES) {
    const delay = retryDelayMs({
      retryAfter: response.headers.get("retry-after"),
      usage: response.headers.get("x-business-use-case-usage"),
    }, attempt);
    await sleep(delay);
    return graphGet<T>(path, params, connection, attempt + 1);
  }
  // Never include the token, URL or raw Graph body in the error.
  throw new Error(`Meta request failed (${response.status}${code ? ` code ${code}` : ""})`);
}

export async function graphPaged<T = unknown>(path: string, params: Record<string, string> = {}, limit = 200, connection?: MetaConnectionDoc | null): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < 200; page += 1) {
    const data = await graphGet<{ data?: T[]; paging?: { next?: string; cursors?: { after?: string } } }>(path, {
      ...params,
      limit: String(limit),
      ...(after ? { after } : {}),
    }, connection);
    rows.push(...(data.data ?? []));
    const next = data.paging?.cursors?.after;
    if (!next || next === after || !data.paging?.next) break;
    after = next;
  }
  return rows;
}

export async function revokeMetaPermissions(connection?: MetaConnectionDoc | null): Promise<void> {
  await revokeMetaToken(await accessToken(connection));
}
