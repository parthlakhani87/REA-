"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Download, Send, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { enablePush, isIOS, isStandalone, sendTestPush, type PushState } from "@/lib/push-client";
import { usePref } from "@/lib/prefs";
import { useApp } from "./app-context";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Chrome/Edge/Samsung fire this once per page load; keep it so the Install button can use it later.
let deferredPrompt: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function useInstall() {
  const [, force] = useState(0);
  const [standalone, setStandalone] = useState(true);
  useEffect(() => {
    setStandalone(isStandalone());
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    installed: standalone,
    canPrompt: !!deferredPrompt,
    ios: typeof navigator !== "undefined" && isIOS(),
    async install() {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      force((n) => n + 1);
      return outcome === "accepted";
    },
  };
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold ${
          done ? "bg-positive text-white" : "border border-line-strong text-ink-2"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-medium ${done ? "text-ink-3" : "text-ink"}`}>{title}</div>
        {!done && children && <div className="mt-1 text-[12.5px] text-ink-2">{children}</div>}
      </div>
    </li>
  );
}

/**
 * Walks an employee through installing the app on their phone and turning on device notifications.
 * `dismissible` cards hide themselves once set up (or when closed); the Settings version always shows.
 */
export function DeviceSetupCard({ push, onPush, dismissible }: { push: PushState; onPush: (p: PushState) => void; dismissible?: boolean }) {
  const { vapidKey, toast } = useApp();
  const { installed, canPrompt, ios, install } = useInstall();
  const [dismissed, setDismissed] = usePref<boolean>("device-setup-dismissed", false);
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(matchMedia("(max-width: 767px), (pointer: coarse)").matches), []);

  const needsInstall = !installed && (mobile || canPrompt);
  const pushOn = push === "granted";
  if (dismissible && (dismissed || (!needsInstall && pushOn))) return null;

  async function turnOn() {
    if (!vapidKey) return toast("Notifications are not available on the server yet", "danger");
    setBusy(true);
    try {
      const r = await enablePush(vapidKey);
      onPush(r);
      if (r === "granted") {
        toast("Notifications turned on");
        await sendTestPush().catch(() => {});
      } else if (r === "denied") toast("Notifications are blocked — allow them in your phone settings", "danger");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await sendTestPush();
      toast(r.sent ? `Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}` : "No device is registered yet — turn notifications on first", r.sent ? "positive" : "danger");
    } catch (e) {
      toast((e as Error).message, "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel relative p-4">
      {dismissible && (
        <button className="btn-ghost absolute top-2 right-2 p-1" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="mb-3 flex items-center gap-2.5 pr-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-ink">
          <Smartphone className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div>
          <div className="font-display text-[14px] font-bold">Get PONGS Connect on your phone</div>
          <div className="text-[12px] text-ink-3">Opens like an app and alerts you even when it is closed.</div>
        </div>
      </div>
      <ol className="space-y-3">
        <Step n={1} done={!needsInstall} title={installed ? "Installed on this device" : "Install the app"}>
          {canPrompt ? (
            <button className="btn-primary mt-1 px-2.5 py-1.5 text-xs" onClick={install}>
              <Download className="h-3.5 w-3.5" /> Install app
            </button>
          ) : ios ? (
            <span className="flex flex-wrap items-center gap-1">
              In Safari tap <Share className="inline h-3.5 w-3.5" /> <b>Share</b>, then <SquarePlus className="inline h-3.5 w-3.5" />{" "}
              <b>Add to Home Screen</b>. Open PONGS Connect from your Home Screen to continue.
            </span>
          ) : (
            <span>
              Open the browser menu <b>⋮</b> and choose <b>Install app</b> (or <b>Add to Home screen</b>).
            </span>
          )}
        </Step>
        <Step n={2} done={pushOn} title={pushOn ? "Notifications are on for this device" : "Turn on notifications"}>
          {push === "install" && <span>On iPhone, notifications work after step 1 — open the app from your Home Screen.</span>}
          {push === "denied" && (
            <span className="text-danger">
              Blocked. Open your phone&apos;s Settings → Notifications (or the browser&apos;s site settings) and allow PONGS Connect.
            </span>
          )}
          {push === "unsupported" && <span>This browser can&apos;t show notifications. Use Chrome on Android or Safari on iPhone (iOS 16.4+).</span>}
          {push === "default" && (
            <button className="btn-primary mt-1 px-2.5 py-1.5 text-xs" disabled={busy} onClick={turnOn}>
              <BellRing className="h-3.5 w-3.5" /> Turn on notifications
            </button>
          )}
        </Step>
      </ol>
      {pushOn && !dismissible && (
        <button className="btn-secondary mt-4 px-2.5 py-1.5 text-xs" disabled={busy} onClick={test}>
          <Send className="h-3.5 w-3.5" /> Send a test notification
        </button>
      )}
    </div>
  );
}
