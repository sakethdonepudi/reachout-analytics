import "server-only";

import { getWorkspaceConnection } from "@/lib/meta/store";
import { syncMeta } from "@/lib/meta/sync";

/** Opening a dashboard refreshes data when the last sync is over 30 minutes old. */
export async function maybeBackgroundSync(): Promise<void> {
  const connection = await getWorkspaceConnection();
  if (!connection || connection.status !== "active") return;
  const last = connection.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : 0;
  if (Date.now() - last < 30 * 60 * 1000) return;
  await syncMeta({ trigger: "manual" }).catch(() => null);
}
