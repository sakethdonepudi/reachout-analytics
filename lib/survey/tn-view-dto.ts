import "server-only";

import { adsManagerCampaigns, adsManagerForCampaign } from "@/lib/ads-desk/links";
import { getClientLinks } from "@/lib/ads-desk/settings";
import type { SurveyData } from "./types";
import { canonicalDistrictName } from "@/lib/tamil-nadu/aliases";
import { buildSurveyMap, type SurveyMapRow, type SurveyMapSlot } from "@/lib/tamil-nadu/survey-map";
import { surveySlots } from "./tn-shared";
import type { TnAc, TnDistrict } from "@/lib/tamil-nadu/model";

const MONEY = /spend|cost|cpm|cpc|cpr|billing|amount|inr|budget|payment/i;
const AIRX = /aiadmk|admk|\beps\b|edapp|puratchi|amma|it wing|two leaves/i;

export type { TnSocialCampaign, TnSocialAccount, TnSocialPeriod, TnSocialTotals, TnSocialOverview, TnSocialFiltered } from "./social-types";
import type { TnSocialCampaign, TnSocialAccount, TnSocialOverview, TnSocialFiltered, SocialFilter } from "./social-types";

type AnyRecord = Record<string, unknown>;
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const text = (value: unknown) => String(value ?? "");
const record = (value: unknown): AnyRecord => (value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {});
const cleanNote = (value: unknown) => {
  const note = text(value);
  return MONEY.test(note) ? "Campaign delivery overview for Tamil Nadu." : note;
};

export function tnSurveyForClient(data: SurveyData): SurveyData {
  return {
    parties: data.parties,
    regions: data.regions,
    periods: data.periods,
    periodCatalog: Object.entries(data.periods).map(([key, period]) => ({ key, label: period.label })),
    actual: data.actual,
    base: data.base,
    n_total: data.n_total,
    geo: data.geo,
    zonelabels: data.zonelabels,
    ads: {
      label: text(data.ads?.label) || "Meta ads",
      range: text(data.ads?.range),
      asOf: data.ads?.asOf,
      note: cleanNote(data.ads?.note),
      total: {},
      periods: {},
    },
  };
}

function safeAccountName(raw: unknown, rank: number, id: string, owner: boolean) {
  const name = text(raw).trim();
  if (owner) return name || id;
  if (!name || /\d{10,20}/.test(name)) return `Ad account ${rank}`;
  return name;
}

function accountRows(data: SurveyData, links: boolean, owner: boolean): { accounts: TnSocialAccount[]; campaignsByKey: Map<string, TnSocialCampaign[]>; idByKey: Map<string, string> } {
  const ads = record(data.ads);
  const sourceAccounts = Array.isArray(ads.accounts) ? ads.accounts as AnyRecord[] : [];
  const camps = record(ads.camps);
  const rankById = new Map<string, number>();
  [...sourceAccounts]
    .sort((left, right) => number(right.reach) - number(left.reach) || sourceAccounts.indexOf(left) - sourceAccounts.indexOf(right))
    .forEach((account, index) => rankById.set(text(account.acct), index + 1));
  const campaignsByKey = new Map<string, TnSocialCampaign[]>();
  const idByKey = new Map<string, string>();
  const accounts = sourceAccounts.map((account) => {
    const id = text(account.acct);
    const rank = rankById.get(id) ?? 0;
    const source = Array.isArray(camps[id]) ? camps[id] as AnyRecord[] : [];
    const campaigns: TnSocialCampaign[] = source.map((campaign) => ({
      ...(owner ? { id: text(campaign.id) } : {}),
      name: text(campaign.name),
      period: text(campaign.per),
      status: text(campaign.st),
      start: text(campaign.start),
      reach: number(campaign.reach),
      impressions: number(campaign.impr),
      views: number(campaign.views),
      clicks: number(campaign.clicks),
      engagements: number(campaign.eng),
      ...(links ? { href: adsManagerForCampaign(id, campaign.id) } : {}),
    }));
    const key = `acct-${rank}`;
    campaignsByKey.set(key, campaigns);
    idByKey.set(key, id);
    return {
      key,
      name: safeAccountName(account.acct_name, rank, id, owner),
      ...(owner ? { id, business: text(account.business) } : {}),
      campaignCount: number(account.n) || campaigns.length,
      reach: number(account.reach),
      impressions: number(account.impr),
      views: number(account.views),
      clicks: number(account.clicks),
      engagements: number(account.eng),
      ...(links ? { href: adsManagerCampaigns(id) } : {}),
    };
  });
  return { accounts, campaignsByKey, idByKey };
}

