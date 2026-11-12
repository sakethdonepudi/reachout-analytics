import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireCsrf } from "@/lib/csrf";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseAdsDeskHtml } from "@/lib/ads-desk/parse";
import { saveDraft } from "@/lib/ads-desk/store";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req); if (csrf) return csrf;
  const auth = await requireRole(req, ["owner"]); if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`ads-upload:${ip}`, 5, 60_000); if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Choose an HTML file." }, { status: 400, headers });
  if (!file.name.toLowerCase().endsWith(".html")) return Response.json({ ok: false, error: "Only .html files are accepted." }, { status: 400, headers });
  if (file.size > 15 * 1024 * 1024) return Response.json({ ok: false, error: "The file must be 15 MB or smaller." }, { status: 400, headers });
  try {
    const parsed = parseAdsDeskHtml(await file.text());
    const versionId = await saveDraft(parsed, file.name, auth.session.displayName ?? auth.session.userId ?? "owner");
    return Response.json({
      ok: true, versionId,
      preview: {
        sha256: parsed.sha256, takenAt: parsed.takenAt, asOf: parsed.asOf,
        regions: parsed.regions.map((region) => ({ key: region.key, label: region.label, totals: region.totals })),
      },
    }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Could not parse the file." }, { status: 400, headers });
  }
}
