"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import type { SurveyDemo, SurveyDemoRow } from "@/lib/survey/types";
import { cn } from "@/lib/utils";

export const TN_PARTY_COLORS: Record<string, string> = {
  TVK: "#E6B800",
  "DMK+": "#DD1100",
  "AIADMK+": "#138808",
  NTK: "#7b3fa0",
  Others: "#8c8f96",
};
const colourOf = (party: string) => TN_PARTY_COLORS[party] ?? "#64748B";
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

function TnProfileTable({ demo, parties, profileKey, periodKey, slotLabel, average, onTarget, onCampaigns, onGroup }: Props) {
  const [sort, setSort] = useState<{ column: number; asc: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const isV21 = profileKey === "v21";
  const geo = profileKey === "dist" || profileKey === "ac" || profileKey === "zone";
  const clickableGroup = periodKey === "op" ? ["age", "caste", "prof"].includes(profileKey) : profileKey === "age";
  const rows = useMemo(() => {
    const list = [...demo.rows];
    if (!sort) return list;
    const leaderIndex = parties.length;
    list.sort((a, b) => {
      const left = sort.column === leaderIndex ? a.v.indexOf(Math.max(...a.v)) : a.v[sort.column] ?? 0;
      const right = sort.column === leaderIndex ? b.v.indexOf(Math.max(...b.v)) : b.v[sort.column] ?? 0;
      return sort.asc ? left - right : right - left;
    });
    return list;
  }, [demo.rows, parties.length, sort]);

  const pageSize = rows.length > 40 ? 30 : rows.length;
  const pageCount = Math.max(1, Math.ceil(rows.length / Math.max(1, pageSize)));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  useEffect(() => { setPage(0); }, [demo, sort]);
  const total = demo.rows.reduce((sum, row) => sum + row.n, 0);
  const weighted = parties.map((_, index) => (total ? demo.rows.reduce((sum, row) => sum + (row.v[index] ?? 0) * row.n, 0) / total : 0));
  const totalLeader = weighted.indexOf(Math.max(...weighted));

  const toggleSort = (column: number) => {
    setSort((current) => current && current.column === column ? { column, asc: !current.asc } : { column, asc: false });
  };

  return (
    <div>
      {isV21 && <p className="text-[14px] leading-relaxed text-[#6B6B6B]">Cross-tabulation: each row is how people who voted for that alliance in 2021 say they will vote in 2026. Row % - each row adds up to 100%.</p>}
      <div className="mt-2 max-h-[520px] overflow-auto rounded-xl border border-[#EAEAEA]" tabIndex={0} role="region" aria-label={`${demo.label} table`}>
        <table className="w-full min-w-[760px] border-collapse text-[15px]">
          <thead className="sticky top-0 z-10 bg-[#FAFAFA]">
            <tr className="text-left text-[13px] uppercase tracking-wide text-[#6B6B6B]">
              <th className="sticky left-0 z-20 bg-[#FAFAFA] px-2 py-2 font-semibold">{isV21 ? "2021 voted / 2026 vote" : demo.label}</th>
              {parties.map((party, index) => (
                <th key={party} className="px-1.5 py-2 text-center font-semibold">
                  <button type="button" onClick={() => toggleSort(index)} className="inline-flex min-h-11! min-w-11 items-center justify-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-black/5" title={`Sort by ${party}`}>
                    <span className="size-1.5 rounded-sm" style={{ background: colourOf(party) }} />
                    {party}
                    <ArrowUpDown className={cn("size-2.5 opacity-50", sort?.column === index && "opacity-100")} />
                  </button>
                </th>
              ))}
              <th className="px-2 py-2 text-left font-semibold">
                <button type="button" onClick={() => toggleSort(parties.length)} className="inline-flex min-h-11! min-w-11 items-center justify-center gap-1 rounded px-1 py-0.5 hover:bg-black/5" title="Sort by leading party">Leading <ArrowUpDown className="size-2.5 opacity-50" /></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rowIndex) => {
              const ranked = [...row.v].sort((a, b) => b - a);
              const leader = row.v.indexOf(ranked[0]);
              const tie = ranked.length > 1 && ranked[0] === ranked[1];
              const dmkFlag = periodKey === "op" && parties[leader] === "DMK+" && !tie;
              return (
                <tr key={row.g} className={cn("border-t border-[#EAEAEA]", dmkFlag && "shadow-[inset_3px_0_0_#e52020]")}>
                  <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 text-left font-semibold text-[#1f2937]">
                    {clickableGroup ? (
                      <button type="button" onClick={() => onGroup(row.g)} className="inline-flex min-h-11! items-center text-left underline decoration-[#B8B8B8] decoration-dotted underline-offset-2 hover:text-[#0B0B0C]" title={`Open campaigns for ${row.g}`}>
                        {row.g}
                      </button>
                    ) : profileKey === "zone" ? (row.g) : row.g}
                  </th>
                  {row.v.map((value, index) => {
                    const alpha = Math.min(92, 8 + value * 1.25);
                    const isLead = index === leader && !tie;
                    const target = parties[index] === "AIADMK+" && value < average;
                    return (
                      <td key={index} className={cn("min-w-[96px] px-2 py-2.5 text-center tabular-nums", isLead && "font-extrabold ring-2 ring-inset ring-[#0B0B0C]")} style={{ background: `color-mix(in srgb, ${colourOf(parties[index])} ${alpha}%, white)` }}>
                        <span className="tn-heat inline-block" style={{ animationDelay: `${rowIndex * 14 + index * 8}ms` }}>{pct(value)}</span>
                        {target && (
                          <button type="button" onClick={() => onTarget({ kind: profileKey, place: row.g, label: demo.label, value, average })} className="tn-target mx-auto mt-1 flex min-h-11! min-w-11 items-center justify-center rounded-full border border-[#e52020] bg-white px-2 text-[11px] font-bold text-[#e52020] hover:bg-[#FEF2F2]">
                            Target Campaign
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                    <span className="mr-1 inline-block size-1.5 rounded-sm align-middle" style={{ background: colourOf(parties[leader]) }} />
                    {tie ? "Tie" : parties[leader]}
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
                {weighted.map((value, index) => <td key={index} className="px-1 py-2 text-center tabular-nums">{pct(value)}</td>)}
                <td className="px-2 py-2 text-left"><span className="mr-1 inline-block size-1.5 rounded-sm align-middle" style={{ background: colourOf(parties[totalLeader]) }} />{parties[totalLeader]}</td>
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
