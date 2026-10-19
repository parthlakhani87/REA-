import { inArray, eq } from "drizzle-orm";
import webpush from "web-push";
import { db, schema } from "@/db";
import { notificationsPaused } from "./notification-switch";

const { notifications, pushSubscriptions, appSettings } = schema;

export type NotificationInput = { type: string; title: string; body?: string; link?: string };

type VapidKeys = { publicKey: string; privateKey: string };
let vapid: Promise<VapidKeys> | null = null;

/**
 * Push notification (VAPID) keys. Uses NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY when set;
 * otherwise generates a key pair once and stores it in the database, so push works with no setup.
 */
export function getVapidKeys(): Promise<VapidKeys> {
  vapid ??= (async () => {
    const env = process.env;
    let keys: VapidKeys;
    if (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      keys = { publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    } else {
      const generated = webpush.generateVAPIDKeys();
      // First writer wins; every instance then reads back the same stored pair.
      await db
        .insert(appSettings)
        .values({ key: "vapid_keys", value: JSON.stringify(generated) })
        .onConflictDoNothing();
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "vapid_keys"));
      keys = JSON.parse(row!.value) as VapidKeys;
    }
    webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:admin@pongs.app", keys.publicKey, keys.privateKey);
    return keys;
  })().catch((err) => {
    vapid = null;
    throw err;
  });
  return vapid;
}

// Stores an in-app notification for each user and sends a push notification to their devices.
export async function notifyUsers(userIds: number[], n: NotificationInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0 || (await notificationsPaused())) return;
  await db.insert(notifications).values(
    ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? "", link: n.link ?? null })),
  );
  await sendPush(ids, n);
}

export async function sendPush(userIds: number[], n: NotificationInput) {
  let sent = 0;
  if (userIds.length === 0) return { sent, devices: 0, paused: false };
  if (await notificationsPaused()) return { sent, devices: 0, paused: true };
  await getVapidKeys();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  // Tag per conversation/link so a new message replaces the previous one from the same chat, like WhatsApp.
  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/app", tag: `${n.type}:${n.link ?? ""}` });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 12,
          urgency: "high",
        });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // 404/410: the device unsubscribed. 403: subscribed with different keys; the app re-subscribes on next open.
        if (code === 404 || code === 410 || code === 403) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        } else {
          console.warn("push failed", code);
        }
      }
    }),
  );
  return { sent, devices: subs.length, paused: false };
}
