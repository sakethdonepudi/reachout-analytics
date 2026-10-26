import { getMongo } from "@/lib/mongodb";
import type { TnAggregates } from "./model";

const DB = process.env.MONGODB_DB || "reachout";
const ID = "tamil-nadu:exit";
const COLLECTION = "tamil_nadu_allocations";

export type PublishedTnAllocation = {
  _id: string;
  caseStudyId: "tamil-nadu";
  pollType: "exit";
  publishedAt: string;
  allocationVersion: string;
  sourceImportId: string;
  sourceHash: string;
  bundle: TnAggregates;
};

export async function getPublishedAllocation(): Promise<PublishedTnAllocation | null> {
  try {
    const p = getMongo();
    if (!p) return null;
    const client = await p;
    return await client.db(DB).collection<PublishedTnAllocation>(COLLECTION).findOne({ _id: ID });
  } catch {
    return null;
  }
}

export async function publishAllocation(bundle: TnAggregates): Promise<PublishedTnAllocation | null> {
  try {
    const p = getMongo();
    if (!p) return null;
    const client = await p;
    const doc: PublishedTnAllocation = {
      _id: ID,
      caseStudyId: "tamil-nadu",
      pollType: "exit",
      publishedAt: new Date().toISOString(),
      allocationVersion: bundle.allocation.version,
      sourceImportId: bundle.allocation.sourceImportId,
      sourceHash: bundle.sourceHash,
      bundle,
    };
    await client.db(DB).collection<PublishedTnAllocation>(COLLECTION).replaceOne({ _id: ID }, doc, { upsert: true });
    return doc;
  } catch {
    return null;
  }
}
