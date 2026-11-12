import { createHash } from "node:crypto";
import { getMongo } from "@/lib/mongodb";
import { maskEmail, redact } from "@/lib/redact";
import type { Role } from "@/lib/access";

const DB = process.env.MONGODB_DB || "reachout";

export type AuditAction =
  | "login_success" | "login_failed" | "login_denied" | "reauth" | "logout" | "logout_all"
  | "role_denied" | "export" | "csrf_rejected" | "totp_failed" | "recovery_code_used" | "session_idle_timeout"
  | "owner_bootstrap" | "ads_upload" | "ads_publish" | "ads_rollback" | "user_created" | "user_updated" | "user_disabled" | "user_deleted"
  | "password_reset" | "totp_reset" | "sign_out_everywhere" | "scope_changed";

export async function audit(input: {
  action: AuditAction;
  email?: string | null;
  role?: Role | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}) {
  const ipHash = createHash("sha256")
    .update(`${input.ip ?? "unknown"}:${process.env.ADMIN_SESSION_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 24);
  const doc = {
    at: new Date().toISOString(),
    action: input.action,
    email: input.email ? maskEmail(input.email) : null,
    role: input.role ?? null,
    ipHash,
    meta: redact(input.meta ?? {}) as Record<string, unknown>,
  };
  try {
    const p = getMongo();
    if (!p) return;
    const client = await p;
    await client.db(DB).collection("audit_log").insertOne(doc);
  } catch {
    // Auditing must never break the request path.
  }
}

export async function recentAudit(limit = 100) {
  const p = getMongo();
  if (!p) return [];
  const client = await p;
  const rows = await client.db(DB).collection("audit_log").find({}).sort({ at: -1 }).limit(Math.min(500, Math.max(1, limit))).toArray();
  return rows.map(({ _id, ...rest }) => rest);
}
