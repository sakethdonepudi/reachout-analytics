import { fmtInt } from "@/lib/telangana/model";

/**
 * One compact disclosure. Collapsed by default, height follows its content, and
 * the method notes live inside the same panel so no large empty card is left in
 * the visual space reserved for charts.
 */
export default function AboutTelangana({
  totals, conflictRows, sourceEntries, groups, acs,
}: {
  totals: { scenarioRows: number; answered2028: number; blank2028: number; sourceEntries: number; geometryPoints: number };
  conflictRows: number;
  sourceEntries: number;
  groups: number;
  acs: number;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
        About this data
        <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-saffron-2">Survey scenario</span>
        <span className="ml-auto text-[10px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-2.5 border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground/85">Survey scenario.</b> The 2028 figures come from a {fmtInt(totals.scenarioRows)}-row
          workbook that repeats {fmtInt(totals.sourceEntries)} supplied entries. {fmtInt(totals.answered2028)} rows answered the
          2028 question and {fmtInt(totals.blank2028)} are blank. Repeated rows are not additional respondents; no margin of error
          or seat projection is claimed.
        </p>
        <p>
          The 2028 party is column B of the supplied workbook. Columns C/D are 2023 values adjusted to statewide shares: they are
          provenance only and are never used as the 2028 party, an AC baseline, a calibration check or a voter-transition table.
          Original AI/AJ answers are self-reported recall with their own missing values.
        </p>
        <p>
          <b className="text-foreground/85">Historical comparisons.</b> 2018 actuals are candidate votes plus NOTA from the
          supplied OpenCity/TCPD table ({fmtInt(20695458)} votes incl NOTA, 119 ACs); 2023 actuals are candidate votes plus NOTA
          from the supplied ECI-origin workbook ({fmtInt(23439945)}). The 2018 BJP share is about 7.01% in that source versus
          6.98% in the supplied reference tracker; the source values are used consistently and never blended. TRS/BHRS map to BRS
          for continuity and raw codes remain in the records.
        </p>
        <p>
          <b className="text-foreground/85">Wording.</b> “2018 → 2023” is an actual historical swing in percentage points.
          “2023 → 2028” is labelled <i>Survey difference vs 2023</i>; it is not a measured election swing, forecast or proof of
          voter transfer. A zero recorded option does not establish zero electorate support, and a zero denominator shows
          “No answered survey responses” rather than 0%.
        </p>
        <p>
          <b className="text-foreground/85">Geography.</b> {acs} sourced assembly polygons join by AC number. Focus uses the
          uploaded AC-derived analytical grouping ({groups} groups); {conflictRows} district strings differ from the Wikipedia
          comparison, some spelling aliases and some substantive. District outlines here are a dissolve of assemblies, not an
          official administrative boundary, and assemblies may cross district lines. Geometry metadata states no explicit licence,
          so reuse terms must be reviewed before production clearance.
        </p>
        <p>
          <b className="text-foreground/85">Device layer.</b> Device mix aggregates original-entry observed/predicted metadata by
          assembly. Markers are illustrative assembly-level placements, not handset GPS, unique users or political preference. Most
          IP-derived coordinates are gateway defaults (4,424 of 5,090 entries share one Hyderabad pair).
        </p>
        <ul className="space-y-1 border-t border-border pt-2.5">
          <li>· 2018 and 2023 are actual results; 2028 is a survey scenario.</li>
          <li>· Zero denominator shows “No answered survey responses”, never 0%.</li>
          <li>· Missing ages and blank answers are retained, not redistributed.</li>
          <li>· No 2028 seat projection, confidence interval or ad-performance claim.</li>
          <li>· Public pages expose aggregates only; raw IPs, IDs, agents and journeys stay private.</li>
        </ul>
      </div>
    </details>
  );
}
