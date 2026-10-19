"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  ArrowDown,
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Bookmark,
  FolderOpen,
  ListChecks,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
  PanelRight,
  Paperclip,
  Search,
  Plus,
  SendHorizontal,
  SquareCheck,
  Users,
  X,
} from "lucide-react";
import type { Attachment } from "@/db/schema";
import { api, dayLabel, fileSize, isOnlineNow, lastSeenLabel, relativeTime, type Approval, type ChannelSummary, type FileHit, type Message, type MessageHit, type Task } from "@/lib/client";
import { usePref } from "@/lib/prefs";
import { channelLabel, useApp } from "./app-context";
import { MembersDialog, NewApprovalDialog, NewTaskDialog } from "./Dialogs";
import { FileIcon, MessageBubble } from "./MessageBubble";
import { Avatar, ChannelIcon, DEPARTMENT_LABELS, EmptyState, ErrorState, Kbd, PresenceAvatar, PresenceText, Skeleton, StatusPill, highlight } from "./ui";

type Page = { messages: Message[]; tasks: Task[]; approvals: Approval[]; serverTime: string };
type Hit = MessageHit;
type PendingUpload = { id: string; file: File; preview?: string; progress: number; result?: Attachment; error?: string };
type Member = { id: number; name: string; role: string; department: string | null; canApprove: boolean; lastSeenAt: string | null };

const POLL_MS = 3000;
const GROUP_GAP_MS = 5 * 60 * 1000;

