"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useReauth } from "@/components/auth/reauth-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TN_COLOR } from "@/lib/tamil-nadu/model";
import { PARTY_COLOR } from "@/lib/telangana/constants";
import { cn } from "@/lib/utils";

type CampaignTag = {
  campaignId: string;
  state: string;
  party: string;
  source: "rule" | "manual";
  confirmed: boolean;
};
type Campaign = {
  id: string;
  name: string;
  accountId: string | null;
  status: string | null;
  effectiveStatus: string | null;
  tag: CampaignTag | null;
};
type Account = { id: string; name: string; currency: string | null };
type StateOption = { slug: string; label: string };
type Rule = { _id: string; field: "prefix" | "contains" | "regex"; pattern: string; state: string; party: string };
type Draft = { state: string; party: string };

const EMPTY_DRAFT: Draft = { state: "", party: "" };

function partyColour(state: string, party: string): string {
  if (state === "tamil-nadu") return TN_COLOR[party as keyof typeof TN_COLOR] ?? "#64748b";
  if (state === "telangana") return PARTY_COLOR[party as keyof typeof PARTY_COLOR] ?? "#64748b";
  return "#64748b";
}

function statusTone(status: string | null): "success" | "warning" | "danger" | "neutral" {
  if (!status) return "neutral";
  if (status === "ACTIVE") return "success";
  if (["PENDING_BILLING_INFO", "WITH_ISSUES", "IN_PROCESS", "PAUSED"].includes(status)) return "warning";
  if (["DISABLED", "DISAPPROVED", "DELETED"].includes(status)) return "danger";
  return "neutral";
}

