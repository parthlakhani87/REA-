"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AtSign,
  BadgeCheck,
  Bookmark,
  CornerDownLeft,
  FolderOpen,
  Home,
  Keyboard,
  ListChecks,
  Megaphone,
  Moon,
  PenSquare,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { api, type ChannelSummary, type DirectoryUser } from "@/lib/client";
import { applyTheme, currentTheme } from "@/lib/prefs";
import { channelLabel, useApp, type View } from "./app-context";
import { Avatar, ChannelIcon, Kbd, Modal } from "./ui";

type Item = { id: string; group: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; keywords?: string };

export function CommandPalette({
  ordered,
  onClose,
  onNewChat,
  onShortcuts,
}: {
  ordered: ChannelSummary[];
  onClose: () => void;
  onNewChat: () => void;
  onShortcuts: () => void;
}) {
  const { go, openDm, me } = useApp();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ users: DirectoryUser[] }>("/api/users").then((r) => setPeople(r.users)).catch(() => {});
  }, []);

  const items = useMemo<Item[]>(() => {
    const nav = (v: View) => () => {
      onClose();
      go(v);
    };
    const ic = "h-4 w-4";
    const all: Item[] = [];
    const query = q.trim();
    if (query.length >= 2) {
      all.push({
        id: "search",
        group: "Search",
        label: `Search everything for “${query}”`,
        icon: <Search className={ic} />,
        run: nav({ kind: "search", q: query }),
      });
    }
    for (const c of ordered) {
      all.push({
        id: `c${c.id}`,
        group: c.type === "dm" ? "Direct messages" : "Channels",
        label: c.type === "dm" ? c.name : channelLabel(c),
        hint: c.type === "dm" ? undefined : (c.cityName ?? "Company"),
        icon: c.type === "dm" ? <Avatar name={c.name} size={18} /> : <ChannelIcon type={c.type} className={ic} />,
        keywords: `${c.name} ${c.cityName ?? ""} ${c.type}`,
        run: nav({ kind: "channel", id: c.id }),
      });
    }
    if (query) {
      for (const p of people.filter((p) => p.id !== me.id)) {
        all.push({
          id: `p${p.id}`,
          group: "People",
          label: p.name,
          hint: [p.department, p.cityName].filter(Boolean).join(" · "),
          icon: <Avatar name={p.name} size={18} />,
          keywords: `${p.name} ${p.department ?? ""} ${p.cityName ?? ""}`,
          run: () => {
            onClose();
            openDm(p.id);
          },
        });
      }
    }
    const dark = currentTheme() === "dark";
    all.push(
      { id: "home", group: "Go to", label: "Home", icon: <Home className={ic} />, run: nav({ kind: "home" }) },
      { id: "mentions", group: "Go to", label: "Mentions", icon: <AtSign className={ic} />, run: nav({ kind: "mentions" }) },
      { id: "saved", group: "Go to", label: "Saved messages", icon: <Bookmark className={ic} />, run: nav({ kind: "saved" }) },
      { id: "tasks", group: "Go to", label: "Action items", icon: <ListChecks className={ic} />, run: nav({ kind: "tasks" }) },
      { id: "approvals", group: "Go to", label: "Costing approvals", icon: <BadgeCheck className={ic} />, run: nav({ kind: "approvals" }) },
      { id: "ann", group: "Go to", label: "Announcements", icon: <Megaphone className={ic} />, run: nav({ kind: "announcements" }) },
      { id: "dir", group: "Go to", label: "Team directory", icon: <Users className={ic} />, run: nav({ kind: "directory" }) },
      { id: "files", group: "Go to", label: "Shared files", icon: <FolderOpen className={ic} />, run: nav({ kind: "files" }) },
      { id: "settings", group: "Go to", label: "Settings", icon: <Settings className={ic} />, run: nav({ kind: "settings" }) },
      {
        id: "new",
        group: "Actions",
        label: "New direct message",
        icon: <PenSquare className={ic} />,
        run: () => {
          onClose();
          onNewChat();
        },
      },
      {
        id: "theme",
        group: "Actions",
        label: dark ? "Switch to light theme" : "Switch to dark theme",
        icon: dark ? <Sun className={ic} /> : <Moon className={ic} />,
        run: () => {
          applyTheme(dark ? "light" : "dark");
          onClose();
        },
      },
      {
        id: "keys",
        group: "Actions",
        label: "Keyboard shortcuts",
        icon: <Keyboard className={ic} />,
        run: () => {
          onClose();
          onShortcuts();
        },
      },
    );
    if (!query) return all.filter((i) => i.group !== "Channels" || ordered.find((c) => `c${c.id}` === i.id)?.unread).slice(0, 40);
    const terms = query.toLowerCase().split(/\s+/);
    return all
      .filter((i) => i.id === "search" || terms.every((t) => `${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(t)))
      .slice(0, 40);
  }, [q, ordered, people, me.id, go, openDm, onClose, onNewChat, onShortcuts]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-graphite/40 p-3 pt-[10vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Command menu"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(23,35,46,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[sel]?.run();
              } else if (e.key === "Escape") onClose();
            }}
            placeholder="Jump to a channel, person or page — or search everything"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-4"
            aria-label="Command or search"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={list} className="scroll-thin max-h-[56vh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-ink-3">No matches. Press Enter on “Search everything” to look inside messages.</div>}
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="eyebrow px-2.5 pt-2.5 pb-1 text-[10.5px]">{header}</div>}
                <button
                  data-idx={idx}
                  role="option"
                  aria-selected={idx === sel}
                  onMouseMove={() => setSel(idx)}
                  onClick={it.run}
                  className={`flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px] ${idx === sel ? "bg-surface-2 text-ink" : "text-ink-2"}`}
                >
                  <span className="flex w-5 justify-center text-ink-3">{it.icon}</span>
                  <span className="truncate">{it.label}</span>
                  {it.hint && <span className="truncate text-[12px] text-ink-4">{it.hint}</span>}
                  {idx === sel && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-4" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>?</Kbd> all shortcuts
          </span>
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ["Open command menu & search", ["Ctrl", "K"]],
  ["Quick search", ["/"]],
  ["Next / previous conversation", ["Alt", "↑ ↓"]],
  ["Next unread conversation", ["Alt", "Shift", "↓"]],
  ["Send message", ["Enter"]],
  ["New line in message", ["Shift", "Enter"]],
  ["Mention someone", ["@"]],
  ["Cancel reply / close dialog", ["Esc"]],
  ["Toggle details panel", ["Ctrl", "."]],
  ["Show this list", ["?"]],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <div className="divide-y divide-line">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-ink-2">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">On a Mac, use ⌘ in place of Ctrl.</p>
    </Modal>
  );
}
