import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRecentAuth, revokeAllSessionsForUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { countActiveOwners, deleteUser, disableTotp, getUser, setTemporaryPassword, updateUser } from "@/lib/users";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

const Patch = z.object({
  action: z.enum(["update", "reset-password", "reset-2fa", "end-sessions"]),
  displayName: z.string().min(2).max(80).optional(),
  organisation: z.string().max(120).nullable().optional(),
  role: z.enum(["owner", "client"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  totpRequired: z.boolean().optional(),
  clientScope: z.object({
    caseStudies: z.array(z.string().max(80)).max(50),
    states: z.array(z.string().max(80)).max(20),
    parties: z.array(z.string().max(40)).max(20),
  }).optional(),
  password: z.string().min(12).max(256).optional(),
});

async function lastOwnerGuard(targetRole: string, targetTotp: boolean): Promise<boolean> {
  if (targetRole !== "owner" || !targetTotp) return false;
  return (await countActiveOwners()) <= 1;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const { id } = await context.params;
  const target = await getUser(id);
  if (!target) return Response.json({ ok: false, error: "User not found" }, { status: 404, headers });
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  const self = auth.session.userId === id;
  const action = parsed.data.action;

  if (action === "end-sessions") {
    await revokeAllSessionsForUser(id);
    await audit({ action: "sign_out_everywhere", role: "owner", meta: { targetUserId: id } });
    return Response.json({ ok: true }, { headers });
  }

  if (action === "reset-password") {
    if (!parsed.data.password || parsed.data.password.length < 12) {
      return Response.json({ ok: false, error: "Temporary password must be at least 12 characters.", fieldErrors: { password: "Temporary password must be at least 12 characters." } }, { status: 400, headers });
    }
    const result = await setTemporaryPassword(id, parsed.data.password, target.username);
    if (!result.ok) return Response.json({ ok: false, error: result.error, fieldErrors: { password: result.error ?? "Invalid password." } }, { status: 400, headers });
    await revokeAllSessionsForUser(id);
    await audit({ action: "password_reset", role: "owner", meta: { targetUserId: id } });
    return Response.json({ ok: true }, { headers });
  }

  if (action === "reset-2fa") {
    if (target.role === "owner" && (await lastOwnerGuard(target.role, target.totpEnabled))) {
      return Response.json({ ok: false, error: "The last active owner must keep 2FA." }, { status: 400, headers });
    }
    await disableTotp(id);
    await revokeAllSessionsForUser(id);
    await audit({ action: "totp_reset", role: "owner", meta: { targetUserId: id } });
    return Response.json({ ok: true }, { headers });
  }

  const demoting = parsed.data.role && parsed.data.role !== target.role;
  const disabling = parsed.data.status === "disabled" && target.status !== "disabled";
  if (self && (demoting || disabling)) return Response.json({ ok: false, error: "You cannot demote or disable your own account." }, { status: 400, headers });
  if ((demoting || disabling) && await lastOwnerGuard(target.role, target.totpEnabled)) {
    return Response.json({ ok: false, error: "At least one active owner with 2FA is required." }, { status: 400, headers });
  }
  if (parsed.data.role === "owner" && target.role !== "owner") parsed.data.totpRequired = true;

  const updated = await updateUser(id, {
    displayName: parsed.data.displayName,
    organisation: parsed.data.organisation,
    role: parsed.data.role,
    status: parsed.data.status,
    totpRequired: parsed.data.totpRequired,
    clientScope: parsed.data.clientScope,
  });
  if (!updated) return Response.json({ ok: false, error: "Nothing to update." }, { status: 400, headers });
  if (disabling) await revokeAllSessionsForUser(id);
  await audit({
    action: disabling ? "user_disabled" : "user_updated",
    role: "owner",
    meta: { targetUserId: id, role: updated.role, status: updated.status, scope: parsed.data.clientScope },
  });
  return Response.json({ ok: true, user: updated }, { headers });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const { id } = await context.params;
  if (auth.session.userId === id) return Response.json({ ok: false, error: "You cannot delete your own account." }, { status: 400, headers });
  const target = await getUser(id);
  if (!target) return Response.json({ ok: false, error: "User not found" }, { status: 404, headers });
  if (await lastOwnerGuard(target.role, target.totpEnabled)) {
    return Response.json({ ok: false, error: "At least one active owner with 2FA is required." }, { status: 400, headers });
  }
  await revokeAllSessionsForUser(id);
  await deleteUser(id);
  await audit({ action: "user_deleted", role: "owner", meta: { targetUserId: id } });
  return Response.json({ ok: true }, { headers });
}
