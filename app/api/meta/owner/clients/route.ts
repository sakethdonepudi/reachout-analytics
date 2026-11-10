import type { NextRequest } from "next/server";
import { z } from "zod";
import { addClientEmail, listClientEmails, ownerEmails, removeClientEmail, requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
const Body = z.object({ email: z.string().email().max(320) });

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  return Response.json({ ok: true, owners: ownerEmails(), clients: await listClientEmails() }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  const result = await addClientEmail(parsed.data.email, auth.session.sub);
  if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
  await audit({ action: "client_added", email: auth.session.sub, role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(), meta: { client: parsed.data.email } });
  return Response.json({ ok: true, clients: await listClientEmails() });
}

export async function DELETE(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]);
  if ("deny" in auth) return auth.deny;
  const email = new URL(req.url).searchParams.get("email") ?? "";
  const result = await removeClientEmail(email);
  if (!result.ok) return Response.json({ ok: false, error: result.reason }, { status: 400 });
  await audit({ action: "client_removed", email: auth.session.sub, role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(), meta: { client: email } });
  return Response.json({ ok: true, clients: await listClientEmails() });
}
