import { inArray, eq } from "drizzle-orm";
import webpush from "web-push";
import { db, schema } from "@/db";

const { notifications, pushSubscriptions } = schema;

export type NotificationInput = { type: string; title: string; body?: string; link?: string };

let vapidReady: boolean | null = null;
function pushEnabled() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = Boolean(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub!, priv!);
  return vapidReady;
}

// Stores an in-app notification for each user and sends a push notification to their devices.
export async function notifyUsers(userIds: number[], n: NotificationInput) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await db.insert(notifications).values(
    ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body ?? "", link: n.link ?? null })),
  );
  await sendPush(ids, n);
}

export async function sendPush(userIds: number[], n: NotificationInput) {
  if (!pushEnabled() || userIds.length === 0) return;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  const payload = JSON.stringify({ title: n.title, body: n.body ?? "", url: n.link ?? "/app", tag: n.type });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 12,
        });
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
        } else {
          console.warn("push failed", code);
        }
      }
    }),
  );
}
