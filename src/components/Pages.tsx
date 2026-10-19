"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  AtSign,
  BadgeCheck,
  Bookmark,
  BookmarkX,
  Check,
  FolderOpen,
  Keyboard,
  LayoutGrid,
  List,
  ListChecks,
  MapPin,
  Megaphone,
  MessageSquare,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import {
  api,
  clockTime,
  dayLabel,
  fileKind,
  fileSize,
  formatTime,
  relativeTime,
  type ChannelSummary,
  type DirectoryUser,
  type FileHit,
  type Message,
  type MessageHit,
  type Task,
  isOnlineNow,
} from "@/lib/client";
import { type PushState } from "@/lib/push-client";
import { DeviceSetupCard } from "./DeviceSetup";
import { applyTheme, currentTheme, usePref, type ThemeChoice } from "@/lib/prefs";
import { channelLabel, useApp } from "./app-context";
import { ShortcutsDialog } from "./CommandPalette";
import { FileIcon, RichText } from "./MessageBubble";
import { Avatar, Badge, ChannelIcon, DEPARTMENT_LABELS, EmptyState, ErrorState, Kbd, Motif, PageHeader, PresenceAvatar, PresenceText, Section, Skeleton, StatusPill, Tabs, highlight } from "./ui";

/* ---------- Shared helpers ---------- */

function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    if (!url) return;
    setError("");
    api<T>(url)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [url]);
  useEffect(load, [load]);
  return { data, error, reload: load, setData };
}

function hitChannel(h: Pick<MessageHit, "channelName" | "channelType" | "cityName">) {
  if (h.channelType === "dm") return h.channelName;
  const name = h.cityName ? h.channelName.replace(`${h.cityName} · `, "") : h.channelName;
  return h.cityName ? `${h.cityName} · ${name}` : name;
}

