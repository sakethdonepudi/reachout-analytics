export default function RefreshIndicator({ active, label = "Updating..." }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--r-muted)]">
      <span className="size-3 animate-spin rounded-full border border-[var(--r-teal)] border-t-transparent" aria-hidden />
      {label}
    </span>
  );
}
