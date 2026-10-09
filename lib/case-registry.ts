import { CASES } from "@/lib/cases";
import { getMongo } from "@/lib/mongodb";

/* =====================================================================
   Case-study registry. Every dataset, import and history entry is scoped
   to a caseStudyId. Stored in MongoDB (mutable by admins); seeded from the
   static CASES list on first use.
   ===================================================================== */

export type CaseRecord = {
  id: string;
  slug: string;
  title: string;
  state: string;
  electionYear: number;
  published: boolean;
  description?: string;
  status: "draft" | "published";
};

const DB = process.env.MONGODB_DB || "reachout";

function yearFor(slug: string): number {
  if (slug.includes("2023")) return 2023;
  if (slug.includes("2024")) return 2024;
  if (slug.includes("2029")) return 2029;
  return 2026;
}

export const DEFAULT_REGISTRY: CaseRecord[] = CASES.map((c) => ({
  id: c.slug,
  slug: c.slug,
  title: c.title,
  state: c.state,
  electionYear: yearFor(c.slug),
  published: false,
  status: "draft" as const,
}));

async function col() {
  const p = getMongo();
  if (!p) return null;
  const client = await p;
  return client.db(DB).collection<CaseRecord>("case_studies");
}

export async function ensureRegistry(): Promise<void> {
  const c = await col();
  if (!c) return;
  for (const r of DEFAULT_REGISTRY) {
    await c.updateOne({ id: r.id }, { $setOnInsert: r }, { upsert: true });
  }
}

export async function listCases(): Promise<CaseRecord[]> {
  const c = await col();
  if (!c) return DEFAULT_REGISTRY;
  await ensureRegistry();
  return c.find({}).sort({ electionYear: -1, title: 1 }).toArray();
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const c = await col();
  if (!c) return DEFAULT_REGISTRY.find((r) => r.id === id) ?? null;
  await ensureRegistry();
  return c.findOne({ $or: [{ id }, { slug: id }] });
}

export async function updateCase(id: string, patch: Partial<Pick<CaseRecord, "title" | "description" | "published" | "electionYear" | "state">>): Promise<CaseRecord | null> {
  const c = await col();
  if (!c) return null;
  const set: Partial<CaseRecord> = { ...patch };
  if (patch.published !== undefined) set.status = patch.published ? "published" : "draft";
  const r = await c.findOneAndUpdate({ $or: [{ id }, { slug: id }] }, { $set: set }, { returnDocument: "after" });
  return r as CaseRecord | null;
}
