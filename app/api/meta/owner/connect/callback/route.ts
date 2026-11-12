import { after, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clearMetaStateCookie, exchangeMetaCode, fetchMetaIdentity, metaConfigured, metaRedirect, readMetaStateCookie } from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/meta/crypto";
import { saveConnection } from "@/lib/meta/store";
import { syncMeta } from "@/lib/meta/sync";
import { safeNextPath } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

function redirect(req: NextRequest, path: string) {
  return metaRedirect(new URL(path, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]).catch(() => ({ deny: null }) as never);
  const storedState = readMetaStateCookie(req);
  // The session cookie is SameSite=Strict, so Facebook's cross-site redirect
  // does not send it. The signed, short-lived state cookie carries the same
  // session identity and is verified before it is used.
  const sid = "session" in auth ? auth.session.sid : storedState?.sid ?? null;
  const userId = "session" in auth ? auth.session.userId : storedState?.userId ?? null;
  const ownerSubject = "session" in auth ? auth.session.sub : null;
  if ((!("session" in auth) && (!sid || !userId)) || ("deny" in auth && auth.deny)) {
    if ("deny" in auth && auth.deny) return auth.deny;
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`meta-callback:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!metaConfigured()) {
    return Response.json(
      { ok: false, error: "Meta app not configured" },
      { status: 503, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  }

  if (!sid) return redirect(req, "/meta-ads/settings?error=session");
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const stored = storedState;
  if (!code || !state || !stored || stored.state !== state || (stored.sid && stored.sid !== sid)) {
    const res = redirect(req, "/meta-ads/settings?error=state");
    clearMetaStateCookie(res);
    return res;
  }

  try {
    const token = await exchangeMetaCode(req, code, stored.verifier);
    const identity = await fetchMetaIdentity(token.token);
    const connectedAt = new Date();
    const expiresAt = new Date(Math.min(connectedAt.getTime() + 12 * 60 * 60 * 1000, "session" in auth ? auth.session.exp : Date.now() + 12 * 60 * 60 * 1000)).toISOString();
    await saveConnection({
      sid,
      userId: userId ?? sid,
      metaUserId: identity.account.id,
      metaUserName: identity.account.name,
      ownerEmail: ownerSubject ?? "owner",
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
    await audit({ action: "meta_connect", email: ownerSubject, role: "owner", ip, meta: { accountId: identity.account.id, adAccounts: identity.adAccounts.length } });
    after(() => syncMeta({ trigger: "manual", sid }));
    const destination = safeNextPath(stored.next ?? null, "owner") ?? "/meta-ads/settings";
    const res = redirect(req, `${destination}${destination.includes("?") ? "&" : "?"}connected=1`);
    clearMetaStateCookie(res);
    return res;
  } catch {
    await audit({ action: "meta_connect", email: ownerSubject, role: "owner", ip, meta: { ok: false } });
    const res = redirect(req, "/meta-ads/settings?error=connect");
    clearMetaStateCookie(res);
    return res;
  }
}
