import type { NextRequest } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRecentAuth, revokeAllSessionsForUser } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { CASES } from "@/lib/cases";
import { PARTIES } from "@/lib/parties";
import { countActiveOwners, createUser, deleteUser, disableTotp, getUser, listUsers, setTemporaryPassword, updateUser } from "@/lib/users";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

const Create = z.object({
  username: z.string().min(3, "Username: 3-32 characters, use a-z, 0-9, dot, underscore or hyphen.").max(32, "Username: 3-32 characters, use a-z, 0-9, dot, underscore or hyphen."),
  displayName: z.string().min(2, "Display name must be 2-80 characters.").max(80, "Display name must be 2-80 characters."),
  organisation: z.string().max(120).optional(),
  role: z.enum(["owner", "client"], { message: "Choose owner or client." }),
  password: z.string().min(12, "Temporary password must be at least 12 characters.").max(256, "Temporary password must be 256 characters or fewer."),
  totpRequired: z.boolean().optional(),
  clientScope: z.object({
    caseStudies: z.array(z.string().max(80)).max(50),
    states: z.array(z.string().max(80)).max(20),
    parties: z.array(z.string().max(40)).max(20),
  }).optional(),
});

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  return Response.json({
    ok: true,
    users: await listUsers(),
    currentUserId: auth.session.userId,
    cases: CASES.map((item) => ({ slug: item.slug, title: item.title, state: item.stateName, party: item.party })),
    parties: Object.values(PARTIES).map((party) => party.name),
    states: [...new Set(CASES.map((item) => item.stateName))].sort(),
  }, { headers });
}

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) }, { status: 400, headers });
  const created = await createUser({ ...parsed.data, createdBy: auth.session.userId ?? null });
  if (!created.ok) {
    const message = created.error;
    const key = /username/i.test(message) ? "username" : /password/i.test(message) ? "password" : /display name/i.test(message) ? "displayName" : "form";
    return Response.json({ ok: false, error: message, fieldErrors: { [key]: message } }, { status: 400, headers });
  }
  await audit({ action: "user_created", role: "owner", meta: { userId: created.user._id, roleCreated: created.user.role } });
  return Response.json({ ok: true, id: created.user._id }, { headers });
}

