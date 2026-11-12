import Link from "next/link";
import { INDIA_STATES, indiaViewBox } from "@/lib/india-states";

type MapCase = { code: string | null; slug: string; title: string; status: "Validated" | "Live" | "Upcoming" };

const FILL: Record<MapCase["status"], string> = {
  Validated: "#1f4e78",
  Live: "#1d9e75",
  Upcoming: "#a8a69f",
};

export default function HomeIndiaMap({ cases }: { cases: MapCase[] }) {
  const byCode = new Map(cases.filter((item) => item.code).map((item) => [item.code as string, item]));
  return (
    <div className="report-card p-4">
      <div className="flex flex-wrap items-start gap-5">
        <svg viewBox={indiaViewBox()} role="group" aria-label="India case-study map" className="h-[300px] w-full max-w-[360px]">
          {INDIA_STATES.map((state) => {
            const item = byCode.get(state.id);
            if (!item) return <path key={state.id} d={state.d} fill="#eeece5" stroke="#ffffff" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />;
            return (
              <a key={state.id} href={`/case-studies/${item.slug}`} tabIndex={0} aria-label={`${item.title}, ${item.status}`}>
                <title>{`${item.title}, ${item.status}`}</title>
                <path d={state.d} fill={FILL[item.status]} stroke="#1f4e78" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
              </a>
            );
          })}
        </svg>
        <div className="min-w-[180px] flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--r-muted)]">Open by state</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {cases.map((item) => (
              <li key={item.slug}>
                <Link href={`/case-studies/${item.slug}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[12px] hover:bg-[var(--r-bg)]">
                  <span className="text-[var(--r-navy)]">{item.title}</span>
                  <span className={`report-pill ${item.status.toLowerCase()}`}>{item.status}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--r-muted)]">
            {(["Validated", "Live", "Upcoming"] as const).map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: FILL[status] }} />{status}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
