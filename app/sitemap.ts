import type { MetadataRoute } from "next";
import { LIVE_CASE_SLUGS } from "@/lib/cases";

const BASE = "https://reachout-analytics.vercel.app";

/** Public entry points. Protected dashboards stay out; robots.txt disallows crawling. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "monthly", priority: 1 },
    ...LIVE_CASE_SLUGS.map((slug) => ({ url: `${BASE}/case-studies/${slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