export async function tnSocialOverview(data: SurveyData, owner = false): Promise<TnSocialOverview> {
  const links = owner && await getClientLinks();
  const ads = record(data.ads);
  const totalsSource = record(ads.total);
  const { accounts } = accountRows(data, links, owner);
  const periods = Object.entries(record(ads.periods)).map(([key, value]) => {
    const item = record(value);
    return {
      key,
      label: text(item.label) || key,
      campaigns: number(item.n),
      reach: number(item.reach),
      impressions: number(item.impr),
      views: number(item.views),
      clicks: number(item.clicks),
      engagements: number(item.eng),
      ...(item.responses != null ? { responses: number(item.responses) } : {}),
    };
  });
  return {
    label: text(ads.label) || "Meta ads",
    range: text(ads.range),
    asOf: text(ads.asOf) || undefined,
    note: cleanNote(ads.note) || undefined,
    totals: {
      accounts: accounts.length,
      campaigns: number(totalsSource.n),
      reach: number(totalsSource.reach),
      impressions: number(totalsSource.impr),
      views: number(totalsSource.views),
      clicks: number(totalsSource.clicks),
      engagements: number(totalsSource.eng),
    },
    accounts,
    periods,
  };
}

export async function tnSocialAccount(data: SurveyData, accountKey: string, owner = false): Promise<TnSocialFiltered | null> {
  const links = owner && await getClientLinks();
  const { accounts, campaignsByKey } = accountRows(data, links, owner);
  const account = accounts.find((item) => item.key === accountKey || (owner && item.id === accountKey));
  if (!account) return null;
  const campaigns = campaignsByKey.get(account.key) ?? [];
  return {
    title: account.name,
    note: `${account.campaignCount} campaigns in ${account.name}.`,
    how: "Campaigns in this ad account.",
    accounts: [account],
    campaigns,
    totalMatching: campaigns.length,
  };
}

type FilterOptions = SocialFilter;

const geo = (data: SurveyData) => record(record(data.geo));
const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/\(sc\)|\(st\)/g, "").replace(/[^a-z0-9]/g, "");

function geoChildren(data: SurveyData, kind: string, place: string): string[] {
  const source = record(kind === "zone" ? geo(data).zone : kind === "dist" ? geo(data).dist : {});
  const children = Array.isArray(source[place]) ? source[place] as unknown[] : [];
  return children.map(text);
}

