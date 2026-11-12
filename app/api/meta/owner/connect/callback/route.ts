import { after, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { clearSessionGrace, getSessionRecord } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clearMetaStateCookie, exchangeMetaCode, fetchMetaIdentity, metaConfigured, readMetaStateCookie } from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/meta/crypto";
import { saveConnection } from "@/lib/meta/store";
import { syncMeta } from "@/lib/meta/sync";
import { safeNextPath } from "@/lib/access";
import { getUser } from "@/lib/users";
import { bounceResponse, callbackDestination, consumeConnectState, validateConnectState, type CallbackFailure } from "@/lib/meta/connect-callback";

export const runtime = "nodejs";
export const maxDuration = 300;

function fail(req: NextRequest, code: CallbackFailure, ip: string, email?: string | null): Response {
  void audit({ action: "meta_connect", role: "owner", email, ip, meta: { ok: false, code } }).catch(() => {});
  const res = bounceResponse(callbackDestination(code));
  clearMetaStateCookie(res);
  return res;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const stored = readMetaStateCookie(req);
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const session = stored?.sid ? await getSessionRecord(stored.sid) : null;
  const user = stored?.userId ? await getUser(stored.userId) : null;
  const check = validateConnectState({ stored, state, session, user });
  if (!check.ok) return fail(req, check.code, ip, user?.username ?? null);

  if (!(await consumeConnectState(check.identity.sid + ":" + state))) {
    return fail(req, "state", ip, check.identity.ownerEmail);
  }

  const limit = rateLimit(`meta-callback:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return fail(req, "connect", ip, check.identity.ownerEmail);
  if (!metaConfigured() || !code) return fail(req, "connect", ip, check.identity.ownerEmail);

  try {
    const token = await exchangeMetaCode(req, code, stored!.verifier);
    const identity = await fetchMetaIdentity(token.token);
    const connectedAt = new Date();
    const expiresAt = new Date(Math.min(connectedAt.getTime() + 12 * 60 * 60 * 1000, check.identity.sessionExp)).toISOString();
    await saveConnection({
      sid: check.identity.sid,
      userId: check.identity.userId,
      metaUserId: identity.account.id,
      metaUserName: identity.account.name,
      ownerEmail: check.identity.ownerEmail,
      token: encryptToken(token.token),
      tokenExpiresAt: token.expiresAt,
      scopes: identity.scopes,
      account: identity.account,
      adAccounts: identity.adAccounts,
      pages: identity.pages,
      enabledAdAccounts: identity.adAccounts.map((account) => account.id),
      connectedAt: connectedAt.toISOString(),
      expiresAt,
      lastSyncAt: null,
    });
    await audit({ action: "meta_connect", email: check.identity.ownerEmail, role: "owner", ip, meta: { accountId: identity.account.id, adAccounts: identity.adAccounts.length } });
    try { after(() => syncMeta({ trigger: "manual", sid: check.identity.sid })); } catch { /* not inside a request context in tests */ }
    await clearSessionGrace(check.identity.sid);
    const destination = safeNextPath(stored!.next ?? null, "owner") ?? callbackDestination(null);
    const res = bounceResponse(destination.includes("?") ? `${destination}&connected=1` : `${destination}?connected=1`);
    clearMetaStateCookie(res);
    return res;
  } catch {
    await clearSessionGrace(check.identity.sid);
    return fail(req, "connect", ip, check.identity.ownerEmail);
  }
}
