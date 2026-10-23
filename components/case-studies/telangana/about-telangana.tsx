import { fmtInt } from "@/lib/telangana/model";
import type { Oct26 } from "@/lib/telangana/oct26";
import { HISTORY } from "@/lib/telangana/history";

export default function AboutTelangana({ data }: { data: Oct26 }) {
  const c = data.counts;
  const s = data.statewide;
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
          <b className="text-foreground/85">Compact model.</b> The compact map and comparison use the final workbook&apos;s
          four-group AC model: BRS/TRS family, <b>Congress+</b> (INC + CPI, not INC alone), BJP and Others. The final numeric
          predictions produce {s.leads.BRS ?? 0} BRS, {s.leads.Congress ?? 0} Congress, {s.leads.BJP ?? 0} BJP and
          {s.leads.Others ?? 0} Others leading assemblies. The 2023-vote-weighted shares are BRS{" "}
          {(s.prediction.BRS * 100).toFixed(2)}%, Congress+ {(s.prediction.Congress * 100).toFixed(2)}%, BJP{" "}
          {(s.prediction.BJP * 100).toFixed(2)}%, Others {(s.prediction.Others * 100).toFixed(2)}%.
        </p>
        <p>
          <b className="text-foreground/85">Historical identity.</b> The historical maps retain detailed winning-party identity —
          TRS, Congress, BJP, AIMIM, TDP, BSP, YSRCP, CPI, CPM, AIFB and Independent. The compact prediction remains four-group;
          AIMIM is not invented as a separate compact percentage. The expanded round tracker uses the reference&apos;s separate
          seven-party series where the underlying answers support them.
        </p>
        <p>
          <b className="text-foreground/85">Map colour.</b> For 2014, 2018 and 2023, each assembly is filled by its actual winner
          in that party&apos;s colour, shaded by the winner&apos;s vote share. For 2028 it is filled by the final workbook&apos;s
          leading predicted group (BRS/TRS pink, Congress/INC blue, BJP saffron, Others muted purple), shaded by the predicted
          share. The final workbook contains no prediction overrides.
        </p>
        <p>
          <b className="text-foreground/85">Final workbook.</b> {fmtInt(c.sourceIds)} distinct Entry IDs; {fmtInt(c.cutoffRows)} entries;
          {" "}{fmtInt(c.answered2028)} answered the 2028 question and {fmtInt(c.blank2028)} left it blank;{" "}
          {fmtInt(c.answeredRecall2023)} answered the 2023 recall and {fmtInt(c.blankRecall2023)} are blank. The projection sheet
          headers are detected on row 1, its English assembly-name column is <b>A/c</b>, 119 AC IDs and 33 district groups are
          validated, and trailing formatted/blank rows are ignored. Summary and pivot values are not used as authoritative
          totals.
        </p>
        <p>
          <b className="text-foreground/85">Round model.</b> The expanded tracker is separate from the compact AC model. It sorts
          all {fmtInt(c.cutoffRows)} entries by Entry Date then Entry ID, builds 13 rounds for the 388 option (twelve 388-entry
          rounds and a final 434) and 8 rounds for 688 (seven 688-entry rounds and a final 274), and uses separate answered
          denominators for 2028 intention and 2023 recall. Projected 2028 = 2023 actual + (2028 intention share − recalled 2023
          share), with negatives clipped and the seven-party vector normalised to 100%. TDP and Janasena were not recalled-2023
          answer options, so their recall share is recorded as zero; raw answers are unchanged.
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
