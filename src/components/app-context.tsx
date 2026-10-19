"use client";

import { createContext, useContext } from "react";
import type { ChannelSummary, Me } from "@/lib/client";
import type { SavedMessage } from "@/lib/prefs";
import type { PushState } from "@/lib/push-client";

export type Sync = {
  notificationsPaused?: boolean;
  channels: ChannelSummary[];
  unreadNotifications: number;
  openTasks: number;
  pendingApprovals: number;
};

export type ViewKind =
  | "home"
  | "chats"
  | "mentions"
  | "saved"
  | "tasks"
  | "approvals"
  | "notifications"
  | "announcements"
  | "directory"
  | "files"
  | "search"
  | "settings";

export type View = { kind: "channel"; id: number; m?: number } | { kind: "search"; q: string } | { kind: Exclude<ViewKind, "search"> };

export const VIEW_LABELS: Record<ViewKind, string> = {
  home: "Home",
  chats: "Conversations",
  mentions: "Mentions",
  saved: "Saved messages",
  tasks: "Action items",
  approvals: "Costing approvals",
  notifications: "Notifications",
  announcements: "Announcements",
  directory: "Team directory",
  files: "Shared files",
  search: "Search",
  settings: "Settings",
};

export type AppContext = {
  me: Me;
  sync: Sync | null;
  refresh: () => Promise<void>;
  go: (v: View) => void;
  openDm: (userId: number) => Promise<void>;
  saved: SavedMessage[];
  isSaved: (id: number) => boolean;
  toggleSaved: (m: Omit<SavedMessage, "savedAt">) => void;
  toast: (text: string, tone?: "positive" | "danger") => void;
  vapidKey: string | null;
  push: PushState;
  setPush: (p: PushState) => void;
};

export const Ctx = createContext<AppContext | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside Shell");
  return c;
}

export function channelLabel(c: Pick<ChannelSummary, "name" | "cityName">) {
  return c.cityName ? c.name.replace(`${c.cityName} · `, "") : c.name;
}
