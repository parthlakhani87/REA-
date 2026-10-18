"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { api, type Approval, type DirectoryUser, type Task } from "@/lib/client";
import { Avatar, Modal } from "./ui";

type Member = { id: number; name: string; role: string; department: string | null; canApprove: boolean };

function useMembers(channelId: number) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    api<{ members: Member[] }>(`/api/channels/${channelId}/members`).then((r) => setMembers(r.members)).catch(() => {});
  }, [channelId]);
  return members;
}

const REMINDER_CHOICES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
  { label: "1 day", value: 1440 },
];

export function NewTaskDialog({
  channelId,
  onClose,
  onCreated,
  initial,
}: {
  channelId: number;
  onClose: () => void;
  onCreated: (t: Task) => void;
  initial?: { title: string; description: string };
}) {
  const members = useMembers(channelId);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    assigneeId: "",
    dueAt: "",
    ack: 30,
    progress: 240,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        json: {
          channelId,
          title: form.title,
          description: form.description,
          assigneeId: Number(form.assigneeId),
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          ackReminderMinutes: form.ack,
          progressReminderMinutes: form.progress,
        },
      });
      onCreated(r.task);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Create action item from message" : "New action item"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Action</label>
          <input className="input" required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Dispatch order #4521 to site" />
        </div>
        <div>
          <label className="label">Details</label>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input" required value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Choose a group member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due (optional)</label>
          <input className="input" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Remind if not attended every</label>
            <select className="input" value={form.ack} onChange={(e) => setForm({ ...form, ack: Number(e.target.value) })}>
              {REMINDER_CHOICES.filter((c) => c.value <= 240).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Then remind to complete every</label>
            <select className="input" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}>
              {REMINDER_CHOICES.filter((c) => c.value >= 30).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create action item"}
        </button>
      </form>
    </Modal>
  );
}

type Line = { item: string; qty: string; cost: string };

export function NewApprovalDialog({
  channelId,
  onClose,
  onCreated,
}: {
  channelId: number;
  onClose: () => void;
  onCreated: (a: Approval) => void;
}) {
  const members = useMembers(channelId);
  const approvers = members.filter((m) => m.canApprove);
  const [form, setForm] = useState({ title: "", customerName: "", amount: "", currency: "INR", notes: "", approverId: "" });
  const [lines, setLines] = useState<Line[]>([{ item: "", qty: "1", cost: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cost = lines.reduce((s, l) => s + (Number(l.cost) || 0) * (Number(l.qty) || 1), 0);
  const amount = Number(form.amount) || 0;
  const margin = amount ? ((amount - cost) / amount) * 100 : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const costBreakdown = lines
        .filter((l) => l.item.trim())
        .map((l) => ({ item: l.item.trim(), qty: Number(l.qty) || 1, cost: Number(l.cost) || 0 }));
      const r = await api<{ approval: Approval }>("/api/approvals", {
        method: "POST",
        json: {
          channelId,
          title: form.title,
          customerName: form.customerName || undefined,
          amount: form.amount ? amount : undefined,
          cost: costBreakdown.length ? cost : undefined,
          currency: form.currency,
          notes: form.notes,
          costBreakdown,
          approverId: form.approverId ? Number(form.approverId) : undefined,
        },
      });
      onCreated(r.approval);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Request costing approval" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Quotation title</label>
            <input className="input" required autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Warehouse racking — Phase 2" />
          </div>
          <div>
            <label className="label">Customer</label>
            <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div>
              <label className="label">Quoted amount</label>
              <input className="input" type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Cost breakdown</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_7rem_2rem] gap-2">
                <input className="input" placeholder="Item" value={l.item} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} />
                <input className="input" type="number" min="0" step="any" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                <input className="input" type="number" min="0" step="any" placeholder="Unit cost" value={l.cost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))} />
                <button type="button" className="btn-ghost p-1" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-1 text-xs" onClick={() => setLines([...lines, { item: "", qty: "1", cost: "" }])}>
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
          <div className="mt-1 flex gap-4 text-sm">
            <span>
              Total cost: <b>{cost.toLocaleString("en-IN")}</b>
            </span>
            {margin !== null && (
              <span className={margin < 10 ? "text-danger" : "text-positive"}>
                Margin: <b>{margin.toFixed(1)}%</b>
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="label">Notes for the approver</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div>
          <label className="label">Approver</label>
          <select className="input" value={form.approverId} onChange={(e) => setForm({ ...form, approverId: e.target.value })}>
            <option value="">Any approver in this group</option>
            {approvers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Sending…" : "Send for approval"}
        </button>
      </form>
    </Modal>
  );
}

export function NewChatDialog({ meId, onClose, onOpen }: { meId: number; onClose: () => void; onOpen: (channelId: number) => void }) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api<{ users: DirectoryUser[] }>("/api/users").then((r) => setUsers(r.users)).catch((e) => setError(e.message));
  }, []);
  const filtered = useMemo(
    () =>
      users.filter(
        (u) => u.id !== meId && `${u.name} ${u.cityName ?? ""} ${u.department ?? ""}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [users, q, meId],
  );

  async function start(userId: number) {
    try {
      const r = await api<{ channelId: number }>("/api/dm", { method: "POST", json: { userId } });
      onOpen(r.channelId);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal title="New direct message" onClose={onClose}>
      <div className="relative mb-3">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
        <input className="input pl-9" autoFocus placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="max-h-96 divide-y divide-line overflow-y-auto">
        {filtered.map((u) => (
          <button key={u.id} onClick={() => start(u.id)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-2 rounded-lg">
            <Avatar name={u.name} />
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-slate-500 capitalize">
                {[u.cityName, u.department, u.role !== "member" ? u.role : null].filter(Boolean).join(" · ")}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No one found</p>}
      </div>
    </Modal>
  );
}

export function MembersDialog({ channelId, onClose, onMessage }: { channelId: number; onClose: () => void; onMessage: (userId: number) => void }) {
  const members = useMembers(channelId);
  return (
    <Modal title={`Members (${members.length})`} onClose={onClose}>
      <div className="max-h-96 divide-y divide-line overflow-y-auto">
        {members.map((m) => (
          <button key={m.id} onClick={() => onMessage(m.id)} className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-2 rounded-lg">
            <Avatar name={m.name} />
            <div className="flex-1">
              <div className="font-medium">{m.name}</div>
              <div className="text-xs text-slate-500 capitalize">
                {[m.role !== "member" ? m.role : null, m.department, m.canApprove ? "approver" : null].filter(Boolean).join(" · ")}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
