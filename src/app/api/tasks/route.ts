import { and, desc, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getChannelForUser } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireUser } from "@/lib/api";
import { channelLink, insertMessage, loadTasks } from "@/lib/messages";
import { notifyUsers } from "@/lib/notify";

const { tasks, channelMembers } = schema;

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const scope = new URL(req.url).searchParams.get("scope") ?? "mine";
  const where =
    scope === "created"
      ? eq(tasks.createdById, user.id)
      : scope === "all"
        ? or(eq(tasks.createdById, user.id), eq(tasks.assigneeId, user.id))
        : eq(tasks.assigneeId, user.id);
  const ids = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(where)
    .orderBy(sql`${tasks.status} = 'done'`, desc(tasks.updatedAt))
    .limit(200);
  const loaded = await loadTasks(ids.map((r) => r.id));
  const order = new Map(ids.map((r, i) => [r.id, i]));
  loaded.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return json({ tasks: loaded });
});

const body = z.object({
  channelId: z.number().int(),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).default(""),
  assigneeId: z.number().int(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  ackReminderMinutes: z.number().int().min(5).max(7 * 24 * 60).default(30),
  progressReminderMinutes: z.number().int().min(15).max(30 * 24 * 60).default(240),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, body);
  const channel = await getChannelForUser(user, input.channelId);
  const [member] = await db
    .select()
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channel.id), eq(channelMembers.userId, input.assigneeId)));
  if (!member) throw new HttpError(400, "The assignee is not a member of this group");

  const [task] = await db
    .insert(tasks)
    .values({
      channelId: channel.id,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      createdById: user.id,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      ackReminderMinutes: input.ackReminderMinutes,
      progressReminderMinutes: input.progressReminderMinutes,
    })
    .returning();
  await insertMessage({ channelId: channel.id, userId: user.id, kind: "task", body: input.title, taskId: task.id });
  if (input.assigneeId !== user.id) {
    await notifyUsers([input.assigneeId], {
      type: "task_assigned",
      title: `New task from ${user.name}`,
      body: input.title,
      link: channelLink(channel.id),
    });
  }
  return json({ task: (await loadTasks([task.id]))[0] });
});
