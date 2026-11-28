import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth";
import { getSurveyCached } from "@/lib/survey/store";
import { tnSocialAccount, tnSocialFiltered, tnSocialOverview } from "@/lib/survey/tn-view-dto";
import { apSocialAccount, apSocialFiltered, apSocialOverview } from "@/lib/survey/ap-view-dto";
import { kaSocialAccount, kaSocialFiltered, kaSocialOverview } from "@/lib/survey/ka-view-dto";
import { tgSocialAccount, tgSocialFiltered, tgSocialOverview } from "@/lib/survey/tg-view-dto";

export const runtime = "nodejs";
export const preferredRegion = "bom1";

const headers = { "Cache-Control": "private, max-age=300", Vary: "Cookie" };

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    const response = Response.json({ ok: false, error: "Sign in required" }, { status: 401, headers });
    clearSessionCookie(response);
    return response;
  }
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "tamil-nadu";
  if (state !== "tamil-nadu" && state !== "andhra-pradesh-2024" && state !== "karnataka" && state !== "telangana") return Response.json({ ok: false, error: "That social view is not available." }, { status: 400, headers });
  const record = await getSurveyCached(state);
  if (!record) return Response.json({ ok: false, error: "Survey dashboard not uploaded." }, { status: 404, headers });
  const owner = session.role === "owner";
  const ap = state === "andhra-pradesh-2024";
  const ka = state === "karnataka";
  const tg = state === "telangana";

  const mode = params.get("mode") ?? "overview";
  try {
    if (mode === "account") {
      const account = await (tg ? tgSocialAccount(record.data, params.get("account") ?? "", owner) : ka ? kaSocialAccount(record.data, params.get("account") ?? "", owner) : ap ? apSocialAccount(record.data, params.get("account") ?? "", owner) : tnSocialAccount(record.data, params.get("account") ?? "", owner));
      if (!account) return Response.json({ ok: false, error: "That ad account was not found." }, { status: 404, headers });
      return Response.json({ ok: true, account }, { headers });
    }
    if (mode === "filter") {
      const filtered = await (tg ? tgSocialFiltered : ka ? kaSocialFiltered : ap ? apSocialFiltered : tnSocialFiltered)(record.data, {
        match: (params.get("match") as "target" | "campaigns" | "group") ?? "campaigns",
        kind: params.get("kind") ?? "dist",
        place: params.get("place") ?? "",
        label: params.get("label") ?? "",
        value: params.get("value") ?? "",
        average: params.get("average") ?? "",
        group: params.get("group") ?? "",
      }, owner);
      return Response.json({ ok: true, filtered }, { headers });
    }
    const overview = await (tg ? tgSocialOverview : ka ? kaSocialOverview : ap ? apSocialOverview : tnSocialOverview)(record.data, owner);
    return Response.json({ ok: true, overview }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "The social view could not be built." }, { status: 500, headers });
  }
}
