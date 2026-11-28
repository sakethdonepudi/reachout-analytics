"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import type { SurveyDemo, SurveyDemoRow } from "@/lib/survey/types";
import { cn } from "@/lib/utils";
import { inkOnTint, partyColour } from "@/lib/tamil-nadu/party-brand";
import { selectGapRows } from "@/lib/survey/target-gaps";
import { useTheme } from "@/components/site/theme";
import { PartyBadge } from "./party-badge";
import { Pill, PillRow } from "@/components/case-studies/shared/pill-row";
import PortalTip from "@/components/ui/portal-tip";

const colourOf = partyColour;
const pct = (value: number) => `${value.toFixed(1)}%`;
const int = (value: number) => new Intl.NumberFormat("en-IN").format(Math.round(value));

type Props = {
  demo: SurveyDemo;
  parties: string[];
  profileKey: string;
  periodKey: string;
  slotLabel: string;
  average: number;
  slotLeader: string;
  targetParty: string;
  targetMode: "below-average" | "leads" | "gap";
  targetPillParty: string;
  targetTooltip: string;
  allowTarget: boolean;
  showCampaignsLink: boolean;
  threshold?: number;
  countBelowThreshold?: boolean;
  partyLabels?: Record<string, string>;
  onTarget: (payload: { kind: string; place: string; label: string; value: number; average: number }) => void;
  onCampaigns: (payload: { kind: string; place: string }) => void;
  onGroup: (group: string) => void;
};

const LEADING_KEY = "__leading";

function TargetCampaign({ tooltip, delay, onClick }: { tooltip: string; delay: number; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="tn-target"
        style={{ "--tn-target-delay": `${delay}ms` } as React.CSSProperties}
        title={tooltip}
        aria-label={`Target Campaign. ${tooltip}`}
      >
        Target Campaign
      </button>
      <PortalTip open={open} anchorRef={ref}>{tooltip}</PortalTip>
    </span>
  );
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <ArrowUpDown className="size-2.5 opacity-50" aria-hidden />;
  return asc ? <ArrowUp className="size-2.5" aria-hidden /> : <ArrowDown className="size-2.5" aria-hidden />;
}

