import { sql } from "drizzle-orm";
import { db } from "@/db";

// Someone counts as online if their app checked in within this window.
export const ONLINE_WINDOW_SECONDS = 60;
// Heartbeats are written at most this often per user.
const WRITE_EVERY_SECONDS = 25;
// Gaps shorter than this are treated as one continuous online period.
const SESSION_GAP_SECONDS = 120;

/**
 * Records that the user has the app open. Updates `users.last_seen_at` and extends (or starts)
 * the user's current online period. Throttled, and race-safe because the users UPDATE claims the write.
 */
export async function heartbeat(userId: number) {
  const claimed = await db.execute(sql`
    update users set last_seen_at = now()
    where id = ${userId} and (last_seen_at is null or last_seen_at < now() - make_interval(secs => ${WRITE_EVERY_SECONDS}))
    returning id
  `);
  if (claimed.length === 0) return;
  const extended = await db.execute(sql`
    update presence_sessions set ended_at = now()
    where id = (
      select id from presence_sessions
      where user_id = ${userId} and ended_at > now() - make_interval(secs => ${SESSION_GAP_SECONDS})
      order by ended_at desc limit 1
    )
    returning id
  `);
  if (extended.length === 0) {
    await db.execute(sql`insert into presence_sessions (user_id) values (${userId})`);
  }
}

export function isOnline(lastSeenAt: Date | string | null | undefined) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_SECONDS * 1000;
}
