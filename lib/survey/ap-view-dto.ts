import "server-only";

import { adsManagerCampaigns, adsManagerForCampaign } from "@/lib/ads-desk/links";
import { getClientLinks } from "@/lib/ads-desk/settings";
import type { SurveyData, SurveyDemo } from "./types";
import type { SocialFilter, TnSocialAccount, TnSocialCampaign, TnSocialFiltered, TnSocialMonth, TnSocialOverview, TnSocialPeriod } from "./social-types";
import type { TnCardModel, TnClientModel, TnSerializedMap, TnSlotModel, TnSwingPayload } from "./tn-view-model";
import { accuracyAgainst, surveySlots } from "./tn-shared";
import { tnSocialMonthly } from "./tn-view-dto";
import { buildApSurveyMap, apDemoLeader } from "@/lib/andhra-pradesh/survey-map";
import { canonicalApAcName, canonicalApDistrict, splitApAcLabel } from "@/lib/andhra-pradesh/aliases";

const STATE = "Andhra Pradesh";
const MONEY = /spend|cost|cpm|cpc|cpr|billing|amount|inr|budget|payment/i;
type AnyRecord = Record<string, unknown>;
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0);
const text = (value: unknown) => String(value ?? "");
const record = (value: unknown): AnyRecord => (value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {});

const cleanCampaignName = (name: string) => name.replace(/₹\s?[\d,.]+/g, "").replace(/\b(?:INR|Rs\.?)\s?[\d,.]+/gi, "").replace(/\s{2,}/g, " ").trim();

function safeAccountName(raw: unknown, rank: number, id: string, owner: boolean) {
  const name = text(raw).trim();
  if (owner) return name || id;
  return `Ad account ${rank}`;
}

