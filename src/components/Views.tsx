"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Bell, BellRing, ChevronRight, ListChecks, MessageSquare, TriangleAlert } from "lucide-react";
import { api, formatTime, relativeTime, type Approval, type Me, type Notification, type Task } from "@/lib/client";
import { channelLabel, useApp } from "./app-context";
import { ApprovalCard, TaskCard } from "./Cards";
import { Avatar, EmptyState, ErrorState, PageHeader, Skeleton, StatusPill, Tabs } from "./ui";

function useChannelName() {
  const { sync } = useApp();
  return (id: number) => {
    const c = sync?.channels.find((x) => x.id === id);
    if (!c) return "Conversation";
    return c.type === "dm" ? c.name : `${c.cityName ? `${c.cityName} · ` : ""}${channelLabel(c)}`;
  };
}

type TaskFilter = "mine" | "created";

export function TasksView({ me, onBack, onOpen }: { me: Me; onBack: () => void; onOpen: (channelId: number) => void }) {
  const [scope, setScope] = useState<TaskFilter>("mine");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"active" | "overdue" | "done">("active");
  const [open, setOpen] = useState<number | null>(null);
  const channelName = useChannelName();

  const load = useCallback(() => {
    setTasks(null);
    setError("");
    api<{ tasks: Task[] }>(`/api/tasks?scope=${scope}`)
      .then((r) => setTasks(r.tasks))
      .catch((e: Error) => setError(e.message));
  }, [scope]);
  useEffect(load, [load]);

  const isOverdue = (t: Task) => !!t.dueAt && t.status !== "done" && new Date(t.dueAt) < new Date();
  const counts = {
    active: tasks?.filter((t) => t.status !== "done").length ?? 0,
    overdue: tasks?.filter(isOverdue).length ?? 0,
    done: tasks?.filter((t) => t.status === "done").length ?? 0,
  };
  const visible =
    tasks?.filter((t) => (status === "done" ? t.status === "done" : status === "overdue" ? isOverdue(t) : t.status !== "done")) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Action items" subtitle="Actions agreed in conversations, with owners and due dates" icon={<ListChecks className="h-4 w-4" />} onBack={onBack}>
        <div className="flex rounded-lg border border-line p-0.5 text-[12.5px]">
          {(
            [
              ["mine", "Assigned to me", "Mine"],
              ["created", "Assigned by me", "By me"],
            ] as const
          ).map(([v, l, short]) => (
            <button
              key={v}
              onClick={() => setScope(v)}
              className={`rounded-md px-2.5 py-1 font-medium ${scope === v ? "bg-graphite text-white dark:bg-surface-3 dark:text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              <span className="hidden sm:inline">{l}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>
      </PageHeader>
      <Tabs
        value={status}
        onChange={setStatus}
        options={[
          ["active", "Open", counts.active],
          ["overdue", "Overdue", counts.overdue],
          ["done", "Completed", counts.done],
        ]}
      />
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={load} />}
        {!tasks && !error && <Skeleton rows={6} avatar={false} />}
        {tasks && visible.length === 0 && (
          <EmptyState
            motif="profile"
            title={status === "done" ? "Nothing completed yet" : status === "overdue" ? "Nothing overdue" : "You're clear"}
            body={status === "active" ? "Action items created from messages will appear here with their owner and due date." : undefined}
          />
        )}
        {visible.length > 0 && (
          <div className="mx-auto max-w-5xl p-3 md:p-6">
            <div className="panel overflow-hidden">
              <div className="hidden grid-cols-[1fr_160px_130px_120px_24px] gap-4 border-b border-line bg-surface-2 px-4 py-2 md:grid">
                {["Action", "Owner", "Due", "Status", ""].map((h) => (
                  <span key={h} className="eyebrow text-[10.5px]">
                    {h}
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-line">
                {visible.map((t) => {
                  const overdue = isOverdue(t);
                  const expanded = open === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() => setOpen(expanded ? null : t.id)}
                        aria-expanded={expanded}
                        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 md:grid-cols-[1fr_160px_130px_120px_24px]"
                      >
                        <span className="min-w-0">
                          <span className={`block truncate text-[13.5px] font-medium ${t.status === "done" ? "text-ink-3 line-through" : ""}`}>{t.title}</span>
                          <span className="flex items-center gap-1 truncate text-[12px] text-ink-3">
                            <MessageSquare className="h-3 w-3 shrink-0" /> {channelName(t.channelId)}
                          </span>
                        </span>
                        <span className="hidden items-center gap-2 text-[12.5px] md:flex">
                          <Avatar name={t.assigneeName} size={20} />
                          <span className="truncate">{t.assigneeId === me.id ? "You" : t.assigneeName}</span>
                        </span>
                        <span className={`hidden text-[12.5px] tabular-nums md:block ${overdue ? "font-medium text-danger" : "text-ink-2"}`}>
                          {t.dueAt ? formatTime(t.dueAt) : "—"}
                        </span>
                        <span className="justify-self-end md:justify-self-start">
                          <StatusPill status={overdue ? "overdue" : t.status} />
                        </span>
                        <ChevronRight className={`hidden h-4 w-4 text-ink-4 transition-transform md:block ${expanded ? "rotate-90" : ""}`} />
                        <span className="col-span-2 flex gap-3 text-[12px] text-ink-3 md:hidden">
                          <span>{t.assigneeId === me.id ? "You" : t.assigneeName}</span>
                          {t.dueAt && <span className={overdue ? "text-danger" : ""}>Due {formatTime(t.dueAt)}</span>}
                        </span>
                      </button>
                      {expanded && (
                        <div className="flex animate-fade-in flex-col gap-2 border-t border-line bg-surface-2 px-4 py-3">
                          <TaskCard task={t} me={me} onChange={(u) => setTasks((p) => p!.map((x) => (x.id === u.id ? u : x)))} />
                          <button className="btn-ghost self-start px-2 py-1 text-xs" onClick={() => onOpen(t.channelId)}>
                            <MessageSquare className="h-3.5 w-3.5" /> Open linked discussion
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ApprovalsView({ me, onBack, onOpen }: { me: Me; onBack: () => void; onOpen: (channelId: number) => void }) {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<Approval[] | null>(null);
  const [error, setError] = useState("");
  const channelName = useChannelName();

  const load = useCallback(() => {
    setItems(null);
    setError("");
    api<{ approvals: Approval[] }>(`/api/approvals${status === "pending" ? "?status=pending" : ""}`)
      .then((r) => setItems(r.approvals))
      .catch((e: Error) => setError(e.message));
  }, [status]);
  useEffect(load, [load]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Costing approvals" subtitle="Quotations waiting for a decision, from the app and PONGS CRM" icon={<BadgeCheck className="h-4 w-4" />} onBack={onBack} />
      <Tabs value={status} onChange={setStatus} options={[["pending", "Waiting"], ["all", "All"]]} />
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={load} />}
        {!items && !error && <Skeleton rows={4} avatar={false} />}
        {items && items.length === 0 && <EmptyState motif="profile" title="No approvals waiting" body="Costing requests will appear here when estimation sends them for a decision." />}
        <div className="mx-auto grid max-w-5xl gap-4 p-3 md:p-6 lg:grid-cols-2">
          {items?.map((a) => (
            <div key={a.id} className="space-y-1.5">
              <ApprovalCard approval={a} me={me} onChange={(u) => setItems((p) => p!.map((x) => (x.id === u.id ? u : x)))} />
              <div className="flex items-center gap-3 px-1 text-[12px] text-ink-3">
                <span>Raised {relativeTime(a.createdAt)}</span>
                <button className="flex items-center gap-1 font-medium text-ink-2 hover:text-ink" onClick={() => onOpen(a.channelId)}>
                  <MessageSquare className="h-3.5 w-3.5" /> {channelName(a.channelId)}
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
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      api<{ notifications: Notification[] }>("/api/notifications")
        .then((r) => setItems(r.notifications))
        .catch((e: Error) => setError(e.message)),
    [],
  );
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

  const urgent = (n: Notification) => /reminder|not_attended|overdue|escalation/.test(n.type);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Notifications" icon={<Bell className="h-4 w-4" />} onBack={onBack}>
        <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={markAll}>
          Mark all read
        </button>
      </PageHeader>
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={load} />}
        {!items && !error && <Skeleton rows={6} />}
        {items && items.length === 0 && <EmptyState motif="light" title="You're all caught up" body="Reminders, approvals and replies will appear here." />}
        {items && items.length > 0 && (
          <div className="mx-auto max-w-3xl p-3 md:p-6">
            <ul className="panel divide-y divide-line overflow-hidden">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={`relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${n.readAt ? "" : "bg-accent-soft/40"}`}>
                    {!n.readAt && <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-lime" />}
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${urgent(n) ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2"}`}>
                      {urgent(n) ? <TriangleAlert className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[13.5px] ${n.readAt ? "text-ink-2" : "font-semibold"}`}>{n.title}</div>
                      {n.body && <div className="line-clamp-2 text-[13px] text-ink-3">{n.body}</div>}
                    </div>
                    <span className="shrink-0 text-[11.5px] text-ink-4">{relativeTime(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
