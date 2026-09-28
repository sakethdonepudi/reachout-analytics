import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLeadsCollection } from "@/lib/mongodb";

export const runtime = "nodejs";

const LeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  organisation: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(4000).optional().default(""),
  // honeypot: real users never see or fill this field
  website: z.string().optional().default(""),
});

/** Best-effort per-instance rate limit: 5 submissions per IP per hour.
 *  Serverless instances each keep their own map, so this blunts casual spam
 *  rather than stopping a determined flood - move to Upstash if volume grows. */
const hits = new Map<string, { count: number; reset: number }>();
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  h.count += 1;
  return h.count > LIMIT;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Please check the form fields" }, { status: 400 });
  }
  const lead = parsed.data;

  // honeypot: pretend success so bots learn nothing
  if (lead.website) {
    return NextResponse.json({ ok: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many messages - please email us directly" }, { status: 429 });
  }

  const leads = await getLeadsCollection();
  if (!leads) {
    // MONGODB_URI not configured on this deployment
    return NextResponse.json({ ok: false, error: "Form backend not configured yet" }, { status: 503 });
  }

  await leads.insertOne({
    name: lead.name,
    organisation: lead.organisation,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    ip,
    userAgent: req.headers.get("user-agent")?.slice(0, 300) || "",
    createdAt: new Date(),
    status: "new",
  });

  return NextResponse.json({ ok: true });
}