function kindOf(file: File): Attachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function ChatView({ channel, focusId, onBack }: { channel: ChannelSummary; focusId?: number; onBack: () => void }) {
  const { me, openDm, refresh, isSaved, toggleSaved, go } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Record<number, Task>>({});
  const [approvals, setApprovals] = useState<Record<number, Approval>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<null | "task" | "approval" | "members">(null);
  const [taskSeed, setTaskSeed] = useState<{ title: string; description: string } | undefined>();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [panelPref, setPanelPref] = usePref<boolean>("panel", true);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [belowCount, setBelowCount] = useState(0);
  const [initialUnread] = useState(channel.unread);
  // Message the history is opened at (search result / notification link). Changing it reloads around that message.
  const [anchor, setAnchor] = useState<{ id: number } | undefined>(focusId ? { id: focusId } : undefined);
  const [searching, setSearching] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const cursor = useRef<{ lastId: number; since: string | null }>({ lastId: 0, since: null });
  const readUpTo = useRef(0);
  const firstScrollDone = useRef(false);

  const isDm = channel.type === "dm";
  const onRead = refresh;

  const mergeCards = useCallback((page: Pick<Page, "tasks" | "approvals">) => {
    if (page.tasks.length) setTasks((prev) => ({ ...prev, ...Object.fromEntries(page.tasks.map((t) => [t.id, t])) }));
    if (page.approvals.length) setApprovals((prev) => ({ ...prev, ...Object.fromEntries(page.approvals.map((a) => [a.id, a])) }));
  }, []);

  const markRead = useCallback(() => {
    const last = cursor.current.lastId;
    if (last > readUpTo.current && document.visibilityState === "visible") {
      readUpTo.current = last;
      api(`/api/channels/${channel.id}/read`, { method: "POST", json: { messageId: last } })
        .then(onRead)
        .catch(() => {});
    }
  }, [channel.id, onRead]);

  const appendMessages = useCallback((incoming: Message[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
    });
    cursor.current.lastId = Math.max(cursor.current.lastId, ...incoming.map((m) => m.id));
    if (!stickToBottom.current) setBelowCount((n) => n + incoming.length);
  }, []);

  // Members (and their online status) refresh every 30 seconds.
  useEffect(() => {
    const load = () =>
      api<{ members: Member[] }>(`/api/channels/${channel.id}/members`)
        .then((r) => setMembers(r.members))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [channel.id]);

  // Initial load + polling for this channel.
  useEffect(() => {
    let stopped = false;
    cursor.current = { lastId: 0, since: null };
    readUpTo.current = 0;
    stickToBottom.current = true;
    firstScrollDone.current = false;
    setMessages([]);
    setTasks({});
    setApprovals({});
    setReplyTo(null);
    setLoading(true);
    setHasMore(true);

    async function poll() {
      try {
        const qs = new URLSearchParams();
        const opening = !cursor.current.lastId && anchor;
        if (opening) qs.set("around", String(anchor.id));
        if (cursor.current.lastId) qs.set("after", String(cursor.current.lastId));
        if (cursor.current.since) qs.set("since", cursor.current.since);
        const page = await api<Page>(`/api/channels/${channel.id}/messages?${qs}`);
        if (stopped) return;
        if (!cursor.current.since && !opening && page.messages.length < 50) setHasMore(false);
        appendMessages(page.messages);
        mergeCards(page);
        cursor.current.since = page.serverTime;
        setError("");
        setLoading(false);
        markRead();
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && (poll(), markRead());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [channel.id, anchor, appendMessages, mergeCards, markRead]);

  // Toggle the details panel with Ctrl/Cmd + "."
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setPanelPref(!panelPref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelPref, setPanelPref]);

  // Index of the first unread message (from someone else) when the channel was opened.
  const unreadFrom = useMemo(() => {
    if (!initialUnread || loading) return -1;
    let n = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.userId !== me.id) n++;
      if (n === initialUnread) return i;
    }
    return -1;
  }, [initialUnread, loading, messages, me.id]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || loading) return;
    if (!firstScrollDone.current) {
      firstScrollDone.current = true;
      const focus = anchor ? document.getElementById(`m-${anchor.id}`) : null;
      if (focus) {
        el.scrollTop = Math.max(0, focus.offsetTop - el.clientHeight / 3);
        focus.animate([{ background: "var(--accent-soft)" }, { background: "transparent" }], { duration: 2000 });
        stickToBottom.current = false;
        return;
      }
      const marker = el.querySelector("[data-unread-marker]") as HTMLElement | null;
      if (marker && marker.offsetTop < el.scrollHeight - el.clientHeight) {
        el.scrollTop = Math.max(0, marker.offsetTop - 48);
        stickToBottom.current = false;
        return;
      }
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, tasks, approvals, loading, anchor]);

  // Scrolls to a message, loading the history around it first if it isn't on screen yet.
  const jumpTo = useCallback((id: number) => {
    const el = document.getElementById(`m-${id}`);
    if (el) {
      stickToBottom.current = false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate([{ background: "var(--accent-soft)" }, { background: "transparent" }], { duration: 2000 });
    } else {
      setAnchor({ id });
    }
  }, []);

  // A new search result / notification link for this same conversation (the view stays mounted).
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (focusId) jumpTo(focusId);
  }, [focusId, jumpTo]);

  async function loadOlder() {
    const first = messages[0];
    if (!first || !hasMore) return;
    const el = scroller.current!;
    const prevHeight = el.scrollHeight;
    const page = await api<Page>(`/api/channels/${channel.id}/messages?before=${first.id}`);
    if (page.messages.length < 50) setHasMore(false);
    mergeCards(page);
    setMessages((prev) => [...page.messages, ...prev]);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  function onScroll() {
    const el = scroller.current!;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickToBottom.current && belowCount) setBelowCount(0);
    if (el.scrollTop < 40 && hasMore && !loading) loadOlder();
  }

  function jumpToBottom() {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setBelowCount(0);
  }

  const title = isDm ? channel.name : channelLabel(channel);
  const onlineCount = members.filter((m) => m.id !== me.id && isOnlineNow(m.lastSeenAt)).length;
  const subtitle = isDm
    ? lastSeenLabel(channel.dmLastSeenAt)
    : channel.type === "general"
      ? `Company-wide · ${members.length || "–"} members`
      : `${channel.cityName ?? ""} · ${DEPARTMENT_LABELS[channel.type] ?? "Channel"} department · ${members.length || "–"} members`;

  const saveMessage = (m: Message) =>
    toggleSaved({
      id: m.id,
      channelId: channel.id,
      channelName: title,
      userName: m.userName,
      body: m.body,
      createdAt: m.createdAt,
      hasAttachments: m.attachments.length > 0,
    });

  const channelTasks = Object.values(tasks).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || b.id - a.id);
  const channelApprovals = Object.values(approvals).sort((a, b) => Number(a.status !== "pending") - Number(b.status !== "pending") || b.id - a.id);

  const panel = (
    <ContextPanel
      channel={channel}
      title={title}
      members={members}
      tasks={channelTasks}
      approvals={channelApprovals}
      onClose={() => (mobilePanel ? setMobilePanel(false) : setPanelPref(false))}
      onMembers={() => setDialog("members")}
      onDm={(uid) => uid !== me.id && openDm(uid)}
      onJump={(id) => {
        setMobilePanel(false);
        const el = document.getElementById(`m-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.animate([{ background: "var(--accent-soft)" }, { background: "transparent" }], { duration: 1600 });
        }
      }}
      onAllFiles={() => go({ kind: "files" })}
    />
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 md:px-6">
          <button className="btn-ghost -ml-1 p-1.5 md:hidden" onClick={onBack} aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isDm ? (
            <PresenceAvatar name={channel.name} size={32} lastSeenAt={channel.dmLastSeenAt} />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-2">
              <ChannelIcon type={channel.type} className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-[15px] font-bold">{title}</h1>
              {!channel.isMember && <span className="rounded border border-line px-1.5 text-[10.5px] font-medium text-ink-3">Viewing as admin</span>}
            </div>
            <div className="truncate text-[12px] text-ink-3">
              {isDm ? <PresenceText lastSeenAt={channel.dmLastSeenAt} /> : subtitle}
              {!isDm && onlineCount > 0 && <span className="text-positive"> · {onlineCount} online</span>}
            </div>
          </div>
          {!isDm && members.length > 0 && (
            <button className="hidden items-center -space-x-1.5 sm:flex" onClick={() => setDialog("members")} aria-label="Members" title="Members">
              {members.slice(0, 4).map((m) => (
                <Avatar key={m.id} name={m.name} size={22} ring />
              ))}
              {members.length > 4 && (
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-surface-3 px-1 text-[10px] font-medium text-ink-2 ring-2 ring-surface">
                  +{members.length - 4}
                </span>
              )}
            </button>
          )}
          <button
            className={`btn-ghost p-2 ${searching ? "bg-surface-2 text-ink" : ""}`}
            onClick={() => setSearching(!searching)}
            aria-label="Search in this conversation"
            aria-pressed={searching}
            title="Search in this conversation"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button
            className={`btn-ghost hidden p-2 lg:inline-flex ${panelPref ? "bg-surface-2 text-ink" : ""}`}
            onClick={() => setPanelPref(!panelPref)}
            aria-label="Toggle details panel"
            aria-pressed={panelPref}
            title="Details (Ctrl + .)"
          >
            <PanelRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setMobilePanel(true)} aria-label="Details">
            <PanelRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </header>

        {searching && <ChatSearch channelId={channel.id} onJump={jumpTo} onClose={() => setSearching(false)} />}

        <div className="relative min-h-0 flex-1">
          <div ref={scroller} onScroll={onScroll} className="scroll-thin absolute inset-0 overflow-y-auto pt-2 pb-4">
            {loading && <Skeleton rows={6} />}
            {!loading && hasMore && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <LoaderCircle className="h-4 w-4 animate-spin text-ink-4" />
              </div>
            )}
            {!loading && !hasMore && messages.length > 0 && (
              <div className="px-4 pt-6 pb-2 md:px-6">
                <div className="font-display text-[18px] font-bold">{isDm ? channel.name : title}</div>
                <p className="text-[13px] text-ink-3">
                  {isDm ? `This is the beginning of your conversation with ${channel.name}.` : `This is the beginning of ${title}.`}
                </p>
              </div>
            )}
            {!loading && messages.length === 0 && !error && (
              <EmptyState
                motif={isDm ? "light" : "membrane"}
                title={isDm ? `Start a conversation with ${channel.name}` : `Welcome to ${title}`}
                body="Share an update, attach a drawing, create an action item or request a costing approval."
              />
            )}
            {error && messages.length === 0 && <ErrorState message={error} />}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              const isUnreadStart = i === unreadFrom;
              const showHeader =
                newDay ||
                isUnreadStart ||
                !prev ||
                prev.userId !== m.userId ||
                prev.kind !== "text" ||
                m.kind !== "text" ||
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="sticky top-0 z-[5] my-2 flex items-center gap-3 px-4 md:px-6">
                      <div className="h-px flex-1 bg-line" />
                      <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-2">{dayLabel(m.createdAt)}</span>
                      <div className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  {isUnreadStart && (
                    <div data-unread-marker className="my-1 flex items-center gap-2 px-4 md:px-6" role="separator" aria-label="New messages">
                      <div className="h-px flex-1 bg-danger/60" />
                      <span className="text-[10.5px] font-semibold tracking-wider text-danger uppercase">New</span>
                    </div>
                  )}
                  <MessageBubble
                    m={m}
                    me={me}
                    isDm={isDm}
                    showHeader={showHeader}
                    saved={isSaved(m.id)}
                    task={m.kind === "task" && m.taskId ? tasks[m.taskId] : undefined}
                    approval={m.kind === "approval" && m.approvalId ? approvals[m.approvalId] : undefined}
                    onTask={(t) => setTasks((p) => ({ ...p, [t.id]: t }))}
                    onApproval={(a) => setApprovals((p) => ({ ...p, [a.id]: a }))}
                    onReply={(msg) => setReplyTo(msg)}
                    onSave={saveMessage}
                    onMakeTask={
                      channel.isMember
                        ? (msg) => {
                            const line = msg.body.split("\n")[0]!.slice(0, 120);
                            setTaskSeed({ title: line || "Follow up", description: `From ${msg.userName}: ${msg.body}`.slice(0, 4000) });
                            setDialog("task");
                          }
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </div>
          {belowCount > 0 && (
            <button
              onClick={jumpToBottom}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-lg bg-graphite px-3 py-1.5 text-[12px] font-medium text-white shadow-lg"
            >
              <ArrowDown className="h-3.5 w-3.5 text-lime" /> {belowCount} new message{belowCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {error && messages.length > 0 && <div className="border-t border-danger/30 bg-danger-soft px-4 py-1.5 text-xs text-danger">Connection issue: {error}. Retrying…</div>}
        {channel.isMember ? (
          <Composer
            channelId={channel.id}
            placeholder={isDm ? `Message ${channel.name}` : `Message ${title}`}
            members={members.filter((m) => m.id !== me.id)}
            replyTo={replyTo}
            clearReply={() => setReplyTo(null)}
            onSent={(m) => {
              stickToBottom.current = true;
              appendMessages([m]);
            }}
            onAction={(a) => {
              setTaskSeed(undefined);
              setDialog(a);
            }}
          />
        ) : (
          <div className="border-t border-line bg-surface-2 p-3 text-center text-[13px] text-ink-3">
            You are viewing this channel as an admin. Add yourself as a member from Administration to post.
          </div>
        )}
      </div>

      {panelPref && <aside className="hidden w-[320px] shrink-0 animate-panel-in border-l border-line bg-canvas lg:flex">{panel}</aside>}
      {mobilePanel && (
        <div className="fixed inset-0 z-40 flex justify-end bg-graphite/40 lg:hidden" onClick={() => setMobilePanel(false)}>
          <aside className="flex h-full w-[90%] max-w-sm animate-panel-in bg-canvas shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {panel}
          </aside>
        </div>
      )}

      {dialog === "task" && (
        <NewTaskDialog
          channelId={channel.id}
          initial={taskSeed}
          onClose={() => setDialog(null)}
          onCreated={(t) => setTasks((p) => ({ ...p, [t.id]: t }))}
        />
      )}
      {dialog === "approval" && (
        <NewApprovalDialog channelId={channel.id} onClose={() => setDialog(null)} onCreated={(a) => setApprovals((p) => ({ ...p, [a.id]: a }))} />
      )}
      {dialog === "members" && (
        <MembersDialog
          channelId={channel.id}
          onClose={() => setDialog(null)}
          onMessage={(uid) => {
            setDialog(null);
            if (uid !== me.id) openDm(uid);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Right-hand context panel ---------- */

function PanelSection({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-line">
      <div className="flex h-10 items-center gap-2 px-4">
        <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="text-ink-3">{icon}</span>
          <span className="eyebrow">{title}</span>
          {count !== undefined && <span className="text-[11px] text-ink-4 tabular-nums">{count}</span>}
        </button>
        {action}
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </section>
  );
}

function ContextPanel({
  channel,
  title,
  members,
  tasks,
  approvals,
  onClose,
  onMembers,
  onDm,
  onJump,
  onAllFiles,
}: {
  channel: ChannelSummary;
  title: string;
  members: Member[];
  tasks: Task[];
  approvals: Approval[];
  onClose: () => void;
  onMembers: () => void;
  onDm: (userId: number) => void;
  onJump: (messageId: number) => void;
  onAllFiles: () => void;
}) {
  const { saved, go } = useApp();
  const [files, setFiles] = useState<FileHit[] | null>(null);
  useEffect(() => {
    api<{ files: FileHit[] }>(`/api/files?channelId=${channel.id}`)
      .then((r) => setFiles(r.files))
      .catch(() => setFiles([]));
  }, [channel.id]);
  const keyMessages = saved.filter((s) => s.channelId === channel.id);
  const isDm = channel.type === "dm";
  const ic = "h-3.5 w-3.5";

  return (
    <div className="scroll-thin flex min-h-0 w-full flex-col overflow-y-auto">
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Details</div>
          <div className="truncate text-[13px] font-semibold">{title}</div>
        </div>
        <button className="btn-ghost p-1.5" onClick={onClose} aria-label="Close details">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isDm && (
        <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
          {[
            ["Location", channel.cityName ?? "All cities"],
            ["Department", DEPARTMENT_LABELS[channel.type] ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="bg-canvas px-4 py-2.5">
              <div className="text-[10.5px] font-medium tracking-wider text-ink-4 uppercase">{k}</div>
              <div className="truncate text-[13px] font-medium">{v}</div>
            </div>
          ))}
        </div>
      )}

      <PanelSection icon={<Bookmark className={ic} />} title="Key messages" count={keyMessages.length}>
        {keyMessages.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">Save important decisions and instructions from this conversation to find them here without scrolling.</p>
        ) : (
          <ul className="space-y-1.5">
            {keyMessages.slice(0, 6).map((s) => (
              <li key={s.id}>
                <button onClick={() => onJump(s.id)} className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-left hover:border-line-strong">
                  <div className="text-[11px] text-ink-3">
                    {s.userName} · {relativeTime(s.createdAt)}
                  </div>
                  <div className="line-clamp-2 text-[12.5px]">{s.body || "Attachment"}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        icon={<ListChecks className={ic} />}
        title="Action items"
        count={tasks.filter((t) => t.status !== "done").length}
        action={
          <button className="text-[11.5px] font-medium text-ink-3 hover:text-ink" onClick={() => go({ kind: "tasks" })}>
            All
          </button>
        }
      >
        {tasks.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">No action items in the loaded history. Hover a message and choose “Create action item”.</p>
        ) : (
          <ul className="space-y-1">
            {tasks.slice(0, 8).map((t) => {
              const overdue = t.dueAt && t.status !== "done" && new Date(t.dueAt) < new Date();
              return (
                <li key={t.id} className="flex items-start gap-2 rounded-lg px-1 py-1.5">
                  <SquareCheck className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${t.status === "done" ? "text-positive" : "text-ink-4"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] ${t.status === "done" ? "text-ink-3 line-through" : "font-medium"}`}>{t.title}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
                      {t.assigneeName}
                      {t.dueAt && <span className={overdue ? "font-medium text-danger" : ""}>· {overdue ? "overdue" : "due"} {relativeTime(t.dueAt)}</span>}
                    </div>
                  </div>
                  <StatusPill status={overdue ? "overdue" : t.status} />
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>

      {approvals.length > 0 && (
        <PanelSection icon={<BadgeCheck className={ic} />} title="Costing approvals" count={approvals.filter((a) => a.status === "pending").length}>
          <ul className="space-y-1">
            {approvals.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-center gap-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{a.title}</span>
                <StatusPill status={a.status} />
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <PanelSection
        icon={<FolderOpen className={ic} />}
        title="Shared files"
        count={files?.length}
        action={
          <button className="text-[11.5px] font-medium text-ink-3 hover:text-ink" onClick={onAllFiles}>
            All
          </button>
        }
      >
        {!files && <div className="h-10 animate-pulse rounded-lg bg-surface-2" />}
        {files?.length === 0 && <p className="text-[12.5px] text-ink-3">Drawings, PDFs and photos shared here will be collected in this list.</p>}
        <ul className="space-y-0.5">
          {files?.slice(0, 6).map((f) => (
            <li key={`${f.messageId}-${f.url}`}>
              <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                {f.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" className="h-8 w-8 shrink-0 rounded-md border border-line object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink-3">
                    <FileIcon name={f.name} type={f.type} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{f.name}</span>
                  <span className="text-[11px] text-ink-3">
                    {fileSize(f.size)} · {relativeTime(f.createdAt)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection
        icon={<Users className={ic} />}
        title="Participants"
        count={members.length}
        action={
          !isDm && (
            <button className="text-[11.5px] font-medium text-ink-3 hover:text-ink" onClick={onMembers}>
              View all
            </button>
          )
        }
      >
        <ul className="space-y-0.5">
          {[...members]
            .sort((a, b) => Number(isOnlineNow(b.lastSeenAt)) - Number(isOnlineNow(a.lastSeenAt)))
            .slice(0, 10)
            .map((m) => (
            <li key={m.id}>
              <button onClick={() => onDm(m.id)} className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-surface-2">
                <PresenceAvatar name={m.name} size={24} lastSeenAt={m.lastSeenAt} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.name}</span>
                <span className="text-[11px] text-ink-4 capitalize">{m.canApprove ? "Approver" : m.role !== "member" ? m.role : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      </PanelSection>
    </div>
  );
}

/* ---------- Composer ---------- */

function Composer({
  channelId,
  placeholder,
  members,
  replyTo,
  clearReply,
  onSent,
  onAction,
}: {
  channelId: number;
  placeholder: string;
  members: Member[];
  replyTo: Message | null;
  clearReply: () => void;
  onSent: (m: Message) => void;
  onAction: (a: "task" | "approval") => void;
}) {
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [menu, setMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mention, setMention] = useState<{ q: string; start: number; sel: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Draft is kept per channel when switching between chats.
  useEffect(() => {
    setText(sessionStorageGet(`draft:${channelId}`));
    setUploads([]);
    setError("");
    setMention(null);
  }, [channelId]);
  useEffect(() => sessionStorageSet(`draft:${channelId}`, text), [channelId, text]);
  useEffect(() => {
    if (replyTo) textarea.current?.focus();
  }, [replyTo]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    const people = members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
    const special = ["everyone"].filter((s) => s.startsWith(q)).map((s) => ({ id: -1, name: s, role: "", department: null, canApprove: false }));
    return [...people, ...special];
  }, [mention, members]);

  function updateMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const m = /(^|\s)@([\p{L}\d_.-]*)$/u.exec(before);
    setMention(m ? { q: m[2]!, start: caret - m[2]!.length - 1, sel: 0 } : null);
  }

  function insertMention(name: string) {
    if (!mention) return;
    const token = `@${name.split(/\s+/)[0]} `;
    const caret = textarea.current?.selectionStart ?? text.length;
    const next = text.slice(0, mention.start) + token + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + token.length;
      textarea.current?.focus();
      textarea.current?.setSelectionRange(pos, pos);
    });
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added: PendingUpload[] = [...files].map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      progress: 0,
    }));
    setUploads((u) => [...u, ...added]);
    for (const item of added) {
      const safeName = item.file.name.replace(/[^\w.\-]+/g, "_").slice(-100);
      upload(`chat/${channelId}/${safeName}`, item.file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: item.file.size > 20 * 1024 * 1024,
        contentType: item.file.type || undefined,
        onUploadProgress: ({ percentage }) => setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: percentage } : x))),
      })
        .then((blob) =>
          setUploads((u) =>
            u.map((x) =>
              x.id === item.id
                ? { ...x, progress: 100, result: { url: blob.url, type: kindOf(item.file), name: item.file.name, size: item.file.size } }
                : x,
            ),
          ),
        )
        .catch((e: Error) => setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, error: e.message } : x))));
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  const uploading = uploads.some((u) => !u.result && !u.error);
  const ready = uploads.filter((u) => u.result).map((u) => u.result!);
  const canSend = !sending && !uploading && (text.trim().length > 0 || ready.length > 0);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setError("");
    try {
      const r = await api<{ message: Message }>(`/api/channels/${channelId}/messages`, {
        method: "POST",
        json: { body: text, attachments: ready, replyToId: replyTo?.id },
      });
      // The POST returns the raw row; the next poll brings the enriched one (author name, reply preview).
      onSent({ ...r.message, userName: "You", replyTo: replyTo ? { id: replyTo.id, body: replyTo.body, userName: replyTo.userName } : null } as Message);
      setText("");
      setUploads([]);
      clearReply();
      textarea.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="shrink-0 bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      <div className="relative rounded-xl border border-line-strong bg-surface transition-colors focus-within:border-ink-3 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_12%,transparent)]">
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full left-2 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg" role="listbox">
            <div className="eyebrow px-2 pt-1 pb-1 text-[10px]">Mention</div>
            {suggestions.map((s, i) => (
              <button
                key={`${s.id}-${s.name}`}
                role="option"
                aria-selected={i === mention.sel}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s.name);
                }}
                className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] ${i === mention.sel ? "bg-surface-2" : ""}`}
              >
                {s.id === -1 ? <AtSign className="h-4 w-4 text-ink-3" /> : <Avatar name={s.name} size={20} />}
                <span className="truncate">{s.id === -1 ? "everyone — notify the channel" : s.name}</span>
              </button>
            ))}
          </div>
        )}
        {replyTo && (
          <div className="flex items-start gap-2 border-b border-line px-3 py-2 text-[12.5px]">
            <div className="min-w-0 flex-1 border-l-2 border-lime pl-2">
              <div className="font-medium">Replying to {replyTo.userName}</div>
              <div className="truncate text-ink-3">{replyTo.body || "Attachment"}</div>
            </div>
            <button onClick={clearReply} className="rounded p-0.5 text-ink-3 hover:bg-surface-2" aria-label="Cancel reply">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {uploads.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-line p-2">
            {uploads.map((u) => (
              <div key={u.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
                {u.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-0.5 p-1 text-center text-[9.5px] break-all text-ink-2">
                    <FileIcon name={u.file.name} type={kindOf(u.file)} />
                    <span className="line-clamp-2">{u.file.name}</span>
                  </div>
                )}
                {!u.result && !u.error && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-graphite/20">
                    <div className="h-full bg-lime transition-[width]" style={{ width: `${u.progress}%` }} />
                  </div>
                )}
                {u.error && <div className="absolute inset-0 flex items-center justify-center bg-danger/85 p-1 text-center text-[9.5px] text-white">{u.error}</div>}
                <button
                  className="absolute top-0.5 right-0.5 rounded-md bg-graphite/70 p-0.5 text-white"
                  onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textarea}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart);
          }}
          onBlur={() => setTimeout(() => setMention(null), 100)}
          onPaste={(e) => e.clipboardData.files.length && addFiles(e.clipboardData.files)}
          onKeyDown={(e) => {
            if (mention && suggestions.length) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const d = e.key === "ArrowDown" ? 1 : -1;
                setMention({ ...mention, sel: (mention.sel + d + suggestions.length) % suggestions.length });
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(suggestions[mention.sel]!.name);
                return;
              }
              if (e.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (e.key === "Escape" && replyTo) clearReply();
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="block max-h-48 min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[14px] leading-[1.5] outline-none placeholder:text-ink-4"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          <div className="relative">
            <ComposerButton label="More actions" onClick={() => setMenu(!menu)} active={menu}>
              <Plus className="h-[18px] w-[18px]" />
            </ComposerButton>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute bottom-10 left-0 z-20 w-64 animate-fade-in overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg">
                  <MenuAction
                    icon={<SquareCheck className="h-4 w-4" />}
                    title="Create action item"
                    hint="Owner, due date and reminders"
                    onClick={() => {
                      setMenu(false);
                      onAction("task");
                    }}
                  />
                  <MenuAction
                    icon={<BadgeCheck className="h-4 w-4" />}
                    title="Request costing approval"
                    hint="Quote, cost and margin"
                    onClick={() => {
                      setMenu(false);
                      onAction("approval");
                    }}
                  />
                </div>
              </>
            )}
          </div>
          <ComposerButton label="Attach drawings, PDFs or photos" onClick={() => fileInput.current?.click()}>
            <Paperclip className="h-[18px] w-[18px]" />
          </ComposerButton>
          <ComposerButton
            label="Mention someone"
            onClick={() => {
              const next = `${text}${text && !text.endsWith(" ") ? " " : ""}@`;
              setText(next);
              setMention({ q: "", start: next.length - 1, sel: 0 });
              textarea.current?.focus();
            }}
          >
            <AtSign className="h-[18px] w-[18px]" />
          </ComposerButton>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dwg,.dxf,.dwf,.skp,.ppt,.pptx,.zip"
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="ml-auto hidden items-center gap-1 pr-2 text-[11px] text-ink-4 sm:flex">
            <Kbd>Shift</Kbd>
            <Kbd>↵</Kbd> new line
          </span>
          <button
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${canSend ? "bg-graphite text-lime hover:bg-[#22333f]" : "bg-surface-2 text-ink-4"}`}
            disabled={!canSend}
            onClick={send}
            aria-label="Send message"
          >
            {sending || uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">Not sent: {error}</p>}
    </div>
  );
}

function ComposerButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-ink ${active ? "bg-surface-2 text-ink" : "text-ink-3"}`}
    >
      {children}
    </button>
  );
}

function MenuAction({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2" onClick={onClick}>
      <span className="mt-0.5 text-ink-2">{icon}</span>
      <span>
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="block text-[11.5px] text-ink-3">{hint}</span>
      </span>
    </button>
  );
}

function sessionStorageGet(key: string) {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function sessionStorageSet(key: string, value: string) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

/* ---------- In-conversation search ---------- */

function ChatSearch({ channelId, onJump, onClose }: { channelId: number; onJump: (id: number) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      api<{ messages: Hit[] }>(`/api/search?channelId=${channelId}&q=${encodeURIComponent(term)}`)
        .then((r) => {
          setHits(r.messages);
          setIndex(0);
          setListOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, channelId]);

  function go(i: number) {
    if (!hits?.length) return;
    const next = (i + hits.length) % hits.length;
    setIndex(next);
    setListOpen(false);
    onJump(hits[next]!.id);
  }

  return (
    <div className="relative z-10 shrink-0 border-b border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2 md:px-6">
        <Search className="h-4 w-4 shrink-0 text-ink-4" />
        <input
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-4"
          placeholder="Search messages in this conversation"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") go(e.shiftKey ? index - 1 : listOpen ? index : index + 1);
          }}
        />
        {busy && <LoaderCircle className="h-4 w-4 animate-spin text-ink-4" />}
        {hits && (
          <button className="shrink-0 text-[12px] text-ink-3 tabular-nums hover:text-ink" onClick={() => setListOpen(!listOpen)}>
            {hits.length ? `${index + 1} of ${hits.length}${hits.length === 100 ? "+" : ""}` : "No matches"}
          </button>
        )}
        <button className="btn-ghost p-1" disabled={!hits?.length} onClick={() => go(index + 1)} aria-label="Older match" title="Older match">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button className="btn-ghost p-1" disabled={!hits?.length} onClick={() => go(index - 1)} aria-label="Newer match" title="Newer match">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button className="btn-ghost p-1" onClick={onClose} aria-label="Close search">
          <X className="h-4 w-4" />
        </button>
      </div>
      {listOpen && !!hits?.length && (
        <ul className="scroll-thin absolute inset-x-0 top-full max-h-[50vh] divide-y divide-line overflow-y-auto border-b border-line bg-surface shadow-lg">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button
                onClick={() => go(i)}
                className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-surface-2 md:px-6 ${i === index ? "bg-surface-2" : ""}`}
              >
                <span className="flex items-center gap-2 text-[12px] text-ink-3">
                  <b className="font-medium text-ink-2">{h.userName ?? "PONGS"}</b>
                  <span className="ml-auto">{dayLabel(h.createdAt)} · {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <span className="line-clamp-2 text-[13px]">{highlight(h.body, q)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
