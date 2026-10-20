import { fmtInt } from "@/lib/telangana/model";
import type { Oct26 } from "@/lib/telangana/oct26";

/**
 * One compact disclosure at the bottom of the page. Collapsed by default; the
 * method notes live in the same panel so no empty card is left in the space
 * reserved for the map.
 */
export default function AboutTelangana({ data }: { data: Oct26 }) {
  const c = data.counts;
  const s = data.statewide;
  return (
    <details className="group mx-auto max-w-[1720px] px-4 pb-10 lg:px-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
        About this data
        <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-saffron-2">
          Opinion model
        </span>
        <span className="ml-auto text-[10px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-2.5 rounded-b-xl border border-t-0 border-border bg-card px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground/85">Three separate measures.</b> The <b>2023 result</b> is the ECI-origin election
          table (candidate votes plus NOTA). The <b>2028 prediction</b> is the workbook&apos;s assembly model, aggregated by the
          2023 total vote weight ({fmtInt(s.votes2023)}). The <b>raw 2028 survey</b> is the actual answered intention at the
          cutoff ({fmtInt(s.answered2028)} answers), aggregated by answered rows. They are never merged or presented as one
          number.
        </p>
        <p>
          <b className="text-foreground/85">Parties.</b> BRS; <b>Congress+</b> is the INC + CPI alliance, not INC alone; BJP;
          and Others (AIMIM + BSP + Janasena + NOTA + IND + all remaining). Raw answer options TDP + Janasena + AIMIM fold into
          the same four display groups. Others is therefore not a single party.
        </p>
        <p>
          <b className="text-foreground/85">Replacement workbook.</b> {fmtInt(c.sourceIds)} distinct Entry IDs; default cutoff
          {" "}{data.cutoff}; {fmtInt(c.cutoffRows)} rows on or after the cutoff; {fmtInt(c.answered2028)} answered the 2028
          question and {fmtInt(c.blank2028)} left it blank; {fmtInt(c.answeredRecall2023)} answered the 2023 recall and
          {" "}{fmtInt(c.blankRecall2023)} are blank. Rows are not repeated or appended to the previous dataset, and blanks are
          not redistributed. Shrink factor k = {data.shrinkFactor}.
        </p>
        <p>
          <b className="text-foreground/85">Kodangal override.</b> A prediction-only 50–50 tie is applied for Kodangal
          (AC {data.overrides[0]?.acNo ?? 72}); the raw answers and the historical result (
          {data.overrideMeta.historicalKodangalWinner}) are unchanged. The five other requested Congress leads hold numerically
          without an override. An exact tie is displayed as a tie, never as a Congress lead.
        </p>
        <p>
          <b className="text-foreground/85">Label vs numbers.</b> Jubilee Hills (AC 61) carries a text winner label of
          “Congress” in the workbook, but its numeric 2028 shares lead BRS. Leaders on this page are derived from the displayed
          numbers, so Jubilee Hills is shown as BRS. The text label is retained in the snapshot as provenance.
        </p>
        <p>
          <b className="text-foreground/85">Geography.</b> {c.acs} assemblies across {c.districts} AC-derived analytical
          groups. The grouping is not an official district boundary, and assemblies may cross district lines. The geometry
          metadata states no explicit licence, so reuse terms must be reviewed before production clearance.
        </p>
        <p>
          <b className="text-foreground/85">What is not claimed.</b> No confidence interval, margin of error, certified seat
          count, voter transfer, live result or ad-performance claim. “Projected leads” are modelled leading assemblies, not
          seats won. A zero recorded share is a valid zero, shown as 0.00%; only a missing base shows “—”. Device and PIN data
          are not in this workbook, so the device layer is unavailable rather than empty.
        </p>
        <p>
          <b className="text-foreground/85">Provenance.</b> Source file {data.sourceFile}; workbook SHA-256{" "}
          <code className="break-all text-[10px]">{data.sourceHash}</code>; import version {data.version}; override version
          {" "}{data.overrideVersion}. Public pages expose aggregates only — no Entry IDs, raw rows, IPs or phone numbers.
        </p>
      </div>
    </details>
  );
}
