"use client";

import { useCallback, useEffect, useState } from "react";
import { useReauth } from "@/components/auth/reauth-provider";

type CaseRow = { id: string; slug: string; title: string };

export default function MappingEditor({ cases }: { cases: CaseRow[] }) {
  const { requestReauth } = useReauth();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [regionKeys, setRegionKeys] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/ads/mapping", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setMapping(data.mapping ?? {});
    setRegionKeys(data.regionKeys ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(regionKey: string, caseSlug: string, retry = false) {
    setMessage("");
    const response = await fetch("/api/ads/mapping", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionKey, caseSlug: caseSlug || null }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 403 && payload.code === "reauth_required" && !retry) {
      if (await requestReauth()) return save(regionKey, caseSlug, true);
    }
    if (!response.ok) { setMessage(payload.error ?? "Could not save the mapping."); return; }
    setMapping((current) => ({ ...current, [regionKey]: caseSlug }));
    setMessage("Mapping saved.");
  }

  const keys = [...new Set([...regionKeys, ...Object.keys(mapping)])].sort();
  return (
    <section className="mb-5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-panel)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[15px] font-semibold">Region to case-study mapping</h2><p className="text-[11.5px] text-[var(--text-muted)]">One region maps to one case study. Changes apply immediately.</p></div>
        {message && <span role="status" className="text-[11.5px] text-[var(--text-muted)]">{message}</span>}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
          <thead className="bg-[var(--surface-raised)] text-[9.5px] uppercase tracking-[0.08em] text-[var(--text-muted)]"><tr><th className="px-2 py-2">Region key</th><th className="px-2 py-2">Case study</th><th className="px-2 py-2">Status</th></tr></thead>
          <tbody>{keys.map((key) => {
            const mapped = mapping[key] ?? "";
            return <tr key={key} className="border-t border-[var(--border-hairline)]/60"><td className="px-2 py-2 font-mono text-[11px]">{key}</td><td className="px-2 py-2"><select value={mapped} onChange={(event) => void save(key, event.target.value)} className="min-h-8 rounded border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[11.5px]"><option value="">Unmapped</option>{cases.map((record) => <option key={record.slug} value={record.slug}>{record.title}</option>)}</select></td><td className="px-2 py-2">{mapped ? <span className="text-[11px] text-[var(--success)]">Mapped</span> : <span className="rounded border border-[var(--warning)]/50 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--warning)]">Unmapped</span>}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  );
}
