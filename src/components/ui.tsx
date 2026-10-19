"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  HardHat,
  Hash,
  Megaphone,
  RotateCw,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { initials, isOnlineNow, lastSeenLabel } from "@/lib/client";

/* ---------- Identity ---------- */

export function Wordmark({ compact, tone = "dark" }: { compact?: boolean; tone?: "dark" | "light" }) {
  const ink = tone === "light" ? "text-white" : "text-ink";
  return (
    <div className="flex items-center gap-2.5 select-none">
      <LogoMark size={compact ? 24 : 28} />
      {!compact && (
        <div className={`font-display text-[13px] leading-none font-bold tracking-[0.18em] ${ink}`}>
          PONGS<span className="ml-1.5 font-semibold tracking-[0.18em] opacity-60">CONNECT</span>
        </div>
      )}
    </div>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden className="shrink-0">
      <rect width="512" height="512" rx="96" fill="#17232E" />
      <path d="M168 392V128h112a72 72 0 0 1 0 144H168" fill="none" stroke="#F5F6F4" strokeWidth="34" strokeLinecap="square" />
      <path d="M300 392h64" stroke="#B6E65B" strokeWidth="34" strokeLinecap="square" />
    </svg>
  );
}

// Muted, architectural tones — avatars should never be the loudest thing on screen.
const AVATAR_TONES = ["#2E4A5C", "#477B70", "#5B6B78", "#6E5F4E", "#3F5E7A", "#56705A", "#7A5A5A", "#4B5563", "#365F6B", "#6A6F45"];

export function toneFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

export function Avatar({ name, size = 32, ring }: { name: string; size?: number; ring?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-medium text-white ${ring ? "ring-2 ring-surface" : ""}`}
      style={{
        width: size,
        height: size,
        background: toneFor(name),
        fontSize: Math.max(10, size * 0.38),
        borderRadius: size >= 28 ? 8 : 6,
        letterSpacing: "0.02em",
      }}
      aria-hidden
    >
      {(size < 24 ? initials(name).slice(0, 1) : initials(name)) || "?"}
    </div>
  );
}

/* ---------- Badges & status ---------- */

export function Badge({ count, tone = "neutral" }: { count: number; tone?: "neutral" | "accent" | "danger" | "nav" }) {
  if (!count) return null;
  const cls = {
    neutral: "bg-graphite text-white dark:bg-surface-3 dark:text-ink",
    accent: "bg-lime text-graphite",
    danger: "bg-danger text-white",
    nav: "bg-lime text-graphite",
  }[tone];
  return (
    <span className={`ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[5px] px-1 text-[10.5px] leading-none font-semibold tabular-nums ${cls}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  sales: "Sales",
  project: "Project",
  accounts: "Accounts",
  dispatch: "Dispatch",
  general: "Company",
  dm: "Direct message",
};

export function ChannelIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  const Icon = { sales: TrendingUp, project: HardHat, accounts: Calculator, dispatch: Truck, general: Megaphone }[type] ?? Hash;
  return <Icon className={className} strokeWidth={1.75} />;
}

