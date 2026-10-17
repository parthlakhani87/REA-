import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { TASK_STATUSES } from "@/db/schema";
import { getChannelForUser } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireUser } from "@/lib/api";
import { channelLink, insertMessage, loadTasks } from "@/lib/messages";
import { notifyUsers } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };
const { tasks } = schema;

const body = z.object({ status: z.enum(TASK_STATUSES) });

const LABEL = { open: "reopened", acknowledged: "acknowledged", in_progress: "started", done: "completed" } as const;

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { status } = await parseBody(req, body);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, Number((await params).id)));
  if (!task) throw new HttpError(404, "Task not found");
  await getChannelForUser(user, task.channelId);
  const isAssignee = task.assigneeId === user.id;
  if (!isAssignee && task.createdById !== user.id && user.role !== "admin") {
    throw new HttpError(403, "Only the assignee or the person who created the task can update it");
  }
  if (!isAssignee && (status === "acknowledged" || status === "in_progress")) {
    throw new HttpError(403, "Only the assignee can acknowledge or start this task");
  }
  if (task.status === status) return json({ task: (await loadTasks([task.id]))[0] });

  await db
    .update(tasks)
    .set({
      status,
      updatedAt: sql`now()`,
      // Restart the reminder clock from this change.
      lastRemindedAt: null,
      reminderCount: 0,
      acknowledgedAt: status === "open" ? null : (task.acknowledgedAt ?? sql`now()`),
      completedAt: status === "done" ? sql`now()` : null,
    })
    .where(eq(tasks.id, task.id));

  await insertMessage({
    channelId: task.channelId,
    userId: user.id,
    kind: "system",
    body: `${user.name} ${LABEL[status]} the task "${task.title}"`,
    taskId: task.id,
  });
  const other = isAssignee ? task.createdById : task.assigneeId;
  if (other !== user.id) {
    await notifyUsers([other], {
      type: "task_update",
      title: `Task ${LABEL[status]}: ${task.title}`,
      body: `by ${user.name}`,
      link: channelLink(task.channelId),
    });
  }
  return json({ task: (await loadTasks([task.id]))[0] });
});
