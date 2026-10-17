"use client";

import { useState } from "react";
import { FileText, Reply } from "lucide-react";
import type { Attachment } from "@/db/schema";
import { avatarColor, formatTime, type Approval, type Me, type Message, type Task } from "@/lib/client";
import { ApprovalCard, TaskCard } from "./Cards";
import { Avatar } from "./ui";

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({ items }: { items: Attachment[] }) {
  const [zoom, setZoom] = useState<string | null>(null);
  const media = items.filter((a) => a.type !== "file");
  const files = items.filter((a) => a.type === "file");
  return (
    <div className="space-y-1">
      {media.length > 0 && (
        <div className={`grid gap-1 ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {media.map((a) =>
            a.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.url}
                src={a.url}
                alt={a.name}
                loading="lazy"
                onClick={() => setZoom(a.url)}
                className="max-h-72 w-full cursor-zoom-in rounded-lg object-cover"
              />
            ) : (
              <video key={a.url} src={a.url} controls preload="metadata" playsInline className="max-h-80 w-full rounded-lg bg-black" />
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
          className="flex items-center gap-2 rounded-lg bg-black/5 px-2 py-1.5 text-sm hover:bg-black/10"
        >
          <FileText className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="truncate">{a.name}</span>
          <span className="ml-auto shrink-0 text-xs text-slate-500">{fileSize(a.size)}</span>
        </a>
      ))}
      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}

export function MessageBubble({
  m,
  me,
  showHeader,
  isDm,
  task,
  approval,
  onTask,
  onApproval,
  onReply,
}: {
  m: Message;
  me: Me;
  showHeader: boolean;
  isDm: boolean;
  task?: Task;
  approval?: Approval;
  onTask: (t: Task) => void;
  onApproval: (a: Approval) => void;
  onReply: (m: Message) => void;
}) {
  if (m.kind === "system") {
    return (
      <div className="my-2 flex justify-center px-4">
        <span className="rounded-lg bg-white/80 px-3 py-1 text-center text-xs text-slate-600 shadow-sm">
          {m.body} · {formatTime(m.createdAt)}
        </span>
      </div>
    );
  }

  const mine = m.userId === me.id;
  const card =
    m.kind === "task" && task ? (
      <TaskCard task={task} me={me} onChange={onTask} />
    ) : m.kind === "approval" && approval ? (
      <ApprovalCard approval={approval} me={me} onChange={onApproval} />
    ) : null;

  return (
    <div className={`group flex gap-2 px-3 ${showHeader ? "mt-3" : "mt-0.5"} ${mine ? "flex-row-reverse" : ""}`}>
      {!mine && !isDm && <div className="w-8 shrink-0">{showHeader && <Avatar name={m.userName} size={32} />}</div>}
      <div className={`flex max-w-[85%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        {card ?? (
          <div className={`rounded-xl px-3 py-1.5 shadow-sm ${mine ? "rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white"}`}>
            {showHeader && !mine && !isDm && (
              <div className="text-xs font-semibold" style={{ color: avatarColor(m.userName) }}>
                {m.userName}
              </div>
            )}
            {m.replyTo && (
              <div className="my-1 rounded-md border-l-4 border-brand-500 bg-black/5 px-2 py-1 text-xs">
                <div className="font-semibold text-brand-700">{m.replyTo.userName ?? "Someone"}</div>
                <div className="line-clamp-2 text-slate-600">{m.replyTo.body || "📎 Attachment"}</div>
              </div>
            )}
            {m.attachments.length > 0 && (
              <div className="my-1">
                <Attachments items={m.attachments} />
              </div>
            )}
            {m.body && <div className="text-[15px] break-words whitespace-pre-wrap">{m.body}</div>}
            <div className="text-right text-[10px] text-slate-500">{formatTime(m.createdAt)}</div>
          </div>
        )}
        {card && <div className="mt-0.5 text-[10px] text-slate-500">{m.userName} · {formatTime(m.createdAt)}</div>}
      </div>
      {!card && (
        <button
          onClick={() => onReply(m)}
          className="self-center rounded-full p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white"
          aria-label="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
