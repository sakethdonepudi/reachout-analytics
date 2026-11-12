import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { syncMeta } from "@/lib/meta/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.headers.get("x-cron-secret") ?? "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return Response.json({ ok: false, error: "Cron is not configured" }, { status: 503 });
  }
  if (!authorised(req)) {
    return Response.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const result = await syncMeta({ trigger: "cron" });
  if (result.skipped === "no-connections") {
    return Response.json({ ok: true, skipped: "no-connections" }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(result, { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
