"use client";

import type { ApprovalDTO, MessageDTO, TaskDTO } from "./messages";
import type { ChannelSummary } from "@/app/api/sync/route";

export type { ApprovalDTO, MessageDTO, TaskDTO, ChannelSummary };

// Dates arrive as ISO strings over JSON.
type Jsonified<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };
export type Task = Jsonified<TaskDTO>;
export type Approval = Jsonified<ApprovalDTO>;
export type Message = Jsonified<MessageDTO>;

export type Me = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "manager" | "member";
  cityId: number | null;
  department: string | null;
  canApprove: boolean;
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DirectoryUser = {
  id: number;
  name: string;
  role: string;
  department: string | null;
  canApprove: boolean;
  cityName: string | null;
  lastSeenAt: string | null;
};

export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth")) {
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short" }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatMoney(amount: string | null, currency: string) {
  if (amount === null) return "—";
  const n = Number(amount);
  const digits = Number.isInteger(n) ? 0 : 2;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-IN")}`;
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function avatarColor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

export type { MessageHit, FileHit } from "./discover";

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) });
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const s = Math.abs(diff);
  if (s < 60) return "just now";
  const unit = s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : s < 7 * 86400 ? `${Math.floor(s / 86400)}d` : null;
  if (!unit) return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
  return diff >= 0 ? `${unit} ago` : `in ${unit}`;
}

export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Groups files the way site and design teams think about them.
export function fileKind(name: string, type: string): "drawing" | "pdf" | "image" | "video" | "document" | "other" {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["dwg", "dxf", "dwf", "skp", "rvt", "ifc", "3dm"].includes(ext)) return "drawing";
  if (ext === "pdf") return "pdf";
  if (type === "image") return "image";
  if (type === "video") return "video";
  if (["doc", "docx", "xls", "xlsx", "csv", "txt", "ppt", "pptx"].includes(ext)) return "document";
  return "other";
}

// Presence: a user is online if their app checked in within the last minute (see src/lib/presence.ts).
export const ONLINE_WINDOW_MS = 60_000;

export function isOnlineNow(lastSeenAt: string | null | undefined) {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

export function lastSeenLabel(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return "Not signed in yet";
  if (isOnlineNow(lastSeenAt)) return "Online";
  const d = new Date(lastSeenAt);
  const day = dayLabel(lastSeenAt);
  const at = clockTime(lastSeenAt);
  if (day === "Today" || day === "Yesterday") return `Last seen ${day.toLowerCase()} at ${at}`;
  return `Last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${at}`;
}