function accountRows(data: SurveyData, links: boolean, owner: boolean) {
  const ads = record(data.ads);
  const sourceAccounts = Array.isArray(ads.accounts) ? ads.accounts as AnyRecord[] : [];
  const camps = record(ads.camps);
  const rankById = new Map<string, number>();
  [...sourceAccounts].sort((left, right) => number(right.reach) - number(left.reach)).forEach((account, index) => rankById.set(text(account.acct), index + 1));
  const campaignsByKey = new Map<string, TnSocialCampaign[]>();
  const idByKey = new Map<string, string>();
  const accounts = sourceAccounts.map((account) => {
    const id = text(account.acct);
    const rank = rankById.get(id) ?? 0;
    const source = Array.isArray(camps[id]) ? camps[id] as AnyRecord[] : [];
    const campaigns: TnSocialCampaign[] = source.map((campaign) => ({
      ...(owner ? { id: text(campaign.id) } : {}),
      name: owner ? text(campaign.name) : cleanCampaignName(text(campaign.name)),
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

export async function apSocialOverview(data: SurveyData, owner = false): Promise<TnSocialOverview> {
  const links = owner && await getClientLinks();
  const ads = record(data.ads);
  const totalsSource = record(ads.total);
  const { accounts } = accountRows(data, links, owner);
  const allCampaigns = Object.values(record(ads.camps)).flatMap((value) => Array.isArray(value) ? value.map(record) : []);
  const periodMetrics = (key: string) => {
    const match = allCampaigns.filter((campaign) => {
      const period = text(campaign.per).toLowerCase();
      if (key === "pre") return period.includes("pre");
      if (key === "op") return period.includes("opinion");
      if (key === "ex") return period.includes("exit");
      if (key === "post") return period.includes("post");
      return false;
    });
    return { impressions: match.reduce((sum, c) => sum + number(c.impr), 0), views: match.reduce((sum, c) => sum + number(c.views), 0), engagements: match.reduce((sum, c) => sum + number(c.eng), 0) };
  };
  const periods: TnSocialPeriod[] = Object.entries(record(ads.periods)).map(([key, value]) => {
    const item = record(value);
    const metrics = periodMetrics(key);
    const label = text(item.label) || key;
    const parsed = /^(.*?)\s*\((.*)\)\s*$/.exec(label);
    return { key, label, name: parsed?.[1]?.trim() ?? label, range: parsed?.[2]?.trim() ?? "", campaigns: number(item.n), reach: number(item.reach), impressions: number(item.impr) || metrics.impressions, views: number(item.views) || metrics.views, clicks: number(item.clicks), engagements: number(item.eng) || metrics.engagements, ...(item.responses != null ? { responses: number(item.responses) } : {}) };
  });
  const rank: Record<string, number> = { op: 0, ex: 1, rd: 2 };
  periods.sort((left, right) => (rank[left.key] ?? 9) - (rank[right.key] ?? 9));
  return {
    label: text(ads.label) || "Meta ads",
    range: text(ads.range),
    asOf: text(ads.asOf) || undefined,
    note: `Campaign delivery overview for Andhra Pradesh.`,
    totals: { accounts: accounts.length, campaigns: number(totalsSource.n), reach: number(totalsSource.reach), impressions: number(totalsSource.impr), views: number(totalsSource.views), clicks: number(totalsSource.clicks), engagements: number(totalsSource.eng) },
    accounts,
    periods,
    monthly: tnSocialMonthly(data),
  };
}

export async function apSocialAccount(data: SurveyData, accountKey: string, owner = false): Promise<TnSocialFiltered | null> {
  const links = owner && await getClientLinks();
  const { accounts, campaignsByKey } = accountRows(data, links, owner);
  const account = accounts.find((item) => item.key === accountKey || (owner && item.id === accountKey));
  if (!account) return null;
  const campaigns = campaignsByKey.get(account.key) ?? [];
  return { title: account.name, note: `${account.campaignCount} campaigns in ${account.name}.`, how: "Campaigns in this ad account.", accounts: [account], campaigns, totalMatching: campaigns.length };
}

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/\(sc\)|\(st\)/g, "").replace(/[^a-z0-9]/g, "");

function geoChildren(data: SurveyData, kind: string, place: string): string[] {
  const geo = record(record(data.geo));
  const source = record(kind === "zone" ? geo.zone : kind === "dist" ? geo.dist : kind === "area" ? geo.area : {});
  return (Array.isArray(source[place]) ? source[place] as unknown[] : []).map(text);
}

export async function apSocialFiltered(data: SurveyData, options: SocialFilter, owner = false): Promise<TnSocialFiltered> {
  const links = owner && await getClientLinks();
  const { accounts, campaignsByKey, idByKey } = accountRows(data, links, owner);
  const accountBySourceId = new Map<string, TnSocialAccount>();
  for (const account of accounts) accountBySourceId.set(idByKey.get(account.key) ?? account.id ?? "", account);
  const all: Array<TnSocialCampaign & { accountId: string }> = [];
  for (const account of accounts) for (const campaign of campaignsByKey.get(account.key) ?? []) all.push({ ...campaign, accountId: idByKey.get(account.key) ?? account.id ?? "" });

  const mode = options.match;
  const place = canonicalApDistrict(String(options.place ?? "").replace(/^\d+\s+/, "").trim());
  const group = canonicalApAcName(String(options.group ?? options.label ?? place));
  let matched: Array<TnSocialCampaign & { accountId: string }> = [];
  let how = "";
  const geoKinds = new Set(["zone", "area", "dist", "ac"]);
  const nonGeo = mode === "target" && !geoKinds.has(options.kind ?? "");

  if (mode === "group") {
    const key = normalize(group);
    if (key.length >= 4) matched = all.filter((campaign) => normalize(campaign.name).includes(key));
    how = `campaign names matched "${group}"`;
  } else if (nonGeo) {
    matched = [...all];
    how = "Audiences you can reuse for retargeting and look-alike audiences";
  } else {
    const kind = options.kind ?? "dist";
    const base = place;
    const tokens = [base, ...geoChildren(data, kind, options.place ?? base)]
      .map(normalize)
      .filter((token) => token.length >= 3);
    const unique = [...new Set(tokens)];
    matched = all.filter((campaign) => unique.some((token) => normalize(campaign.name).includes(token)));
    how = `campaigns named for ${base}${kind === "ac" ? "" : " or its constituencies"}`;
    if (mode === "target" && !matched.length) {
      matched = all.filter((campaign) => /ysrcp|jagan|yeduguri|saila|fan/i.test(campaign.name));
      how = `no campaign is named for ${base}, so these are the YSRCP campaigns to retarget there`;
    }
  }

  if (nonGeo) {
    const active = (campaign: TnSocialCampaign) => /(^|\s)(active|limit reached)/i.test(campaign.status);
    matched.sort((a, b) => Number(active(b)) - Number(active(a)) || b.reach - a.reach || b.clicks - a.clicks);
  } else {
    matched.sort((a, b) => b.reach - a.reach || b.clicks - a.clicks);
  }
  const limited = matched.slice(0, 100).map(({ accountId: _accountId, ...campaign }) => campaign);
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
      byAccount.set(account.key, { ...account, campaignCount: 1, reach: campaign.reach, impressions: campaign.impressions, views: campaign.views, clicks: campaign.clicks, engagements: campaign.engagements });
    }
  }
  const used = [...byAccount.values()].sort((a, b) => b.reach - a.reach);
  const title = mode === "target" ? `Target campaign · ${options.label ?? place}` : mode === "group" ? `${options.label ?? group} campaigns` : `${options.label ?? place} campaigns`;
  return { title, place: nonGeo ? (options.label ?? options.place) : (options.place ?? options.label ?? group), note: `${matched.length} matching Andhra Pradesh campaigns across ${used.length} ad accounts.`, how, accounts: used, campaigns: limited, totalMatching: matched.length };
}

function apSlots(data: SurveyData, periodKey: string): Array<{ key: string; label: string; monthKey?: string; subKey?: string }> {
  const period = data.periods[periodKey];
  if (!period) return [];
  const allLabel = periodKey === "rd" ? "All years" : periodKey === "ex" ? "May 2024 (all)" : "All months";
  const list: Array<{ key: string; label: string; monthKey?: string; subKey?: string }> = [{ key: "all", label: allLabel }];
  for (const [monthKey, month] of Object.entries(period.months ?? {})) {
    list.push({ key: monthKey, label: month.label, monthKey });
    for (const [subKey, sub] of Object.entries(month.sub ?? {})) list.push({ key: subKey, label: sub.label, monthKey, subKey });
  }
  return list;
}

export function apClientModel(data: SurveyData, initialView: string, initialSlot: string): TnClientModel {
  const actual = data.actual[STATE] ?? {};
  const cards: TnCardModel[] = ["op", "ex", "rd"].map((key) => {
    const period = data.periods[key];
    if (!period) return null;
    const seats = period.seats as Record<string, unknown>;
    return {
      key,
      label: key === "rd" ? "Post-poll (Live tracking)" : period.label.replace(/\s*\(.*/, ""),
      n: period.n,
      expected: period.expected[STATE] ?? {},
      accuracy: key === "rd" ? undefined : accuracyAgainst(period.expected[STATE] ?? {}, actual, data.parties),
      showAccuracy: key !== "rd",
      seats: Object.fromEntries(data.parties.map((party) => [party, Number(seats[party] ?? 0)])),
    };
  }).filter(Boolean) as TnCardModel[];
  const slots: Record<string, TnSlotModel[]> = {};
  const swing: TnSwingPayload = { sources: {} };
  for (const key of ["op", "ex", "rd"]) {
    slots[key] = [];
    swing.sources[key] = [];
    const period = data.periods[key];
    if (!period) continue;
    for (const option of apSlots(data, key)) {
      const month = option.monthKey ? period.months?.[option.monthKey] : undefined;
      const sub = option.subKey ? month?.sub?.[option.subKey] : undefined;
      const base = sub ?? month ?? period;
      slots[key].push({
        key: option.key,
        label: sub ? `${month?.label ?? option.monthKey} · ${sub.label}` : month ? month.label : `${period.label} (all ${key === "rd" ? "years" : "months"})`,
        buttonLabel: option.label,
        monthKey: option.monthKey,
        subKey: option.subKey,
        n: base.n,
        from: base.from ?? period.from ?? "",
        to: base.to ?? period.to ?? "",
        expected: base.expected,
        seats: base.seats,
        demoCatalog: Object.fromEntries(Object.entries(base.demo ?? {}).map(([profileKey, profile]) => [profileKey, { label: profile.label, cov: profile.cov }])),
        profiles: base.demo ?? {},
        lazyProfiles: [],
      });
      if (!option.subKey) swing.sources[key].push({ key: option.key, label: slots[key][slots[key].length - 1].label, expected: base.expected, seats: base.seats, n: base.n, base: period.base2019, last: period.last, target: period.target });
    }
  }
  return {
    parties: data.parties,
    regions: data.regions,
    actual: data.actual,
    base: (data.periods.op?.base2019 ?? {}) as Record<string, Record<string, number>>,
    zonelabels: data.zonelabels,
    n_total: data.n_total,
    actualSeats: { NDA: 164, YSRCP: 11 },
    actualZones: {},
    cards,
    slots,
    swing,
    socialMonthly: tnSocialMonthly(data),
    initialMap: serializeApMap(buildApSurveyMap(data, initialView === "ex" ? "ex" : initialView === "rd" ? "rd" : "op", initialSlot)),
  };
}

export function serializeApMap(build: ReturnType<typeof buildApSurveyMap>): TnSerializedMap {
  return {
    slot: { ...build.slot, demo: {}, demoCatalog: undefined },
    acs: build.acs.map((ac) => ({ no: ac.no, name: ac.name, district: ac.district, districtEci: ac.district, survey: ac.survey, surveyLeader: ac.surveyLeader, noData: ac.noData })) as unknown as TnSerializedMap["acs"],
    districts: build.districts.map((district) => ({ name: district.name, acs: district.acs, survey: district.survey, surveyLeader: district.surveyLeader })) as unknown as TnSerializedMap["districts"],
    districtRows: Object.fromEntries(build.districtRows),
    acRows: Object.fromEntries(build.acRows),
    resultRows: {},
  };
}

export { apDemoLeader, splitApAcLabel };
