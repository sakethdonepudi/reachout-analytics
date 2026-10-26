import { getMongo } from "@/lib/mongodb";
import type { TnAggregates } from "./model";

const DB = process.env.MONGODB_DB || "reachout";
const ID = "tamil-nadu:exit";
const COLLECTION = "tamil_nadu_snapshots";

export type PublishedTnSnapshot = {
  _id: string;
  caseStudyId: "tamil-nadu";
  pollType: "exit";
  publishedAt: string;
  sourceVersion: string;
  sourceImportId: string;
  sourceHash: string;
  bundle: TnAggregates;
};

export async function getPublishedSnapshot(): Promise<PublishedTnSnapshot | null> {
  try {
    const p = getMongo();
    if (!p) return null;
    const client = await p;
    return await client.db(DB).collection<PublishedTnSnapshot>(COLLECTION).findOne({ _id: ID });
  } catch {
    return null;
  }
}

export async function publishSnapshot(bundle: TnAggregates): Promise<PublishedTnSnapshot | null> {
  try {
    const p = getMongo();
    if (!p) return null;
    const client = await p;
    const doc: PublishedTnSnapshot = {
      _id: ID,
      caseStudyId: "tamil-nadu",
      pollType: "exit",
      publishedAt: new Date().toISOString(),
      sourceVersion: bundle.version,
      sourceImportId: bundle.sourceImportId,
      sourceHash: bundle.sourceHash,
      bundle,
    };
    await client.db(DB).collection<PublishedTnSnapshot>(COLLECTION).replaceOne({ _id: ID }, doc, { upsert: true });
    return doc;
  } catch {
    return null;
  }
}
