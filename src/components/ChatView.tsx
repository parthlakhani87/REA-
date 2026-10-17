"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { ArrowLeft, BadgeCheck, LoaderCircle, Paperclip, Plus, Send, SquareCheck, Users, X } from "lucide-react";
import type { Attachment } from "@/db/schema";
import { api, type Approval, type ChannelSummary, type Me, type Message, type Task } from "@/lib/client";
import { MembersDialog, NewApprovalDialog, NewTaskDialog } from "./Dialogs";
import { MessageBubble } from "./MessageBubble";
import { Avatar, ChannelIcon } from "./ui";

type Page = { messages: Message[]; tasks: Task[]; approvals: Approval[]; serverTime: string };
type PendingUpload = { id: string; file: File; preview?: string; progress: number; result?: Attachment; error?: string };

const POLL_MS = 3000;

function kindOf(file: File): Attachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

export function ChatView({
  channel,
  me,
  onBack,
  onOpenDm,
  onRead,
}: {
  channel: ChannelSummary;
  me: Me;
  onBack: () => void;
  onOpenDm: (userId: number) => void;
  onRead: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Record<number, Task>>({});
  const [approvals, setApprovals] = useState<Record<number, Approval>>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<null | "task" | "approval" | "members">(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const cursor = useRef<{ lastId: number; since: string | null }>({ lastId: 0, since: null });
  const readUpTo = useRef(0);

  const mergeCards = useCallback((page: Pick<Page, "tasks" | "approvals">) => {
    if (page.tasks.length) setTasks((prev) => ({ ...prev, ...Object.fromEntries(page.tasks.map((t) => [t.id, t])) }));
    if (page.approvals.length)
      setApprovals((prev) => ({ ...prev, ...Object.fromEntries(page.approvals.map((a) => [a.id, a])) }));
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

  const appendMessages = useCallback(
    (incoming: Message[]) => {
      if (!incoming.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
      });
      cursor.current.lastId = Math.max(cursor.current.lastId, ...incoming.map((m) => m.id));
    },
    [],
  );

  // Initial load + polling for this channel.
  useEffect(() => {
    let stopped = false;
    cursor.current = { lastId: 0, since: null };
    readUpTo.current = 0;
    stickToBottom.current = true;
    setMessages([]);
    setTasks({});
    setApprovals({});
    setReplyTo(null);
    setLoading(true);
    setHasMore(true);

    async function poll() {
      try {
        const qs = new URLSearchParams();
        if (cursor.current.lastId) qs.set("after", String(cursor.current.lastId));
        if (cursor.current.since) qs.set("since", cursor.current.since);
        const page = await api<Page>(`/api/channels/${channel.id}/messages?${qs}`);
        if (stopped) return;
        if (!cursor.current.since && page.messages.length < 50) setHasMore(false);
        appendMessages(page.messages);
        mergeCards(page);
        cursor.current.since = page.serverTime;
        setError("");
        setLoading(false);
        markRead();
      } catch (e) {
        if (!stopped) setError((e as Error).message);
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
  }, [channel.id, appendMessages, mergeCards, markRead]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, tasks, approvals]);

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
    if (el.scrollTop < 40 && hasMore && !loading) loadOlder();
  }

  const isDm = channel.type === "dm";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-3 py-2.5">
        <button className="btn-ghost p-1 md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {isDm ? (
          <Avatar name={channel.name} size={38} />
        ) : (
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <ChannelIcon type={channel.type} className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{channel.name}</div>
          <div className="truncate text-xs text-slate-500">
            {isDm ? "Direct message" : channel.cityName ? `${channel.cityName} group` : "Company-wide"}
            {!channel.isMember && " · viewing as admin"}
          </div>
        </div>
        {!isDm && (
          <button className="btn-ghost p-2" onClick={() => setDialog("members")} aria-label="Members">
            <Users className="h-5 w-5" />
          </button>
        )}
      </header>

      <div ref={scroller} onScroll={onScroll} className="chat-bg flex-1 overflow-y-auto pb-3">
        {loading && (
          <div className="flex justify-center p-6">
            <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-xl bg-white/90 p-4 text-center text-sm text-slate-600 shadow-sm">
            No messages yet. Say hello, share a photo, assign a task or request a costing approval.
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showHeader =
            !prev ||
            prev.userId !== m.userId ||
            prev.kind !== "text" ||
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
          return (
            <MessageBubble
              key={m.id}
              m={m}
              me={me}
              isDm={isDm}
              showHeader={showHeader}
              task={m.kind === "task" && m.taskId ? tasks[m.taskId] : undefined}
              approval={m.kind === "approval" && m.approvalId ? approvals[m.approvalId] : undefined}
              onTask={(t) => setTasks((p) => ({ ...p, [t.id]: t }))}
              onApproval={(a) => setApprovals((p) => ({ ...p, [a.id]: a }))}
              onReply={(msg) => setReplyTo(msg)}
            />
          );
        })}
      </div>

      {error && <div className="bg-red-50 px-3 py-1 text-xs text-red-700">{error}</div>}
      {channel.isMember ? (
        <Composer
          channelId={channel.id}
          replyTo={replyTo}
          clearReply={() => setReplyTo(null)}
          onSent={(m) => {
            stickToBottom.current = true;
            appendMessages([m]);
          }}
          onAction={(a) => setDialog(a)}
        />
      ) : (
        <div className="border-t bg-white p-3 text-center text-sm text-slate-500">
          You are viewing this group as an admin. Add yourself as a member from the Admin page to post.
        </div>
      )}

      {dialog === "task" && (
        <NewTaskDialog
          channelId={channel.id}
          onClose={() => setDialog(null)}
          onCreated={(t) => setTasks((p) => ({ ...p, [t.id]: t }))}
        />
      )}
      {dialog === "approval" && (
        <NewApprovalDialog
          channelId={channel.id}
          onClose={() => setDialog(null)}
          onCreated={(a) => setApprovals((p) => ({ ...p, [a.id]: a }))}
        />
      )}
      {dialog === "members" && (
        <MembersDialog
          channelId={channel.id}
          onClose={() => setDialog(null)}
          onMessage={(uid) => {
            setDialog(null);
            if (uid !== me.id) onOpenDm(uid);
          }}
        />
      )}
    </div>
  );
}

function Composer({
  channelId,
  replyTo,
  clearReply,
  onSent,
  onAction,
}: {
  channelId: number;
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
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Draft is kept per channel when switching between chats.
  useEffect(() => {
    setText(sessionStorageGet(`draft:${channelId}`));
    setUploads([]);
    setError("");
  }, [channelId]);
  useEffect(() => sessionStorageSet(`draft:${channelId}`, text), [channelId, text]);

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
        onUploadProgress: ({ percentage }) =>
          setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: percentage } : x))),
      })
        .then((blob) =>
          setUploads((u) =>
            u.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    progress: 100,
                    result: { url: blob.url, type: kindOf(item.file), name: item.file.name, size: item.file.size },
                  }
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
      className="border-t bg-[#f0f2f5] px-2 py-2"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        addFiles(e.dataTransfer.files);
      }}
    >
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-brand-500 bg-white px-3 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-brand-700">Replying to {replyTo.userName}</div>
            <div className="truncate text-slate-600">{replyTo.body || "📎 Attachment"}</div>
          </div>
          <button onClick={clearReply} aria-label="Cancel reply">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      )}
      {uploads.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {uploads.map((u) => (
            <div key={u.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm">
              {u.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-1 text-center text-[10px] break-all text-slate-600">
                  {u.file.type.startsWith("video/") ? "🎥 " : "📄 "}
                  {u.file.name}
                </div>
              )}
              {!u.result && !u.error && (
                <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                  <div className="h-full bg-brand-500" style={{ width: `${u.progress}%` }} />
                </div>
              )}
              {u.error && <div className="absolute inset-0 flex items-center justify-center bg-red-600/80 p-1 text-center text-[10px] text-white">{u.error}</div>}
              <button
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
                onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      <div className="flex items-end gap-1.5">
        <div className="relative">
          <button className="btn-ghost rounded-full p-2" onClick={() => setMenu(!menu)} aria-label="More actions">
            <Plus className="h-5 w-5" />
          </button>
          {menu && (
            <div className="absolute bottom-12 left-0 z-20 w-56 overflow-hidden rounded-xl border bg-white shadow-lg">
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); onAction("task"); }}>
                <SquareCheck className="h-4 w-4 text-indigo-600" /> Assign a task
              </button>
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); onAction("approval"); }}>
                <BadgeCheck className="h-4 w-4 text-amber-600" /> Request costing approval
              </button>
            </div>
          )}
        </div>
        <button className="btn-ghost rounded-full p-2" onClick={() => fileInput.current?.click()} aria-label="Attach photo or video">
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={(e) => addFiles(e.target.files)}
        />
        <textarea
          ref={textarea}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => e.clipboardData.files.length && addFiles(e.clipboardData.files)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message"
          className="max-h-40 min-h-[42px] flex-1 resize-none rounded-2xl border-0 bg-white px-4 py-2.5 text-[15px] outline-none"
          style={{ fieldSizing: "content" } as React.CSSProperties}
        />
        <button className="btn-primary h-[42px] w-[42px] rounded-full p-0" disabled={!canSend} onClick={send} aria-label="Send">
          {sending || uploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
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
