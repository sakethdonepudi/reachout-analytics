import { NextResponse, type NextRequest } from "next/server";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { createPkce, createOAuthState } from "@/lib/oauth-pkce";

export const META_STATE_COOKIE = "ro_meta_state";
export const META_STATE_TTL = 10 * 60 * 1000;
export const META_SCOPES = ["ads_read", "business_management", "pages_read_engagement", "pages_show_list"];
const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaState = { state: string; verifier: string; next?: string | null };

export function metaConfigured(): boolean {
  return !!process.env.META_APP_ID && !!process.env.META_APP_SECRET && !!process.env.ADMIN_SESSION_SECRET;
}

/** Revoke a token without ever returning or logging it. */
export async function revokeMetaToken(token: string): Promise<void> {
  if (!token) return;
  const response = await fetch(`${GRAPH}/me/permissions`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data as { success?: boolean }).success === false) throw new Error("Meta permission revoke failed");
}

export function metaRedirectUri(req: NextRequest): string {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  return `${new URL(req.url).origin}/api/meta/owner/connect/callback`;
}

/**
 * Redirect responses from the Web `Response.redirect()` helper have immutable
 * headers. Meta needs to append the state cookie and cache headers, so always
 * use NextResponse here.
 */
export function metaRedirect(url: string | URL): NextResponse {
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export function createMetaFlow() {
  const pkce = createPkce();
  const { state } = createOAuthState();
  return { ...pkce, state };
}

export function metaAuthUrl(req: NextRequest, flow: ReturnType<typeof createMetaFlow>): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", metaRedirectUri(req));
  url.searchParams.set("state", flow.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("code_challenge", flow.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function setMetaStateCookie(response: Response, payload: MetaState) {
  const token = signPayload(payload as unknown as Record<string, unknown>, process.env.ADMIN_SESSION_SECRET ?? "", META_STATE_TTL);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${META_STATE_COOKIE}=${token}; Path=/api/meta/owner/connect; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
}

export function readMetaStateCookie(req: NextRequest): MetaState | null {
  return verifyPayload<MetaState>(req.cookies.get(META_STATE_COOKIE)?.value, process.env.ADMIN_SESSION_SECRET ?? "");
}

export function clearMetaStateCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${META_STATE_COOKIE}=; Path=/api/meta/owner/connect; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

type TokenResponse = { access_token?: string; expires_in?: number; token_type?: string; error?: { message?: string } };

async function graphJson<T>(url: URL): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { error?: unknown }).error) throw new Error("Meta authorization failed");
  return data as T;
}

export async function exchangeMetaCode(req: NextRequest, code: string, verifier: string) {
  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  shortUrl.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  shortUrl.searchParams.set("redirect_uri", metaRedirectUri(req));
  shortUrl.searchParams.set("code", code);
  shortUrl.searchParams.set("code_verifier", verifier);
  const short = await graphJson<TokenResponse>(shortUrl);
  if (!short.access_token) throw new Error("No Meta access token");

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  longUrl.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const long = await graphJson<TokenResponse>(longUrl);
  const token = long.access_token ?? short.access_token;
  const expiresIn = Number(long.expires_in ?? short.expires_in ?? 0);
  return { token, expiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null, expiresIn };
}

async function graphAuthed<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta request failed (${res.status})`);
  return data as T;
}

export async function fetchMetaIdentity(token: string) {
  const me = await graphAuthed<{ id: string; name: string }>("/me", token, { fields: "id,name" });
  const accounts = await graphAuthed<{ data?: Array<{ id: string; account_id: string; name: string; account_status?: number; currency?: string }> }>("/me/adaccounts", token, {
    fields: "id,account_id,name,account_status,currency",
    limit: "200",
  });
  const pages = await graphAuthed<{ data?: Array<{ id: string; name: string }> }>("/me/accounts", token, {
    fields: "id,name",
    limit: "200",
  });
  const permissions = await graphAuthed<{ data?: Array<{ permission: string; status: string }> }>("/me/permissions", token);
  return {
    account: { id: me.id, name: me.name },
    adAccounts: (accounts.data ?? []).map((account) => ({
      id: account.id,
      accountId: account.account_id,
      name: account.name,
      status: account.account_status ?? null,
      currency: account.currency ?? null,
    })),
    pages: (pages.data ?? []).map((page) => ({
      id: page.id,
      name: page.name,
    })),
    scopes: (permissions.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission),
  };
}
