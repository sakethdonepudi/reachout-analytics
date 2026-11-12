import { after, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionRecord } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clearMetaStateCookie, exchangeMetaCode, fetchMetaIdentity, metaConfigured, readMetaStateCookie, META_SCOPES } from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/meta/crypto";
import { getMetaHolder, saveWorkspaceConnection, getWorkspaceConnection } from "@/lib/meta/store";
import { syncMeta } from "@/lib/meta/sync";
import { safeNextPath } from "@/lib/access";
import { getUser } from "@/lib/users";
import { bounceResponse, consumeConnectState, facebookFailureReason, validateConnectState, type CallbackFailure } from "@/lib/meta/connect-callback";
import { META_CONNECTION_TTL_MS } from "@/lib/meta/insights";
import { redactText } from "@/lib/redact";

export const runtime = "nodejs";
export const maxDuration = 300;

function bounce(req: NextRequest, destination: string): Response {
  const res = bounceResponse(destination);
  clearMetaStateCookie(res);
  return res;
}

function failure(req: NextRequest, code: CallbackFailure, ip: string, email?: string | null): Response {
  void audit({ action: "meta_connect", role: "owner", email, ip, meta: { ok: false, code } }).catch(() => {});
  return bounce(req, `/meta-ads/settings?error=${code}`);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const stored = readMetaStateCookie(req);
  const params = req.nextUrl.searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";

  if (params.get("error") || params.get("error_code") || params.get("error_reason")) {
    const reason = facebookFailureReason(params);
    await audit({
      action: "meta_connect", role: "owner", ip,
      meta: { ok: false, stage: "facebook", reason, detail: redactText(params.get("error_description") ?? "") },
    }).catch(() => {});
    return bounce(req, `/meta-ads/settings?error=facebook&reason=${encodeURIComponent(reason)}`);
  }

  const session = stored?.sid ? await getSessionRecord(stored.sid) : null;
  const user = stored?.userId ? await getUser(stored.userId) : null;
  const check = validateConnectState({ stored, state, session, user });
  if (!check.ok) return failure(req, check.code, ip, user?.username ?? null);

  const holder = await getMetaHolder();
  if (!holder || holder._id !== check.identity.userId) return failure(req, "session", ip, check.identity.ownerEmail);

  if (!(await consumeConnectState(check.identity.sid + ":" + state))) return failure(req, "state", ip, check.identity.ownerEmail);

  const limit = rateLimit(`meta-callback:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok || !metaConfigured() || !code) return failure(req, "connect", ip, check.identity.ownerEmail);

  try {
    const token = await exchangeMetaCode(req, code, stored!.verifier);
    const identity = await fetchMetaIdentity(token.token);
    const connectedAt = new Date();
    const tokenExpiry = token.expiresAt ? new Date(token.expiresAt).getTime() : null;
    const expiresAt = new Date(Math.min(connectedAt.getTime() + META_CONNECTION_TTL_MS, tokenExpiry ?? Number.POSITIVE_INFINITY)).toISOString();
    const declinedScopes = META_SCOPES.filter((scope) => !identity.scopes.includes(scope));
    const previous = await getWorkspaceConnection();
    await saveWorkspaceConnection({
      holderUserId: check.identity.userId,
      metaUserId: identity.account.id,
      metaUserName: identity.account.name,
      ownerEmail: check.identity.ownerEmail,
      token: encryptToken(token.token),
      tokenExpiresAt: token.expiresAt,
      scopes: identity.scopes,
      declinedScopes,
      grantedAssets: [...identity.scopes],
      account: identity.account,
      adAccounts: identity.adAccounts,
      pages: identity.pages,
      enabledAdAccounts: previous?.enabledAdAccounts?.length ? previous.enabledAdAccounts : identity.adAccounts.map((account) => account.id),
      connectedAt: connectedAt.toISOString(),
      expiresAt,
      lastSyncAt: previous?.lastSyncAt ?? null,
    });
    await audit({ action: "meta_connect", email: check.identity.ownerEmail, role: "owner", ip, meta: { accountId: identity.account.id, adAccounts: identity.adAccounts.length, declinedScopes } });
    try { after(() => syncMeta({ trigger: "manual" })); } catch { /* not inside a request context in tests */ }
    const destination = safeNextPath(stored!.next ?? null, "owner") ?? "/meta-ads/settings";
    return bounce(req, destination.includes("?") ? `${destination}&connected=1` : `${destination}?connected=1`);
  } catch {
    await audit({ action: "meta_connect", role: "owner", email: check.identity.ownerEmail, ip, meta: { ok: false, stage: "token-exchange" } }).catch(() => {});
    return bounce(req, `/meta-ads/settings?error=facebook&reason=exchange`);
  }
}
