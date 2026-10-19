"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Bell,
  BellRing,
  Bookmark,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Home,
  ListChecks,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessagesSquare,
  PenSquare,
  Search,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";
import { api, formatTime, type ChannelSummary, type Me } from "@/lib/client";
import { enablePush, pushStatus, setAppBadge, type PushState } from "@/lib/push-client";
import { useSaved, usePref } from "@/lib/prefs";
import { Ctx, VIEW_LABELS, channelLabel, useApp as useApp_, type AppContext, type Sync, type View, type ViewKind } from "./app-context";
import { ChatView } from "./ChatView";
import { CommandPalette, ShortcutsDialog } from "./CommandPalette";
import { NewChatDialog } from "./Dialogs";
import {
  AnnouncementsView,
  DirectoryView,
  FilesView,
  HomeView,
  MentionsView,
  SavedView,
  SearchView,
  SettingsView,
} from "./Pages";
import { ApprovalsView, NotificationsView, TasksView } from "./Views";
import { Avatar, Badge, ChannelIcon, EmptyState, Kbd, PresenceAvatar, Toast, Wordmark } from "./ui";

const DEPT_ORDER = ["sales", "project", "accounts", "dispatch"];
const SYNC_MS = 5000;
const SIMPLE_VIEWS: ViewKind[] = [
  "home",
  "chats",
  "mentions",
  "saved",
  "tasks",
  "approvals",
  "notifications",
  "announcements",
  "directory",
  "files",
  "settings",
];

function readUrlView(): View {
  const p = new URLSearchParams(window.location.search);
  const c = Number(p.get("c"));
  if (c) return { kind: "channel", id: c, m: Number(p.get("m")) || undefined };
  const v = p.get("view");
  if (v === "search") return { kind: "search", q: p.get("q") ?? "" };
  if (v && (SIMPLE_VIEWS as string[]).includes(v)) return { kind: v as Exclude<ViewKind, "search"> };
  return { kind: "home" };
}

function viewUrl(v: View) {
  if (v.kind === "channel") return `/app?c=${v.id}${v.m ? `&m=${v.m}` : ""}`;
  if (v.kind === "search") return `/app?view=search${v.q ? `&q=${encodeURIComponent(v.q)}` : ""}`;
  return v.kind === "home" ? "/app" : `/app?view=${v.kind}`;
}

