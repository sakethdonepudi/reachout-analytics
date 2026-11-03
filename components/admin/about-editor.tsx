"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { AboutContent } from "@/lib/about-content";

const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const input = "w-full rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] text-foreground outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20";

/**
 * Editor for the public /about page. The redesigned page is a fixed brand
 * story, so only the opening statement and closing invitation are editable.
 */
export default function AboutEditor() {
  const [c, setC] = useState<AboutContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/content").then((r) => (r.ok ? r.json() : null)).then((d) => d && setC(d.content)).catch(() => {});
  }, []);

  if (!c) return <p className="text-[13px] text-muted-foreground">Loading about content…</p>;

  const set = (patch: Partial<AboutContent>) => setC((s) => (s ? { ...s, ...patch } : s));
  const setCta = (patch: Partial<AboutContent["cta"]>) => setC((s) => (s ? { ...s, cta: { ...s.cta, ...patch } } : s));

  async function save() {
    if (!c) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eyebrow: c.eyebrow, headline: c.headline, intro: c.intro, cta: c.cta }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Save failed");
      setC(d.content); setMsg("Saved. The opening statement and closing invitation on /about now reflect these changes.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
        The redesigned About page is a fixed brand story. These fields control the opening statement and the closing call to action; the story, practice and case-study sections are set by the design.
      </p>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Opening statement</p>
        <label className="block"><span className={label}>Eyebrow</span><input className={input} value={c.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></label>
        <label className="block"><span className={label}>Headline</span><input className={input} value={c.headline} onChange={(e) => set({ headline: e.target.value })} /></label>
        <label className="block"><span className={label}>Introduction</span><textarea rows={3} className={input} value={c.intro} onChange={(e) => set({ intro: e.target.value })} /></label>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Closing invitation</p>
        <label className="block"><span className={label}>Title</span><input className={input} value={c.cta.title} onChange={(e) => setCta({ title: e.target.value })} /></label>
        <label className="block"><span className={label}>Body</span><textarea rows={2} className={input} value={c.cta.body} onChange={(e) => setCta({ body: e.target.value })} /></label>
        <label className="block"><span className={label}>Button label</span><input className={input} value={c.cta.button} onChange={(e) => setCta({ button: e.target.value })} /></label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-saffron px-4 py-2 text-[13px] font-semibold text-[#241203] disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save About page
        </button>
        {msg && <span className="text-[12.5px] text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}
