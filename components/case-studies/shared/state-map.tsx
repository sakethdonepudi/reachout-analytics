import { INDIA_STATES, NORTH_EAST_STATES, PARTY_FILL, indiaViewBox, viewBoxFor } from "@/lib/india-states";

export default function StateMap({
  stateCode,
  stateName: label,
  year,
  party,
}: {
  stateCode: string;
  stateName: string;
  year: number;
  party: string;
}) {
  const fill = PARTY_FILL[party] ?? "#1f4e78";
  const northEast = stateCode === "as";
  const titleId = `state-map-title-${stateCode}`;
  const descId = `state-map-desc-${stateCode}`;
  const mainViewBox = viewBoxFor(stateCode);
  const insetViewBox = indiaViewBox();
  const neighbourFill = (id: string) => {
    if (id === stateCode) return fill;
    if (northEast && NORTH_EAST_STATES.includes(id)) return fill;
    return "var(--state-map-neighbour)";
  };
  const neighbourOpacity = (id: string) => (id === stateCode ? 1 : northEast && NORTH_EAST_STATES.includes(id) ? 0.22 : 0.55);

  return (
    <section className="report-card p-4" aria-labelledby={titleId}>
      <div className="flex items-start gap-3">
        <svg viewBox={mainViewBox} role="img" aria-labelledby={titleId} aria-describedby={descId} className="h-[220px] w-full max-w-[300px] flex-1">
          <title id={titleId}>{label} state outline</title>
          <desc id={descId}>{`State outline for ${label}. District boundaries are not available for this case study.`}</desc>
          {INDIA_STATES.map((state) => (
            <path
              key={state.id}
              d={state.d}
              fill={neighbourFill(state.id)}
              fillOpacity={neighbourOpacity(state.id)}
              stroke={state.id === stateCode ? "var(--theme-link)" : "var(--theme-border)"}
              strokeWidth={state.id === stateCode ? 1.2 : 0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <div className="shrink-0">
          <svg viewBox={insetViewBox} aria-hidden="true" className="h-[110px] w-[86px]">
            {INDIA_STATES.map((state) => (
              <path key={state.id} d={state.d} fill={state.id === stateCode ? fill : "var(--state-map-inset)"} stroke={state.id === stateCode ? "var(--theme-link)" : "var(--theme-border)"} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <p className="mt-1 text-center text-[9px] text-[color:var(--theme-text-3)]">India</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] font-semibold text-[color:var(--theme-link)]">{label} · {year}</p>
      <p className="mt-1 text-[11px] text-[color:var(--theme-text-2)]">State outline. District boundaries are not available for this case study.</p>
    </section>
  );
}