export function MetaTagging() {
  const { requestReauth } = useReauth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [parties, setParties] = useState<Record<string, string[]>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ruleField, setRuleField] = useState<Rule["field"]>("prefix");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleState, setRuleState] = useState("");
  const [ruleParty, setRuleParty] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tagsResponse, rulesResponse] = await Promise.all([
        fetch("/api/meta/owner/tags", { cache: "no-store" }),
        fetch("/api/meta/owner/tag-rules", { cache: "no-store" }),
      ]);
      if (!tagsResponse.ok) throw new Error("Could not load campaign tags");
      const tags = await tagsResponse.json();
      setCampaigns(tags.campaigns ?? []);
      setAccounts(tags.accounts ?? []);
      setStates(tags.states ?? []);
      setParties(tags.parties ?? {});
      setDrafts(Object.fromEntries((tags.campaigns ?? []).map((campaign: Campaign) => [
        campaign.id,
        { state: campaign.tag?.state ?? "", party: campaign.tag?.party ?? "" },
      ])));
      if (rulesResponse.ok) setRules((await rulesResponse.json()).rules ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load campaign tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function send(url: string, method: string, body?: unknown, retry = false): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 403 && !retry) {
      const data = await response.json().catch(() => ({}));
      if (data.code === "reauth_required" && (await requestReauth())) return send(url, method, body, true);
    }
    return response;
  }

  async function saveTag(campaignId: string, confirmed = true) {
    const draft = drafts[campaignId] ?? EMPTY_DRAFT;
    if (!draft.state || !draft.party) { setMessage("Choose a state and party first."); return; }
    setBusy(`tag:${campaignId}`); setError(""); setMessage("");
    try {
      const response = await send("/api/meta/owner/tags", "POST", { campaignId, state: draft.state, party: draft.party, confirmed });
      if (!response.ok) throw new Error("Could not save the tag");
      setMessage("Campaign tag saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the tag");
    } finally { setBusy(""); }
  }

  async function untag(campaignId: string) {
    setBusy(`untag:${campaignId}`); setError(""); setMessage("");
    try {
      const response = await send(`/api/meta/owner/tags?campaignId=${encodeURIComponent(campaignId)}`, "DELETE");
      if (!response.ok) throw new Error("Could not clear the tag");
      setMessage("Campaign tag cleared.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear the tag");
    } finally { setBusy(""); }
  }

  async function confirmAll() {
    setBusy("confirm-all"); setError(""); setMessage("");
    try {
      const response = await send("/api/meta/owner/tags/confirm-all", "POST");
      if (!response.ok) throw new Error("Could not confirm suggestions");
      const data = await response.json();
      setMessage(`${data.confirmed ?? 0} suggestion(s) confirmed.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm suggestions");
    } finally { setBusy(""); }
  }

  async function addRule() {
    setBusy("rule"); setError(""); setMessage("");
    try {
      const response = await send("/api/meta/owner/tag-rules", "POST", { field: ruleField, pattern: rulePattern, state: ruleState, party: ruleParty });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save the rule");
      setRulePattern("");
      setMessage(`${data.suggestions ?? 0} campaign suggestion(s) created.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the rule");
    } finally { setBusy(""); }
  }

  async function removeRule(id: string) {
    setBusy(`rule:${id}`); setError(""); setMessage("");
    try {
      const response = await send(`/api/meta/owner/tag-rules?id=${encodeURIComponent(id)}`, "DELETE");
      if (!response.ok) throw new Error("Could not remove the rule");
      setMessage("Naming rule removed.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the rule");
    } finally { setBusy(""); }
  }

  const accountName = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]);
  const ruleParties = parties[ruleState] ?? [];

  if (loading) return <Card className="p-5"><SkeletonRows rows={6} /></Card>;

  return (
    <div className="space-y-5">
      {(error || message) && (
        <p role={error ? "alert" : "status"} className={cn("rounded-[var(--radius-control)] border px-3 py-2 text-[12.5px]", error ? "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]" : "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]")}>
          {error || message}
        </p>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="type-micro text-[var(--text-muted)]">Naming rules</p>
            <h2 className="type-h3 mt-1">Suggest tags from campaign names</h2>
            <p className="type-small mt-1 text-[var(--text-muted)]">Rules create unconfirmed suggestions. Manual and confirmed tags are never overwritten.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Rule
            <select value={ruleField} onChange={(event) => setRuleField(event.target.value as Rule["field"])} className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]">
              <option value="prefix">Starts with</option>
              <option value="contains">Contains</option>
              <option value="regex">Regex</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Pattern
            <input value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} placeholder="TN_TVK_" className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]" />
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">State
            <select value={ruleState} onChange={(event) => { setRuleState(event.target.value); setRuleParty(""); }} className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]">
              <option value="">Select state</option>
              {states.map((state) => <option key={state.slug} value={state.slug}>{state.label}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Party
            <select value={ruleParty} onChange={(event) => setRuleParty(event.target.value)} disabled={!ruleState} className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px] disabled:opacity-60">
              <option value="">Select party</option>
              {ruleParties.map((party) => <option key={party} value={party}>{party}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void addRule()} disabled={busy === "rule" || !rulePattern || !ruleState || !ruleParty} className="mt-5 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-3 text-[12px] font-semibold text-white disabled:opacity-60">
            {busy === "rule" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add rule
          </button>
        </div>
        {rules.length ? (
          <ul className="mt-4 divide-y divide-[var(--border-hairline)] rounded-[var(--radius-control)] border border-[var(--border-hairline)]">
            {rules.map((rule) => (
              <li key={rule._id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
                <code className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[11px]">{rule.field}: {rule.pattern}</code>
                <span className="text-[var(--text-muted)]">→ {states.find((state) => state.slug === rule.state)?.label ?? rule.state} · {rule.party}</span>
                <button type="button" onClick={() => void removeRule(rule._id)} disabled={busy === `rule:${rule._id}`} aria-label={`Remove rule ${rule.pattern}`} className="ml-auto grid size-10 place-items-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:text-[var(--danger)]">
                  {busy === `rule:${rule._id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        ) : <div className="mt-4"><EmptyState title="No naming rules yet." /></div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5">
          <div>
            <p className="type-micro text-[var(--text-muted)]">Campaigns</p>
            <h2 className="type-h3 mt-1">Tag campaigns</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-3 text-[12px] font-semibold hover:bg-[var(--surface-raised)]"><RefreshCw className="size-3.5" /> Refresh</button>
            <button type="button" onClick={() => void confirmAll()} disabled={busy === "confirm-all"} className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-3 text-[12px] font-semibold text-white disabled:opacity-60">
              {busy === "confirm-all" ? <Loader2 className="size-3.5 animate-spin" /> : null} Confirm all
            </button>
          </div>
        </div>
        {campaigns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-[12px]">
              <thead className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-2">Campaign</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">Tag</th>
                  <th className="px-4 py-2 text-right">Save</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const draft = drafts[campaign.id] ?? EMPTY_DRAFT;
                  const draftParties = parties[draft.state] ?? [];
                  const tag = campaign.tag;
                  return (
                    <tr key={campaign.id} className="border-t border-[var(--border-hairline)]">
                      <td className="max-w-[260px] px-4 py-2">
                        <p className="truncate font-semibold text-[var(--text-primary)]">{campaign.name}</p>
                        <p className="truncate text-[10px] text-[var(--text-muted)]">{campaign.id}</p>
                      </td>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{campaign.accountId ? accountName.get(campaign.accountId) ?? campaign.accountId : "—"}</td>
                      <td className="px-4 py-2"><Badge tone={statusTone(campaign.effectiveStatus ?? campaign.status)}>{campaign.effectiveStatus ?? campaign.status ?? "—"}</Badge></td>
                      <td className="px-4 py-2">
                        <select
                          value={draft.state}
                          onChange={(event) => setDrafts((current) => ({ ...current, [campaign.id]: { state: event.target.value, party: "" } }))}
                          className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]"
                        >
                          <option value="">Unassigned</option>
                          {states.map((state) => <option key={state.slug} value={state.slug}>{state.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          {draft.party && <span className="size-2.5 rounded-full" style={{ background: partyColour(draft.state, draft.party) }} aria-hidden />}
                          <select
                            value={draft.party}
                            onChange={(event) => setDrafts((current) => ({ ...current, [campaign.id]: { ...draft, party: event.target.value } }))}
                            disabled={!draft.state}
                            className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px] disabled:opacity-60"
                          >
                            <option value="">Select party</option>
                            {draftParties.map((party) => <option key={party} value={party}>{party}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {tag ? <Badge tone={tag.confirmed ? "success" : "warning"}>{tag.source === "manual" ? "Manual" : "Suggested"} · {tag.confirmed ? "Confirmed" : "Unconfirmed"}</Badge> : <Badge tone="neutral">Untagged</Badge>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1.5">
                          {tag && <button type="button" onClick={() => void untag(campaign.id)} disabled={busy === `untag:${campaign.id}`} className="min-h-10 rounded-[var(--radius-control)] border border-[var(--border-hairline)] px-2 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--danger)]">Clear</button>}
                          <button type="button" onClick={() => void saveTag(campaign.id)} disabled={busy === `tag:${campaign.id}` || !draft.state || !draft.party} className="inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-3 text-[11px] font-semibold text-white disabled:opacity-60">
                            {busy === `tag:${campaign.id}` ? <Loader2 className="size-3.5 animate-spin" /> : null} Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="p-5"><EmptyState title="No campaigns have synced yet." /></div>}
      </Card>
    </div>
  );
}
