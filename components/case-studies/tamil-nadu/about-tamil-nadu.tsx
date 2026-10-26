import type { TnAggregates } from "@/lib/tamil-nadu/model";

export default function AboutTamilNadu({ data }: { data: TnAggregates }) {
  return (
    <details className="group mx-auto max-w-[1720px] px-4 pb-10 lg:px-6">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[12px] font-semibold [&::-webkit-details-marker]:hidden">
        About this data
        <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-saffron-2">Workbook estimate</span>
        <span className="ml-auto text-[10px] font-normal text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-2.5 rounded-b-xl border border-t-0 border-border bg-card px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <p><b className="text-foreground/85">Source.</b> {data.sourceFile}; workbook SHA-256 <span className="font-mono text-[10px]">{data.sourceHash.slice(0, 16)}…</span>; import ID <span className="font-mono text-[10px]">{data.sourceImportId}</span>. The previous workbook and allocation snapshot are archived privately and are not used in active queries.</p>
        <p><b className="text-foreground/85">Estimate.</b> The statewide estimated vote share uses the workbook&apos;s calibrated shares. District and assembly estimates use the available survey-derived shares; statewide percentages are not substituted locally and no local calibrated vote shares are invented. Estimated seats use the final district-calibrated calls; Actual 2026 is shown separately.</p>
        <p><b className="text-foreground/85">Coverage.</b> {data.source.totalResponses.toLocaleString("en-IN")} party-choice responses; {data.source.withAc.toLocaleString("en-IN")} with an assembly and {data.source.noAc.toLocaleString("en-IN")} in the <span className="font-mono">NO DIST, AC</span> aggregate, which remains statewide only. All 234 assemblies and 38 district groups resolve. Historical 2011–2021 shares are retained with unrelated parties kept separately in Others. No dated survey rounds, collection windows or time trends are inferred from this aggregate workbook. Full methodology and calibration metrics are retained in admin and exports.</p>
      </div>
    </details>
  );
}
