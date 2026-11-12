import type { NextRequest } from "next/server";
import { requireRole, listSessionsForUser, revokeAllSessionsForUser, revokeSessionById } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function maskIp(ip: string | undefined): string {
  if (!ip) return "—";
  if (ip.includes(".")) return `${ip.split(".").slice(0, 3).join(".")}.0/24`;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 4).join(":")}::/64`;
  return "—";
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  if (!auth.session.userId) return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
  const rows = await listSessionsForUser(auth.session.userId);
  return Response.json({
    ok: true,
    current: auth.session.sid,
    sessions: rows.map((row) => ({
      id: row._id,
      device: row.device ?? "Unknown device",
      ip: maskIp(row.ip),
      lastSeen: row.lastSeen,
      createdAt: row.createdAt,
      current: row._id === auth.session.sid,
    })),
  }, { headers });
}

export async function DELETE(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  if (!auth.session.userId) return Response.json({ ok: false, error: "Sign in again" }, { status: 401, headers });
  const params = new URL(req.url).searchParams;
  if (params.get("all") === "1") {
    await revokeAllSessionsForUser(auth.session.userId);
    return Response.json({ ok: true }, { headers });
  }
  const id = params.get("id") ?? "";
  if (!id) return Response.json({ ok: false, error: "Session id is required" }, { status: 400, headers });
  const deleted = await revokeSessionById(id, auth.session.userId);
  return Response.json({ ok: deleted }, { status: deleted ? 200 : 404, headers });
}
