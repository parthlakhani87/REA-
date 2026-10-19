import { after } from "next/server";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, json, requireUser } from "@/lib/api";
import { visibleApprovals } from "@/lib/access";
import { claimOpportunisticSweep, runReminderSweep } from "@/lib/reminders";
import { heartbeat } from "@/lib/presence";
import { notificationsPaused } from "@/lib/notification-switch";

export type ChannelSummary = {
  id: number;
  type: string;
  name: string;
  cityId: number | null;
  cityName: string | null;
  isMember: boolean;
  unread: number;
  lastMessageId: number | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  dmUserId: number | null;
  dmLastSeenAt: string | null;
};

// Polled by the client every few seconds: sidebar state, unread counts and badge counts.
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  // The client sends active=1 only while the app is on screen, so "online" means really looking at it.
  if (new URL(req.url).searchParams.get("active") === "1") after(() => heartbeat(user.id));
  const isAdmin = user.role === "admin";

  const rows = (await db.execute(sql`
    select c.id, c.type, c.name, c.city_id as "cityId", ci.name as "cityName",
      (cm.user_id is not null) as "isMember",
      case when cm.user_id is null then 0 else (
        select count(*)::int from messages m
        where m.channel_id = c.id and m.id > cm.last_read_message_id and coalesce(m.user_id, 0) <> ${user.id}
      ) end as unread,
      lm.id as "lastMessageId", to_json(lm.created_at) #>> '{}' as "lastMessageAt",
      case when lm.id is null then null
        else coalesce(lu.name || ': ', '') || case when lm.body <> '' then left(lm.body, 80) else '📎 Attachment' end
      end as "lastMessagePreview",
      dm.user_id as "dmUserId", dmu.name as "dmName", to_json(dmu.last_seen_at) #>> '{}' as "dmLastSeenAt"
    from channels c
    left join cities ci on ci.id = c.city_id
    left join channel_members cm on cm.channel_id = c.id and cm.user_id = ${user.id}
    left join lateral (select id, created_at, body, user_id from messages where channel_id = c.id order by id desc limit 1) lm on true
    left join users lu on lu.id = lm.user_id
    left join lateral (
      select user_id from channel_members where channel_id = c.id and c.type = 'dm' and user_id <> ${user.id} limit 1
    ) dm on true
    left join users dmu on dmu.id = dm.user_id
    where cm.user_id is not null or (${isAdmin} and c.type <> 'dm')
    order by ci.name nulls first, c.id
  `)) as unknown as (ChannelSummary & { dmName: string | null })[];

  const channels: ChannelSummary[] = rows.map(({ dmName, ...c }) => ({
    ...c,
    name: c.type === "dm" ? (dmName ?? "Direct message") : c.name,
    lastMessageId: c.lastMessageId === null ? null : Number(c.lastMessageId),
  }));

  const [[{ unreadNotifications }], [{ openTasks }], [{ pendingApprovals }]] = await Promise.all([
    db
      .select({ unreadNotifications: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))),
    db
      .select({ openTasks: count() })
      .from(schema.tasks)
      .where(and(eq(schema.tasks.assigneeId, user.id), sql`${schema.tasks.status} <> 'done'`)),
    user.canApprove
      ? db
          .select({ pendingApprovals: count() })
          .from(schema.approvals)
          .where(and(eq(schema.approvals.status, "pending"), visibleApprovals(user.id, isAdmin)))
      : Promise.resolve([{ pendingApprovals: 0 }]),
  ]);

  after(async () => {
    if (await claimOpportunisticSweep()) await runReminderSweep();
  });

  return json({ notificationsPaused: await notificationsPaused(), channels, unreadNotifications, openTasks, pendingApprovals, serverTime: new Date().toISOString() });
});
