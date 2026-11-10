import type { PublicMetaStatus } from "@/lib/meta/store";

/** Client-safe connection summary. Never include cost, spend, budget or token data. */
export function publicClientSummary(status: PublicMetaStatus) {
  return {
    connected: status.connected,
    accountName: status.accountName,
    adAccounts: status.adAccounts.map((account) => ({ id: account.id, name: account.name, status: account.status, currency: account.currency })),
    pages: status.pages.map((page) => ({ id: page.id, name: page.name })),
    lastSyncAt: status.lastSyncAt,
  };
}
