"use client";

import { api } from "./client";

// "install": iPhone/iPad in Safari — notifications only work once the app is added to the Home Screen.
export type PushState = "unsupported" | "install" | "default" | "granted" | "denied";

export function isIOS() {
  return typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function sameKey(sub: PushSubscription, vapidKey: string) {
  const current = sub.options.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  const b = urlBase64ToUint8Array(vapidKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Creates (or repairs) this device's subscription and registers it with the server.
async function subscribe(vapidKey: string) {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, vapidKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
  await api("/api/push/subscribe", { method: "POST", json: sub.toJSON() });
}

export async function pushStatus(vapidKey: string | null): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() ? "install" : "unsupported";
  if (Notification.permission !== "granted") return Notification.permission as PushState;
  // Permission already granted: keep this device's subscription valid without prompting again.
  if (!vapidKey) return "default";
  try {
    await subscribe(vapidKey);
    return "granted";
  } catch {
    return "default";
  }
}

export async function enablePush(vapidKey: string): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() ? "install" : "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  await subscribe(vapidKey);
  return "granted";
}

export async function sendTestPush() {
  return api<{ sent: number; devices: number; paused?: boolean }>("/api/push/test", { method: "POST" });
}

// Unread count on the home-screen icon (Android / iOS / desktop installed apps).
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch {}
}
