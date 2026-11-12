"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useReauth } from "@/components/auth/reauth-provider";
import { cn } from "@/lib/utils";

type User = {
  _id: string; username: string; displayName: string; organisation: string | null; role: "owner" | "client";
  status: "active" | "disabled"; totpEnabled: boolean; totpRequired: boolean; mustChangePassword: boolean;
  lastLoginAt: string | null; lastLoginDevice: string | null;
  clientScope: { caseStudies: string[]; states: string[]; parties: string[] };
};
type Meta = {
  users: User[]; currentUserId: string;
  cases: { slug: string; title: string; state: string; party: string }[];
  parties: string[]; states: string[];
};

const EMPTY_FORM = { username: "", displayName: "", organisation: "", role: "client" as "owner" | "client", password: "", totpRequired: false, caseStudies: [] as string[], states: [] as string[], parties: [] as string[] };

export default function UsersClient() {
  const { requestReauth } = useReauth();
  const [data, setData] = useState<Meta | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/account/users", { cache: "no-store" });
    if (response.status === 403) {
      if (await requestReauth()) return load();
      setError("Re-authentication is required.");
      return;
    }
    if (!response.ok) { setError("Could not load users."); return; }
    setData(await response.json());
    setError("");
  }, [requestReauth]);

  useEffect(() => { void load(); }, [load]);

  async function call(id: string | null, body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE", retry = false): Promise<boolean> {
    setBusy(id ?? "create"); setError(""); setMessage(""); setFieldErrors({});
    try {
      const url = id ? `/api/account/users/${id}` : "/api/account/users";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 403 && payload.code === "reauth_required" && !retry) {
        if (await requestReauth()) return call(id, body, method, true);
      }
      if (!response.ok) { setFieldErrors((payload.fieldErrors as Record<string, string>) ?? {}); setError(typeof payload.error === "string" ? payload.error : "Request failed."); return false; }
      await load();
      return true;
    } catch { setError("Request failed."); return false; }
    finally { setBusy(""); }
  }

  async function create() {
    const ok = await call(null, form, "POST");
    if (ok) { setForm(EMPTY_FORM); setMessage("Account created. The user must change the temporary password at first sign-in."); }
  }

  async function resetPassword(user: User) {
    const password = window.prompt(`Temporary password for ${user.username} (at least 12 characters)`);
    if (!password) return;
    if (await call(user._id, { action: "reset-password", password }, "PATCH")) setMessage("Temporary password set. All their sessions were ended.");
  }

  async function toggle(user: User) {
    const status = user.status === "active" ? "disabled" : "active";
    if (await call(user._id, { action: "update", status }, "PATCH")) setMessage(status === "disabled" ? "Account disabled." : "Account enabled.");
  }

  async function resetTotp(user: User) {
    if (!window.confirm(`Reset 2FA for ${user.username}? They will enroll again at next sign-in.`)) return;
    if (await call(user._id, { action: "reset-2fa" }, "PATCH")) setMessage("2FA reset.");
  }

  async function endSessions(user: User) {
    if (await call(user._id, { action: "end-sessions" }, "PATCH")) setMessage("Sessions ended.");
  }

  async function remove(user: User) {
    if (!window.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    if (await call(user._id, {}, "DELETE")) setMessage("Account deleted.");
  }

  const parties = data?.parties ?? [];
  const states = data?.states ?? [];
  const cases = data?.cases ?? [];
  const owners = useMemo(() => data?.users.filter((user) => user.role === "owner" && user.status === "active" && user.totpEnabled).length ?? 0, [data]);

  return (
    <div className="space-y-6">
      <div>
        <p className="type-micro text-[var(--accent-brass-strong)]">Owner tools</p>
        <h1 className="font-display text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">Users</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">Create owners and clients, set client scope, reset passwords and 2FA. Every change needs a fresh password and authenticator check.</p>
      </div>

      {error && <p role="alert" className="rounded-[var(--radius-control)] border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
      {message && <p role="status" className="rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-raised)] px-3 py-2 text-[12.5px] text-[var(--text-muted)]">{message}</p>}

      <Card className="p-5">
        <div className="flex items-center gap-2"><UserPlus className="size-4" /><h2 className="type-h3">Create account</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} error={fieldErrors.username} hint="3-32 characters: a-z, 0-9, dot, underscore or hyphen." />
          <Field label="Display name" value={form.displayName} onChange={(value) => setForm({ ...form, displayName: value })} error={fieldErrors.displayName} />
          <Field label="Organisation (clients)" value={form.organisation} onChange={(value) => setForm({ ...form, organisation: value })} />
          <label className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Role
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "owner" | "client" })} className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 text-[12px]">
              <option value="client">Client</option><option value="owner">Owner</option>
            </select>
          </label>
          <Field label="Temporary password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} error={fieldErrors.password} hint="At least 12 characters." />
          <label className="mt-5 flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" checked={form.role === "owner" || form.totpRequired} disabled={form.role === "owner"} onChange={(event) => setForm({ ...form, totpRequired: event.target.checked })} className="size-4 accent-[var(--accent-brass)]" /> Require 2FA</label>
        </div>

        {form.role === "client" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Picker label="Case studies" options={cases.map((item) => [item.slug, `${item.title} (${item.state})`])} selected={form.caseStudies} onChange={(values) => setForm({ ...form, caseStudies: values })} />
            <Picker label="States" options={states.map((value) => [value, value])} selected={form.states} onChange={(values) => setForm({ ...form, states: values })} />
            <Picker label="Parties" options={parties.map((value) => [value, value])} selected={form.parties} onChange={(values) => setForm({ ...form, parties: values })} />
          </div>
        )}

        <button type="button" onClick={() => void create()} disabled={busy === "create"} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent-brass)] px-4 text-[12.5px] font-semibold text-[var(--text-on-brass)] disabled:opacity-60">
          {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Create account
        </button>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-5"><h2 className="type-h3">Accounts</h2><span className="text-[11.5px] text-[var(--text-muted)]">{owners} active owner{owners === 1 ? "" : "s"} with 2FA</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
            <thead className="bg-[var(--surface-raised)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">2FA</th><th className="px-4 py-2">Scope</th><th className="px-4 py-2">Last sign-in</th><th className="px-4 py-2 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((user) => (
                <tr key={user._id} className="border-t border-[var(--border-hairline)]/70">
                  <td className="px-4 py-3"><p className="font-semibold">{user.displayName}</p><p className="text-[10.5px] text-[var(--text-muted)]">@{user.username}{user.organisation ? ` · ${user.organisation}` : ""}</p></td>
                  <td className="px-4 py-3"><Badge tone={user.role === "owner" ? "accent" : "neutral"}>{user.role}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={user.status === "active" ? "success" : "danger"}>{user.status}</Badge></td>
                  <td className="px-4 py-3 text-[11.5px]">{user.totpEnabled ? "Enrolled" : user.totpRequired ? "Required, not enrolled" : "Optional"}</td>
                  <td className="px-4 py-3 text-[10.5px] text-[var(--text-muted)]">{user.role === "client" ? `${user.clientScope.caseStudies.length} cases · ${user.clientScope.states.length} states · ${user.clientScope.parties.length} parties` : "All"}</td>
                  <td className="px-4 py-3 text-[10.5px] text-[var(--text-muted)]">{user.lastLoginAt ? `${new Date(user.lastLoginAt).toLocaleString()} · ${user.lastLoginDevice ?? "device"}` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Action onClick={() => void toggle(user)} disabled={busy === user._id}>{user.status === "active" ? "Disable" : "Enable"}</Action>
                      <Action onClick={() => void resetPassword(user)} disabled={busy === user._id}>Reset password</Action>
                      <Action onClick={() => void resetTotp(user)} disabled={busy === user._id || (user.role === "owner" && owners <= 1)}>Reset 2FA</Action>
                      <Action onClick={() => void endSessions(user)} disabled={busy === user._id}>End sessions</Action>
                      <button type="button" onClick={() => void remove(user)} disabled={busy === user._id || user._id === data?.currentUserId || (user.role === "owner" && owners <= 1)} aria-label={`Delete ${user.username}`} className="grid size-8 place-items-center rounded border border-[var(--danger)]/40 text-[var(--danger)] disabled:opacity-40"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", error, hint }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string; hint?: string }) {
  return (
    <label className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} className={`mt-1 min-h-10 w-full rounded-[var(--radius-control)] border bg-[var(--surface-panel)] px-2 text-[12px] normal-case tracking-normal ${error ? "border-[var(--danger)]" : "border-[var(--border-hairline)]"}`} />
      {error ? <span className="mt-1 block text-[10.5px] font-medium normal-case tracking-normal text-[var(--danger)]">{error}</span> : hint ? <span className="mt-1 block text-[10.5px] font-normal normal-case tracking-normal text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}

function Picker({ label, options, selected, onChange }: { label: string; options: [string, string][]; selected: string[]; onChange: (values: string[]) => void }) {
  return (
    <label className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}
      <select multiple value={selected} onChange={(event) => onChange([...event.target.selectedOptions].map((option) => option.value))} className="mt-1 min-h-24 w-full rounded-[var(--radius-control)] border border-[var(--border-hairline)] bg-[var(--surface-panel)] px-2 py-1 text-[11.5px] normal-case tracking-normal">
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
}

function Action({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={cn("min-h-8 rounded border border-[var(--border-hairline)] px-2 text-[10.5px] font-semibold hover:bg-[var(--surface-raised)] disabled:opacity-40")}>{children}</button>;
}