export function Shell({ me, vapidKey }: { me: Me; vapidKey: string | null }) {
  const [sync, setSync] = useState<Sync | null>(null);
  const [view, setViewState] = useState<View>({ kind: "home" });
  const [dialog, setDialog] = useState<null | "newChat" | "palette" | "shortcuts">(null);
  const [push, setPush] = useState<PushState>("unsupported");
  const [drawer, setDrawer] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; tone: "positive" | "danger" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { saved, isSaved, toggle } = useSaved(me.id);

  const go = useCallback((v: View) => {
    setViewState(v);
    setDrawer(false);
    window.history.pushState(null, "", viewUrl(v));
  }, []);

  const refresh = useCallback(async () => {
    try {
      // active=1 marks the user online; only sent while the app is actually on screen.
      setSync(await api<Sync>(`/api/sync${document.visibilityState === "visible" ? "?active=1" : ""}`));
    } catch {}
  }, []);

  const toast = useCallback((text: string, tone: "positive" | "danger" = "positive") => {
    clearTimeout(toastTimer.current);
    setToastMsg({ text, tone });
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  useEffect(() => {
    setViewState(readUrlView());
    const onPop = () => setViewState(readUrlView());
    window.addEventListener("popstate", onPop);
    refresh();
    const t = setInterval(refresh, SYNC_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    pushStatus(vapidKey).then(setPush);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(t);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh, vapidKey]);

  const totalUnread = useMemo(() => sync?.channels.reduce((s, c) => s + c.unread, 0) ?? 0, [sync]);
  useEffect(() => {
    document.title = totalUnread ? `(${totalUnread}) PONGS Connect` : "PONGS Connect";
    setAppBadge(totalUnread);
  }, [totalUnread]);

  const openDm = useCallback(
    async (userId: number) => {
      const r = await api<{ channelId: number }>("/api/dm", { method: "POST", json: { userId } });
      await refresh();
      go({ kind: "channel", id: r.channelId });
    },
    [refresh, go],
  );

  // Ordered list used for keyboard navigation between conversations.
  const ordered = useMemo(() => {
    const list = sync?.channels ?? [];
    const company = list.filter((c) => c.type === "general");
    const city = list
      .filter((c) => c.cityName)
      .sort((a, b) => (a.cityName ?? "").localeCompare(b.cityName ?? "") || DEPT_ORDER.indexOf(a.type) - DEPT_ORDER.indexOf(b.type));
    const dms = list.filter((c) => c.type === "dm").sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
    return [...company, ...city, ...dms];
  }, [sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDialog((d) => (d === "palette" ? null : "palette"));
        return;
      }
      if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const idx = view.kind === "channel" ? ordered.findIndex((c) => c.id === view.id) : -1;
        const dir = e.key === "ArrowDown" ? 1 : -1;
        if (e.shiftKey) {
          for (let i = 1; i <= ordered.length; i++) {
            const c = ordered[(idx + dir * i + ordered.length * 2) % ordered.length];
            if (c && c.unread > 0) return go({ kind: "channel", id: c.id });
          }
          return toast("No unread conversations");
        }
        const next = ordered[(idx + dir + ordered.length) % ordered.length];
        if (next) go({ kind: "channel", id: next.id });
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") setDialog("shortcuts");
      if (e.key === "/") {
        e.preventDefault();
        setDialog("palette");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ordered, view, go, toast]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const activeChannel = view.kind === "channel" ? sync?.channels.find((c) => c.id === view.id) : undefined;
  const inConversation = view.kind === "channel";

  const ctx: AppContext = {
    me,
    sync,
    refresh,
    go,
    openDm,
    saved,
    isSaved,
    toggleSaved: (m) => {
      const was = isSaved(m.id);
      toggle(m);
      toast(was ? "Removed from saved" : "Saved for later");
    },
    toast,
    vapidKey,
    push,
    setPush,
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
        {/* Top bar */}
        <header className={`${inConversation ? "hidden md:flex" : "flex"} h-12 shrink-0 items-center gap-3 bg-nav px-3 text-nav-ink md:px-4`}>
          <button className="rounded-md p-1.5 text-nav-ink-2 hover:bg-nav-2 hover:text-white md:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <button className="md:w-[228px]" onClick={() => go({ kind: "home" })} aria-label="PONGS Connect home">
            <Wordmark tone="light" />
          </button>
          <button
            onClick={() => setDialog("palette")}
            className="ml-auto flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-[13px] text-nav-ink-2 transition-colors hover:border-white/20 hover:bg-white/10 md:mx-auto md:ml-0 md:w-full md:max-w-xl"
            aria-label="Search and commands"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search messages, people, files…</span>
            <span className="ml-auto hidden items-center gap-1 md:flex">
              <kbd className="rounded border border-white/15 px-1.5 text-[10px] leading-4">Ctrl K</kbd>
            </span>
          </button>
          <div className="flex items-center gap-1 md:w-[228px] md:justify-end">
            <button
              className="relative rounded-md p-1.5 text-nav-ink-2 hover:bg-nav-2 hover:text-white"
              onClick={() => go({ kind: "notifications" })}
              aria-label={`Notifications${sync?.unreadNotifications ? ` (${sync.unreadNotifications} unread)` : ""}`}
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {!!sync?.unreadNotifications && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-lime ring-2 ring-nav" />}
            </button>
            <button
              className="hidden rounded-md p-1.5 text-nav-ink-2 hover:bg-nav-2 hover:text-white md:block"
              onClick={() => setDialog("newChat")}
              title="New direct message"
              aria-label="New direct message"
            >
              <PenSquare className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
            <UserMenu me={me} onSettings={() => go({ kind: "settings" })} onLogout={logout} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Sidebar: persistent on desktop, a drawer on mobile */}
          {drawer && <div className="fixed inset-0 z-40 animate-fade-in bg-graphite/40 md:hidden" onClick={() => setDrawer(false)} />}
          <aside
            className={`${drawer ? "fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-[320px] animate-panel-in shadow-2xl" : "hidden"} flex-col border-r border-line bg-surface-2 md:static md:z-auto md:flex md:w-[260px] md:max-w-none md:shrink-0 md:animate-none md:shadow-none`}
          >
            {drawer && (
              <div className="flex h-12 items-center justify-between border-b border-line px-3 md:hidden">
                <Wordmark />
                <button className="btn-ghost p-1" onClick={() => setDrawer(false)} aria-label="Close navigation">
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            <Sidebar view={view} push={push} onPush={setPush} onNewChat={() => setDialog("newChat")} />
          </aside>

          <main className={`flex min-w-0 flex-1 flex-col bg-surface ${inConversation ? "" : "pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0"}`}>
            {view.kind === "channel" && activeChannel && <ChatView key={activeChannel.id} channel={activeChannel} focusId={view.m} onBack={() => go({ kind: "chats" })} />}
            {view.kind === "channel" && !activeChannel && sync && (
              <EmptyState motif="profile" title="Conversation unavailable" body="This conversation does not exist or you are no longer a member." />
            )}
            {view.kind === "home" && <HomeView />}
            {view.kind === "chats" && (
              <div className="flex min-h-0 flex-1 flex-col md:hidden">
                <ConversationList view={view} onNewChat={() => setDialog("newChat")} />
              </div>
            )}
            {view.kind === "chats" && (
              <div className="hidden flex-1 md:flex">
                <EmptyState motif="membrane" title="Select a conversation" body="Pick a department channel or a direct message from the sidebar." />
              </div>
            )}
            {view.kind === "mentions" && <MentionsView />}
            {view.kind === "saved" && <SavedView />}
            {view.kind === "announcements" && <AnnouncementsView />}
            {view.kind === "directory" && <DirectoryView />}
            {view.kind === "files" && <FilesView />}
            {view.kind === "search" && <SearchView key={view.q} initialQuery={view.q} />}
            {view.kind === "settings" && <SettingsView push={push} onPush={setPush} />}
            {view.kind === "tasks" && <TasksView me={me} onBack={() => go({ kind: "home" })} onOpen={(id) => go({ kind: "channel", id })} />}
            {view.kind === "approvals" && <ApprovalsView me={me} onBack={() => go({ kind: "home" })} onOpen={(id) => go({ kind: "channel", id })} />}
            {view.kind === "notifications" && (
              <NotificationsView
                onBack={() => go({ kind: "home" })}
                onNavigate={(link) => {
                  const u = new URL(link, window.location.origin);
                  window.history.pushState(null, "", u.pathname + u.search);
                  setViewState(readUrlView());
                }}
                onRead={refresh}
              />
            )}
          </main>
        </div>

        {/* Mobile bottom navigation — hidden inside a conversation to give the composer room */}
        {!inConversation && <BottomNav view={view} />}

        {dialog === "newChat" && (
          <NewChatDialog
            meId={me.id}
            onClose={() => setDialog(null)}
            onOpen={async (id) => {
              await refresh();
              go({ kind: "channel", id });
            }}
          />
        )}
        {dialog === "palette" && (
          <CommandPalette
            ordered={ordered}
            onClose={() => setDialog(null)}
            onNewChat={() => setDialog("newChat")}
            onShortcuts={() => setDialog("shortcuts")}
          />
        )}
        {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
        {toastMsg && <Toast text={toastMsg.text} tone={toastMsg.tone} />}
      </div>
    </Ctx.Provider>
  );
}

/* ---------- Sidebar ---------- */

function NavItem({
  icon,
  label,
  active,
  count,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  count?: number;
  tone?: "neutral" | "danger";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors ${
        active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-surface-3/70 hover:text-ink"
      }`}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-lime" />}
      <span className={active ? "text-ink" : "text-ink-3"}>{icon}</span>
      <span className="truncate">{label}</span>
      <Badge count={count ?? 0} tone={tone} />
    </button>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center px-2.5 pt-2">
      <span className="eyebrow text-[10.5px]">{children}</span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

function Sidebar({
  view,
  push,
  onPush,
  onNewChat,
}: {
  view: View;
  push: PushState;
  onPush: (p: PushState) => void;
  onNewChat: () => void;
}) {
  const { me, sync, go, vapidKey } = useApp_();
  const ic = "h-4 w-4";
  const is = (k: string) => view.kind === k;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-3" aria-label="Workspace">
        <div className="space-y-px">
          <NavItem icon={<Home className={ic} strokeWidth={1.75} />} label="Home" active={is("home")} onClick={() => go({ kind: "home" })} />
          <NavItem icon={<AtSign className={ic} strokeWidth={1.75} />} label="Mentions" active={is("mentions")} onClick={() => go({ kind: "mentions" })} />
          <NavItem icon={<Bookmark className={ic} strokeWidth={1.75} />} label="Saved messages" active={is("saved")} onClick={() => go({ kind: "saved" })} />
          <NavItem
            icon={<ListChecks className={ic} strokeWidth={1.75} />}
            label="Action items"
            active={is("tasks")}
            count={sync?.openTasks}
            onClick={() => go({ kind: "tasks" })}
          />
          {(me.canApprove || me.role === "admin" || !!sync?.pendingApprovals) && (
            <NavItem
              icon={<BadgeCheck className={ic} strokeWidth={1.75} />}
              label="Costing approvals"
              active={is("approvals")}
              count={sync?.pendingApprovals}
              tone="danger"
              onClick={() => go({ kind: "approvals" })}
            />
          )}
          <NavItem icon={<Megaphone className={ic} strokeWidth={1.75} />} label="Announcements" active={is("announcements")} onClick={() => go({ kind: "announcements" })} />
          <NavItem icon={<Users className={ic} strokeWidth={1.75} />} label="Team directory" active={is("directory")} onClick={() => go({ kind: "directory" })} />
          <NavItem icon={<FolderOpen className={ic} strokeWidth={1.75} />} label="Shared files" active={is("files")} onClick={() => go({ kind: "files" })} />
        </div>

        {push === "default" && vapidKey && !sync?.notificationsPaused && (
          <button
            onClick={async () => onPush(await enablePush(vapidKey))}
            className="mt-3 flex w-full items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs text-ink-2 hover:border-line-strong"
          >
            <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" />
            <span>
              <span className="block font-medium text-ink">Turn on notifications</span>
              Never miss an action item or approval.
            </span>
          </button>
        )}

        <ChannelSections view={view} onNewChat={onNewChat} />
      </nav>

      <div className="space-y-px border-t border-line px-2 py-2">
        {me.role === "admin" && (
          <a href="/admin" className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-2 hover:bg-surface-3/70 hover:text-ink">
            <Shield className="h-4 w-4 text-ink-3" strokeWidth={1.75} /> Administration
          </a>
        )}
        <NavItem icon={<Settings className="h-4 w-4" strokeWidth={1.75} />} label="Settings" active={is("settings")} onClick={() => go({ kind: "settings" })} />
      </div>
    </div>
  );
}

function useGroups(location: string) {
  const { sync } = useApp_();
  return useMemo(() => {
    const list = sync?.channels ?? [];
    const company = list.filter((c) => c.type === "general");
    const dms = list.filter((c) => c.type === "dm").sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
    const cities = new Map<string, ChannelSummary[]>();
    for (const c of list) {
      if (!c.cityName || (location !== "all" && c.cityName !== location)) continue;
      if (!cities.has(c.cityName)) cities.set(c.cityName, []);
      cities.get(c.cityName)!.push(c);
    }
    for (const arr of cities.values()) arr.sort((a, b) => DEPT_ORDER.indexOf(a.type) - DEPT_ORDER.indexOf(b.type));
    const allCities = [...new Set(list.map((c) => c.cityName).filter((x): x is string => !!x))].sort();
    return { company, dms, cities: [...cities.entries()].sort(([a], [b]) => a.localeCompare(b)), allCities };
  }, [sync, location]);
}

function ChannelRow({ c, label, active, onClick }: { c: ChannelSummary; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors ${
        active
          ? "bg-graphite text-white dark:bg-surface dark:shadow-[0_0_0_1px_var(--line)]"
          : c.unread
            ? "font-semibold text-ink hover:bg-surface-3/70"
            : "text-ink-2 hover:bg-surface-3/70 hover:text-ink"
      } ${!c.isMember ? "opacity-60" : ""}`}
    >
      <span className={active ? "text-lime" : c.unread ? "text-ink" : "text-ink-4"}>
        <ChannelIcon type={c.type} className="h-3.5 w-3.5" />
      </span>
      <span className="truncate">{label}</span>
      <Badge count={c.unread} tone={active ? "accent" : "neutral"} />
    </button>
  );
}

function DmRow({ c, active, onClick, detailed }: { c: ChannelSummary; active: boolean; onClick: () => void; detailed?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors ${detailed ? "py-2.5" : "h-8"} ${
        active ? "bg-graphite text-white dark:bg-surface dark:shadow-[0_0_0_1px_var(--line)]" : "hover:bg-surface-3/70"
      }`}
    >
      <PresenceAvatar name={c.name} size={detailed ? 36 : 20} lastSeenAt={c.dmLastSeenAt} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-[13px] ${c.unread ? "font-semibold" : active ? "" : "text-ink-2"}`}>{c.name}</span>
          {detailed && c.lastMessageAt && <span className="ml-auto shrink-0 text-[11px] text-ink-4">{formatTime(c.lastMessageAt)}</span>}
          {!detailed && <Badge count={c.unread} tone={active ? "accent" : "neutral"} />}
        </div>
        {detailed && (
          <div className="flex items-center gap-2">
            <span className="truncate text-[12.5px] text-ink-3">{c.lastMessagePreview ?? "Start the conversation"}</span>
            <Badge count={c.unread} />
          </div>
        )}
      </div>
    </button>
  );
}

function ChannelSections({ view, onNewChat, detailed }: { view: View; onNewChat: () => void; detailed?: boolean }) {
  const { go, sync } = useApp_();
  const [location, setLocation] = usePref<string>("location", "all");
  const [collapsed, setCollapsed] = usePref<Record<string, boolean>>("collapsed", {});
  const g = useGroups(location);
  const activeId = view.kind === "channel" ? view.id : null;

  if (!sync) {
    return (
      <div className="mt-4 space-y-2 px-2.5" aria-busy="true">
        {[60, 72, 48, 66, 54].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded bg-surface-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  const toggle = (k: string) => setCollapsed({ ...collapsed, [k]: !collapsed[k] });

  return (
    <div className="mt-2">
      {g.allCities.length > 1 && (
        <label className="mt-2 flex h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] text-ink-2 focus-within:border-teal">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={1.75} />
          <span className="sr-only">Location</span>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent font-medium text-ink outline-none"
          >
            <option value="all">All locations</option>
            {g.allCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 text-ink-4" />
        </label>
      )}

      {g.company.length > 0 && (
        <>
          <SectionLabel>Company</SectionLabel>
          {g.company.map((c) => (
            <ChannelRow key={c.id} c={c} label={c.name} active={activeId === c.id} onClick={() => go({ kind: "channel", id: c.id })} />
          ))}
        </>
      )}

      {g.cities.length > 0 && (
        <>
          <SectionLabel>Department channels</SectionLabel>
          {g.cities.map(([city, chans]) => {
            const unread = chans.reduce((s, c) => s + c.unread, 0);
            const isCollapsed = !!collapsed[city];
            const single = g.cities.length === 1;
            return (
              <div key={city}>
                {!single && (
                  <button
                    onClick={() => toggle(city)}
                    aria-expanded={!isCollapsed}
                    className="flex h-7 w-full items-center gap-1.5 rounded-lg px-2.5 text-left text-[12px] font-medium text-ink-3 hover:text-ink"
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {city}
                    {isCollapsed && <Badge count={unread} />}
                  </button>
                )}
                {(!isCollapsed || single) &&
                  chans.map((c) => (
                    <ChannelRow key={c.id} c={c} label={channelLabel(c)} active={activeId === c.id} onClick={() => go({ kind: "channel", id: c.id })} />
                  ))}
              </div>
            );
          })}
        </>
      )}

      <SectionLabel
        action={
          <button className="rounded p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink" onClick={onNewChat} title="New direct message" aria-label="New direct message">
            <PenSquare className="h-3.5 w-3.5" />
          </button>
        }
      >
        Direct messages
      </SectionLabel>
      {g.dms.map((c) => (
        <DmRow key={c.id} c={c} detailed={detailed} active={activeId === c.id} onClick={() => go({ kind: "channel", id: c.id })} />
      ))}
      {g.dms.length === 0 && (
        <button onClick={onNewChat} className="px-2.5 py-1 text-left text-[12.5px] text-ink-3 hover:text-ink">
          Start a direct message…
        </button>
      )}
    </div>
  );
}

// Mobile "Conversations" tab: the same channel structure with message previews.
function ConversationList({ view, onNewChat }: { view: View; onNewChat: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center border-b border-line px-4">
        <h1 className="flex-1 font-display text-[17px] font-bold">Conversations</h1>
        <button className="btn-primary px-2.5 py-1.5" onClick={onNewChat}>
          <PenSquare className="h-4 w-4" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <ChannelSections view={view} onNewChat={onNewChat} detailed />
      </div>
    </>
  );
}

function BottomNav({ view }: { view: View }) {
  const { go, sync } = useApp_();
  const unread = sync?.channels.reduce((s, c) => s + c.unread, 0) ?? 0;
  const items: [ViewKind, React.ReactNode, number][] = [
    ["home", <Home key="h" className="h-5 w-5" strokeWidth={1.75} />, 0],
    ["chats", <MessagesSquare key="c" className="h-5 w-5" strokeWidth={1.75} />, unread],
    ["tasks", <ListChecks key="t" className="h-5 w-5" strokeWidth={1.75} />, sync?.openTasks ?? 0],
    ["mentions", <AtSign key="m" className="h-5 w-5" strokeWidth={1.75} />, 0],
    ["search", <Search key="s" className="h-5 w-5" strokeWidth={1.75} />, 0],
  ];
  const short: Partial<Record<ViewKind, string>> = { chats: "Chats", tasks: "Actions" };
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {items.map(([k, icon, count]) => {
        const active = view.kind === k;
        return (
          <button
            key={k}
            onClick={() => go(k === "search" ? { kind: "search", q: "" } : ({ kind: k } as View))}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${active ? "text-ink" : "text-ink-3"}`}
            aria-current={active ? "page" : undefined}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-lime" />}
            <span className="relative">
              {icon}
              {count > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-[5px] bg-graphite px-1 text-[9.5px] font-semibold text-white dark:bg-lime dark:text-graphite">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            {short[k] ?? VIEW_LABELS[k].split(" ")[0]}
          </button>
        );
      })}
    </nav>
  );
}

function UserMenu({ me, onSettings, onLogout }: { me: Me; onSettings: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button className="ml-1 rounded-lg p-0.5 hover:ring-2 hover:ring-white/20" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open}>
        <Avatar name={me.name} size={28} />
      </button>
      {open && (
        <div className="absolute top-10 right-0 z-50 w-60 animate-fade-in overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-[0_16px_40px_-16px_rgba(23,35,46,0.35)]">
          <div className="flex items-center gap-3 border-b border-line px-3 py-3">
            <Avatar name={me.name} size={36} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{me.name}</div>
              <div className="truncate text-xs text-ink-3 capitalize">
                {me.role}
                {me.canApprove ? " · approver" : ""}
              </div>
            </div>
          </div>
          <div className="p-1">
            <MenuItem
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
              icon={<Settings className="h-4 w-4" />}
            >
              Settings & notifications
            </MenuItem>
            {me.role === "admin" && (
              <a href="/admin" className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] hover:bg-surface-2">
                <Shield className="h-4 w-4 text-ink-3" /> Administration
              </a>
            )}
            <MenuItem onClick={onLogout} icon={<LogOut className="h-4 w-4" />}>
              Sign out
            </MenuItem>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line px-3 py-2 text-[11px] text-ink-3">
            Press <Kbd>?</Kbd> for keyboard shortcuts
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] hover:bg-surface-2">
      <span className="text-ink-3">{icon}</span>
      {children}
    </button>
  );
}
