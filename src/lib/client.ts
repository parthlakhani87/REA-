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
