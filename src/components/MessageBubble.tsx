"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Download, FileText, ListPlus, PenTool, Reply, X } from "lucide-react";
import type { Attachment } from "@/db/schema";
import { clockTime, fileKind, fileSize, formatTime, type Approval, type Me, type Message, type Task } from "@/lib/client";
import { ApprovalCard, TaskCard } from "./Cards";
import { Avatar } from "./ui";

export function FileIcon({ name, type, className = "h-4 w-4" }: { name: string; type: string; className?: string }) {
  const kind = fileKind(name, type);
  return kind === "drawing" ? <PenTool className={className} strokeWidth={1.75} /> : <FileText className={className} strokeWidth={1.75} />;
}

export function Attachments({ items }: { items: Attachment[] }) {
  const [zoom, setZoom] = useState<Attachment | null>(null);
  const media = items.filter((a) => a.type !== "file");
  const files = items.filter((a) => a.type === "file");
  return (
    <div className="space-y-1.5">
      {media.length > 0 && (
        <div className={`grid max-w-md gap-1.5 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {media.map((a) =>
            a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.url}
                src={a.url}
                alt={a.name}
                loading="lazy"
                onClick={() => setZoom(a)}
                className="max-h-72 w-full cursor-zoom-in rounded-lg border border-line object-cover"
              />
            ) : (
              <video key={a.url} src={a.url} controls preload="metadata" playsInline className="max-h-80 w-full rounded-lg border border-line bg-black" />
            ),
          )}
        </div>
      )}
      {files.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-sm items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] transition-colors hover:border-line-strong hover:bg-surface-2"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2">
            <FileIcon name={a.name} type={a.type} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{a.name}</span>
            <span className="text-[11px] text-ink-3 uppercase">
              {a.name.split(".").pop()} · {fileSize(a.size)}
            </span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-ink-4" />
        </a>
      ))}
      {zoom && (
        <div className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-graphite/95" onClick={() => setZoom(null)}>
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-white">
            <span className="min-w-0 flex-1 truncate">{zoom.name}</span>
            <a href={zoom.url} target="_blank" rel="noreferrer" className="btn px-2 py-1 text-white hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
              <Download className="h-4 w-4" /> Open original
            </a>
            <button className="btn p-1 text-white hover:bg-white/10" aria-label="Close preview">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom.url} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

const TOKEN = /(https?:\/\/[^\s]+|@[\p{L}\d_-]+)/gu;

export function RichText({ text, meName }: { text: string; meName?: string }) {
  const first = meName?.split(/\s+/)[0]?.toLowerCase();
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        if (p.startsWith("http"))
          return (
            <a key={i} href={p} target="_blank" rel="noreferrer" className="text-positive underline decoration-line-strong underline-offset-2 hover:decoration-positive">
              {p}
            </a>
          );
        const isMe = first && p.slice(1).toLowerCase() === first;
        return (
          <span key={i} className={`rounded px-0.5 font-medium ${isMe ? "bg-lime/50 text-graphite dark:text-ink" : "bg-surface-3 text-ink"}`}>
            {p}
          </span>
        );
      })}
    </>
  );
}

export function mentionsMe(body: string, me: Me) {
  const b = body.toLowerCase();
  const first = me.name.split(/\s+/)[0]?.toLowerCase() ?? "";
  return b.includes(`@${me.name.toLowerCase()}`) || (first && b.includes(`@${first}`)) || b.includes("@everyone") || b.includes("@channel");
}

export function MessageBubble({
  m,
  me,
  showHeader,
  task,
  approval,
  saved,
  onTask,
  onApproval,
  onReply,
  onSave,
  onMakeTask,
}: {
  m: Message;
  me: Me;
  showHeader: boolean;
  isDm?: boolean;
  task?: Task;
  approval?: Approval;
  saved?: boolean;
  onTask: (t: Task) => void;
  onApproval: (a: Approval) => void;
  onReply: (m: Message) => void;
  onSave?: (m: Message) => void;
  onMakeTask?: (m: Message) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (m.kind === "system") {
    return (
      <div className="my-3 flex items-center gap-3 px-4 md:px-6">
        <div className="h-px flex-1 bg-line" />
        <span className="text-center text-[11.5px] text-ink-3">
          {m.body} · {clockTime(m.createdAt)}
        </span>
        <div className="h-px flex-1 bg-line" />
      </div>
    );
  }

  const card =
    m.kind === "task" && task ? (
      <TaskCard task={task} me={me} onChange={onTask} />
    ) : m.kind === "approval" && approval ? (
      <ApprovalCard approval={approval} me={me} onChange={onApproval} />
    ) : null;
  const pinged = m.kind === "text" && m.userId !== me.id && mentionsMe(m.body, me);

  return (
    <div
      id={`m-${m.id}`}
      className={`group relative flex gap-3 px-4 transition-colors md:px-6 ${showHeader ? "mt-3 pt-1" : "mt-0"} py-0.5 ${
        pinged ? "border-l-2 border-lime bg-accent-soft/60 hover:bg-accent-soft" : "border-l-2 border-transparent hover:bg-surface-2/70"
      }`}
    >
      <div className="w-8 shrink-0">
        {showHeader ? (
          <Avatar name={m.userName} size={32} />
        ) : (
          <span className="block pt-0.5 text-right text-[10px] leading-5 text-ink-4 opacity-0 tabular-nums group-hover:opacity-100">
            {clockTime(m.createdAt)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-[13.5px] font-semibold">{m.userId === me.id ? `${m.userName === "You" ? me.name : m.userName}` : m.userName}</span>
            <time className="text-[11px] text-ink-4 tabular-nums" dateTime={m.createdAt} title={formatTime(m.createdAt)}>
              {clockTime(m.createdAt)}
            </time>
            {saved && <BookmarkCheck className="h-3.5 w-3.5 self-center text-positive" aria-label="Saved" />}
          </div>
        )}
        {m.replyTo && (
          <button
            className="mt-1 mb-1 flex max-w-lg items-start gap-2 border-l-2 border-line-strong py-0.5 pl-2 text-left text-[12.5px] hover:border-ink-3"
            onClick={() => document.getElementById(`m-${m.replyTo!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <Reply className="mt-0.5 h-3 w-3 shrink-0 -scale-x-100 text-ink-4" />
            <span className="min-w-0">
              <span className="font-medium text-ink-2">{m.replyTo.userName ?? "Someone"}</span>{" "}
              <span className="line-clamp-1 text-ink-3">{m.replyTo.body || "Attachment"}</span>
            </span>
          </button>
        )}
        {card ? (
          <div className="mt-1">{card}</div>
        ) : (
          <>
            {m.body && (
              <div className="text-[14px] leading-[1.55] break-words whitespace-pre-wrap text-ink">
                <RichText text={m.body} meName={me.name} />
              </div>
            )}
            {m.attachments.length > 0 && (
              <div className="mt-1.5">
                <Attachments items={m.attachments} />
              </div>
            )}
          </>
        )}
      </div>

      {m.kind === "text" && (
        <div className="absolute -top-3 right-4 z-10 hidden items-center rounded-lg border border-line bg-surface p-0.5 shadow-sm group-hover:flex group-focus-within:flex md:right-6">
          <ToolbarButton label="Reply" onClick={() => onReply(m)}>
            <Reply className="h-4 w-4" />
          </ToolbarButton>
          {onSave && (
            <ToolbarButton label={saved ? "Remove from saved" : "Save message"} onClick={() => onSave(m)} active={saved}>
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </ToolbarButton>
          )}
          {onMakeTask && (
            <ToolbarButton label="Create action item" onClick={() => onMakeTask(m)}>
              <ListPlus className="h-4 w-4" />
            </ToolbarButton>
          )}
          {m.body && (
            <ToolbarButton
              label={copied ? "Copied" : "Copy text"}
              onClick={() => {
                navigator.clipboard?.writeText(m.body).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                });
              }}
            >
              <Copy className="h-4 w-4" />
            </ToolbarButton>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 transition-colors hover:bg-surface-2 ${active ? "text-positive" : "text-ink-3 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
