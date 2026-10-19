import { fmtInt } from "@/lib/telangana/model";

/**
 * Accessible "About this data" panel. Counts and provenance live here (and in
 * admin), not in headline cards on the public dashboard.
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
    <details className="group rounded-2xl border border-border bg-card open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[12.5px] font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          About this data
          <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-saffron-2">Survey scenario</span>
        </span>
        <span className="text-[11px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-3 border-t border-border px-4 py-4 text-[11.5px] leading-relaxed text-muted-foreground">
        <p>
          <b className="text-foreground/85">Survey scenario.</b> The 2028 figures come from a {fmtInt(totals.scenarioRows)}-row
          scenario workbook that repeats {fmtInt(totals.sourceEntries)} supplied entries. {fmtInt(totals.answered2028)} rows
          answered the 2028 question and {fmtInt(totals.blank2028)} are blank. The repeated rows are not additional
          respondents, and no margin of error or seat projection is claimed.
        </p>
        <p>
          The 2028 party is column B of the supplied workbook. Columns C/D are 2023 values adjusted to statewide shares;
          they are preserved as provenance but are never used as the 2028 party, an AC baseline, a calibration check or a
          voter-transition table. The original 2023 answers in columns AI/AJ are self-reported recall with their own missing
          answers.
        </p>
        <p>
          <b className="text-foreground/85">Historical denominators.</b> 2018 actuals are candidate votes plus NOTA from the
          supplied OpenCity/TCPD table ({fmtInt(20695458)} votes incl NOTA, 119 ACs). 2023 actuals are candidate votes plus
          NOTA from the supplied ECI-origin workbook ({fmtInt(23439945)}). The 2018 BJP share in that downloaded source is
          about 7.01%; the supplied reference tracker uses 6.98%. The source values are used consistently and are not blended.
          TRS/BHRS are mapped to BRS for series continuity; raw codes remain in the records.
        </p>
        <p>
          <b className="text-foreground/85">Wording.</b> “2018 → 2023” is an actual historical swing in percentage points.
          “2023 → 2028” is labelled <i>Survey difference vs 2023</i>; it is not a measured election swing, a forecast or proof
          of voter transfer. A zero recorded option does not establish zero electorate support, and a zero denominator shows
          “No answered survey responses” rather than 0%.
        </p>
        <p>
          <b className="text-foreground/85">Geography.</b> {acs} sourced assembly polygons join by AC number. Focus uses the
          uploaded AC-derived analytical grouping ({groups} groups). {conflictRows} exact district strings differ from the
          Wikipedia comparison — some are spelling aliases and some are substantive; this grouping is not an independently
          verified official district boundary, and assemblies may cross administrative districts. District aggregates here are
          a dissolve of ACs in the group, not a spatial apportionment of votes. The geometry source states no explicit licence
          in its fetched metadata, so reuse terms must be reviewed before production publication.
        </p>
        <p>
          <b className="text-foreground/85">Device layer.</b> Device mix aggregates the original entries&apos; observed/predicted
          metadata by assembly. It is not handset GPS, not one verified phone per voter, and not a political-preference measure.
          Most IP-derived coordinates are gateway defaults (4,424 of 5,090 entries share one Hyderabad pair), so markers are
          assembly aggregate anchors, not respondent locations.
        </p>
        <p>
          Public pages show aggregates only. Raw IPs, generated IDs, entry IDs, user agents and journey fields are never
          exposed; those fields remain in private admin inputs.
        </p>
      </div>
    </details>
  );
}
