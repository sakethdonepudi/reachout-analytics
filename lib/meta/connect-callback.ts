import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { MetaState } from "@/lib/meta/oauth";
import type { SessionRecord } from "@/lib/auth";
import type { UserDoc } from "@/lib/users";
import { IDLE_MS } from "@/lib/auth";
import { getMongo } from "@/lib/mongodb";

export type CallbackFailure = "state" | "session" | "expired" | "connect";

export type CallbackIdentity = {
  sid: string;
  userId: string;
  ownerEmail: string;
  sessionExp: number;
};

function equalState(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

/** Verify the signed state before touching Meta. Never relies on the session cookie. */
export function validateConnectState(input: {
  stored: MetaState | null;
  state: string;
  session: SessionRecord | null;
  user: UserDoc | null;
  now?: number;
}): { ok: true; identity: CallbackIdentity } | { ok: false; code: CallbackFailure } {
  const now = input.now ?? Date.now();
  const stored = input.stored;
  if (!stored) return { ok: false, code: "session" };
  if (!input.state || !stored.state || !equalState(input.state, stored.state)) return { ok: false, code: "state" };
  if (!stored.sid || !stored.userId) return { ok: false, code: "state" };
  if (!input.session) return { ok: false, code: "session" };
  if (input.session.userId !== stored.userId || input.session.role !== "owner") return { ok: false, code: "session" };
  if (input.session.exp.getTime() <= now) return { ok: false, code: "expired" };
  const graceActive = Boolean(input.session.graceUntil && input.session.graceUntil.getTime() > now);
  if (!graceActive && now - input.session.lastSeen.getTime() > IDLE_MS) return { ok: false, code: "expired" };
  if (!input.user || input.user._id !== stored.userId || input.user.role !== "owner" || input.user.status !== "active") {
    return { ok: false, code: "session" };
  }
  return {
    ok: true,
    identity: {
      sid: stored.sid,
      userId: stored.userId,
      ownerEmail: input.user.username,
      sessionExp: input.session.exp.getTime(),
    },
  };
}

/** Single-use state record, so a replayed cookie fails even if the cookie is kept. */
export async function consumeConnectState(state: string): Promise<boolean> {
  const promise = getMongo();
  if (!promise) return false;
  try {
    const client = await promise;
    const col = client.db(process.env.MONGODB_DB || "reachout").collection<{ _id: string; expiresAt: Date }>("meta_connect_states");
    await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    const _id = createHash("sha256").update(state).digest("hex");
    await col.insertOne({ _id, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** No inline script, so the nonce CSP is untouched. The second hop is same-site. */
export function bounceResponse(destination: string): Response {
  const href = escapeHtml(destination);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0;url=${href}">
<title>Connecting Meta Ads…</title>
</head>
<body>
<p>Connecting Meta Ads…</p>
<p>If nothing happens, <a href="${href}">continue</a>.</p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
      Vary: "Cookie",
    },
  });
}

export function callbackDestination(code: CallbackFailure | null): string {
  return code ? `/meta-ads/settings?error=${code}` : "/meta-ads/settings?connected=1";
}
