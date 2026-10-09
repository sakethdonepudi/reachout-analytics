import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await getSession(req);
  if (!s) return Response.json({ ok: false }, { status: 401 });
  return Response.json({ ok: true, role: s.role });
}
