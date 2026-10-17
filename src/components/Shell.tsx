"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BellRing,
  ChevronDown,
  ChevronRight,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Search,
  Settings,
  Shield,
  SquareCheck,
} from "lucide-react";
import { api, formatTime, type ChannelSummary, type Me } from "@/lib/client";
import { enablePush, pushStatus } from "@/lib/push-client";
import { ChatView } from "./ChatView";
import { NewChatDialog } from "./Dialogs";
import { ApprovalsView, NotificationsView, ProfileDialog, TasksView } from "./Views";
import { Avatar, Badge, ChannelIcon } from "./ui";

type Sync = {
  channels: ChannelSummary[];
  unreadNotifications: number;
  openTasks: number;
  pendingApprovals: number;
};
export type View = { kind: "channel"; id: number } | { kind: "tasks" } | { kind: "approvals" } | { kind: "notifications" } | null;

const DEPT_ORDER = ["sales", "project", "accounts", "dispatch"];
const SYNC_MS = 5000;

function readUrlView(): View {
  const p = new URLSearchParams(window.location.search);
  const c = Number(p.get("c"));
  if (c) return { kind: "channel", id: c };
  const v = p.get("view");
  if (v === "tasks" || v === "approvals" || v === "notifications") return { kind: v };
  return null;
}

