const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function gone() {
  return Response.json({ ok: false, error: "Meta integration removed" }, { status: 410, headers });
}

export const GET = gone;
export const POST = gone;
export const PATCH = gone;
export const PUT = gone;
export const DELETE = gone;
