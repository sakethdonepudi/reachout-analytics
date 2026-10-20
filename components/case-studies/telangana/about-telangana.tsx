import { fmtInt } from "@/lib/telangana/model";
import type { Oct26 } from "@/lib/telangana/oct26";
import { HISTORY } from "@/lib/telangana/history";

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
          <b className="text-foreground/85">Four election years.</b> The <b>2014</b> and <b>2018</b> figures are actual
          ECI-derived OpenCity/TCPD mirror results (vote totals {fmtInt(HISTORY.years["2014"].total)} and {fmtInt(HISTORY.years["2018"].total)});
          <b> 2023</b> is the supplied workbook result table ({fmtInt(HISTORY.years["2023"].total)} votes). None of these are exit
          polls. <b>2028</b> is a separate model prediction aggregated by 2023 vote weight ({fmtInt(s.votes2023)}), not an
          observed result. Raw survey answers stay private and are not displayed in the public comparison.
        </p>
        <p>
          <b className="text-foreground/85">Parties.</b> The comparison table uses four groups: BRS/TRS family; <b>Congress+</b>
          (INC + CPI, not INC alone); BJP; and Others (AIMIM + BSP + Janasena + NOTA + IND + all remaining). Historical maps
          retain the detailed winning-party identity — TRS, Congress, BJP, AIMIM, TDP, BSP, YSRCP, CPI, CPM, AIFB and
          Independent — so the seat geography is not collapsed into the four comparison groups.
        </p>
        <p>
          <b className="text-foreground/85">Map colour.</b> For 2014, 2018 and 2023, each assembly is filled by its actual
          winner in that party&apos;s colour, shaded by the winner&apos;s vote share. For 2028 it is filled by the leading
          predicted party (BRS pink, Congress+ blue, BJP orange, Others purple-slate) shaded by the predicted share.
          Kodangal&apos;s 50–50 tie is split equally between BRS and Congress. AIMIM has separate historical results (green)
          but no separate 2028 prediction: it sits inside Others, so no green 2028 region is invented.
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
          <b className="text-foreground/85">Swing statistics.</b> The median is the median assembly swing across the 119
          comparable ACs (or a re-computed cohort with at least 10 assemblies), not the vote-weighted aggregate. Quartiles are
          inclusive; outlier fences are 1.5×IQR. A selected assembly&apos;s points outside a fence are ringed; the statewide
          aggregate is never flagged as an AC outlier.
        </p>
        <p>
          <b className="text-foreground/85">Devices.</b> The device layer uses a separate exact Entry ID join: {fmtInt(HISTORY.devices.total)}
          {" "}October-cutoff entries, with zero AC mismatches. Brands are predicted metadata, not verified handsets, unique
          people or GPS; markers use stable illustrative anchors inside the selected assembly geometry. If a later import no
          longer matches Entry IDs, enrichment must be disabled and revalidated.
        </p>
        <p>
          <b className="text-foreground/85">What is not claimed.</b> No confidence interval, margin of error, certified seat
          count, voter transfer, live result or ad-performance claim. “Projected leads” are modelled leading assemblies, not
          seats won. A zero recorded share is a valid zero, shown as 0.00%; only a missing base shows “—”. The historical
          downloads are internally reconciled but official ECI PDF verification remains incomplete; the downloaded source URLs and versions are retained in the admin bundle.
        </p>
        <p>
          <b className="text-foreground/85">Provenance.</b> Source file {data.sourceFile}; workbook SHA-256{" "}
          <code className="break-all text-[10px]">{data.sourceHash}</code>; import version {data.version}; override version
          {" "}{data.overrideVersion}. Historical/map sources: {HISTORY.sourceAudit.historical.map((h) => `${h.year} (${fmtInt(h.totalVotes)} votes)`).join(" · ")}.
          Public pages expose aggregates only — no Entry IDs, raw rows, IPs or phone numbers.
        </p>
      </div>
    </details>
  );
}
