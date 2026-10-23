import { fmtInt } from "@/lib/telangana/model";
import type { Oct26 } from "@/lib/telangana/oct26";
import { HISTORY } from "@/lib/telangana/history";

export default function AboutTelangana({ data }: { data: Oct26 }) {
  const c = data.counts;
  const s = data.statewide;
  const ext = data.aimimExtension;
  return (
    <details className="group mx-auto max-w-[1720px] px-4 pb-10 lg:px-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
        About this data
        <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-saffron-2">Final workbook</span>
        <span className="ml-auto text-[10px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-2.5 rounded-b-xl border border-t-0 border-border bg-card px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground/85">Four election years.</b> The <b>2014</b> and <b>2018</b> figures are actual
          ECI-derived OpenCity/TCPD mirror results (vote totals {fmtInt(HISTORY.years["2014"].total)} and {fmtInt(HISTORY.years["2018"].total)});
          <b> 2023</b> is the final workbook&apos;s ECI result table ({fmtInt(HISTORY.years["2023"].total)} votes). None are exit
          polls. <b>2028</b> is the final workbook&apos;s AC prediction model, aggregated by 2023 vote weight ({fmtInt(s.votes2023)}),
          not an observed result or a latest-round survey percentage.
        </p>
        <p>
          <b className="text-foreground/85">Parties.</b> The compact comparison displays BRS/TRS, <b>Congress+</b> (INC + CPI,
          not INC alone), BJP, <b>AIMIM</b> and Others. The final workbook prediction is four-group and folds AIMIM into Others.
          AIMIM is extracted through the documented extension below and subtracted from that assembly&apos;s Others residual, so
          it is not double-counted. The final leaders are BRS {s.leads.BRS ?? 0}, Congress {s.leads.Congress ?? 0}, BJP{" "}
          {s.leads.BJP ?? 0}, AIMIM {s.leads.AIMIM ?? 0}, Others {s.leads.Others ?? 0}, total 119. Weighted shares are BRS{" "}
          {(s.prediction.BRS * 100).toFixed(2)}%, Congress+ {(s.prediction.Congress * 100).toFixed(2)}%, BJP{" "}
          {(s.prediction.BJP * 100).toFixed(2)}%, AIMIM {(s.prediction.AIMIM * 100).toFixed(2)}%, Others{" "}
          {(s.prediction.Others * 100).toFixed(2)}%.
        </p>
        <p>
          <b className="text-foreground/85">AIMIM extraction.</b> {ext?.method ?? "The final workbook folds AIMIM into Others. The extension uses 2023 ECI AIMIM actual plus the AIMIM survey swing."}{" "}
          Baseline: {ext?.baseline ?? "2023 ECI AIMIM votes / total votes"}. Model cutoff: {ext?.cutoff ?? data.modelCutoff ?? "—"};{" "}
          {ext?.cappedCount === 0 ? "no assembly was constrained by a smaller Others residual" : `${ext?.cappedCount ?? 0} assembly(ies) were capped by the available Others residual`}.
          The raw AIMIM survey share is not used as the prediction, and Others is never divided arbitrarily. Every five-party
          vector is normalised to 100% before rounding.
        </p>
        <p>
          <b className="text-foreground/85">Historical identity.</b> Historical maps retain detailed winning-party identity —
          TRS, Congress, BJP, AIMIM, TDP, BSP, YSRCP, CPI, CPM, AIFB and Independent. The expanded round tracker also carries
          separate AIMIM, TDP and Janasena series where the underlying answers support them.
        </p>
        <p>
          <b className="text-foreground/85">Map colour.</b> For 2014, 2018 and 2023, each assembly is filled by its actual winner
          in that party&apos;s colour, shaded by the winner&apos;s vote share. For 2028 it is filled by the final workbook&apos;s
          leading predicted party after the AIMIM extraction (BRS/TRS pink, Congress/INC blue, BJP saffron, AIMIM green, Others
          muted purple). The final workbook contains no prediction override; Kodangal is not a tie.
        </p>
        <p>
          <b className="text-foreground/85">Final workbook.</b> {fmtInt(c.sourceIds)} distinct Entry IDs; {fmtInt(c.cutoffRows)} entries;
          {" "}{fmtInt(c.answered2028)} answered the 2028 question and {fmtInt(c.blank2028)} left it blank;{" "}
          {fmtInt(c.answeredRecall2023)} answered the 2023 recall and {fmtInt(c.blankRecall2023)} are blank. The projection sheet
          headers are on row 1, with the English assembly-name column <b>A/c</b>; 119 AC IDs and 33 district groups are validated,
          and trailing formatted/blank rows are ignored. All eight sheets were read and audited. The stale <b>Sheet3</b> pivot
          (66/32) is ignored; the AC rows give 68/30/13/8 four-group leaders before the AIMIM extraction. Summary/pivot totals are
          not treated as authoritative.
        </p>
        <p>
          <b className="text-foreground/85">Round model.</b> The expanded tracker is separate from the compact AC model. It sorts
          all {fmtInt(c.cutoffRows)} entries by Entry Date then Entry ID, builds 13 rounds for 388 (twelve 388-entry rounds and a
          final 434) and 8 rounds for 688 (seven 688-entry rounds and a final 274), and uses separate answered denominators for
          2028 intention and 2023 recall. Projected 2028 = 2023 actual + (2028 intention share − recalled 2023 share), with
          negatives clipped and the seven-party vector normalised to 100%. TDP and Janasena were not recalled-2023 answer options,
          so their recall share is recorded as zero; raw answers are unchanged.
        </p>
        <p>
          <b className="text-foreground/85">Swing statistics.</b> Survey-period medians and outliers use inclusive quartiles and
          1.5×IQR fences per party; historical election anchors are excluded. Historical anchors are not survey rounds. The
          reference&apos;s rounded R1 BRS example gives 43.99%; full-precision calculation gives approximately 43.98%, a display
          rounding difference, not an adjustment to responses.
        </p>
        <p>
          <b className="text-foreground/85">What is not claimed.</b> No confidence interval, margin of error, certified seat
          count, voter transfer, live result or ad-performance claim. “Projected leads” are modelled leading assemblies, not
          seats won. A zero recorded share is valid; only a missing base shows “—”. Official ECI PDF verification remains
          incomplete for the 2014/2018 historical mirror; the final workbook&apos;s 2023 result sheet is the supplied ECI table.
        </p>
        <p>
          <b className="text-foreground/85">Provenance.</b> Source file {data.sourceFile}; workbook SHA-256{" "}
          <code className="break-all text-[10px]">{data.sourceHash}</code>; import version {data.version}; override version{" "}
          {data.overrideVersion}. Historical/map sources: {HISTORY.sourceAudit.historical.map((h) => `${h.year} (${fmtInt(h.totalVotes)} votes)`).join(" · ")}.
          Public pages expose aggregates only — no Entry IDs, raw rows, IPs or phone numbers.
        </p>
      </div>
    </details>
  );
}