function TnProfileTable({ demo, parties, profileKey, periodKey, slotLabel, average, slotLeader, targetParty, targetMode, targetPillParty, targetTooltip, allowTarget, showCampaignsLink, threshold = 30, countBelowThreshold = false, partyLabels, onTarget, onCampaigns, onGroup }: Props) {
  const partyLabel = (party: string) => partyLabels?.[party] ?? party;
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>(parties);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [hover, setHover] = useState<{ row: string | null; column: string | null }>({ row: null, column: null });
  const isV21 = profileKey === "v21";
  const geo = profileKey === "dist" || profileKey === "ac" || profileKey === "zone";
  const clickableGroup = periodKey === "op" ? ["age", "caste", "prof"].includes(profileKey) : profileKey === "age";
  const allSelected = selected.length === parties.length;
  const visible = parties.filter((party) => selected.includes(party) || leaving.includes(party));
  const selectedIndexes = parties.map((party, index) => (selected.includes(party) ? index : -1)).filter((index) => index >= 0);
  const selectedSet = new Set(selected);

  useEffect(() => { setSelected(parties); }, [parties]);
  useEffect(() => {
    if (!leaving.length) return;
    const timer = window.setTimeout(() => setLeaving([]), 260);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  useEffect(() => { setPage(0); }, [demo, sort, selected]);

  const gapRows = useMemo(() => {
    const targetIndex = parties.indexOf(targetParty);
    if (targetMode !== "gap" || targetIndex < 0) return new Set<string>();
    return selectGapRows(
      demo.rows.filter((row) => row.n >= threshold).map((row) => ({ key: row.g, value: row.v[targetIndex] ?? 0, n: row.n })),
      average,
    );
  }, [average, demo.rows, parties, targetMode, targetParty, threshold]);

  const toggle = (party: string) => {
    setLeaving((current) => current.filter((item) => item !== party));
    setSelected((current) => current.includes(party) ? current.filter((item) => item !== party) : [...current, party]);
  };
  const selectAll = () => { setLeaving([]); setSelected(parties); };

  const leaderOfRow = (row: SurveyDemoRow) => {
    let leaderIndex = -1;
    let leadValue = -1;
    let tie = false;
    for (const index of selectedIndexes) {
      const value = row.v[index] ?? 0;
      if (value > leadValue) { leaderIndex = index; leadValue = value; tie = false; }
      else if (value === leadValue) tie = true;
    }
    return { index: leaderIndex, value: leadValue, tie };
  };

  const rows = useMemo(() => {
    const list = [...demo.rows];
    if (!sort) return list;
    const sortIndex = sort.key === LEADING_KEY ? -1 : parties.indexOf(sort.key);
    list.sort((a, b) => {
      const valueOf = (row: SurveyDemoRow) => {
        if (sortIndex >= 0) return row.v[sortIndex] ?? 0;
        return leaderOfRow(row).value;
      };
      return sort.asc ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a);
    });
    return list;
    // leaderOfRow reads the current selected columns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.rows, parties, selected, sort]);

  const pageSize = rows.length > 80 ? 50 : rows.length;
  const pageCount = Math.max(1, Math.ceil(rows.length / Math.max(1, pageSize)));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  const total = demo.rows.reduce((sum, row) => sum + row.n, 0);
  const weighted = parties.map((_, index) => (total ? demo.rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total : 0));
  const totalLeader = (() => {
    let index = selectedIndexes[0] ?? -1;
    for (const candidate of selectedIndexes) if (weighted[candidate] > (weighted[index] ?? -1)) index = candidate;
    return index;
  })();
  const maxByParty = parties.map((_, index) => Math.max(1, ...demo.rows.map((row) => row.v[index] ?? 0)));

  const toggleSort = (key: string) => {
    setSort((current) => current && current.key === key ? { key, asc: !current.asc } : { key, asc: false });
  };

  return (
    <div>
      {isV21 && <p className="text-[14px] leading-relaxed text-[color:var(--theme-text-3)]">Cross-tabulation: each row is how people who voted for that alliance in 2021 say they will vote in 2026. Row % - each row adds up to 100%.</p>}
      <PillRow label="PARTIES" ariaLabel="Party columns" className="mt-2">
        <Pill
          selected={allSelected}
          colour={colourOf(slotLeader)}
          party={slotLeader}
          label="All parties"
          check
          onClick={(event) => {
            selectAll();
            const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
            if (strip) {
              const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
              strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
            }
          }}
        >
          All
        </Pill>
        {parties.map((party) => (
          <Pill
            key={party}
            selected={selected.includes(party)}
            colour={colourOf(party)}
            party={party}
            onClick={(event) => {
              toggle(party);
              const strip = event.currentTarget.closest(".no-scrollbar") as HTMLElement | null;
              if (strip) {
                const sr = strip.getBoundingClientRect(), br = event.currentTarget.getBoundingClientRect();
                strip.scrollTo({ left: strip.scrollLeft + br.left - sr.left - (strip.clientWidth - br.width) / 2, behavior: "smooth" });
              }
            }}
          >
            <PartyBadge party={party} size={20} />
            {partyLabel(party)}
          </Pill>
        ))}
      </PillRow>
      <div className="edge-fade-right mt-2 hidden max-h-[520px] overflow-auto rounded-xl border border-[color:var(--theme-border)] min-[640px]:block" tabIndex={0} role="region" aria-label={`${demo.label} table`}>
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[13px] uppercase tracking-wide">
              <th scope="col" className="sticky left-0 z-30 px-2 py-2 font-semibold">{isV21 ? "2021 voted / 2026 vote" : demo.label}</th>
              {visible.map((party) => {
                const index = parties.indexOf(party);
                const active = selectedSet.has(party);
                return (
                  <th key={`${party}:${active ? "in" : "out"}`} scope="col" className={cn("px-1.5 py-2 text-center font-semibold", active ? "tn-col-in" : "tn-col-out")}>
                    <button type="button" onClick={() => toggleSort(party)} className="inline-flex min-h-[45px]! min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-[color:var(--theme-surface)]/10" title={`Sort by ${party}`}>
                      <PartyBadge party={party} size={20} />
                      {partyLabel(party)}
                      <SortIcon active={sort?.key === party} asc={Boolean(sort?.asc)} />
                    </button>
                  </th>
                );
              })}
              <th scope="col" className="px-2 py-2 text-left font-semibold">
                <button type="button" onClick={() => toggleSort(LEADING_KEY)} className="inline-flex min-h-[45px]! min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-[color:var(--theme-surface)]/10" title="Sort by leading party">
                  {allSelected ? "Leading" : "Leading (selected)"} <SortIcon active={sort?.key === LEADING_KEY} asc={Boolean(sort?.asc)} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const leader = leaderOfRow(row);
              const rowTarget = allowTarget && !leader.tie && (targetMode === "leads" ? leader.index === parties.indexOf(targetParty) : targetMode === "gap" ? gapRows.has(row.g) : false);
              if (countBelowThreshold && row.n < threshold) {
                return <tr key={row.g} className="border-t border-[color:var(--theme-border)]"><th scope="row" className="sticky left-0 z-10 h-12 bg-[color:var(--theme-surface)] px-3 py-1 text-left font-semibold text-[color:var(--theme-text-2)]">{row.g} <span className="text-[12px] font-normal text-[color:var(--theme-text-3)]">· {int(row.n)} responses</span></th><td colSpan={visible.length + 1} className="px-3 py-2 text-[13px] text-[color:var(--theme-text-3)]">Too few responses to show</td></tr>;
              }
              return (
                <tr
                  key={row.g}
                  className="border-t border-[color:var(--theme-border)]"
                  onMouseEnter={() => setHover((current) => ({ ...current, row: row.g }))}
                  onMouseLeave={() => setHover((current) => ({ ...current, row: null }))}
                >
                  <th scope="row" className="sticky left-0 z-10 h-12 bg-[color:var(--theme-surface)] px-3 py-1 text-left font-semibold text-[color:var(--theme-text-2)]">
                    {rowTarget && <button type="button" onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value: row.v[parties.indexOf(targetParty)] ?? 0, average })} className="target-ring mr-1.5 inline-block size-2.5 rounded-full border border-white bg-[#e52020] align-middle" title={targetTooltip} aria-label={targetTooltip} />}
                    {clickableGroup ? (
                      <button type="button" onClick={() => onGroup(row.g)} className="group/link inline-flex min-h-11! items-center gap-0.5 text-left font-semibold text-[color:var(--theme-link)] underline decoration-[#B8B8B8] decoration-1 underline-offset-2 hover:decoration-[color:var(--theme-link)]" title={`Open campaigns for ${row.g}`}>
                        {row.g}
                        <span aria-hidden className="opacity-0 transition-opacity duration-150 group-hover/link:opacity-100">↗</span>
                      </button>
                    ) : row.g}
                    {row.n < threshold && <span className="ml-1 text-[12px] font-normal text-[color:var(--theme-text-3)]" title={`Only ${row.n} answers, too few to show`}>· {int(row.n)}</span>}
                  </th>
                  {visible.map((party) => {
                    const index = parties.indexOf(party);
                    const active = selectedSet.has(party);
                    const value = row.v[index] ?? 0;
                    const alpha = 6 + (value / maxByParty[index]) * 56;
                    const isLead = active && index === leader.index && !leader.tie;
                    const target = allowTarget && active && (targetMode === "below-average" ? party === targetParty && value < average : rowTarget && party === targetPillParty);
                    const tint = inkOnTint(party, alpha, dark);
                    const delayKey = `${row.g}:${party}`;
                    let delayHash = 0;
                    for (let charIndex = 0; charIndex < delayKey.length; charIndex += 1) delayHash = (delayHash * 31 + delayKey.charCodeAt(charIndex)) | 0;
                    const animationDelay = Math.abs(delayHash) % 401;
                    return (
                      <td
                        key={`${party}:${active ? "in" : "out"}`}
                        className={cn(
                          "h-12 min-w-[132px] px-2 py-1.5 text-center align-middle tabular-nums",
                          active ? "tn-col-in" : "tn-col-out",
                          hover.column === party && "tn-col-hover",
                          hover.row === row.g && "tn-row-hover",
                        )}
                        style={{
                          background: active ? tint.background : "var(--theme-surface)",
                          color: active ? tint.ink : "var(--theme-text)",
                          outline: isLead ? `2px solid ${colourOf(party)}` : undefined,
                          outlineOffset: isLead ? -2 : undefined,
                          boxShadow: rowTarget && party === visible.find((item) => selectedSet.has(item)) ? "inset 3px 0 0 #e52020" : undefined,
                        }}
                        onMouseEnter={() => setHover((current) => ({ ...current, column: party }))}
                        onMouseLeave={() => setHover((current) => ({ ...current, column: null }))}
                      >
                        <div className="flex flex-col items-center gap-0">
                          <span className={cn("text-[15px] tabular-nums", isLead && "font-extrabold")} style={{ color: active ? tint.ink : "var(--theme-text)" }}>
                            {pct(value)}
                          </span>
                          {target && (
                            <TargetCampaign tooltip={targetTooltip} delay={animationDelay} onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value, average })} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="h-12 whitespace-nowrap px-2 py-1 text-left font-semibold align-middle">
                    {leader.index >= 0 ? (
                      <span className="mr-1 inline-flex items-center gap-1 align-middle">
                        <PartyBadge party={parties[leader.index]} size={20} />
                        {leader.tie ? "Tie" : partyLabel(parties[leader.index])}
                      </span>
                    ) : "—"}
                    {geo && showCampaignsLink && (
                      <button type="button" onClick={() => onCampaigns({ kind: profileKey, place: row.g })} className="ml-1 inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-link)] px-2 text-[12px] font-bold text-[color:var(--theme-link)] hover:bg-[color:var(--tn-soft-blue)]">
                        Campaigns ↗
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {isV21 && (
            <tfoot>
              <tr className="border-t-2 border-[color:var(--theme-text)] bg-[color:var(--theme-surface-3)] font-bold">
                <td className="sticky left-0 z-10 bg-[color:var(--theme-surface-3)] px-2 py-2 text-left">All 2021 voters</td>
                {visible.map((party) => {
                  const index = parties.indexOf(party);
                  return <td key={`${party}:${selectedSet.has(party) ? "in" : "out"}`} className={cn("px-1 py-2 text-center tabular-nums", selectedSet.has(party) ? "tn-col-in" : "tn-col-out")}>{pct(weighted[index])}</td>;
                })}
                <td className="px-2 py-2 text-left">
                  {totalLeader >= 0 ? <span className="inline-flex items-center gap-1"><PartyBadge party={parties[totalLeader]} size={20} />{partyLabel(parties[totalLeader])}</span> : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="mt-2 space-y-3 min-[640px]:hidden">
        {pageRows.map((row) => {
          const leader = leaderOfRow(row);
          const rowTarget = allowTarget && !leader.tie && (targetMode === "leads" ? leader.index === parties.indexOf(targetParty) : targetMode === "gap" ? gapRows.has(row.g) : false);
          return (
            <article key={row.g} className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {rowTarget && <button type="button" onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value: row.v[parties.indexOf(targetParty)] ?? 0, average })} className="target-ring inline-block size-2.5 rounded-full border border-white bg-[#e52020]" title={targetTooltip} aria-label={targetTooltip} />}
                  {clickableGroup ? (
                    <button type="button" onClick={() => onGroup(row.g)} className="inline-flex min-h-11! items-center gap-1 text-left text-[14px] font-semibold text-[color:var(--theme-link)] underline decoration-[#B8B8B8] underline-offset-2">
                      {row.g}<span aria-hidden>↗</span>
                    </button>
                  ) : <span className="text-[14px] font-semibold text-[color:var(--theme-text)]">{row.g}</span>}
                  {row.n < threshold && <span className="text-[12px] font-normal text-[color:var(--theme-text-3)]" title={`Only ${row.n} answers, too few to show`}>· {int(row.n)}</span>}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] text-[color:var(--theme-text-3)]">
                  {leader.index >= 0 && <PartyBadge party={parties[leader.index]} size={20} />}
                  {leader.tie ? "Tie" : partyLabel(parties[leader.index])}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {visible.filter((party) => selectedSet.has(party)).map((party) => {
                  const index = parties.indexOf(party);
                  const value = row.v[index] ?? 0;
                  const alpha = 6 + (value / maxByParty[index]) * 56;
                  const tint = inkOnTint(party, alpha, dark);
                  const isLead = index === leader.index && !leader.tie;
                  const target = allowTarget && (targetMode === "below-average" ? party === targetParty && value < average : rowTarget && party === targetPillParty);
                  return (
                    <div
                      key={party}
                      className="rounded-xl px-2.5 py-2"
                      style={{
                        background: tint.background,
                        color: tint.ink,
                        outline: isLead ? `2px solid ${colourOf(party)}` : undefined,
                        outlineOffset: isLead ? -2 : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold")} style={{ color: tint.ink }}>
                          <PartyBadge party={party} size={20} />{partyLabel(party)}
                        </span>
                        <span className={cn("text-[13px] tabular-nums", isLead && "font-extrabold")} style={{ color: tint.ink }}>{pct(value)}</span>
                      </div>
                      {target && (
                        <div className="mt-1.5 flex justify-center">
                          <TargetCampaign tooltip={targetTooltip} delay={(row.g.length * 17 + index * 43) % 400} onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value, average })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {geo && showCampaignsLink && (
                <button type="button" onClick={() => onCampaigns({ kind: profileKey, place: row.g })} className="mt-2 inline-flex min-h-11! items-center gap-1 text-[12px] font-semibold text-[color:var(--theme-link)]">
                  Campaigns ↗
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <p className="rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-3)] px-4 py-6 text-[14px] text-[color:var(--theme-text-3)]">No rows in this view. The upload may not include this question.</p>
      )}
      {pageCount > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[12.5px] text-[color:var(--theme-text-3)]">
          <span className="tabular-nums">{currentPage * pageSize + 1}-{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length}</span>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Previous</button>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[color:var(--theme-border)] px-3 font-semibold text-[color:var(--theme-text)] disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

export function weightedPartyAverage(rows: SurveyDemoRow[], parties: string[], party: string): number {
  const index = parties.indexOf(party);
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return index < 0 || !total ? 0 : rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total;
}

export function weightedAiadminAverage(rows: SurveyDemoRow[], parties: string[]): number {
  return weightedPartyAverage(rows, parties, "AIADMK+");
}

export default memo(TnProfileTable);
