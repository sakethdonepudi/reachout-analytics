import "server-only";

import { HISTORY } from "@/lib/telangana/history";
import type { ClientHistoryBundle } from "@/lib/telangana/history-runtime";

/** The client-safe historical bundle without the device breakdown. */
export function getClientHistory(): ClientHistoryBundle {
  return {
    version: HISTORY.version,
    cutoff: HISTORY.cutoff,
    groups: HISTORY.groups,
    groupLabels: HISTORY.groupLabels,
    winnerColours: HISTORY.winnerColours,
    sa: HISTORY.sourceAudit,
    cw: HISTORY.crosswalk.map((c) => ({ n: c.no, name: c.name, district: c.district })),
    years: HISTORY.years,
    stats: HISTORY.stats,
  };
}
