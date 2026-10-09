"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import type { AboutContent } from "@/lib/about-content";

const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const input = "w-full rounded-xl border border-border bg-elevated/60 px-3 py-2 text-[13px] text-foreground outline-none focus:border-saffron/60 focus:ring-2 focus:ring-saffron/20";

/** Editor for the public /about page. Persists to site_content (admin-only API). */
export default function AboutEditor() {
  const [c, setC] = useState<AboutContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/content").then((r) => (r.ok ? r.json() : null)).then((d) => d && setC(d.content)).catch(() => {});
  }, []);

  if (!c) return <p className="text-[13px] text-muted-foreground">Loading about content…</p>;

  const set = (patch: Partial<AboutContent>) => setC((s) => (s ? { ...s, ...patch } : s));
  const setTeam = (patch: Partial<AboutContent["team"]>) => setC((s) => (s ? { ...s, team: { ...s.team, ...patch } } : s));
  const setCta = (patch: Partial<AboutContent["cta"]>) => setC((s) => (s ? { ...s, cta: { ...s.cta, ...patch } } : s));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Save failed");
      setC(d.content); setMsg("Saved. The public /about page now reflects these changes.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Hero</p>
        <label className="block"><span className={label}>Eyebrow</span><input className={input} value={c.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} /></label>
        <label className="block"><span className={label}>Headline</span><input className={input} value={c.headline} onChange={(e) => set({ headline: e.target.value })} /></label>
        <label className="block"><span className={label}>Introduction</span><textarea rows={3} className={input} value={c.intro} onChange={(e) => set({ intro: e.target.value })} /></label>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Approach (one paragraph per blank-line-separated block)</p>
        <textarea rows={8} className={input} value={c.overview.join("\n\n")} onChange={(e) => set({ overview: e.target.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) })} />
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Expertise</p>
        {c.expertise.map((x, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <input className={input} aria-label={`Expertise ${i + 1} title`} value={x.title} onChange={(e) => { const ex = [...c.expertise]; ex[i] = { ...ex[i], title: e.target.value }; set({ expertise: ex }); }} />
            <input className={input} aria-label={`Expertise ${i + 1} description`} value={x.desc} onChange={(e) => { const ex = [...c.expertise]; ex[i] = { ...ex[i], desc: e.target.value }; set({ expertise: ex }); }} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Core team</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className={label}>Name</span><input className={input} value={c.team.name} onChange={(e) => setTeam({ name: e.target.value })} /></label>
          <label className="block"><span className={label}>Displayed role</span><input className={input} value={c.team.role} onChange={(e) => setTeam({ role: e.target.value })} /></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className={label}>Portrait path</span><input className={input} value={c.team.portrait} onChange={(e) => setTeam({ portrait: e.target.value })} /></label>
          <label className="block"><span className={label}>Portrait alt text</span><input className={input} value={c.team.portraitAlt} onChange={(e) => setTeam({ portraitAlt: e.target.value })} /></label>
        </div>
        <label className="block"><span className={label}>Biography (blank line = new section)</span><textarea rows={10} className={input} value={c.team.bio.join("\n\n")} onChange={(e) => setTeam({ bio: e.target.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) })} /></label>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
        <p className="text-[13px] font-semibold">Experience, skills & CTA</p>
        <label className="block"><span className={label}>Professional experience (comma-separated)</span><input className={input} value={c.professionalOrgs.join(", ")} onChange={(e) => set({ professionalOrgs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
        <label className="block"><span className={label}>Training delivered for (comma-separated)</span><input className={input} value={c.trainingOrgs.join(", ")} onChange={(e) => set({ trainingOrgs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
        <label className="block"><span className={label}>Technical skills (comma-separated)</span><input className={input} value={c.skills.join(", ")} onChange={(e) => set({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={input} aria-label="CTA title" value={c.cta.title} onChange={(e) => setCta({ title: e.target.value })} />
          <input className={input} aria-label="CTA body" value={c.cta.body} onChange={(e) => setCta({ body: e.target.value })} />
          <input className={input} aria-label="CTA button" value={c.cta.button} onChange={(e) => setCta({ button: e.target.value })} />
        </div>
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
