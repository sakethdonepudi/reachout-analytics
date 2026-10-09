import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAbout, saveAbout, type AboutContent } from "@/lib/about-content";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  return Response.json({ ok: true, content: await getAbout() });
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : undefined);
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 400)) : undefined);

/** Update editable About page content. Only known fields are accepted. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("deny" in auth) return auth.deny;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const patch: Partial<AboutContent> = {};
  if (str(body.eyebrow) !== undefined) patch.eyebrow = str(body.eyebrow, 200);
  if (str(body.headline) !== undefined) patch.headline = str(body.headline, 300);
  if (str(body.intro) !== undefined) patch.intro = str(body.intro, 2000);
  if (arr(body.overview)) patch.overview = arr(body.overview);
  if (Array.isArray(body.expertise)) {
    patch.expertise = body.expertise
      .filter((x) => !!x && typeof x === "object")
      .map((x) => {
        const e = x as { title?: unknown; desc?: unknown };
        return { title: String(e.title ?? "").slice(0, 200), desc: String(e.desc ?? "").slice(0, 400) };
      });
  }
  if (arr(body.professionalOrgs)) patch.professionalOrgs = arr(body.professionalOrgs);
  if (arr(body.trainingOrgs)) patch.trainingOrgs = arr(body.trainingOrgs);
  if (arr(body.skills)) patch.skills = arr(body.skills);
  if (body.team && typeof body.team === "object") {
    const t = body.team as Record<string, unknown>;
    const team: AboutContent["team"] = { ...(await getAbout()).team };
    if (str(t.name) !== undefined) team.name = str(t.name, 200) as string;
    if (str(t.role) !== undefined) team.role = str(t.role, 200) as string;
    if (arr(t.bio)) team.bio = arr(t.bio) as string[];
    if (str(t.portrait) !== undefined) team.portrait = str(t.portrait, 400) as string;
    if (str(t.portraitAlt) !== undefined) team.portraitAlt = str(t.portraitAlt, 300) as string;
    patch.team = team;
  }
  if (body.cta && typeof body.cta === "object") {
    const k = body.cta as Record<string, unknown>;
    const cta: AboutContent["cta"] = { ...(await getAbout()).cta };
    if (str(k.title) !== undefined) cta.title = str(k.title, 300) as string;
    if (str(k.body) !== undefined) cta.body = str(k.body, 600) as string;
    if (str(k.button) !== undefined) cta.button = str(k.button, 80) as string;
    patch.cta = cta;
  }

  try {
    const content = await saveAbout(patch);
    return Response.json({ ok: true, content });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Save failed" }, { status: 503 });
  }
}
