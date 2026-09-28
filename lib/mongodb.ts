import { MongoClient } from "mongodb";

/**
 * Cached MongoClient so dev hot-reloads and serverless warm starts reuse one
 * connection pool instead of opening a new connection per request.
 * Needs MONGODB_URI (Atlas connection string) and optional MONGODB_DB
 * (defaults to "reachout").
 */
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "reachout";

declare global {
  // eslint-disable-next-line no-var
  var __reachoutMongo: Promise<MongoClient> | undefined;
}

export function getMongo(): Promise<MongoClient> | null {
  if (!uri) return null;
  if (!global.__reachoutMongo) {
    global.__reachoutMongo = new MongoClient(uri, { maxPoolSize: 5 }).connect();
  }
  return global.__reachoutMongo;
}

export async function getLeadsCollection() {
  const clientPromise = getMongo();
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(dbName).collection("leads");
}
