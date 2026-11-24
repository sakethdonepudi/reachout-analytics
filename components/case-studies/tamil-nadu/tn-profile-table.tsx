"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import type { SurveyDemo, SurveyDemoRow } from "@/lib/survey/types";
import { cn } from "@/lib/utils";
import { partyColour, partyNeedsWhiteInk } from "@/lib/tamil-nadu/party-brand";
import { PartyBadge } from "./party-badge";

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
  onTarget: (payload: { kind: string; place: string; label: string; value: number; average: number }) => void;
  onCampaigns: (payload: { kind: string; place: string }) => void;
  onGroup: (group: string) => void;
};

const LEADING_KEY = "__leading";

function TnProfileTable({ demo, parties, profileKey, periodKey, slotLabel, average, onTarget, onCampaigns, onGroup }: Props) {
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

  const pageSize = rows.length > 40 ? 30 : rows.length;
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
      {isV21 && <p className="text-[14px] leading-relaxed text-[#6B6B6B]">Cross-tabulation: each row is how people who voted for that alliance in 2021 say they will vote in 2026. Row % - each row adds up to 100%.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Party columns">
        <button
          type="button"
          aria-pressed={allSelected}
          onClick={selectAll}
          className={cn(
            "inline-flex min-h-11! items-center gap-1 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
            allSelected ? "border-[#0B0B0C] bg-[#0B0B0C] text-white" : "border-[#D5D8DE] bg-white text-[#555] hover:border-[#0B0B0C]",
          )}
        >
          {allSelected && <Check className="size-3.5" />} All
        </button>
        {parties.map((party) => {
          const active = selected.includes(party);
          return (
            <button
              key={party}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(party)}
              className={cn(
                "inline-flex min-h-11! items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                active ? "border-[#0B0B0C] bg-[#0B0B0C] text-white" : "border-[#D5D8DE] bg-white text-[#555] hover:border-[#0B0B0C]",
              )}
            >
              <PartyBadge party={party} size={16} />
              {party}
            </button>
          );
        })}
      </div>
      <div className="mt-2 max-h-[520px] overflow-auto rounded-xl border border-[#EAEAEA]" tabIndex={0} role="region" aria-label={`${demo.label} table`}>
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead className="sticky top-0 z-10">
            <tr className="text-left text-[13px] uppercase tracking-wide">
              <th className="sticky left-0 z-30 px-2 py-2 font-semibold">{isV21 ? "2021 voted / 2026 vote" : demo.label}</th>
              {visible.map((party) => {
                const index = parties.indexOf(party);
                const active = selectedSet.has(party);
                return (
                  <th key={`${party}:${active ? "in" : "out"}`} className={cn("px-1.5 py-2 text-center font-semibold", active ? "tn-col-in" : "tn-col-out")}>
                    <button type="button" onClick={() => toggleSort(party)} className="inline-flex min-h-11! min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-white/10" title={`Sort by ${party}`}>
                      <PartyBadge party={party} size={16} />
                      {party}
                      <ArrowUpDown className={cn("size-2.5 opacity-50", sort?.key === party && "opacity-100")} />
                    </button>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-left font-semibold">
                <button type="button" onClick={() => toggleSort(LEADING_KEY)} className="inline-flex min-h-11! min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-white/10" title="Sort by leading party">
                  {allSelected ? "Leading" : "Leading (selected)"} <ArrowUpDown className={cn("size-2.5 opacity-50", sort?.key === LEADING_KEY && "opacity-100")} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const leader = leaderOfRow(row);
              const dmkFlag = periodKey === "op" && parties[leader.index] === "DMK+" && !leader.tie;
              return (
                <tr
                  key={row.g}
                  className="border-t border-[#EAEAEA]"
                  onMouseEnter={() => setHover((current) => ({ ...current, row: row.g }))}
                  onMouseLeave={() => setHover((current) => ({ ...current, row: null }))}
                >
                  <th scope="row" className={cn("sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-[#1f2937]", dmkFlag && "border-l-[3px] border-l-[#e52020]")}>
                    {clickableGroup ? (
                      <button type="button" onClick={() => onGroup(row.g)} className="group/link inline-flex min-h-11! items-center gap-0.5 text-left font-semibold text-[#002147] underline decoration-[#B8B8B8] decoration-1 underline-offset-2 hover:decoration-[#002147]" title={`Open campaigns for ${row.g}`}>
                        {row.g}
                        <span aria-hidden className="opacity-0 transition-opacity duration-150 group-hover/link:opacity-100">↗</span>
                      </button>
                    ) : row.g}
                  </th>
                  {visible.map((party) => {
                    const index = parties.indexOf(party);
                    const active = selectedSet.has(party);
                    const value = row.v[index] ?? 0;
                    const alpha = 6 + (value / maxByParty[index]) * 82;
                    const isLead = active && index === leader.index && !leader.tie;
                    const target = active && party === "AIADMK+" && value < average;
                    const lightText = active && alpha > 52 && partyNeedsWhiteInk(party);
                    return (
                      <td
                        key={`${party}:${active ? "in" : "out"}`}
                        className={cn(
                          "relative min-w-[96px] px-2 py-2.5 text-center tabular-nums",
                          active ? "tn-col-in" : "tn-col-out",
                          hover.column === party && "tn-col-hover",
                          hover.row === row.g && "tn-row-hover",
                          lightText && "text-white",
                        )}
                        style={{
                          background: active ? `color-mix(in srgb, ${colourOf(party)} ${alpha}%, white)` : "white",
                          outline: isLead ? `2px solid ${colourOf(party)}` : undefined,
                          outlineOffset: isLead ? -2 : undefined,
                        }}
                        onMouseEnter={() => setHover((current) => ({ ...current, column: party }))}
                        onMouseLeave={() => setHover((current) => ({ ...current, column: null }))}
                      >
                        <span className="pointer-events-none absolute inset-x-2 bottom-1 h-1 overflow-hidden rounded-full bg-black/10" aria-hidden>
                          <span className="block h-full rounded-full opacity-70" style={{ width: `${Math.max(2, value)}%`, background: lightText ? "rgba(255,255,255,.7)" : colourOf(party) }} />
                        </span>
                        <span
                          className={cn("relative z-10 inline-block", isLead && "font-extrabold", lightText ? "text-white" : "text-[#0B0B0C]")}
                          style={{ animationDelay: `${rowIndex * 14 + index * 8}ms` }}
                        >
                          {pct(value)}
                        </span>
                        {target && (
                          <button
                            type="button"
                            onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value, average })}
                            className="tn-target relative z-10 mx-auto mt-1 flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#e52020] bg-white px-2 text-[11px] font-bold text-[#e52020] hover:bg-[#FEF2F2]"
                            title="AIADMK+ below average here: open campaigns"
                            aria-label="Target Campaign. AIADMK+ below average here: open campaigns"
                          >
                            Target Campaign
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                    {leader.index >= 0 ? (
                      <span className="mr-1 inline-flex items-center gap-1 align-middle">
                        <PartyBadge party={parties[leader.index]} size={16} />
                        {leader.tie ? "Tie" : parties[leader.index]}
                      </span>
                    ) : "—"}
                    {dmkFlag && <span className="ml-1 rounded-full border border-[#e52020] px-1 py-0.5 text-[10.5px] font-bold text-[#e52020]">Need Target promotion</span>}
                    {geo && (
                      <button type="button" onClick={() => onCampaigns({ kind: profileKey, place: row.g })} className="ml-1 inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#1f6fd1] px-2 text-[10.5px] font-bold text-[#1f6fd1] hover:bg-[#EFF6FF]">
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
              <tr className="border-t-2 border-[#0B0B0C] bg-[#FAFAFA] font-bold">
                <td className="sticky left-0 z-10 bg-[#FAFAFA] px-2 py-2 text-left">All 2021 voters</td>
                {visible.map((party) => {
                  const index = parties.indexOf(party);
                  return <td key={`${party}:${selectedSet.has(party) ? "in" : "out"}`} className={cn("px-1 py-2 text-center tabular-nums", selectedSet.has(party) ? "tn-col-in" : "tn-col-out")}>{pct(weighted[index])}</td>;
                })}
                <td className="px-2 py-2 text-left">
                  {totalLeader >= 0 ? <span className="inline-flex items-center gap-1"><PartyBadge party={parties[totalLeader]} size={16} />{parties[totalLeader]}</span> : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {pageCount > 1 && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[12.5px] text-[#6B6B6B]">
          <span className="tabular-nums">{currentPage * pageSize + 1}-{Math.min(rows.length, (currentPage + 1) * pageSize)} of {rows.length}</span>
          <button type="button" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Previous</button>
          <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="inline-flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#CFCFCF] px-3 font-semibold text-[#0B0B0C] disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

export function weightedAiadminAverage(rows: SurveyDemoRow[], parties: string[]): number {
  const index = parties.indexOf("AIADMK+");
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  return index < 0 || !total ? 0 : rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total;
}

export default memo(TnProfileTable);
