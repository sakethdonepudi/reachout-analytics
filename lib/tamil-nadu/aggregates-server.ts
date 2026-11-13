import "server-only";

import aggregates from "@/lib/data/tamil-nadu/aggregates.json";
import type { TnAggregates } from "@/lib/tamil-nadu/model";
import { getPublishedSnapshot } from "@/lib/tamil-nadu/snapshot-store";

/** Aggregates for the page shell, preferring the last approved snapshot. */
export async function getTamilNaduAggregates(): Promise<TnAggregates> {
  const published = await getPublishedSnapshot();
  const current = aggregates as TnAggregates;
  const matches = !!published
    && published.sourceHash === current.sourceHash
    && published.sourceVersion === current.version;
  return (matches ? published!.bundle : current) as TnAggregates;
}