export function Shell({ me, vapidKey }: { me: Me; vapidKey: string | null }) {
  const [sync, setSync] = useState<Sync | null>(null);
  const [view, setViewState] = useState<View>(null);
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<null | "newChat" | "profile">(null);
  const [push, setPush] = useState<"unsupported" | "default" | "granted" | "denied">("unsupported");

  const setView = useCallback((v: View) => {
    setViewState(v);
    const url = v?.kind === "channel" ? `/app?c=${v.id}` : v ? `/app?view=${v.kind}` : "/app";
    window.history.pushState(null, "", url);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSync(await api<Sync>("/api/sync"));
    } catch {}
  }, []);

  useEffect(() => {
    setViewState(readUrlView());
    const onPop = () => setViewState(readUrlView());
    window.addEventListener("popstate", onPop);
    refresh();
    const t = setInterval(refresh, SYNC_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    pushStatus().then(setPush);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(t);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Unread count in the tab title, like WhatsApp Web.
  const totalUnread = useMemo(() => sync?.channels.reduce((s, c) => s + c.unread, 0) ?? 0, [sync]);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) PONGS Connect` : "PONGS Connect";
  }, [totalUnread]);

  const groups = useMemo(() => {
    const q = filter.toLowerCase();
    const list = (sync?.channels ?? []).filter((c) => !q || `${c.name} ${c.cityName ?? ""}`.toLowerCase().includes(q));
    const company = list.filter((c) => c.type === "general");
    const dms = list
      .filter((c) => c.type === "dm")
      .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
    const cities = new Map<string, ChannelSummary[]>();
    for (const c of list) {
      if (!c.cityName) continue;
      if (!cities.has(c.cityName)) cities.set(c.cityName, []);
      cities.get(c.cityName)!.push(c);
    }
    for (const arr of cities.values()) arr.sort((a, b) => DEPT_ORDER.indexOf(a.type) - DEPT_ORDER.indexOf(b.type));
    return { company, dms, cities: [...cities.entries()].sort(([a], [b]) => a.localeCompare(b)) };
  }, [sync, filter]);

  const activeChannel = view?.kind === "channel" ? sync?.channels.find((c) => c.id === view.id) : undefined;

  async function openDm(userId: number) {
    const r = await api<{ channelId: number }>("/api/dm", { method: "POST", json: { userId } });
    await refresh();
    setView({ kind: "channel", id: r.channelId });
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const channelRow = (c: ChannelSummary, label: string, indent = false) => {
    const active = view?.kind === "channel" && view.id === c.id;
    return (
      <button
        key={c.id}
        onClick={() => setView({ kind: "channel", id: c.id })}
        className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${indent ? "pl-7" : "pl-2"} ${
          active ? "bg-brand-600 text-white" : c.unread ? "font-semibold text-white hover:bg-side-hover" : "text-slate-300 hover:bg-side-hover"
        } ${!c.isMember ? "opacity-60" : ""}`}
      >
        <ChannelIcon type={c.type} className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        <Badge count={c.unread} />
      </button>
    );
  };

  const navButton = (kind: "tasks" | "approvals" | "notifications", icon: React.ReactNode, label: string, count: number) => (
    <button
      onClick={() => setView({ kind })}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
        view?.kind === kind ? "bg-brand-600 text-white" : "text-slate-200 hover:bg-side-hover"
      }`}
    >
      {icon}
      {label}
      <Badge count={count} tone="red" />
    </button>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar — full screen on mobile when nothing is open (WhatsApp style) */}
      <aside className={`${view ? "hidden md:flex" : "flex"} w-full flex-col bg-side text-white md:w-80 md:shrink-0`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div className="flex-1 font-semibold">PONGS Connect</div>
          <button className="rounded-md p-1.5 hover:bg-side-hover" title="New chat" onClick={() => setDialog("newChat")}>
            <MessageSquarePlus className="h-5 w-5" />
          </button>
          {me.role === "admin" && (
            <a href="/admin" className="rounded-md p-1.5 hover:bg-side-hover" title="Admin">
              <Shield className="h-5 w-5" />
            </a>
          )}
        </div>

        {push === "default" && vapidKey && (
          <button
            onClick={async () => setPush(await enablePush(vapidKey))}
            className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-amber-400/90 px-3 py-2 text-left text-xs font-medium text-amber-950"
          >
            <BellRing className="h-4 w-4 shrink-0" />
            Turn on notifications so you never miss a task reminder or approval.
          </button>
        )}

        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search groups & chats"
              className="w-full rounded-lg bg-white/10 py-1.5 pr-2 pl-8 text-sm text-white placeholder:text-slate-400 outline-none focus:bg-white/15"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          <div className="space-y-0.5">
            {navButton("tasks", <SquareCheck className="h-4 w-4" />, "My tasks", sync?.openTasks ?? 0)}
            {navButton("approvals", <BadgeCheck className="h-4 w-4" />, "Costing approvals", sync?.pendingApprovals ?? 0)}
            {navButton("notifications", <Bell className="h-4 w-4" />, "Notifications", sync?.unreadNotifications ?? 0)}
          </div>

          {groups.company.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Company</div>
              {groups.company.map((c) => channelRow(c, c.name))}
            </div>
          )}

          {groups.cities.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Cities</div>
              {groups.cities.map(([city, chans]) => {
                const unread = chans.reduce((s, c) => s + c.unread, 0);
                const isCollapsed = collapsed[city] && !filter;
                return (
                  <div key={city}>
                    <button
                      onClick={() => setCollapsed({ ...collapsed, [city]: !collapsed[city] })}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-100 hover:bg-side-hover"
                    >
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <MapPin className="h-4 w-4 text-brand-500" />
                      {city}
                      {isCollapsed && <Badge count={unread} />}
                    </button>
                    {!isCollapsed && chans.map((c) => channelRow(c, c.name.replace(`${city} · `, ""), true))}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="flex items-center px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Direct messages
              <button className="ml-auto text-slate-300 hover:text-white" onClick={() => setDialog("newChat")} title="New chat">
                +
              </button>
            </div>
            {groups.dms.map((c) => {
              const active = view?.kind === "channel" && view.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setView({ kind: "channel", id: c.id })}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${active ? "bg-brand-600" : "hover:bg-side-hover"}`}
                >
                  <Avatar name={c.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm ${c.unread ? "font-semibold" : ""}`}>{c.name}</span>
                      {c.lastMessageAt && <span className="ml-auto shrink-0 text-[10px] text-slate-400">{formatTime(c.lastMessageAt)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs text-slate-400">{c.lastMessagePreview ?? "Start chatting"}</span>
                      <Badge count={c.unread} />
                    </div>
                  </div>
                </button>
              );
            })}
            {groups.dms.length === 0 && <p className="px-2 text-xs text-slate-500">No direct messages yet.</p>}
          </div>
        </nav>

        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
          <Avatar name={me.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{me.name}</div>
            <div className="truncate text-xs text-slate-400 capitalize">
              {me.role}
              {me.canApprove ? " · approver" : ""}
            </div>
          </div>
          <button className="rounded-md p-1.5 hover:bg-side-hover" title="Profile" onClick={() => setDialog("profile")}>
            <Settings className="h-4 w-4" />
          </button>
          <button className="rounded-md p-1.5 hover:bg-side-hover" title="Sign out" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className={`${view ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-white`}>
        {view?.kind === "channel" && activeChannel && (
          <ChatView key={activeChannel.id} channel={activeChannel} me={me} onBack={() => setView(null)} onOpenDm={openDm} onRead={refresh} />
        )}
        {view?.kind === "channel" && !activeChannel && sync && (
          <Empty text="This conversation is not available to you." />
        )}
        {view?.kind === "tasks" && <TasksView me={me} onBack={() => setView(null)} onOpen={(id) => setView({ kind: "channel", id })} />}
        {view?.kind === "approvals" && (
          <ApprovalsView me={me} onBack={() => setView(null)} onOpen={(id) => setView({ kind: "channel", id })} />
        )}
        {view?.kind === "notifications" && (
          <NotificationsView
            onBack={() => setView(null)}
            onNavigate={(link) => {
              const u = new URL(link, window.location.origin);
              window.history.pushState(null, "", u.pathname + u.search);
              setViewState(readUrlView());
            }}
            onRead={refresh}
          />
        )}
        {!view && <Empty text="Pick a city group or a chat to start messaging." />}
      </main>

      {dialog === "newChat" && (
        <NewChatDialog
          meId={me.id}
          onClose={() => setDialog(null)}
          onOpen={async (id) => {
            await refresh();
            setView({ kind: "channel", id });
          }}
        />
      )}
      {dialog === "profile" && (
        <ProfileDialog me={me} push={push} vapidKey={vapidKey} onPush={setPush} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="chat-bg flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="h-16 w-16 opacity-80" />
      <p className="max-w-xs text-sm text-slate-600">{text}</p>
    </div>
  );
}
