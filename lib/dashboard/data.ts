import "server-only";

import { CASES } from "@/lib/cases";
import { getRegionSummaries, getTopCampaigns, listVersions } from "@/lib/ads-desk/store";
import type { AdsRegionSummary } from "@/lib/ads-desk/summary";
import { getRegionMap, unmappedRegions } from "@/lib/ads-desk/mapping";
import { adsManagerForCampaign } from "@/lib/ads-desk/links";
import { history } from "@/lib/poll-store";
import type { PartyId } from "@/lib/parties";

const PARTY_BAND: Record<PartyId, string> = {
  BJP: "#F59E0B",
  AIADMK: "#16A34A",
  BRS: "#E91E63",
  TDP: "#FACC15",
  "JD(U)": "#0F766E",
  INC: "#2563EB",
};

export type DashboardTotals = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  campaigns: number;
  active: number;
  costPerResult: number;
  ctr: number;
};

export type DashboardState = DashboardTotals & {
  slug: string;
  party: PartyId;
  stateName: string;
  band: string;
  mappedRegions: { key: string; label: string; asOf: string }[];
  poll: { at: string; fileName: string; rows: number; outcome: string } | null;
};

export type DashboardCampaign = {
  id: string;
  name: string;
  results: number;
  spend: number;
  impressions: number;
  href: string | null;
  slug: string;
  party: PartyId;
  stateName: string;
  band: string;
};

export type DashboardVersion = {
  id: string;
  fileName: string;
  uploadedAt: string;
  takenAt: string;
  range: string;
  number: number;
};

export type DashboardShell = {
  version: DashboardVersion | null;
  states: DashboardState[];
  unmapped: string[];
  cases: { id: string; slug: string; title: string }[];
  versions: { _id: string; uploadedAt: string; uploadedBy?: string; sha256?: string; fileName: string; status: string; takenAt: string }[];
  activeId: string | null;
};

export type DashboardAnalytics = {
  version: DashboardVersion | null;
  totals: DashboardTotals;
  previous: DashboardTotals | null;
  states: DashboardState[];
  campaigns: DashboardCampaign[];
};

function emptyTotals(): DashboardTotals {
  return { spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, campaigns: 0, active: 0, costPerResult: 0, ctr: 0 };
}

function totalsFor(rows: AdsRegionSummary[]): DashboardTotals {
  const t = rows.reduce((acc, row) => {
    acc.spend += row.totals.spend ?? 0;
    acc.impressions += row.totals.impressions ?? 0;
    acc.reach += row.totals.reach ?? 0;
    acc.clicks += row.totals.clicks ?? 0;
    acc.campaigns += row.totals.campaigns ?? 0;
    acc.active += row.totals.active ?? 0;
    acc.results += row.accounts.reduce((sum, account) => sum + (account.results ?? 0), 0);
    return acc;
  }, emptyTotals());
  t.costPerResult = t.results > 0 ? t.spend / t.results : 0;
  t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  return t;
}

function groupBySlug(summaries: AdsRegionSummary[], map: Record<string, string>) {
  const bySlug = new Map<string, AdsRegionSummary[]>();
  for (const summary of summaries) {
    const slug = map[summary.regionKey];
    if (!slug) continue;
    const rows = bySlug.get(slug) ?? [];
    rows.push(summary);
    bySlug.set(slug, rows);
  }
  return bySlug;
}

function latestPolls(rows: Record<string, unknown>[]) {
  const latest = new Map<string, { at: string; fileName: string; rows: number; outcome: string }>();
  for (const row of rows) {
    const caseStudyId = String(row.caseStudyId ?? "");
    if (!caseStudyId || latest.has(caseStudyId)) continue;
    const counts = row.counts as { total?: number } | undefined;
    latest.set(caseStudyId, {
      at: String(row.at ?? ""),
      fileName: String(row.filename ?? "workbook"),
      rows: Number(counts?.total ?? row.inserted ?? 0),
      outcome: String(row.outcome ?? ""),
    });
  }
  return latest;
}

function buildStates(bySlug: Map<string, AdsRegionSummary[]>, polls: Map<string, { at: string; fileName: string; rows: number; outcome: string }>, withTotals: boolean): DashboardState[] {
  return CASES.map((item) => {
    const rows = bySlug.get(item.slug) ?? [];
    return {
      slug: item.slug,
      party: item.party,
      stateName: item.stateName,
      band: rows[0]?.band ?? PARTY_BAND[item.party],
      ...(withTotals ? totalsFor(rows) : emptyTotals()),
      mappedRegions: rows.map((row) => ({ key: row.regionKey, label: row.label, asOf: row.asOf })),
      poll: polls.get(item.slug) ?? null,
    };
  });
}

function versionFor(active: { _id: string; fileName: string; uploadedAt: string; takenAt: string } | null, versions: { _id: string }[], summaries: AdsRegionSummary[]): DashboardVersion | null {
  return active ? {
    id: active._id,
    fileName: active.fileName,
    uploadedAt: active.uploadedAt,
    takenAt: active.takenAt,
    range: summaries[0]?.range ?? "",
    number: versions.length - versions.indexOf(active as { _id: string }),
  } : null;
}

export async function getDashboardShell(): Promise<DashboardShell> {
  const [versions, map, unmapped, pollHistory] = await Promise.all([listVersions(24), getRegionMap(), unmappedRegions(), history(null, 200)]);
  const active = versions.find((version) => version.status === "active") ?? null;
  const summaries = active ? await getRegionSummaries(active._id) : [];
  return {
    version: versionFor(active, versions, summaries),
    states: buildStates(groupBySlug(summaries, map), latestPolls(pollHistory as Record<string, unknown>[]), false),
    unmapped,
    cases: CASES.map((item) => ({ id: item.slug, slug: item.slug, title: `${item.party} · ${item.stateName}` })),
    versions: versions.map((version) => ({ _id: version._id, uploadedAt: version.uploadedAt, uploadedBy: version.uploadedBy, sha256: version.sha256, fileName: version.fileName, status: version.status, takenAt: version.takenAt })),
    activeId: active?._id ?? null,
  };
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const [versions, map, pollHistory] = await Promise.all([listVersions(24), getRegionMap(), history(null, 200)]);
  const active = versions.find((version) => version.status === "active") ?? null;
  const summaries = active ? await getRegionSummaries(active._id) : [];
  const previousVersion = versions.find((version) => version._id !== active?._id && version.status !== "draft") ?? null;
  const previousSummaries = previousVersion ? await getRegionSummaries(previousVersion._id) : [];
  const topCampaigns = active ? await getTopCampaigns(active._id, 10) : [];
  const bySlug = groupBySlug(summaries, map);
  const campaigns = topCampaigns.map((campaign) => {
    const slug = map[campaign.regionKey] ?? "";
    const item = CASES.find((row) => row.slug === slug);
    return {
      id: campaign.id,
      name: campaign.name,
      results: campaign.results,
      spend: campaign.spend,
      impressions: campaign.impressions,
      href: adsManagerForCampaign(campaign.accountId, campaign.id),
      slug,
      party: item?.party ?? ("BJP" as PartyId),
      stateName: item?.stateName ?? campaign.regionKey,
      band: summaries.find((row) => row.regionKey === campaign.regionKey)?.band ?? PARTY_BAND[item?.party ?? "BJP"],
    };
  });
  return {
    version: versionFor(active, versions, summaries),
    totals: totalsFor(summaries),
    previous: previousVersion ? totalsFor(previousSummaries) : null,
    states: buildStates(bySlug, latestPolls(pollHistory as Record<string, unknown>[]), true),
    campaigns,
  };
}
