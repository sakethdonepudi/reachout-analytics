import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableAlign = "left" | "right";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  align?: DataTableAlign;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  empty?: ReactNode;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  className?: string;
};

function sortState(key: string, sortKey?: string | null, direction?: "asc" | "desc"): "ascending" | "descending" | "none" {
  if (sortKey !== key) return "none";
  return direction === "desc" ? "descending" : "ascending";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  sortKey,
  sortDirection,
  onSort,
  className,
}: DataTableProps<T>) {
  if (!rows.length) {
    return <div className={cn("rounded-[var(--radius-card)] border border-[var(--border-hairline)] p-4", className)}>{empty ?? "No rows"}</div>;
  }

  return (
    <div className={cn("max-h-[min(70vh,720px)] overflow-auto rounded-[var(--radius-card)] border border-[var(--border-hairline)]", className)}>
      <table className="w-full border-collapse text-left text-[var(--text-small)]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-[var(--surface-panel)]">
          <tr className="border-b border-[var(--border-hairline)]">
            {columns.map((column) => {
              const align = column.align ?? "left";
              const active = sortKey === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sortable ? sortState(column.key, sortKey, sortDirection) : undefined}
                  className={cn(
                    "px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]",
                    align === "right" ? "text-right" : "text-left",
                    column.className,
                  )}
                >
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        "inline-flex min-h-10 items-center gap-1 rounded-[var(--radius-control)] px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-brass)]",
                        align === "right" && "justify-end",
                        active && "text-[var(--text-primary)]",
                      )}
                    >
                      {column.label}
                      <span aria-hidden className="text-[9px]">{active ? (sortDirection === "desc" ? "↓" : "↑") : "↕"}</span>
                    </button>
                  ) : column.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-[var(--border-hairline)]/70 last:border-b-0">
              {columns.map((column) => {
                const raw = (row as Record<string, unknown>)[column.key];
                const value = column.render
                  ? column.render(row)
                  : raw == null || raw === ""
                    ? "—"
                    : typeof raw === "number" && column.align === "right"
                      ? new Intl.NumberFormat("en-IN").format(raw)
                      : raw as ReactNode;
                return (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 py-2 align-top text-[var(--text-primary)]",
                      column.align === "right" ? "num-right" : "text-left",
                      column.className,
                    )}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
