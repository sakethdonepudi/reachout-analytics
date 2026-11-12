import type { NextRequest } from "next/server";
import { z } from "zod";
import QRCode from "qrcode";
import { createSession, refreshSessionAuth, requireRole, setSessionCookie, sessionIsRecent } from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/access";
import { clearPendingCookie, readPending } from "@/lib/pending-auth";
import { openSecret, sealSecret } from "@/lib/secure-box";
import { generateRecoveryCodes, generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { enableTotp, getUser, hashPassword, setRecoveryCodes, setTotpSecret } from "@/lib/users";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const Body = z.object({ code: z.string().max(32).optional(), mode: z.enum(["confirm", "recovery"]).optional() });

async function identify(req: NextRequest): Promise<{ user: NonNullable<Awaited<ReturnType<typeof getUser>>>; pending: boolean; next?: string | null } | null> {
  const pending = readPending(req);
  if (pending && pending.purpose === "enroll") {
    const user = await getUser(pending.userId);
    return user ? { user, pending: true, next: pending.next } : null;
  }
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth || !auth.session.userId) return null;
  const user = await getUser(auth.session.userId);
  return user ? { user, pending: false, next: null } : null;
}

export async function GET(req: NextRequest) {
  const identity = await identify(req);
  if (!identity) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers });
  const { user } = identity;
  if (user.totpEnabled) return Response.json({ ok: true, enabled: true }, { headers });

  let secret = openSecret(user.totpSecret);
  if (!secret) {
    secret = generateTotpSecret();
    await setTotpSecret(user._id, sealSecret(secret));
  }
  const url = otpauthUrl(user.username, secret);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 });
  return Response.json({ ok: true, enabled: false, secret, otpauth: url, qr, account: user.username }, { headers });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  if (!auth.session.userId || !sessionIsRecent(auth.session)) {
    return Response.json({ ok: false, error: "Re-authentication required", code: "reauth_required" }, { status: 403, headers });
  }
  const user = await getUser(auth.session.userId);
  if (!user) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers });
  const { disableTotp } = await import("@/lib/users");
  await disableTotp(user._id);
  return Response.json({ ok: true }, { headers });
}

export async function POST(req: NextRequest) {
  const identity = await identify(req);
  if (!identity) return Response.json({ ok: false, error: "Not authenticated" }, { status: 401, headers });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  const { user, pending, next } = identity;

  if (parsed.data.mode === "recovery") {
    if (!user.totpEnabled) return Response.json({ ok: false, error: "Enroll the authenticator first." }, { status: 400, headers });
    if (!pending) {
      const auth = await requireRole(req, ["owner", "client"]);
      if ("deny" in auth || !sessionIsRecent(auth.session)) {
        return Response.json({ ok: false, error: "Re-authentication required", code: "reauth_required" }, { status: 403, headers });
      }
    }
    const codes = generateRecoveryCodes();
    await setRecoveryCodes(user._id, await Promise.all(codes.map((code) => hashPassword(code.replace(/[^A-Z2-7]/g, "")))));
    return Response.json({ ok: true, recoveryCodes: codes }, { headers });
  }

  const secret = openSecret(user.totpSecret);
  if (!secret) return Response.json({ ok: false, error: "Start enrollment again." }, { status: 400, headers });
  const check = verifyTotp(secret, parsed.data.code ?? "", null);
  if (!check.ok) return Response.json({ ok: false, error: "That code is not valid." }, { status: 401, headers });

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((code) => hashPassword(code.replace(/[^A-Z2-7]/g, ""))));
  await enableTotp(user._id, sealSecret(secret), hashes);

  if (pending) {
    const token = await createSession(
      { userId: user._id, role: user.role, displayName: user.displayName },
      { device: req.headers.get("user-agent")?.slice(0, 200) ?? undefined },
    );
    const response = Response.json({ ok: true, recoveryCodes: codes, redirect: safeNextPath(next ?? null, user.role) ?? (user.role === "owner" ? "/dashboard" : "/") }, { headers });
    setSessionCookie(response, token);
    clearPendingCookie(response);
    return response;
  }

  const current = await requireRole(req, ["owner", "client"]);
  if (!("deny" in current)) await refreshSessionAuth(current.session.sid);
  return Response.json({ ok: true, recoveryCodes: codes }, { headers });
}