const STATUS: Record<string, { label: string; dot: string; cls: string }> = {
  open: { label: "Not attended", dot: "bg-danger", cls: "text-danger bg-danger-soft" },
  acknowledged: { label: "Acknowledged", dot: "bg-ink-3", cls: "text-ink-2 bg-surface-2" },
  in_progress: { label: "In progress", dot: "bg-graphite dark:bg-lime", cls: "text-ink bg-accent-soft" },
  done: { label: "Done", dot: "bg-positive", cls: "text-positive bg-positive-soft" },
  pending: { label: "Pending", dot: "bg-warn", cls: "text-warn bg-warn-soft" },
  approved: { label: "Approved", dot: "bg-positive", cls: "text-positive bg-positive-soft" },
  rejected: { label: "Rejected", dot: "bg-danger", cls: "text-danger bg-danger-soft" },
  changes_requested: { label: "Changes requested", dot: "bg-warn", cls: "text-warn bg-warn-soft" },
  overdue: { label: "Overdue", dot: "bg-danger", cls: "text-danger bg-danger-soft" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status.replace(/_/g, " "), dot: "bg-ink-4", cls: "text-ink-2 bg-surface-2" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/* ---------- Layout primitives ---------- */

export function PageHeader({
  title,
  subtitle,
  icon,
  onBack,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex min-h-14 items-center gap-3 border-b border-line bg-surface px-4 py-2.5 md:px-6">
      {onBack && (
        <button className="btn-ghost -ml-2 p-1.5 md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      {icon && <div className="hidden h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-2 sm:flex">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[17px] font-bold tracking-[-0.01em]">{title}</h1>
        {subtitle && <div className="hidden truncate text-xs text-ink-3 sm:block">{subtitle}</div>}
      </div>
      {children}
    </header>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string, number?][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-4 md:px-6" role="tablist">
      {options.map(([v, label, count]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`relative flex shrink-0 items-center gap-1.5 px-2 py-2.5 text-[13px] font-medium transition-colors ${
            value === v ? "text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          {label}
          {count !== undefined && <span className="text-[11px] text-ink-4 tabular-nums">{count}</span>}
          {value === v && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-graphite dark:bg-lime" />}
        </button>
      ))}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  count,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="eyebrow">{title}</h2>
        {count !== undefined && <span className="text-[11px] font-medium text-ink-4 tabular-nums">{count}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

/* ---------- States ---------- */

export function Skeleton({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-3">
          {avatar && <div className="h-8 w-8 shrink-0 rounded-lg bg-surface-3" />}
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2.5 rounded bg-surface-3" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
            <div className="h-2.5 rounded bg-surface-2" style={{ width: `${55 + ((i * 23) % 40)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type Motif = "membrane" | "profile" | "light" | "grid";

// Understated product references: a tensioned membrane, an aluminium profile section, a linear light.
export function Motif({ kind, className = "h-20 w-32" }: { kind: Motif; className?: string }) {
  const stroke = "var(--line-strong)";
  return (
    <svg viewBox="0 0 160 100" className={className} fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="159" height="99" rx="8" stroke="var(--line)" />
      {kind === "membrane" && (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M16 ${26 + i * 10} Q80 ${40 + i * 6} 144 ${26 + i * 10}`} stroke={stroke} strokeWidth="1" />
          ))}
          <path d="M16 20v66M144 20v66" stroke="var(--ink-3)" strokeWidth="2" />
        </>
      )}
      {kind === "profile" && (
        <>
          <path d="M40 24h80v12h-12v28h12v12H40V64h12V36H40z" stroke="var(--ink-3)" strokeWidth="1.5" />
          <path d="M52 36h56M52 64h56" stroke={stroke} strokeDasharray="3 3" />
        </>
      )}
      {kind === "light" && (
        <>
          <path d="M24 34h112" stroke="var(--ink-3)" strokeWidth="2" />
          <path d="M44 38h72" stroke="var(--lime)" strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${56 + i * 12} 44 L${44 + i * 18} 84`} stroke={stroke} strokeWidth="1" />
          ))}
        </>
      )}
      {kind === "grid" && (
        <>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={`v${i}`} d={`M${i * 20} 8v84`} stroke="var(--line)" />
          ))}
          {[1, 2, 3, 4].map((i) => (
            <path key={`h${i}`} d={`M8 ${i * 20}h144`} stroke="var(--line)" />
          ))}
          <rect x="60" y="40" width="40" height="20" stroke="var(--ink-3)" strokeWidth="1.5" />
          <circle cx="100" cy="40" r="3" fill="var(--lime)" />
        </>
      )}
    </svg>
  );
}

export function EmptyState({
  title,
  body,
  motif = "grid",
  action,
  compact,
}: {
  title: string;
  body?: React.ReactNode;
  motif?: Motif;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-16"}`}>
      {!compact && <Motif kind={motif} />}
      <div className="text-[14px] font-semibold">{title}</div>
      {body && <div className="max-w-sm text-[13px] text-ink-3">{body}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-[13px]" role="alert">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-danger">Something went wrong</div>
        <div className="text-ink-2">{message}</div>
      </div>
      {onRetry && (
        <button className="btn-secondary px-2 py-1 text-xs" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

/* ---------- Overlays ---------- */

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-graphite/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-surface shadow-[0_24px_64px_-24px_rgba(23,35,46,0.45)] sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
          <h2 className="font-display text-[15px] font-bold">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ text, tone = "positive" }: { text: string; tone?: "positive" | "danger" }) {
  return (
    <div
      role="status"
      className={`pointer-events-none fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 animate-fade-in items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium shadow-lg md:bottom-6 ${
        tone === "positive" ? "border-line bg-graphite text-white" : "border-danger/40 bg-danger text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "positive" ? "bg-lime" : "bg-white"}`} />
      {text}
    </div>
  );
}

export function highlight(text: string, q: string) {
  if (!q.trim()) return text;
  const terms = q.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "ig"));
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-ink">
        {p}
      </mark>
    ) : (
      p
    ),
  );
}

/* ---------- Presence ---------- */

// Avatar with a green "online" dot (WhatsApp/Slack style). Offline shows no dot.
export function PresenceAvatar({ name, size = 32, lastSeenAt }: { name: string; size?: number; lastSeenAt: string | null | undefined }) {
  const online = isOnlineNow(lastSeenAt);
  const dot = Math.max(8, Math.round(size * 0.3));
  return (
    <span className="relative inline-flex shrink-0" title={lastSeenLabel(lastSeenAt)}>
      <Avatar name={name} size={size} />
      {online && (
        <span
          className="absolute rounded-full bg-positive ring-2 ring-surface"
          style={{ width: dot, height: dot, right: -2, bottom: -2 }}
          aria-label="Online"
        />
      )}
    </span>
  );
}

export function PresenceText({ lastSeenAt, className = "" }: { lastSeenAt: string | null | undefined; className?: string }) {
  const online = isOnlineNow(lastSeenAt);
  return (
    <span className={`inline-flex items-center gap-1.5 ${online ? "text-positive" : "text-ink-3"} ${className}`}>
      {online && <span className="h-1.5 w-1.5 rounded-full bg-positive" />}
      {lastSeenLabel(lastSeenAt)}
    </span>
  );
}