export async function tnSocialFiltered(data: SurveyData, options: FilterOptions, owner = false): Promise<TnSocialFiltered> {
  const links = owner && await getClientLinks();
  const { accounts, campaignsByKey, idByKey } = accountRows(data, links, owner);
  const accountBySourceId = new Map<string, TnSocialAccount>();
  for (const account of accounts) accountBySourceId.set(idByKey.get(account.key) ?? account.id ?? "", account);
  const all: Array<TnSocialCampaign & { accountId: string }> = [];
  for (const account of accounts) for (const campaign of campaignsByKey.get(account.key) ?? []) all.push({ ...campaign, accountId: idByKey.get(account.key) ?? account.id ?? "" });

  const mode = options.match;
  const place = String(options.place ?? "").replace(/^\d+\s+/, "").trim();
  const group = canonicalDistrictName(String(options.group ?? options.label ?? place));
  let matched: Array<TnSocialCampaign & { accountId: string }> = [];
  let how = "";

  if (mode === "group") {
    const key = normalize(group);
    if (key.length >= 4) {
      matched = all.filter((campaign) => normalize(campaign.name).includes(key));
      how = `campaign names matched "${group}"`;
    }
    if (!matched.length) {
      matched = all.filter((campaign) => AIRX.test(campaign.name));
      how = `no campaign is named for ${group}, so these are the AIADMK campaigns to retarget at this group`;
    }
  } else {
    const kind = options.kind ?? "dist";
    const base = canonicalDistrictName(place);
    const tokens = [base, ...geoChildren(data, kind, place)]
      .map(normalize)
      .filter((token) => token.length >= 4 && (!["north", "south", "delta", "chennai"].includes(token) || token === normalize(base)));
    const unique = [...new Set(tokens)];
    matched = all.filter((campaign) => unique.some((token) => normalize(campaign.name).includes(token)));
    how = `campaigns named for ${base}${kind === "ac" ? "" : " or its constituencies"}`;
    if (mode === "target" && !matched.length) {
      matched = all.filter((campaign) => AIRX.test(campaign.name));
      how = `no campaign is named for ${base}, so these are the AIADMK campaigns to retarget there`;
    }
  }

  matched.sort((a, b) => b.reach - a.reach || b.clicks - a.clicks);
  const limited = (mode === "campaigns" ? matched.slice(0, 150) : matched.slice(0, 100)).map(({ accountId: _accountId, ...campaign }) => campaign);
  const byAccount = new Map<string, TnSocialAccount>();
  for (const campaign of matched) {
    const account = accountBySourceId.get(campaign.accountId);
    if (!account) continue;
    const current = byAccount.get(account.key);
    if (current) {
      current.campaignCount += 1;
      current.reach += campaign.reach;
      current.impressions += campaign.impressions;
      current.views += campaign.views;
      current.clicks += campaign.clicks;
      current.engagements += campaign.engagements;
    } else {
      byAccount.set(account.key, {
        ...account,
        campaignCount: 1,
        reach: campaign.reach,
        impressions: campaign.impressions,
        views: campaign.views,
        clicks: campaign.clicks,
        engagements: campaign.engagements,
      });
    }
  }
  const used = [...byAccount.values()].sort((a, b) => b.reach - a.reach);
  const title = mode === "target"
    ? `Target campaign · ${options.label ?? place}`
    : mode === "group"
      ? `${options.label ?? group} campaigns`
      : `${options.label ?? place} campaigns`;
  return {
    title,
    note: `${matched.length} matching Tamil Nadu campaigns across ${used.length} ad accounts.`,
    how,
    accounts: used,
    campaigns: limited,
    totalMatching: matched.length,
  };
}

/** Key names that must never appear in a social payload. */
export function tnSocialMoneyKeys(): RegExp {
  return MONEY;
}

const PROFILE_ORDER: Record<string, string[]> = {
  op: ["age", "caste", "prof", "zone", "dist", "ac", "v21", "app"],
  ex: ["zone", "dist", "ac", "v21", "age", "caste", "prof", "form", "religion", "app"],
};

export type TnSerializedMap = {
  slot: SurveyMapSlot;
  acs: TnAc[];
  districts: TnDistrict[];
  districtRows: Record<string, SurveyMapRow>;
  acRows: Record<string, SurveyMapRow>;
  resultRows: Record<string, { acs: number; seats: Record<string, number>; total: number }>;
};
export type TnSwingSource = { key: string; label: string; expected: Record<string, import("./types").SurveyShare>; seats: Record<string, unknown>; n: number };
export type TnSwingPayload = { sources: Record<"op" | "ex", TnSwingSource[]> };

function serializeMap(build: ReturnType<typeof buildSurveyMap>): TnSerializedMap {
  return {
    slot: build.slot,
    acs: build.acs,
    districts: build.districts,
    districtRows: Object.fromEntries(build.districtRows),
    acRows: Object.fromEntries(build.acRows),
    resultRows: Object.fromEntries(build.resultRows),
  };
}

