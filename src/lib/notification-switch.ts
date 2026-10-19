import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const KEY = "notifications_paused";
let cache: { value: boolean; at: number } | null = null;

/**
 * Company-wide notification switch, controlled from Administration.
 * While paused nothing is sent: no device push, no in-app alerts, no task/approval reminders.
 * A missing setting counts as paused — notifications stay off until an admin resumes them.
 */
export async function notificationsPaused(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, KEY));
  const value = row ? row.value === "true" : true;
  cache = { value, at: Date.now() };
  return value;
}

export async function setNotificationsPaused(paused: boolean) {
  if (!paused) {
    // Restart reminder clocks so resuming doesn't fire a burst of reminders for everything missed while paused.
    await db.execute(sql`update tasks set last_reminded_at = now() where status <> 'done'`);
    await db.execute(sql`update approvals set last_reminded_at = now() where status = 'pending'`);
  }
  await db
    .insert(schema.appSettings)
    .values({ key: KEY, value: String(paused) })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: String(paused) } });
  cache = { value: paused, at: Date.now() };
}
