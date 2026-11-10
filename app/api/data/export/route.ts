import type { NextRequest } from "next/server";
import { requireRecentAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { buildWorkbook, type Row } from "@/lib/poll-data";
import { getActiveImportId } from "@/lib/poll-store";
import { getMongo } from "@/lib/mongodb";
import { PIN_DIVISION_METHOD, PIN_DIVISION_VERSION } from "@/lib/pin-divide";
import { POSTAL_REFERENCE } from "@/lib/data/tamil-nadu-pincodes";

export const runtime = "nodejs";
export const maxDuration = 60;

const DB = process.env.MONGODB_DB || "reachout";

async function rowsFor(caseStudyId: string, pollType: "opinion" | "exit"): Promise<Row[]> {
  const p = getMongo();
  if (!p) return [];
  const importId = await getActiveImportId(caseStudyId, pollType);
  if (!importId) return [];
  const client = await p;
  const cursor = client.db(DB).collection("poll_responses").find({ caseStudyId, pollType, importId }).project({ _id: 0, row: 1 });
  const out: Row[] = [];
  for await (const d of cursor) {
    const row = (d as { row: Row }).row;
    // Dataset-level provenance applies to every row (the import it came from and
    // the reference version). District-division metadata is stamped ONLY on rows
    // that actually carry an assumed-PIN allocation — never on unrelated or
    // unallocated rows.
    const allocated = String(row["Assumed PIN Code"] ?? "").trim() !== "" || String(row["PIN Assignment Method"] ?? "").trim() !== "";
    out.push({
      ...row,
      "Reference Version": POSTAL_REFERENCE.version,
      "Source Import ID": importId,
      ...(allocated ? { "PIN Division Method": `${PIN_DIVISION_METHOD} (${PIN_DIVISION_VERSION})` } : {}),
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireRecentAuth(req);
  if ("deny" in auth) return auth.deny;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limit = rateLimit(`export:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);
  if (!getMongo()) return Response.json({ ok: false, error: "Database not configured" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const caseStudyId = (sp.get("caseStudyId") ?? "").trim();
  if (!caseStudyId) return Response.json({ ok: false, error: "caseStudyId is required" }, { status: 400 });

  await audit({ action: "export", email: auth.session.sub, role: "owner", ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(), meta: { caseStudyId } });
  const [opinion, exit] = await Promise.all([rowsFor(caseStudyId, "opinion"), rowsFor(caseStudyId, "exit")]);
  const buf = buildWorkbook(opinion, exit);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${caseStudyId}-poll-export-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
