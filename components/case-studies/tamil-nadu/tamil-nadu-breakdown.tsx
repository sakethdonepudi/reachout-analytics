"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import EChart from "@/components/case-studies/telangana/echart";
import NotUploaded from "@/components/case-studies/shared/not-uploaded";
import { usePrefersReducedMotion } from "@/components/case-studies/telangana/chart-motion";
import { TN_COLOR, TN_LABEL } from "@/lib/tamil-nadu/model";
import type { PollKind, PollSegment, SegmentType, VoteShareReason } from "@/lib/case-data/types";
import { cn } from "@/lib/utils";

const SUB_TABS: { id: SegmentType; label: string }[] = [
  { id: "gender", label: "Gender" },
  { id: "age", label: "Age" },
  { id: "caste", label: "Caste / Community" },
  { id: "region", label: "Region" },
];

const FALLBACK_COLOURS = ["#0B0B0C", "#2563EB", "#16A34A", "#F59E0B", "#E91E63", "#0F766E", "#7C3AED"];
const partyColour = (party: string, index: number) => (TN_COLOR as Record<string, string>)[party] ?? FALLBACK_COLOURS[index % FALLBACK_COLOURS.length];
const partyLabel = (party: string) => (TN_LABEL as Record<string, string>)[party] ?? party;
const fmtShare = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`);
const fmtPp = (value: number) => `${Math.abs(value) < 0.05 ? "0.0" : value > 0 ? "+" : ""}${value.toFixed(1)}pp`;

export default function TamilNaduBreakdown({
  segments,
  reasons,
  scope,
  scopeName,
  pollType,
  owner = false,
  initialReason = null,
}: {
  segments: PollSegment[];
  reasons: VoteShareReason[];
  scope: string;
  scopeName: string;
  pollType: PollKind;
  owner?: boolean;
  initialReason?: string | null;
}) {
  const reduced = usePrefersReducedMotion();
  const [segmentType, setSegmentType] = useState<SegmentType>("gender");
  const [openReason, setOpenReason] = useState<string | null>(initialReason);

  useEffect(() => { setOpenReason(initialReason); }, [initialReason]);
  useEffect(() => {
    if (!openReason) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenReason(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openReason]);

  const typeSegments = useMemo(() => segments.filter((row) => row.pollType === pollType), [segments, pollType]);
  const scoped = useMemo(() => {
    if (scope.startsWith("d:")) return typeSegments.filter((row) => row.scope === "district" && row.scopeName === scope.slice(2));
    if (scope.startsWith("a:")) return typeSegments.filter((row) => row.scope === "assembly" && row.scopeName === scopeName);
    return typeSegments.filter((row) => row.scope === "statewide");
  }, [scope, scopeName, typeSegments]);
  const statewide = useMemo(() => typeSegments.filter((row) => row.scope === "statewide"), [typeSegments]);
  const active = scoped.length ? scoped : statewide;
  const statewideOnly = !scope.startsWith("d:") && !scope.startsWith("a:") ? false : scoped.length === 0 && statewide.length > 0;

  const rows = useMemo(() => active.filter((row) => row.segmentType === segmentType), [active, segmentType]);
  const labels = useMemo(() => [...new Set(rows.map((row) => row.segmentLabel))], [rows]);
  const parties = useMemo(() => [...new Set(rows.map((row) => row.party))], [rows]);
  const nFor = (label: string) => rows.find((row) => row.segmentLabel === label)?.n ?? null;
  const shareFor = (label: string, party: string) => rows.find((row) => row.segmentLabel === label && row.party === party)?.share ?? null;

  const chartOption = useMemo(() => ({
    animation: !reduced,
    animationDuration: 420,
    grid: { left: 42, right: 14, top: 34, bottom: 42 },
    legend: { top: 0, left: 0, itemWidth: 9, itemHeight: 9, textStyle: { color: "#555", fontSize: 10 } },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#fff",
      borderColor: "rgba(20,24,31,.12)",
      borderWidth: 1,
      textStyle: { color: "#20262e", fontSize: 11 },
      valueFormatter: (value: unknown) => (typeof value === "number" ? `${value.toFixed(1)}%` : "—"),
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#555", fontSize: 9.5, interval: 0, rotate: labels.length > 5 ? 18 : 0 },
      axisLine: { lineStyle: { color: "rgba(70,86,104,.35)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value", max: 100,
      axisLabel: { color: "#6B6B6B", fontSize: 9, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(20,24,31,.08)" } },
    },
    series: parties.map((party, index) => ({
      name: partyLabel(party), type: "bar", barMaxWidth: 18, barGap: "12%",
      itemStyle: { color: partyColour(party, index), borderRadius: [2, 2, 0, 0] },
      data: labels.map((label) => shareFor(label, party)),
    })),
  }), [labels, parties, rows, reduced]);

  const reasonLabels = (reason: VoteShareReason) => [...new Set([...reason.before, ...reason.after].map((row) => row.label))];

  return (
    <>
      <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Vote share by segment">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Segments</p>
            <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Vote share by segment</h3>
            <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">{scopeName} · {pollType === "exit" ? "Exit poll" : "Opinion poll"}</p>
          </div>
          {statewideOnly && <span className="rounded-full border border-[var(--a-border)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--a-muted)]">Statewide only</span>}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Segment groups">
          {SUB_TABS.map((sub) => {
            const count = active.filter((row) => row.segmentType === sub.id).length;
            return (
              <button
                key={sub.id}
                type="button"
                role="tab"
                aria-selected={segmentType === sub.id}
                onClick={() => setSegmentType(sub.id)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[10.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-brass)]/50",
                  segmentType === sub.id ? "border-[var(--a-brass)]/50 bg-[var(--a-brass-soft)] text-[var(--a-ink)]" : "border-[var(--a-border)] text-[var(--a-muted)] hover:text-[var(--a-ink)]",
                )}
              >
                {sub.label}
                <span className="text-[8.5px] font-normal opacity-70">{count ? count : "0"}</span>
              </button>
            );
          })}
        </div>

        {!rows.length ? (
          <NotUploaded label="Segment data" owner={owner} />
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="min-w-0 rounded-xl border border-[var(--a-border)] bg-[var(--a-panel-2)] p-2">
              <EChart option={chartOption} height={300} reduced={reduced} ariaLabel={`Vote share by ${SUB_TABS.find((tab) => tab.id === segmentType)?.label} for ${scopeName}`} />
            </div>
            <div className="min-w-0 overflow-x-auto rounded-xl border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Segment vote-share table">
              <table className="w-full min-w-[260px] border-collapse text-[9.5px]">
                <caption className="sr-only">{SUB_TABS.find((tab) => tab.id === segmentType)?.label} vote share by party</caption>
                <thead>
                  <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                    <th scope="col" className="px-2 py-2 font-semibold">Segment</th>
                    <th scope="col" className="px-1.5 py-2 text-right font-semibold">n</th>
                    {parties.map((party) => <th key={party} scope="col" className="px-1.5 py-2 text-right font-semibold">{partyLabel(party)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {labels.map((label) => (
                    <tr key={label} className="border-t border-[var(--a-border)]/70">
                      <th scope="row" className="px-2 py-1.5 text-left font-medium">{label}</th>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-[var(--a-muted)]">{nFor(label)?.toLocaleString("en-IN") ?? "—"}</td>
                      {parties.map((party) => <td key={party} className="px-1.5 py-1.5 text-right tabular-nums">{fmtShare(shareFor(label, party))}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {segmentType === "caste" && rows.length > 0 && <p className="mt-2 text-[9.5px] text-[var(--a-muted)]">Aggregated shares only. Labels are shown exactly as uploaded.</p>}
      </section>

      <section className="analysis-panel rounded-2xl p-4 sm:p-5" aria-label="Why the vote share changed">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--a-brass)]">Reasons</p>
          <h3 className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-[var(--a-ink)]">Why the vote share changed</h3>
          <p className="mt-0.5 text-[10.5px] text-[var(--a-muted)]">Open a reason for the explanation, numbers and related social campaigns.</p>
        </div>

        {!reasons.length ? (
          <NotUploaded label="Reasons" owner={owner} />
        ) : (
          <div className="mt-4 divide-y divide-[var(--a-border)] rounded-xl border border-[var(--a-border)]">
            {reasons.map((reason) => {
              const open = openReason === reason.id;
              const colour = partyColour(reason.party, parties.indexOf(reason.party));
              return (
                <div key={reason.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`reason-${reason.id}`}
                    onClick={() => setOpenReason(open ? null : reason.id)}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--a-brass)]/50"
                  >
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: colour }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-[var(--a-ink)]">{reason.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-[var(--a-muted)]">
                        <span className="rounded-full border border-[var(--a-border)] px-2 py-0.5 font-semibold">{partyLabel(reason.party)}</span>
                        <span className="rounded-full border border-[var(--a-border)] px-2 py-0.5 tabular-nums">{fmtPp(reason.impactPp)}</span>
                        {reason.segments.map((segment) => <span key={segment} className="rounded-full bg-[var(--a-brass-soft)] px-2 py-0.5">{segment}</span>)}
                      </span>
                    </span>
                    <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-[var(--a-muted)] transition-transform", open && "rotate-180")} aria-hidden />
                  </button>
                  <div id={`reason-${reason.id}`} className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      <div className="space-y-3 px-3 pb-4 pl-8 text-[11px] leading-relaxed text-[var(--a-muted)]">
                        <p className="text-[var(--a-ink)]">{reason.explanation}</p>
                        {reasonLabels(reason).length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border border-[var(--a-border)]" tabIndex={0} role="region" aria-label="Reason supporting numbers">
                            <table className="w-full min-w-[300px] border-collapse text-[9.5px]">
                              <thead>
                                <tr className="border-b border-[var(--a-border)] text-left text-[8px] uppercase tracking-wide text-[var(--a-muted)]">
                                  <th className="px-2 py-1.5 font-semibold">Segment</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Before</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">After</th>
                                  <th className="px-2 py-1.5 text-right font-semibold">Change</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reasonLabels(reason).map((label) => {
                                  const before = reason.before.find((row) => row.label === label)?.share ?? null;
                                  const after = reason.after.find((row) => row.label === label)?.share ?? null;
                                  const delta = before == null || after == null ? null : after - before;
                                  return (
                                    <tr key={label} className="border-t border-[var(--a-border)]/70">
                                      <th scope="row" className="px-2 py-1.5 text-left font-medium text-[var(--a-ink)]">{label}</th>
                                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtShare(before)}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtShare(after)}</td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">{delta == null ? "—" : fmtPp(delta)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : <p>No supporting numbers uploaded.</p>}
                        {(reason.relatedCampaigns.length > 0 || reason.socialUrls.length > 0) && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.12em]">Related social media</span>
                            {reason.relatedCampaigns.map((campaign) => (
                              <Link key={campaign} href={`?view=social&campaign=${encodeURIComponent(campaign)}`} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--a-border)] px-2.5 text-[9.5px] font-semibold text-[var(--a-ink)] hover:border-[var(--a-brass)]/60">
                                Campaign {campaign} <ExternalLink className="size-3" aria-hidden />
                              </Link>
                            ))}
                            {reason.socialUrls.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--a-border)] px-2.5 text-[9.5px] font-semibold text-[var(--a-ink)] hover:border-[var(--a-brass)]/60">
                                Social post <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
