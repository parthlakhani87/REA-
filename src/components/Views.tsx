"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BellRing, LoaderCircle, MessageCircle } from "lucide-react";
import { api, formatTime, type Approval, type Me, type Notification, type Task } from "@/lib/client";
import { enablePush, type PushState } from "@/lib/push-client";
import { ApprovalCard, TaskCard } from "./Cards";
import { Modal } from "./ui";

function Header({ title, onBack, children }: { title: string; onBack: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 border-b bg-white px-3 py-3">
      <button className="btn-ghost p-1 md:hidden" onClick={onBack} aria-label="Back">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      {children}
    </header>
  );
}

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b bg-white px-3">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${value === v ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center p-8">
      <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );
}

export function TasksView({ me, onBack, onOpen }: { me: Me; onBack: () => void; onOpen: (channelId: number) => void }) {
  const [scope, setScope] = useState<"mine" | "created">("mine");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    setTasks(null);
    api<{ tasks: Task[] }>(`/api/tasks?scope=${scope}`).then((r) => setTasks(r.tasks));
  }, [scope]);

  const visible = tasks?.filter((t) => showDone || t.status !== "done") ?? [];
  return (
    <div className="flex h-full flex-col">
      <Header title="Tasks" onBack={onBack}>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
        </label>
      </Header>
      <Tabs value={scope} onChange={setScope} options={[["mine", "Assigned to me"], ["created", "Assigned by me"]]} />
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        {!tasks && <Loading />}
        {tasks && visible.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Nothing pending. 🎉</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((t) => (
            <div key={t.id} className="space-y-1">
              <TaskCard task={t} me={me} onChange={(u) => setTasks((p) => p!.map((x) => (x.id === u.id ? u : x)))} />
              <button className="flex items-center gap-1 text-xs text-brand-700" onClick={() => onOpen(t.channelId)}>
                <MessageCircle className="h-3.5 w-3.5" /> Open conversation
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ApprovalsView({ me, onBack, onOpen }: { me: Me; onBack: () => void; onOpen: (channelId: number) => void }) {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<Approval[] | null>(null);

  useEffect(() => {
    setItems(null);
    api<{ approvals: Approval[] }>(`/api/approvals${status === "pending" ? "?status=pending" : ""}`).then((r) => setItems(r.approvals));
  }, [status]);

  return (
    <div className="flex h-full flex-col">
      <Header title="Costing approvals" onBack={onBack} />
      <Tabs value={status} onChange={setStatus} options={[["pending", "Waiting"], ["all", "All"]]} />
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        {!items && <Loading />}
        {items && items.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No approvals here.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          {items?.map((a) => (
            <div key={a.id} className="space-y-1">
              <ApprovalCard approval={a} me={me} onChange={(u) => setItems((p) => p!.map((x) => (x.id === u.id ? u : x)))} />
              <div className="flex gap-3 text-xs text-slate-500">
                <span>Raised {formatTime(a.createdAt)}</span>
                <button className="flex items-center gap-1 text-brand-700" onClick={() => onOpen(a.channelId)}>
                  <MessageCircle className="h-3.5 w-3.5" /> Discuss in group
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotificationsView({
  onBack,
  onNavigate,
  onRead,
}: {
  onBack: () => void;
  onNavigate: (link: string) => void;
  onRead: () => void;
}) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const load = useCallback(() => api<{ notifications: Notification[] }>("/api/notifications").then((r) => setItems(r.notifications)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    await api("/api/notifications", { method: "POST", json: { all: true } });
    await load();
    onRead();
  }
  async function open(n: Notification) {
    if (!n.readAt) await api("/api/notifications", { method: "POST", json: { ids: [n.id] } });
    onRead();
    if (n.link) onNavigate(n.link);
    else load();
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Notifications" onBack={onBack}>
        <button className="btn-ghost text-xs" onClick={markAll}>
          Mark all read
        </button>
      </Header>
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {!items && <Loading />}
        {items && items.length === 0 && <p className="py-10 text-center text-sm text-slate-500">You&apos;re all caught up.</p>}
        <ul className="divide-y">
          {items?.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-white ${n.readAt ? "" : "bg-brand-50"}`}>
                <BellRing className={`mt-0.5 h-4 w-4 shrink-0 ${n.type.includes("reminder") || n.type.includes("not_attended") || n.type.includes("overdue") ? "text-red-500" : "text-brand-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.title}</div>
                  {n.body && <div className="text-sm text-slate-600">{n.body}</div>}
                  <div className="mt-0.5 text-xs text-slate-400">{formatTime(n.createdAt)}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ProfileDialog({
  me,
  push,
  vapidKey,
  onPush,
  onClose,
}: {
  me: Me;
  push: PushState;
  vapidKey: string | null;
  onPush: (p: PushState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ name: me.name, phone: me.phone ?? "", currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/me", {
        method: "PATCH",
        json: {
          name: form.name,
          phone: form.phone,
          ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
        },
      });
      setMsg("Saved. Reloading…");
      window.location.reload();
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Your profile" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Current password</label>
            <input className="input" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium">Notifications on this device</div>
          {push === "granted" && <p className="text-emerald-700">On — you&apos;ll get reminders even when the app is closed.</p>}
          {push === "denied" && <p className="text-red-600">Blocked. Allow notifications for this site in your browser settings.</p>}
          {push === "unsupported" && (
            <p className="text-slate-600">Not supported here. On iPhone, tap Share → “Add to Home Screen”, then open the app from there.</p>
          )}
          {push === "default" && vapidKey && (
            <button type="button" className="btn-primary mt-1 text-xs" onClick={async () => onPush(await enablePush(vapidKey))}>
              Turn on notifications
            </button>
          )}
          {!vapidKey && <p className="text-slate-500">Push notifications are not configured on the server yet.</p>}
        </div>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          Save
        </button>
      </form>
    </Modal>
  );
}
