"use client";

import { useEffect } from "react";
import { Calculator, HardHat, Megaphone, MessageCircle, TrendingUp, Truck, X } from "lucide-react";
import { avatarColor, initials } from "@/lib/client";

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.38 }}
    >
      {initials(name) || "?"}
    </div>
  );
}

export function Badge({ count, tone = "brand" }: { count: number; tone?: "brand" | "red" }) {
  if (!count) return null;
  return (
    <span
      className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-semibold text-white ${
        tone === "red" ? "bg-red-500" : "bg-brand-500"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChannelIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  const Icon =
    { sales: TrendingUp, project: HardHat, accounts: Calculator, dispatch: Truck, general: Megaphone }[type] ?? MessageCircle;
  return <Icon className={className} />;
}

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn-ghost p-1" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  acknowledged: "bg-sky-100 text-sky-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  done: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  changes_requested: "bg-orange-100 text-orange-800",
};

export function StatusPill({ status }: { status: string }) {
  const label = status === "open" ? "Not attended" : status.replace("_", " ");
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[status] ?? "bg-slate-100"}`}>
      {label}
    </span>
  );
}
