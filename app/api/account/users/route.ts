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
  username: z.string().min(3).max(32),
  displayName: z.string().min(2).max(80),
  organisation: z.string().max(120).optional(),
  role: z.enum(["owner", "client"]),
  password: z.string().min(12).max(256),
  totpRequired: z.boolean().optional(),
  clientScope: z.object({
    caseStudies: z.array(z.string().max(80)).max(50),
    states: z.array(z.string().max(80)).max(20),
    parties: z.array(z.string().max(40)).max(20),
  }).optional(),
});

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
  if (!parsed.success) return Response.json({ ok: false, error: "Check the form and try again." }, { status: 400, headers });
  const created = await createUser({ ...parsed.data, createdBy: auth.session.userId ?? null });
  if (!created.ok) return Response.json({ ok: false, error: created.error }, { status: 400, headers });
  await audit({ action: "user_created", role: "owner", meta: { userId: created.user._id, roleCreated: created.user.role } });
  return Response.json({ ok: true, id: created.user._id }, { headers });
}

