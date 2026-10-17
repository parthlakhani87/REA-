"use client";

import { api } from "./client";

export type PushState = "unsupported" | "default" | "granted" | "denied";

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushStatus(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (Notification.permission !== "granted") return Notification.permission as PushState;
  // Permission granted: make sure this device's subscription is registered with the server.
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) api("/api/push/subscribe", { method: "POST", json: sub.toJSON() }).catch(() => {});
  return sub ? "granted" : "default";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(vapidKey: string): Promise<PushState> {
  if (!supported()) {
    alert("This browser does not support notifications. On iPhone, first add PONGS Connect to your Home Screen.");
    return "unsupported";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) }));
  await api("/api/push/subscribe", { method: "POST", json: sub.toJSON() });
  return "granted";
}
