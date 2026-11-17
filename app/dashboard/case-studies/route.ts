import { NextResponse, type NextRequest } from "next/server";

/** Retired: the owner portal now lives at /dashboard. */
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/dashboard", req.url), 308);
}
