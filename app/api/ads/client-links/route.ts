import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireRecentAuth } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { audit } from "@/lib/audit";
import { getClientLinks, setClientLinks } from "@/lib/ads-desk/settings";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  return Response.json({ ok: true, clientLinks: await getClientLinks() }, { headers });
}

export async function PUT(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const parsed = z.object({ clientLinks: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400, headers });
  await setClientLinks(parsed.data.clientLinks);
  await audit({ action: "ads_client_links_changed", role: "owner", meta: { clientLinks: parsed.data.clientLinks } });
  return Response.json({ ok: true, clientLinks: parsed.data.clientLinks }, { headers });
}