function MessageHitRow({ h, q, onOpen }: { h: MessageHit; q?: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
      <Avatar name={h.userName ?? "PONGS"} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-[12px] text-ink-3">
          <span className="text-[13px] font-semibold text-ink">{h.userName ?? "PONGS CRM"}</span>
          <span className="flex min-w-0 items-center gap-1 truncate">
            <ChannelIcon type={h.channelType} className="h-3 w-3 shrink-0" />
            {hitChannel(h)}
          </span>
          <span className="ml-auto shrink-0 tabular-nums">{relativeTime(h.createdAt)}</span>
        </div>
        <div className="line-clamp-3 text-[13.5px] leading-[1.5] whitespace-pre-wrap text-ink-2">{q ? highlight(h.body, q) : <RichText text={h.body} />}</div>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/* ---------- Home / My Inbox ---------- */

export function HomeView() {
  const { me, sync, go, push, setPush } = useApp();
  const tasks = useLoad<{ tasks: Task[] }>("/api/tasks?scope=mine");
  const mentions = useLoad<{ mentions: MessageHit[] }>("/api/mentions");
  const general = sync?.channels.find((c) => c.type === "general");
  const ann = useLoad<{ messages: Message[] }>(general ? `/api/channels/${general.id}/messages` : null);

  const unread = useMemo(() => (sync?.channels ?? []).filter((c) => c.unread > 0).sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")), [sync]);
  const recent = useMemo(
    () => (sync?.channels ?? []).filter((c) => c.lastMessageAt).sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")).slice(0, 6),
    [sync],
  );
  const openTasks = (tasks.data?.tasks ?? []).filter((t) => t.status !== "done");
  const overdue = openTasks.filter((t) => t.dueAt && new Date(t.dueAt) < new Date());
  const notAttended = openTasks.filter((t) => t.status === "open");
  const latestAnn = (ann.data?.messages ?? []).filter((m) => m.kind === "text" && m.body).slice(-1)[0];
  const totalUnread = unread.reduce((s, c) => s + c.unread, 0);
  const recentMentions = (mentions.data?.mentions ?? []).slice(0, 4);

  const stats: [string, number, () => void, boolean][] = [
    ["Unread messages", totalUnread, () => go({ kind: "chats" }), false],
    ["Mentions this week", (mentions.data?.mentions ?? []).filter((m) => Date.now() - new Date(m.createdAt).getTime() < 7 * 86400000).length, () => go({ kind: "mentions" }), false],
    ["Open action items", openTasks.length, () => go({ kind: "tasks" }), false],
    ["Overdue", overdue.length, () => go({ kind: "tasks" }), overdue.length > 0],
  ];
  if (me.canApprove || me.role === "admin") stats.splice(3, 0, ["Approvals waiting", sync?.pendingApprovals ?? 0, () => go({ kind: "approvals" }), false]);

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1">{new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className="font-display text-[22px] font-bold tracking-[-0.015em] md:text-[26px]">
              {greeting()}, {me.name.split(" ")[0]}
            </h1>
            <p className="text-[13.5px] text-ink-3">
              {totalUnread + openTasks.length + (sync?.pendingApprovals ?? 0) === 0
                ? "Nothing needs your attention right now."
                : "Here is what needs your attention, most urgent first."}
            </p>
          </div>
        </div>

        <div className="mb-6 empty:hidden">
          <DeviceSetupCard push={push} onPush={setPush} dismissible />
        </div>

        {/* Counters, not charts: each one is a shortcut to the work behind it. */}
        <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-5">
          {stats.map(([label, value, onClick, alert]) => (
            <button key={label} onClick={onClick} className="group -mr-px -mb-px border-r border-b border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2">
              <div className={`font-display text-[22px] font-bold tabular-nums ${alert ? "text-danger" : ""}`}>{sync ? value : "–"}</div>
              <div className="flex items-center gap-1 text-[12px] text-ink-3">
                {label}
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <Section
              title="Needs your attention"
              count={notAttended.length + overdue.length + (sync?.pendingApprovals ?? 0)}
              action={
                <button className="text-[12px] font-medium text-ink-3 hover:text-ink" onClick={() => go({ kind: "tasks" })}>
                  All action items
                </button>
              }
            >
              {!tasks.data && !tasks.error && <Skeleton rows={3} avatar={false} />}
              {tasks.error && <ErrorState message={tasks.error} onRetry={tasks.reload} />}
              {tasks.data && openTasks.length === 0 && !sync?.pendingApprovals && <EmptyState compact title="No pending actions" body="Action items assigned to you will appear here." />}
              <ul className="divide-y divide-line">
                {!!sync?.pendingApprovals && (
                  <li>
                    <button onClick={() => go({ kind: "approvals" })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warn-soft text-warn">
                        <BadgeCheck className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-[13.5px] font-medium">
                        {sync.pendingApprovals} costing approval{sync.pendingApprovals > 1 ? "s" : ""} waiting for your decision
                      </span>
                      <ArrowRight className="h-4 w-4 text-ink-4" />
                    </button>
                  </li>
                )}
                {[...overdue, ...openTasks.filter((t) => !overdue.includes(t))].slice(0, 6).map((t) => {
                  const late = overdue.includes(t);
                  return (
                    <li key={t.id}>
                      <button onClick={() => go({ kind: "channel", id: t.channelId })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${late ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2"}`}>
                          {late ? <TriangleAlert className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium">{t.title}</span>
                          <span className="text-[12px] text-ink-3">
                            From {t.createdByName}
                            {t.dueAt && <span className={late ? "font-medium text-danger" : ""}> · due {formatTime(t.dueAt)}</span>}
                          </span>
                        </span>
                        <StatusPill status={late ? "overdue" : t.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Unread conversations" count={unread.length}>
              {!sync && <Skeleton rows={3} />}
              {sync && unread.length === 0 && <EmptyState compact title="You're up to date" body="New messages in your channels and direct messages will appear here." />}
              <ul className="divide-y divide-line">
                {unread.slice(0, 8).map((c) => (
                  <ConversationRow key={c.id} c={c} onClick={() => go({ kind: "channel", id: c.id })} />
                ))}
              </ul>
            </Section>

            <Section
              title="Recent mentions"
              count={mentions.data?.mentions.length}
              action={
                <button className="text-[12px] font-medium text-ink-3 hover:text-ink" onClick={() => go({ kind: "mentions" })}>
                  All mentions
                </button>
              }
            >
              {!mentions.data && !mentions.error && <Skeleton rows={2} />}
              {mentions.error && <ErrorState message={mentions.error} onRetry={mentions.reload} />}
              {mentions.data && recentMentions.length === 0 && <EmptyState compact title="No mentions yet" body={`When someone writes @${me.name.split(" ")[0]} you will see it here.`} />}
              <div className="divide-y divide-line">
                {recentMentions.map((h) => (
                  <MessageHitRow key={h.id} h={h} onOpen={() => go({ kind: "channel", id: h.channelId, m: h.id })} />
                ))}
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section
              title="Latest announcement"
              action={
                <button className="text-[12px] font-medium text-ink-3 hover:text-ink" onClick={() => go({ kind: "announcements" })}>
                  View all
                </button>
              }
            >
              {!general && <EmptyState compact title="No announcement channel" />}
              {general && !ann.data && !ann.error && <Skeleton rows={1} />}
              {general && ann.data && !latestAnn && <EmptyState compact title="No announcements yet" />}
              {latestAnn && (
                <button onClick={() => go({ kind: "announcements" })} className="block w-full px-4 py-3 text-left hover:bg-surface-2">
                  {isImportant(latestAnn.body) && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wider text-danger uppercase">
                      Important
                    </span>
                  )}
                  <div className="text-[14px] font-semibold">{splitAnnouncement(latestAnn.body).title}</div>
                  <div className="mt-0.5 line-clamp-3 text-[13px] text-ink-3">{splitAnnouncement(latestAnn.body).body}</div>
                  <div className="mt-2 text-[11.5px] text-ink-4">
                    {latestAnn.userName} · {relativeTime(latestAnn.createdAt)}
                  </div>
                </button>
              )}
            </Section>

            <Section title="Recent conversations">
              {!sync && <Skeleton rows={3} />}
              <ul className="divide-y divide-line">
                {recent.map((c) => (
                  <ConversationRow key={c.id} c={c} compact onClick={() => go({ kind: "channel", id: c.id })} />
                ))}
              </ul>
              {sync && recent.length === 0 && <EmptyState compact title="No conversations yet" />}
            </Section>

            <div className="panel arch-grid flex items-center gap-3 p-4">
              <Keyboard className="h-4 w-4 shrink-0 text-ink-3" />
              <div className="flex-1 text-[12.5px] text-ink-2">
                Jump anywhere with <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>. Press <Kbd>?</Kbd> for all shortcuts.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationRow({ c, onClick, compact }: { c: ChannelSummary; onClick: () => void; compact?: boolean }) {
  const isDm = c.type === "dm";
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
        {isDm ? (
          <Avatar name={c.name} size={28} />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line text-ink-2">
            <ChannelIcon type={c.type} className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`truncate text-[13px] ${c.unread ? "font-semibold" : "font-medium"}`}>
              {isDm ? c.name : channelLabel(c)}
              {!isDm && c.cityName && <span className="font-normal text-ink-4"> · {c.cityName}</span>}
            </span>
            {c.lastMessageAt && <span className="ml-auto shrink-0 text-[11px] text-ink-4">{relativeTime(c.lastMessageAt)}</span>}
          </span>
          {!compact && <span className="block truncate text-[12.5px] text-ink-3">{c.lastMessagePreview}</span>}
        </span>
        {c.unread > 0 && <Badge count={c.unread} />}
      </button>
    </li>
  );
}

/* ---------- Mentions ---------- */

export function MentionsView() {
  const { go, me } = useApp();
  const { data, error, reload } = useLoad<{ mentions: MessageHit[] }>("/api/mentions");
  const groups = useMemo(() => {
    const map = new Map<string, MessageHit[]>();
    for (const h of data?.mentions ?? []) {
      const k = dayLabel(h.createdAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return [...map.entries()];
  }, [data]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Mentions" subtitle={`Messages that mention @${me.name.split(" ")[0]} or @everyone`} icon={<AtSign className="h-4 w-4" />} onBack={() => go({ kind: "home" })} />
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && !error && <Skeleton rows={6} />}
        {data && data.mentions.length === 0 && <EmptyState motif="light" title="No mentions yet" body="When a colleague mentions you in a channel or direct message, it will be collected here." />}
        <div className="mx-auto max-w-3xl space-y-5 p-3 md:p-6">
          {groups.map(([day, hits]) => (
            <section key={day}>
              <h2 className="eyebrow mb-2 px-1">{day}</h2>
              <div className="panel divide-y divide-line overflow-hidden">
                {hits.map((h) => (
                  <MessageHitRow key={h.id} h={h} onOpen={() => go({ kind: "channel", id: h.channelId, m: h.id })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Saved messages ---------- */

export function SavedView() {
  const { go, saved, toggleSaved } = useApp();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Saved messages" subtitle="Decisions and instructions you want to find again · kept on this device" icon={<Bookmark className="h-4 w-4" />} onBack={() => go({ kind: "home" })} />
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {saved.length === 0 && (
          <EmptyState
            motif="profile"
            title="Nothing saved yet"
            body="Hover any message and choose the bookmark to keep important decisions, measurements and instructions one click away."
          />
        )}
        <div className="mx-auto max-w-3xl p-3 md:p-6">
          {saved.length > 0 && (
            <ul className="panel divide-y divide-line overflow-hidden">
              {saved.map((s) => (
                <li key={s.id} className="group flex gap-3 px-4 py-3 hover:bg-surface-2">
                  <Avatar name={s.userName} size={32} />
                  <button className="min-w-0 flex-1 text-left" onClick={() => go({ kind: "channel", id: s.channelId, m: s.id })}>
                    <div className="flex items-baseline gap-2 text-[12px] text-ink-3">
                      <span className="text-[13px] font-semibold text-ink">{s.userName}</span>
                      <span className="truncate">{s.channelName}</span>
                      <span className="ml-auto shrink-0">{formatTime(s.createdAt)}</span>
                    </div>
                    <div className="line-clamp-4 text-[13.5px] whitespace-pre-wrap text-ink-2">{s.body || (s.hasAttachments ? "Attachment" : "")}</div>
                  </button>
                  <button
                    className="self-start rounded-md p-1.5 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 hover:text-ink focus:opacity-100"
                    onClick={() => toggleSaved(s)}
                    aria-label="Remove from saved"
                    title="Remove from saved"
                  >
                    <BookmarkX className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Team directory ---------- */

export function DirectoryView() {
  const { go, openDm, me } = useApp();
  const { data, error, reload } = useLoad<{ users: DirectoryUser[] }>("/api/users");
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [city, setCity] = useState("all");
  // Keep online status fresh while the directory is open.
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);
  const users = [...(data?.users ?? [])].sort((a, b) => Number(isOnlineNow(b.lastSeenAt)) - Number(isOnlineNow(a.lastSeenAt)) || a.name.localeCompare(b.name));
  const onlineNow = users.filter((u) => isOnlineNow(u.lastSeenAt)).length;
  const depts = [...new Set(users.map((u) => u.department).filter((x): x is string => !!x))].sort();
  const cities = [...new Set(users.map((u) => u.cityName).filter((x): x is string => !!x))].sort();
  const list = users.filter(
    (u) =>
      (dept === "all" || u.department === dept) &&
      (city === "all" || u.cityName === city) &&
      `${u.name} ${u.department ?? ""} ${u.cityName ?? ""} ${u.role}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Team directory" subtitle={data ? `${users.length} people across ${cities.length || 1} location${cities.length === 1 ? "" : "s"} · ${onlineNow} online now` : " "} icon={<Users className="h-4 w-4" />} onBack={() => go({ kind: "home" })} />
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5 md:px-6">
        <div className="relative min-w-[200px] flex-1 md:max-w-sm">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-ink-4" />
          <input className="input pl-9" placeholder="Search by name, department or city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FilterSelect value={dept} onChange={setDept} label="All departments" options={depts.map((d) => [d, DEPARTMENT_LABELS[d] ?? d])} />
        <FilterSelect value={city} onChange={setCity} label="All locations" options={cities.map((c) => [c, c])} />
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && !error && <Skeleton rows={8} />}
        {data && list.length === 0 && <EmptyState compact title="No one matches" body="Try another name or clear the filters." />}
        {list.length > 0 && (
          <div className="mx-auto max-w-6xl p-3 md:p-6">
            <div className="panel overflow-hidden">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_1fr_1fr_120px] gap-4 border-b border-line bg-surface-2 px-4 py-2 md:grid">
                {["Name", "Department & role", "Location", ""].map((h) => (
                  <span key={h} className="eyebrow text-[10.5px]">
                    {h}
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-line">
                {list.map((u) => (
                  <li key={u.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[minmax(0,1.4fr)_1fr_1fr_120px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <PresenceAvatar name={u.name} size={36} lastSeenAt={u.lastSeenAt} />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium">
                          {u.name} {u.id === me.id && <span className="text-[12px] font-normal text-ink-4">(you)</span>}
                        </div>
                        <PresenceText lastSeenAt={u.lastSeenAt} className="text-[11.5px]" />
                        <div className="truncate text-[12px] text-ink-3 md:hidden">
                          {[u.department ? DEPARTMENT_LABELS[u.department] : null, u.cityName].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    <div className="hidden min-w-0 md:block">
                      <div className="truncate text-[13px]">{u.department ? (DEPARTMENT_LABELS[u.department] ?? u.department) : "—"}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-ink-3 capitalize">
                        {u.role}
                        {u.canApprove && <span className="rounded border border-line px-1 text-[10.5px] font-medium normal-case">Approver</span>}
                      </div>
                    </div>
                    <div className="hidden items-center gap-1.5 text-[13px] text-ink-2 md:flex">
                      {u.cityName ? (
                        <>
                          <MapPin className="h-3.5 w-3.5 text-ink-4" /> {u.cityName}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="justify-self-end">
                      {u.id !== me.id && (
                        <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => openDm(u.id)}>
                          <MessageSquare className="h-3.5 w-3.5" /> Message
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 cursor-pointer rounded-lg border px-2.5 text-[13px] outline-none ${value === "all" ? "border-line bg-surface text-ink-2" : "border-graphite bg-graphite text-white dark:border-lime dark:bg-transparent dark:text-lime"}`}
    >
      <option value="all">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ---------- Shared files ---------- */

const FILE_FILTERS: [string, string][] = [
  ["all", "All files"],
  ["drawing", "Drawings"],
  ["pdf", "PDFs"],
  ["image", "Images"],
  ["document", "Documents"],
  ["video", "Video"],
];

export function FilesView() {
  const { go } = useApp();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("all");
  const [layout, setLayout] = usePref<"list" | "grid">("filesLayout", "list");
  const [preview, setPreview] = useState<FileHit | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, reload } = useLoad<{ files: FileHit[] }>(`/api/files${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`);
  const files = (data?.files ?? []).filter((f) => kind === "all" || fileKind(f.name, f.type) === kind);
  const counts = Object.fromEntries(FILE_FILTERS.map(([k]) => [k, (data?.files ?? []).filter((f) => k === "all" || fileKind(f.name, f.type) === k).length]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Shared files" subtitle="Drawings, PDFs, site photos and documents shared in your conversations" icon={<FolderOpen className="h-4 w-4" />} onBack={() => go({ kind: "home" })}>
        <div className="hidden rounded-lg border border-line p-0.5 sm:flex">
          {(["list", "grid"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`rounded-md p-1.5 ${layout === l ? "bg-surface-2 text-ink" : "text-ink-4 hover:text-ink"}`}
              aria-label={`${l} view`}
              aria-pressed={layout === l}
            >
              {l === "list" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5 md:px-6">
        <div className="relative min-w-[200px] flex-1 md:max-w-xs">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-ink-4" />
          <input className="input pl-9" placeholder="Search file names" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {FILE_FILTERS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                kind === k ? "border-graphite bg-graphite text-white dark:border-lime dark:bg-transparent dark:text-lime" : "border-line text-ink-2 hover:border-line-strong"
              }`}
            >
              {l} <span className="ml-0.5 tabular-nums opacity-60">{data ? counts[k] : ""}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        {error && <ErrorState message={error} onRetry={reload} />}
        {!data && !error && <Skeleton rows={6} />}
        {data && files.length === 0 && <EmptyState motif="profile" title={debounced || kind !== "all" ? "No files match" : "No files shared yet"} body="Files attached to messages in your channels appear here automatically." />}
        {files.length > 0 && layout === "list" && (
          <div className="mx-auto max-w-6xl p-3 md:p-6">
            <div className="panel overflow-hidden">
              <ul className="divide-y divide-line">
                {files.map((f) => (
                  <li key={`${f.messageId}-${f.url}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <FileThumb f={f} onClick={() => (f.type === "image" ? setPreview(f) : window.open(f.url, "_blank", "noopener"))} />
                    <div className="min-w-0 flex-1">
                      <a href={f.url} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-medium hover:underline">
                        {highlight(f.name, debounced)}
                      </a>
                      <div className="truncate text-[12px] text-ink-3">
                        {f.userName ?? "PONGS CRM"} in {hitChannel(f)} · {relativeTime(f.createdAt)}
                      </div>
                    </div>
                    <span className="hidden w-20 text-right text-[12px] text-ink-3 uppercase sm:block">{f.name.split(".").pop()}</span>
                    <span className="hidden w-16 text-right text-[12px] text-ink-3 tabular-nums sm:block">{fileSize(f.size)}</span>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => go({ kind: "channel", id: f.channelId, m: f.messageId })}>
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Discussion</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {files.length > 0 && layout === "grid" && (
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:p-6 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((f) => (
              <div key={`${f.messageId}-${f.url}`} className="panel group overflow-hidden">
                <button
                  className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-line bg-surface-2"
                  onClick={() => (f.type === "image" ? setPreview(f) : window.open(f.url, "_blank", "noopener"))}
                >
                  {f.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
                  ) : (
                    <span className="arch-grid flex h-full w-full flex-col items-center justify-center gap-1 text-ink-3">
                      <FileIcon name={f.name} type={f.type} className="h-7 w-7" />
                      <span className="text-[10.5px] font-semibold tracking-wider uppercase">{f.name.split(".").pop()}</span>
                    </span>
                  )}
                </button>
                <div className="px-3 py-2">
                  <div className="truncate text-[12.5px] font-medium">{f.name}</div>
                  <div className="truncate text-[11px] text-ink-3">
                    {hitChannel(f)} · {fileSize(f.size)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {preview && (
        <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-graphite/95" onClick={() => setPreview(null)}>
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{preview.name}</div>
              <div className="text-xs text-white/60">
                {preview.userName} in {hitChannel(preview)} · {formatTime(preview.createdAt)}
              </div>
            </div>
            <button className="btn px-2 py-1 text-white hover:bg-white/10" onClick={() => go({ kind: "channel", id: preview.channelId, m: preview.messageId })}>
              <MessageSquare className="h-4 w-4" /> Discussion
            </button>
            <button className="btn p-1 text-white hover:bg-white/10" onClick={() => setPreview(null)} aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function FileThumb({ f, onClick }: { f: FileHit; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2" aria-label={`Preview ${f.name}`}>
      {f.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-3">
          <FileIcon name={f.name} type={f.type} />
        </span>
      )}
    </button>
  );
}

/* ---------- Search ---------- */

type SearchResult = {
  messages: MessageHit[];
  people: { id: number; name: string; role: string; department: string | null; canApprove: boolean; cityName: string | null }[];
  files: FileHit[];
};

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const { go, openDm, sync, me } = useApp();
  const [q, setQ] = useState(initialQuery);
  const [tab, setTab] = useState<"all" | "messages" | "people" | "files" | "channels">("all");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      window.history.replaceState(null, "", `/app?view=search&q=${encodeURIComponent(term)}`);
      api<SearchResult>(`/api/search?q=${encodeURIComponent(term)}`)
        .then((r) => {
          setRes(r);
          setError("");
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const term = q.trim().toLowerCase();
  const channels = term.length >= 2 ? (sync?.channels ?? []).filter((c) => `${c.name} ${c.cityName ?? ""}`.toLowerCase().includes(term)) : [];
  const show = (k: typeof tab) => tab === "all" || tab === k;
  const nothing = res && !res.messages.length && !res.people.length && !res.files.length && !channels.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-surface px-4 pt-4 md:px-6">
        <div className="relative mx-auto max-w-4xl">
          <Search className="absolute top-3 left-3.5 h-5 w-5 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages, people, files and channels"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-10 pl-11 text-[15px] outline-none focus:border-ink-3 focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_12%,transparent)]"
            aria-label="Search"
          />
          {q && (
            <button className="absolute top-2.5 right-2.5 rounded-md p-1 text-ink-4 hover:bg-surface-2 hover:text-ink" onClick={() => setQ("")} aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mx-auto mt-2 max-w-4xl">
          <div className="-mx-4 md:-mx-6">
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                ["all", "All"],
                ["messages", "Messages", res?.messages.length],
                ["people", "People", res?.people.length],
                ["files", "Files", res?.files.length],
                ["channels", "Channels", term.length >= 2 ? channels.length : undefined],
              ]}
            />
          </div>
        </div>
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-4xl space-y-5 p-3 md:p-6">
          {term.length < 2 && (
            <EmptyState
              motif="grid"
              title="Search across PONGS CONNECT"
              body={
                <>
                  Find a measurement, a drawing revision or a colleague. Results are limited to conversations you belong to. Tip: press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> from anywhere.
                </>
              }
            />
          )}
          {error && <ErrorState message={error} />}
          {loading && !res && <Skeleton rows={5} />}
          {nothing && !loading && <EmptyState compact title={`No results for “${q.trim()}”`} body="Check the spelling, or try a shorter term such as a project name or customer." />}

          {res && show("channels") && channels.length > 0 && (
            <Section title="Channels" count={channels.length}>
              <ul className="divide-y divide-line">
                {channels.slice(0, tab === "all" ? 4 : 50).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => go({ kind: "channel", id: c.id })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                      {c.type === "dm" ? <Avatar name={c.name} size={28} /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-2"><ChannelIcon type={c.type} className="h-3.5 w-3.5" /></span>}
                      <span className="text-[13.5px] font-medium">{highlight(c.type === "dm" ? c.name : channelLabel(c), q)}</span>
                      <span className="text-[12px] text-ink-3">{c.type === "dm" ? "Direct message" : (c.cityName ?? "Company")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {res && show("people") && res.people.length > 0 && (
            <Section title="People" count={res.people.length}>
              <ul className="grid gap-px bg-line sm:grid-cols-2">
                {res.people.slice(0, tab === "all" ? 4 : 50).map((p) => (
                  <li key={p.id} className="bg-surface">
                    <button onClick={() => p.id !== me.id && openDm(p.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                      <Avatar name={p.name} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">{highlight(p.name, q)}</span>
                        <span className="block truncate text-[12px] text-ink-3 capitalize">
                          {[p.department ? DEPARTMENT_LABELS[p.department] : null, p.cityName, p.role !== "member" ? p.role : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {res && show("messages") && res.messages.length > 0 && (
            <Section title="Messages" count={res.messages.length}>
              <div className="divide-y divide-line">
                {res.messages.slice(0, tab === "all" ? 6 : 50).map((h) => (
                  <MessageHitRow key={h.id} h={h} q={q} onOpen={() => go({ kind: "channel", id: h.channelId, m: h.id })} />
                ))}
              </div>
              {tab === "all" && res.messages.length > 6 && (
                <button className="w-full border-t border-line px-4 py-2 text-[12.5px] font-medium text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => setTab("messages")}>
                  Show all {res.messages.length} messages
                </button>
              )}
            </Section>
          )}

          {res && show("files") && res.files.length > 0 && (
            <Section title="Files" count={res.files.length}>
              <ul className="divide-y divide-line">
                {res.files.slice(0, tab === "all" ? 5 : 50).map((f) => (
                  <li key={`${f.messageId}-${f.url}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <FileThumb f={f} onClick={() => window.open(f.url, "_blank", "noopener")} />
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{highlight(f.name, q)}</span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {f.userName} in {hitChannel(f)} · {relativeTime(f.createdAt)} · {fileSize(f.size)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Announcements ---------- */

function isImportant(body: string) {
  return /^\s*(\[important\]|\[urgent\]|!)/i.test(body);
}

function splitAnnouncement(body: string) {
  const clean = body.replace(/^\s*(\[important\]|\[urgent\]|!)\s*/i, "");
  const [first, ...rest] = clean.split("\n");
  return rest.length ? { title: first!.trim(), body: rest.join("\n").trim() } : { title: clean.length > 90 ? "" : clean, body: clean.length > 90 ? clean : "" };
}

export function AnnouncementsView() {
  const { me, sync, go, toast } = useApp();
  const channels = (sync?.channels ?? []).filter((c) => c.type === "general");
  const [channelId, setChannelId] = useState<number | null>(null);
  const active = channels.find((c) => c.id === channelId) ?? channels[0];
  const { data, error, reload } = useLoad<{ messages: Message[] }>(active ? `/api/channels/${active.id}/messages` : null);
  const [compose, setCompose] = useState({ title: "", body: "", important: false });
  const [busy, setBusy] = useState(false);
  const canPost = active?.isMember && (me.role === "admin" || me.role === "manager");

  const items = (data?.messages ?? []).filter((m) => m.kind === "text" && (m.body || m.attachments.length)).reverse();

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !compose.title.trim()) return;
    setBusy(true);
    try {
      const body = `${compose.important ? "[Important] " : ""}${compose.title.trim()}${compose.body.trim() ? `\n${compose.body.trim()}` : ""}`;
      await api(`/api/channels/${active.id}/messages`, { method: "POST", json: { body } });
      setCompose({ title: "", body: "", important: false });
      toast("Announcement published");
      reload();
    } catch (err) {
      toast((err as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Announcements" subtitle="Company-wide updates, operational instructions and leadership notes" icon={<Megaphone className="h-4 w-4" />} onBack={() => go({ kind: "home" })}>
        {active && (
          <button className="btn-secondary px-2.5 py-1.5 text-xs" onClick={() => go({ kind: "channel", id: active.id })}>
            <MessageSquare className="h-3.5 w-3.5" /> Open as conversation
          </button>
        )}
      </PageHeader>
      {channels.length > 1 && (
        <Tabs value={String(active?.id ?? "")} onChange={(v) => setChannelId(Number(v))} options={channels.map((c) => [String(c.id), c.name] as [string, string])} />
      )}
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-3xl space-y-4 p-3 md:p-6">
          {canPost && (
            <form onSubmit={post} className="panel overflow-hidden">
              <div className="border-b border-line px-4 py-2.5">
                <span className="eyebrow">New announcement</span>
              </div>
              <div className="space-y-2 p-4">
                <input className="input font-medium" placeholder="Headline" value={compose.title} onChange={(e) => setCompose({ ...compose, title: e.target.value })} maxLength={200} />
                <textarea className="input" rows={3} placeholder="Details, instructions or context (optional)" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                    <input type="checkbox" className="h-4 w-4 accent-[#C84F46]" checked={compose.important} onChange={(e) => setCompose({ ...compose, important: e.target.checked })} />
                    Mark as important
                  </label>
                  <button className="btn-primary ml-auto" disabled={busy || !compose.title.trim()}>
                    {busy ? "Publishing…" : "Publish"}
                  </button>
                </div>
              </div>
            </form>
          )}
          {!sync && <Skeleton rows={3} />}
          {sync && !active && <EmptyState motif="light" title="No announcement channel" body="An administrator can create the company-wide channel from Administration." />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {active && !data && !error && <Skeleton rows={3} />}
          {data && items.length === 0 && <EmptyState motif="light" title="No announcements yet" body="Company updates and instructions will be published here." />}
          {items.map((m) => {
            const important = isImportant(m.body);
            const { title, body } = splitAnnouncement(m.body);
            return (
              <article key={m.id} className={`panel relative overflow-hidden ${important ? "border-danger/40" : ""}`}>
                {important && <div className="absolute inset-y-0 left-0 w-[3px] bg-danger" />}
                <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                  <Avatar name={m.userName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{m.userName}</div>
                    <div className="text-[11.5px] text-ink-3">
                      {dayLabel(m.createdAt)} · {clockTime(m.createdAt)}
                    </div>
                  </div>
                  {important && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-[10.5px] font-semibold tracking-wider text-danger uppercase">
                      <TriangleAlert className="h-3 w-3" /> Important
                    </span>
                  )}
                </div>
                <div className="px-5 py-4">
                  {title && <h2 className="font-display text-[17px] font-bold tracking-[-0.01em]">{title}</h2>}
                  {body && <div className={`text-[14px] leading-[1.6] whitespace-pre-wrap text-ink-2 ${title ? "mt-1.5" : ""}`}><RichText text={body} /></div>}
                  {m.attachments.length > 0 && <div className="mt-3 text-[12px] text-ink-3">{m.attachments.length} attachment{m.attachments.length > 1 ? "s" : ""} — open as conversation to view</div>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */

export function SettingsView({ push, onPush }: { push: PushState; onPush: (p: PushState) => void }) {
  const { me, go } = useApp();
  const [form, setForm] = useState({ name: me.name, phone: me.phone ?? "", currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [theme, setTheme] = useState<ThemeChoice>("light");
  const [keys, setKeys] = useState(false);
  useEffect(() => setTheme(currentTheme()), []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/me", {
        method: "PATCH",
        json: {
          name: form.name,
          phone: form.phone,
          ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}),
        },
      });
      setMsg({ text: "Saved. Reloading…", ok: true });
      window.location.reload();
    } catch (err) {
      setMsg({ text: (err as Error).message, ok: false });
      setBusy(false);
    }
  }

  const themes: [ThemeChoice, string, React.ReactNode][] = [
    ["light", "Light", <Sun key="l" className="h-4 w-4" />],
    ["dark", "Dark", <Moon key="d" className="h-4 w-4" />],
    ["system", "Match device", <Monitor key="s" className="h-4 w-4" />],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Settings" icon={<Settings className="h-4 w-4" />} onBack={() => go({ kind: "home" })} />
      <div className="scroll-thin flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-3xl space-y-5 p-3 md:p-6">
          <SettingsBlock title="Profile" description="How colleagues see you across PONGS CONNECT.">
            <form onSubmit={save} className="space-y-3">
              <div className="flex items-center gap-3 pb-1">
                <Avatar name={form.name || me.name} size={48} />
                <div className="text-[13px] text-ink-3">
                  <div className="font-medium text-ink">{me.email}</div>
                  <span className="capitalize">{me.role}</span>
                  {me.department ? ` · ${DEPARTMENT_LABELS[me.department] ?? me.department}` : ""}
                  {me.canApprove ? " · Costing approver" : ""}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Current password</label>
                  <input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
                </div>
                <div>
                  <label className="label">New password</label>
                  <input className="input" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
                {msg && <span className={`text-[13px] ${msg.ok ? "text-positive" : "text-danger"}`}>{msg.text}</span>}
              </div>
            </form>
          </SettingsBlock>

          <SettingsBlock title="Appearance" description="Light is the primary theme. Dark is available for low-light sites and evenings.">
            <div className="grid grid-cols-3 gap-2">
              {themes.map(([v, l, icon]) => (
                <button
                  key={v}
                  onClick={() => {
                    applyTheme(v);
                    setTheme(v);
                  }}
                  aria-pressed={theme === v}
                  className={`relative flex flex-col items-start gap-3 rounded-xl border p-3 text-left transition-colors ${theme === v ? "border-graphite dark:border-lime" : "border-line hover:border-line-strong"}`}
                >
                  <ThemePreview kind={v} />
                  <span className="flex items-center gap-2 text-[13px] font-medium">
                    {icon} {l}
                  </span>
                  {theme === v && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-md bg-graphite text-lime">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </SettingsBlock>

          <SettingsBlock title="Phone app & notifications" description="Install PONGS CONNECT on this device and get reminders, approvals and messages even when it is closed.">
            <DeviceSetupCard push={push} onPush={onPush} />
          </SettingsBlock>

          <SettingsBlock title="Keyboard" description="Move through conversations without leaving the keyboard.">
            <button className="btn-secondary" onClick={() => setKeys(true)}>
              <Keyboard className="h-4 w-4" /> View keyboard shortcuts
            </button>
          </SettingsBlock>

          <div className="flex items-center gap-4 px-1 pt-2 pb-6 text-[11.5px] text-ink-4">
            <Motif kind="profile" className="h-10 w-16" />
            <span>
              PONGS CONNECT · Precision in every detail. Interface colours are a proposed software palette, not official corporate brand colours.
            </span>
          </div>
        </div>
      </div>
      {keys && <ShortcutsDialog onClose={() => setKeys(false)} />}
    </div>
  );
}

function SettingsBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="panel grid gap-4 p-5 md:grid-cols-[200px_1fr]">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ThemePreview({ kind }: { kind: ThemeChoice }) {
  const light = { bg: "#F5F6F4", nav: "#17232E", line: "#D5DEE4", card: "#FFFFFF" };
  const dark = { bg: "#0F171E", nav: "#0B1218", line: "#2A3A47", card: "#16212B" };
  const half = (c: typeof light, x: number, w: number) => (
    <g>
      <rect x={x} y="0" width={w} height="44" fill={c.bg} />
      <rect x={x} y="0" width={w} height="7" fill={c.nav} />
      <rect x={x + 6} y="13" width={w - 12} height="6" rx="1.5" fill={c.card} stroke={c.line} strokeWidth="0.8" />
      <rect x={x + 6} y="23" width={w - 20} height="6" rx="1.5" fill={c.card} stroke={c.line} strokeWidth="0.8" />
      <rect x={x + 6} y="33" width="10" height="3" rx="1" fill="#B6E65B" />
    </g>
  );
  return (
    <svg viewBox="0 0 80 44" className="h-11 w-20 overflow-hidden rounded-md border border-line" aria-hidden>
      {kind === "light" && half(light, 0, 80)}
      {kind === "dark" && half(dark, 0, 80)}
      {kind === "system" && (
        <>
          {half(light, 0, 40)}
          {half(dark, 40, 40)}
        </>
      )}
    </svg>
  );
}
