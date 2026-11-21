import "server-only";

import { getMongo } from "@/lib/mongodb";
import type { PollKind, PollSegment, VoteShareReason } from "./types";

const SEGMENTS = "poll_segments";
const REASONS = "vote_share_reasons";

async function db() {
  const promise = getMongo();
  if (!promise) return null;
  const client = await promise;
  return client.db(process.env.MONGODB_DB || "reachout");
}

export async function getSegments(state: string, pollType?: PollKind): Promise<PollSegment[]> {
  const database = await db();
  if (!database) return [];
  const query: Record<string, unknown> = { state };
  if (pollType) query.pollType = pollType;
  try {
    return await database.collection<PollSegment>(SEGMENTS).find(query, { projection: { _id: 0 } }).sort({ segmentType: 1, segmentLabel: 1, party: 1 }).toArray();
  } catch {
    return [];
  }
}

export async function getReasons(state: string): Promise<VoteShareReason[]> {
  const database = await db();
  if (!database) return [];
  try {
    return await database.collection<VoteShareReason>(REASONS).find({ state }, { projection: { _id: 0 } }).toArray();
  } catch {
    return [];
  }
}

export async function replaceSegments(state: string, pollType: PollKind, rows: PollSegment[]): Promise<number> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<PollSegment>(SEGMENTS);
  await collection.deleteMany({ state, pollType });
  if (rows.length) await collection.insertMany(rows.map((row) => ({ ...row, state, pollType })));
  return rows.length;
}

export async function replaceReasons(state: string, rows: VoteShareReason[]): Promise<number> {
  const database = await db();
  if (!database) throw new Error("Database not configured");
  const collection = database.collection<VoteShareReason>(REASONS);
  await collection.deleteMany({ state });
  if (rows.length) await collection.insertMany(rows.map((row) => ({ ...row, state })));
  return rows.length;
}
