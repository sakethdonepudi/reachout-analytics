import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { clearMetaStateCookie, exchangeMetaCode, fetchMetaIdentity, metaConfigured, metaRedirect, readMetaStateCookie } from "@/lib/meta/oauth";
import { encryptToken } from "@/lib/meta/crypto";
import { saveConnection } from "@/lib/meta/store";

export const runtime = "nodejs";

function redirect(req: NextRequest, path: string) {
  return metaRedirect(new URL(path, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`meta-callback:${ip}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!metaConfigured()) {
    return Response.json(
      { ok: false, error: "Meta app not configured" },
      { status: 503, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  }

  const code = req.nextUrl.searchParams.get("code") ?? "";
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const stored = readMetaStateCookie(req);
  if (!code || !state || !stored || stored.state !== state) {
    const res = redirect(req, "/meta-ads/settings?error=state");
    clearMetaStateCookie(res);
    return res;
  }

  try {
    const token = await exchangeMetaCode(req, code, stored.verifier);
    const identity = await fetchMetaIdentity(token.token);
    await saveConnection({
      ownerEmail: auth.session.sub,
      token: encryptToken(token.token),
      tokenExpiresAt: token.expiresAt,
      scopes: identity.scopes,
      account: identity.account,
      adAccounts: identity.adAccounts,
      pages: identity.pages,
      enabledAdAccounts: identity.adAccounts.map((account) => account.id),
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
    });
    await audit({ action: "meta_connect", email: auth.session.sub, role: "owner", ip, meta: { accountId: identity.account.id, adAccounts: identity.adAccounts.length } });
    const res = redirect(req, "/meta-ads/settings?connected=1");
    clearMetaStateCookie(res);
    return res;
  } catch {
    await audit({ action: "meta_connect", email: auth.session.sub, role: "owner", ip, meta: { ok: false } });
    const res = redirect(req, "/meta-ads/settings?error=connect");
    clearMetaStateCookie(res);
    return res;
  }
}