/** Uploaded data sliced to the active period, slot and profile for the RSC payload. */
export function tnSurveySlice(data: SurveyData, options: { view: string; slot?: string | null; profile?: string | null }): {
  data: SurveyData;
  profiles: string[];
  activeProfile: string;
  map: TnSerializedMap | null;
  swing: TnSwingPayload;
} {
  const periodKey = options.view === "social" ? "op" : options.view;
  const active = data.periods[periodKey];
  const slotKey = options.slot ?? "all";
  const month = slotKey !== "all" && active?.months?.[slotKey] ? slotKey : active?.months && Object.keys(active.months).find((monthKey) => active.months?.[monthKey]?.sub?.[slotKey]) || "";
  const sub = month ? active?.months?.[month]?.sub?.[slotKey] : undefined;
  const activeSlot = sub ?? (month ? active?.months?.[month] : active);
  const demos = activeSlot?.demo ?? {};
  const order = PROFILE_ORDER[periodKey] ?? [];
  const profiles = [...order.filter((key) => demos[key]), ...Object.keys(demos).filter((key) => !order.includes(key))];
  const activeProfile = options.profile && demos[options.profile] ? options.profile : profiles[0] ?? "";

  const periods: SurveyData["periods"] = {};
  for (const [key, period] of Object.entries(data.periods)) {
    const isActive = key === periodKey;
    const months: NonNullable<SurveyData["periods"][string]["months"]> = {};
    for (const [monthKey, monthValue] of Object.entries(period.months ?? {})) {
      const subs: NonNullable<SurveyData["periods"][string]["sub"]> = {};
      for (const [subKey, subValue] of Object.entries(monthValue.sub ?? {})) {
        const keep = isActive && subKey === slotKey;
        subs[subKey] = keep ? { ...subValue, demo: activeProfile && subValue.demo?.[activeProfile] ? { [activeProfile]: subValue.demo[activeProfile] } : {} } : { ...subValue, demo: {} };
      }
      const keepMonth = isActive && monthKey === month && !sub;
      months[monthKey] = {
        ...monthValue,
        demo: keepMonth && activeProfile && monthValue.demo?.[activeProfile] ? { [activeProfile]: monthValue.demo[activeProfile] } : {},
        ...(Object.keys(subs).length ? { sub: subs } : {}),
      };
    }
    const keepAll = isActive && !month && !sub;
    periods[key] = {
      ...period,
      demo: keepAll && activeProfile && period.demo?.[activeProfile] ? { [activeProfile]: period.demo[activeProfile] } : {},
      ...(isActive && profiles.length ? { demoCatalog: Object.fromEntries(profiles.map((profileKey) => [profileKey, { label: (activeSlot?.demo ?? {})[profileKey]?.label ?? profileKey, cov: (activeSlot?.demo ?? {})[profileKey]?.cov }])) } : {}),
      ...(Object.keys(months).length ? { months } : {}),
    };
  }

  const map = serializeMap(buildSurveyMap(data, periodKey, options.view === "rs" ? "all" : slotKey));
  const swing: TnSwingPayload = { sources: { op: [], ex: [] } };
  for (const key of ["op", "ex"] as const) {
    swing.sources[key] = surveySlots(data, key)
      .filter((item) => !item.subKey)
      .map((item) => {
        const build = buildSurveyMap(data, key, item.key);
        return { key: item.key, label: build.slot.label, expected: build.slot.expected, seats: build.slot.seats, n: build.slot.n };
      });
  }
  return {
    profiles,
    activeProfile,
    map,
    swing,
    data: {
      parties: data.parties,
      regions: data.regions,
      periods,
      actual: data.actual,
      base: data.base,
      n_total: data.n_total,
      zonelabels: data.zonelabels,
      geo: undefined,
      ads: { label: text(data.ads?.label) || "Meta ads", range: text(data.ads?.range), asOf: data.ads?.asOf, note: cleanNote(data.ads?.note), total: {}, periods: {} },
    },
  };
}
