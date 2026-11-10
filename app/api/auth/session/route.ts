import type { NextRequest } from "next/server";
import { getSession, sessionIsRecent } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  return Response.json({ ok: true, role: session.role, email: session.sub, recent: sessionIsRecent(session) }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
