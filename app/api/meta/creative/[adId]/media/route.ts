import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { graphGet } from "@/lib/meta/client";
import { getCreativeView } from "@/lib/meta/creative";
import { getMetaDb, getWorkspaceConnection } from "@/lib/meta/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Proxy the Meta video stream through our origin so the CDN source URL and the
 * access token never reach the browser. The resolved source is short-lived, so
 * it is fetched per request and the response is cached for 30 minutes.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ adId: string }> }) {
  const auth = await requireRole(req, ["owner", "client"]);
  if ("deny" in auth) return auth.deny;
  const db = await getMetaDb();
  if (!db) return new Response("Database not configured", { status: 503 });

  const { adId } = await context.params;
  const state = new URL(req.url).searchParams.get("state");
  const isOwner = auth.session.role === "owner";
  if (!isOwner && !state) return new Response("state is required", { status: 400 });

  const view = await getCreativeView(db, adId, state, isOwner);
  const videoId = view?.creative?.videoId;
  if (!view || !videoId) return new Response("Media not found", { status: 404 });

  const connection = await getWorkspaceConnection();
  if (!connection) return new Response("Media unavailable", { status: 503 });

  let source: string | undefined;
  try {
    const data = await graphGet<{ source?: string }>(`/${encodeURIComponent(videoId)}`, { fields: "source" }, connection);
    source = data.source;
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
  if (!source) return new Response("Media not found", { status: 404 });

  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(source, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });
  } catch {
    return new Response("Media unavailable", { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) return new Response("Media unavailable", { status: 502 });

  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
    "Cache-Control": "private, max-age=1800",
    "Accept-Ranges": "bytes",
    Vary: "Cookie",
  });
  for (const name of ["content-length", "content-range"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
