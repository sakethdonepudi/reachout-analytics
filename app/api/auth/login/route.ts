import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Password login was replaced by Google sign-in. */
export async function POST(_req: NextRequest) {
  return Response.json({ ok: false, error: "Password login is disabled. Continue with Google." }, { status: 410 });
}
