import type { Db } from "mongodb";
import { CASES } from "@/lib/cases";

export type TagRuleField = "prefix" | "contains" | "regex";
export type MetaTagRule = {
  _id: string;
  field: TagRuleField;
  pattern: string;
  state: string;
  party: string;
  createdAt: string;
};
export type MetaCampaignTag = {
  _id: string;
  campaignId: string;
  accountId: string;
  state: string;
  party: string;
  source: "rule" | "manual";
  confirmed: boolean;
  ruleId?: string;
  updatedAt: string;
};

export const STATE_OPTIONS = CASES.map((item) => ({ slug: item.slug, label: item.stateName }));
export const PARTY_OPTIONS: Record<string, string[]> = {
  "tamil-nadu": ["TVK", "AIADMK+", "DMK+", "NTK", "Others"],
  telangana: ["BRS", "Congress", "BJP", "AIMIM", "Others"],
};
export const DEFAULT_PARTIES = ["Others"];
export const TAG_RULE_FIELDS: { id: TagRuleField; label: string }[] = [
  { id: "prefix", label: "Starts with" },
  { id: "contains", label: "Contains" },
  { id: "regex", label: "Regex" },
];

export function partiesForState(slug: string): string[] {
  return PARTY_OPTIONS[slug] ?? DEFAULT_PARTIES;
}

export function ruleMatches(name: string, rule: Pick<MetaTagRule, "field" | "pattern">): boolean {
  if (!name || !rule.pattern) return false;
  if (rule.field === "prefix") return name.startsWith(rule.pattern);
  if (rule.field === "contains") return name.includes(rule.pattern);
  try {
    return new RegExp(rule.pattern).test(name);
  } catch {
    return false;
  }
}

export function validateRule(input: { field?: unknown; pattern?: unknown; state?: unknown; party?: unknown }): { ok: true; value: Omit<MetaTagRule, "_id" | "createdAt"> } | { ok: false; error: string } {
  const field = input.field;
  const pattern = typeof input.pattern === "string" ? input.pattern.trim() : "";
  const state = typeof input.state === "string" ? input.state : "";
  const party = typeof input.party === "string" ? input.party.trim() : "";
  if (field !== "prefix" && field !== "contains" && field !== "regex") return { ok: false, error: "Choose a rule type" };
  if (!pattern || pattern.length > 200) return { ok: false, error: "Enter a pattern of 200 characters or fewer" };
  if (!STATE_OPTIONS.some((option) => option.slug === state)) return { ok: false, error: "Choose a state" };
  if (!party) return { ok: false, error: "Choose a party" };
  if (field === "regex") {
    try { new RegExp(pattern); } catch { return { ok: false, error: "Enter a valid regular expression" }; }
  }
  return { ok: true, value: { field, pattern, state, party } };
}

/** Apply naming rules as unconfirmed suggestions without replacing manual/confirmed tags. */
export async function applyTagRules(db: Db): Promise<number> {
  const rules = await db.collection<MetaTagRule & { _id: string }>("meta_tag_rules").find({}).sort({ createdAt: 1 }).toArray();
  if (!rules.length) return 0;
  const campaigns = await db.collection<{ _id: string; name?: string; accountId?: string }>("meta_campaigns").find({}).toArray();
  const existing = await db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").find({}).toArray();
  const byCampaign = new Map(existing.map((tag) => [tag.campaignId, tag]));
  let changed = 0;

  for (const campaign of campaigns) {
    const current = byCampaign.get(campaign._id);
    if (current && (current.source === "manual" || current.confirmed)) continue;
    const rule = rules.find((candidate) => ruleMatches(campaign.name ?? "", candidate));
    if (!rule) continue;
    if (current && current.source === "rule" && current.ruleId === rule._id && current.state === rule.state && current.party === rule.party) continue;
    await db.collection<MetaCampaignTag & { _id: string }>("meta_campaign_tags").updateOne(
      { _id: campaign._id },
      {
        $set: {
          campaignId: campaign._id,
          accountId: campaign.accountId ?? "",
          state: rule.state,
          party: rule.party,
          source: "rule",
          confirmed: false,
          ruleId: rule._id,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    changed += 1;
  }
  return changed;
}
