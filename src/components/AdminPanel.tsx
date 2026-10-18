"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, Plus, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar, ChannelIcon, Modal, Wordmark } from "./ui";

type City = { id: number; name: string };
type Channel = { id: number; name: string; type: string; cityId: number | null; cityName: string | null };
type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "manager" | "member";
  cityId: number | null;
  department: string | null;
  canApprove: boolean;
  active: boolean;
  channelIds: number[];
};

const DEPARTMENTS = [
  ["sales", "Sales"],
  ["project", "Project"],
  ["accounts", "Accounts"],
  ["dispatch", "Dispatch"],
] as const;

export function AdminPanel() {
  const [tab, setTab] = useState<"users" | "cities" | "crm">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [u, c, ch] = await Promise.all([
      api<{ users: AdminUser[] }>("/api/admin/users"),
      api<{ cities: City[] }>("/api/admin/cities"),
      api<{ channels: Channel[] }>("/api/admin/channels"),
    ]);
    setUsers(u.users);
    setCities(c.cities);
    setChannels(ch.channels);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const cityName = (id: number | null) => cities.find((c) => c.id === id)?.name ?? "—";
  const filtered = users.filter((u) => `${u.name} ${u.email} ${cityName(u.cityId)}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-full bg-canvas">
      <header className="flex h-12 items-center gap-3 bg-nav px-4 text-nav-ink">
        <a href="/app" className="rounded-md p-1 hover:bg-nav-2" aria-label="Back to workspace">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <Wordmark tone="light" />
        <span className="h-4 w-px bg-white/15" />
        <h1 className="text-[13px] font-medium text-nav-ink-2">Administration</h1>
      </header>
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="mb-6 flex gap-1 border-b border-line">
          {(
            [
              ["users", "People"],
              ["cities", "Cities & groups"],
              ["crm", "PONGS CRM integration"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === v ? "border-graphite text-ink dark:border-lime" : "border-transparent text-ink-3 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="panel">
            <div className="flex items-center gap-2 border-b p-3">
              <input className="input max-w-xs" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn-primary ml-auto" onClick={() => setEditing("new")}>
                <UserPlus className="h-4 w-4" /> Add person
              </button>
            </div>
            <div className="divide-y divide-line">
              {filtered.map((u) => (
                <button key={u.id} onClick={() => setEditing(u)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${u.active ? "" : "opacity-50"}`}>
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {u.name} {!u.active && <span className="text-xs text-red-600">(deactivated)</span>}
                    </div>
                    <div className="truncate text-xs text-slate-500">{u.email}</div>
                  </div>
                  <div className="hidden text-right text-xs text-slate-600 capitalize sm:block">
                    <div>
                      {u.role}
                      {u.canApprove && " · approver"}
                    </div>
                    <div>
                      {cityName(u.cityId)}
                      {u.department && ` · ${u.department}`} · {u.channelIds.length} groups
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No people yet.</p>}
            </div>
          </div>
        )}

        {tab === "cities" && <CitiesTab cities={cities} channels={channels} users={users} onChange={load} />}
        {tab === "crm" && <CrmTab />}
      </div>

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          cities={cities}
          channels={channels}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CitiesTab({ cities, channels, users, onChange }: { cities: City[]; channels: Channel[]; users: AdminUser[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/cities", { method: "POST", json: { name } });
      setName("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  const memberCount = (channelId: number) => users.filter((u) => u.channelIds.includes(channelId)).length;
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex items-end gap-2 panel p-4">
        <div className="flex-1">
          <label className="label">New city</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Surat" required />
        </div>
        <button className="btn-primary">
          <Plus className="h-4 w-4" /> Add city
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-slate-500">Each city automatically gets Sales, Project, Accounts and Dispatch groups.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cities.map((c) => (
          <div key={c.id} className="panel p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <MapPin className="h-4 w-4 text-brand-600" /> {c.name}
            </div>
            {channels
              .filter((ch) => ch.cityId === c.id)
              .map((ch) => (
                <div key={ch.id} className="flex items-center gap-2 py-1 text-sm">
                  <ChannelIcon type={ch.type} />
                  <span className="capitalize">{ch.type}</span>
                  <span className="ml-auto text-xs text-slate-500">{memberCount(ch.id)} members</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultChannels(form: { role: string; cityId: string; department: string }, channels: Channel[]) {
  return channels
    .filter((ch) => {
      if (ch.type === "general") return true;
      if (!form.cityId || ch.cityId !== Number(form.cityId)) return false;
      return form.role !== "member" || !form.department || ch.type === form.department;
    })
    .map((ch) => ch.id);
}

function UserDialog({
  user,
  cities,
  channels,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  cities: City[];
  channels: Channel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    role: user?.role ?? "member",
    cityId: user?.cityId ? String(user.cityId) : "",
    department: user?.department ?? "",
    canApprove: user?.canApprove ?? false,
    active: user?.active ?? true,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set(user?.channelIds ?? []));
  const [touched, setTouched] = useState(Boolean(user));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // For new people, group membership follows city/department/role until the admin edits it by hand.
  useEffect(() => {
    if (!touched) setSelected(new Set(defaultChannels(form, channels)));
  }, [form.role, form.cityId, form.department, channels, touched]); // eslint-disable-line react-hooks/exhaustive-deps

  const byCity = useMemo(() => {
    const m = new Map<string, Channel[]>();
    for (const ch of channels) {
      const k = ch.cityName ?? "Company";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(ch);
    }
    return [...m.entries()];
  }, [channels]);

  function toggle(id: number) {
    setTouched(true);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      cityId: form.cityId ? Number(form.cityId) : null,
      department: form.department || null,
      canApprove: form.canApprove,
      active: form.active,
      channelIds: [...selected],
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      if (user) await api(`/api/admin/users/${user.id}`, { method: "PATCH", json: payload });
      else await api("/api/admin/users", { method: "POST", json: payload });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Modal title={user ? `Edit ${user.name}` : "Add person"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className="label">Email (login)</label>
            <input className="input" type="email" required value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <label className="label">{user ? "Reset password (leave blank to keep)" : "Starting password"}</label>
            <input className="input" type="text" minLength={8} required={!user} value={form.password} onChange={set("password")} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={set("role")}>
              <option value="member">Member</option>
              <option value="manager">City manager (all groups of their city)</option>
              <option value="admin">Admin (everything)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">City</label>
              <select className="input" value={form.cityId} onChange={set("cityId")}>
                <option value="">—</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="input" value={form.department} onChange={set("department")}>
                <option value="">—</option>
                {DEPARTMENTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.canApprove} onChange={(e) => setForm({ ...form, canApprove: e.target.checked })} />
            Can approve costings
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active (can sign in)
          </label>
        </div>
        <div>
          <div className="label">Groups</div>
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
            {byCity.map(([city, chans]) => (
              <div key={city}>
                <div className="mb-1 text-xs font-semibold text-slate-700">{city}</div>
                {chans.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 py-0.5 text-sm capitalize">
                    <input type="checkbox" checked={selected.has(ch.id)} onChange={() => toggle(ch.id)} />
                    {ch.type === "general" ? ch.name : ch.type}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Modal>
  );
}

function CrmTab() {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";
  const sample = `curl -X POST ${origin}/api/integrations/crm/approvals \\
  -H "x-api-key: $CRM_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{
    "quoteId": "Q-2026-1042",
    "title": "Cold storage panels — Phase 1",
    "city": "Mumbai",
    "department": "sales",
    "customerName": "Acme Foods",
    "amount": 1250000,
    "cost": 1010000,
    "currency": "INR",
    "costBreakdown": [
      { "item": "PUF panels 100mm", "qty": 400, "cost": 1900 },
      { "item": "Installation labour", "cost": 250000 }
    ],
    "notes": "Customer wants delivery in 3 weeks",
    "crmUrl": "https://crm.pongs.example/quotes/Q-2026-1042",
    "callbackUrl": "https://crm.pongs.example/webhooks/approvals",
    "requestedBy": { "name": "Estimation Team", "email": "estimation@pongs.example" }
  }'`;
  return (
    <div className="space-y-4 panel p-5 text-sm">
      <p>
        PONGS CRM sends quotation costings here. Each one appears as an approval card in the chosen city group, approvers get
        a notification straight away and a reminder every <code>APPROVAL_REMINDER_MINUTES</code> until they decide.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Set <code>CRM_API_KEY</code> in Vercel and give the same key to the CRM.
        </li>
        <li>
          CRM calls <code>POST /api/integrations/crm/approvals</code> (sample below). Re-sending the same <code>quoteId</code> after
          a decision re-opens it as a revision.
        </li>
        <li>
          When someone approves / rejects / requests changes, we <code>POST</code> to <code>callbackUrl</code> (or{" "}
          <code>CRM_WEBHOOK_URL</code>) with <code>{`{ event, quoteId, status, note, decidedBy, decidedAt }`}</code>, signed in the{" "}
          <code>x-pongs-signature</code> header (HMAC-SHA256 of the body with <code>CRM_WEBHOOK_SECRET</code>).
        </li>
        <li>
          The CRM can also poll <code>GET /api/integrations/crm/approvals?quoteId=…</code>.
        </li>
      </ol>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">{sample}</pre>
    </div>
  );
}
