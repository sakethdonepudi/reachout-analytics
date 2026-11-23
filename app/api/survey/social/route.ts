import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSurveyCached } from "@/lib/survey/store";
import { tnSocialAccount, tnSocialFiltered, tnSocialOverview } from "@/lib/survey/tn-view-dto";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return Response.json({ ok: false, error: "Sign in required" }, { status: 401, headers });
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "tamil-nadu";
  if (state !== "tamil-nadu") return Response.json({ ok: false, error: "Only the Tamil Nadu social view is available." }, { status: 400, headers });
  const record = await getSurveyCached("tamil-nadu");
  if (!record) return Response.json({ ok: false, error: "Survey dashboard not uploaded." }, { status: 404, headers });

  const mode = params.get("mode") ?? "overview";
  try {
    if (mode === "account") {
      const account = await tnSocialAccount(record.data, params.get("account") ?? "");
      if (!account) return Response.json({ ok: false, error: "That ad account was not found." }, { status: 404, headers });
      return Response.json({ ok: true, account }, { headers });
    }
    if (mode === "filter") {
      const filtered = await tnSocialFiltered(record.data, {
        match: (params.get("match") as "target" | "campaigns" | "group") ?? "campaigns",
        kind: params.get("kind") ?? "dist",
        place: params.get("place") ?? "",
        label: params.get("label") ?? "",
        value: params.get("value") ?? "",
        average: params.get("average") ?? "",
        group: params.get("group") ?? "",
      });
      return Response.json({ ok: true, filtered }, { headers });
    }
    const overview = await tnSocialOverview(record.data);
    return Response.json({ ok: true, overview }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "The social view could not be built." }, { status: 500, headers });
  }
}
