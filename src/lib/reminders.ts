import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { approversForChannel } from "./access";
import { notifyUsers } from "./notify";
import { notificationsPaused } from "./notification-switch";
import { channelLink } from "./messages";

const { tasks, approvals, appMeta } = schema;

// After this many "not attended" reminders the task creator is alerted too.
const ESCALATE_AFTER = 3;

function approvalReminderMinutes() {
  return Number(process.env.APPROVAL_REMINDER_MINUTES) || 30;
}

type TaskRow = typeof tasks.$inferSelect;

/**
 * Sends every reminder that is due. Each UPDATE ... RETURNING claims the rows it reminds about,
 * so concurrent sweeps (cron + opportunistic) never double-send.
 */
export async function runReminderSweep() {
  if (await notificationsPaused()) return { paused: true, notAttended: 0, inProgress: 0, approvals: 0 };
  const notAttended = await db
    .update(tasks)
    .set({ lastRemindedAt: sql`now()`, reminderCount: sql`${tasks.reminderCount} + 1` })
    .where(
      sql`${tasks.status} = 'open' and coalesce(${tasks.lastRemindedAt}, ${tasks.createdAt}) + make_interval(mins => ${tasks.ackReminderMinutes}) <= now()`,
    )
    .returning();

  const inProgress = await db
    .update(tasks)
    .set({ lastRemindedAt: sql`now()`, reminderCount: sql`${tasks.reminderCount} + 1` })
    .where(
      sql`${tasks.status} in ('acknowledged', 'in_progress') and coalesce(${tasks.lastRemindedAt}, ${tasks.acknowledgedAt}, ${tasks.createdAt}) + make_interval(mins => ${tasks.progressReminderMinutes}) <= now()`,
    )
    .returning();

  const pendingApprovals = await db
    .update(approvals)
    .set({ lastRemindedAt: sql`now()`, reminderCount: sql`${approvals.reminderCount} + 1` })
    .where(
      sql`${approvals.status} = 'pending' and coalesce(${approvals.lastRemindedAt}, ${approvals.createdAt}) + make_interval(mins => ${approvalReminderMinutes()}) <= now()`,
    )
    .returning();

  for (const t of notAttended) await remindNotAttended(t);
  for (const t of inProgress) await remindToComplete(t);
  for (const a of pendingApprovals) {
    const targets = a.approverId ? [a.approverId] : (await approversForChannel(a.channelId)).map((u) => u.id);
    await notifyUsers(targets, {
      type: "approval_reminder",
      title: `Approval waiting: ${a.title}`,
      body: `${a.customerName ? a.customerName + " · " : ""}pending for ${age(a.createdAt)}. Please approve or reject.`,
      link: channelLink(a.channelId),
    });
  }

  return { notAttended: notAttended.length, inProgress: inProgress.length, approvals: pendingApprovals.length };
}

async function remindNotAttended(t: TaskRow) {
  await notifyUsers([t.assigneeId], {
    type: "task_not_attended",
    title: `Task not attended: ${t.title}`,
    body: `Assigned ${age(t.createdAt)} ago. Tap to acknowledge it.`,
    link: channelLink(t.channelId),
  });
  if (t.reminderCount >= ESCALATE_AFTER && t.createdById !== t.assigneeId) {
    await notifyUsers([t.createdById], {
      type: "task_escalation",
      title: `Still not attended: ${t.title}`,
      body: `No response after ${t.reminderCount} reminders.`,
      link: channelLink(t.channelId),
    });
  }
}

async function remindToComplete(t: TaskRow) {
  const overdue = t.dueAt && t.dueAt.getTime() < Date.now();
  await notifyUsers([t.assigneeId], {
    type: "task_progress",
    title: `${overdue ? "Overdue" : "Reminder"}: complete "${t.title}"`,
    body: overdue ? `This task was due ${age(t.dueAt!)} ago.` : "Mark it done once finished.",
    link: channelLink(t.channelId),
  });
  if (overdue && t.createdById !== t.assigneeId) {
    await notifyUsers([t.createdById], {
      type: "task_overdue",
      title: `Overdue: ${t.title}`,
      body: "The assignee has not completed this task yet.",
      link: channelLink(t.channelId),
    });
  }
}

/**
 * Lets normal app traffic drive reminders, so they still go out frequently on plans where
 * Vercel Cron only runs once a day. Returns true if this caller won the right to sweep.
 */
export async function claimOpportunisticSweep(minIntervalSeconds = 60) {
  const rows = await db
    .insert(appMeta)
    .values({ key: "last_sweep", value: sql`now()` })
    .onConflictDoUpdate({
      target: appMeta.key,
      set: { value: sql`now()` },
      setWhere: sql`${appMeta.value} < now() - make_interval(secs => ${minIntervalSeconds})`,
    })
    .returning();
  return rows.length > 0;
}

function age(d: Date) {
  const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}
