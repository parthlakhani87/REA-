import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import type { Attachment } from "@/db/schema";

const { messages, users, tasks, approvals } = schema;

export function channelLink(channelId: number) {
  return `/app?c=${channelId}`;
}

export async function insertMessage(input: {
  channelId: number;
  userId: number | null;
  kind?: "text" | "task" | "approval" | "system";
  body?: string;
  attachments?: Attachment[];
  replyToId?: number | null;
  taskId?: number | null;
  approvalId?: number | null;
}) {
  const [row] = await db
    .insert(messages)
    .values({
      channelId: input.channelId,
      userId: input.userId,
      kind: input.kind ?? "text",
      body: input.body ?? "",
      attachments: input.attachments ?? [],
      replyToId: input.replyToId ?? null,
      taskId: input.taskId ?? null,
      approvalId: input.approvalId ?? null,
    })
    .returning();
  return row;
}

export async function loadTasks(ids: number[]) {
  if (ids.length === 0) return [];
  const assignee = alias(users, "assignee");
  const creator = alias(users, "creator");
  return db
    .select({
      task: tasks,
      assigneeName: assignee.name,
      createdByName: creator.name,
    })
    .from(tasks)
    .innerJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .innerJoin(creator, eq(creator.id, tasks.createdById))
    .where(inArray(tasks.id, ids))
    .then((rows) => rows.map((r) => ({ ...r.task, assigneeName: r.assigneeName, createdByName: r.createdByName })));
}
export type TaskDTO = Awaited<ReturnType<typeof loadTasks>>[number];

export async function loadApprovals(ids: number[]) {
  if (ids.length === 0) return [];
  const decider = alias(users, "decider");
  const approver = alias(users, "approver");
  return db
    .select({ approval: approvals, decidedByName: decider.name, approverName: approver.name })
    .from(approvals)
    .leftJoin(decider, eq(decider.id, approvals.decidedById))
    .leftJoin(approver, eq(approver.id, approvals.approverId))
    .where(inArray(approvals.id, ids))
    .then((rows) =>
      rows.map((r) => {
        const { callbackUrl: _hidden, ...rest } = r.approval;
        return { ...rest, decidedByName: r.decidedByName, approverName: r.approverName };
      }),
    );
}
export type ApprovalDTO = Awaited<ReturnType<typeof loadApprovals>>[number];

export async function loadMessages(channelId: number, opts: { after?: number; before?: number; limit?: number }) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const where = [eq(messages.channelId, channelId)];
  if (opts.after) where.push(gt(messages.id, opts.after));
  if (opts.before) where.push(lt(messages.id, opts.before));

  // Polling for new messages reads forward; initial load / history reads backward from the newest.
  const rows = await db
    .select({ m: messages, userName: users.name })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.userId))
    .where(and(...where))
    .orderBy(opts.after ? asc(messages.id) : desc(messages.id))
    .limit(limit);
  if (!opts.after) rows.reverse();

  const replyIds = rows.map((r) => r.m.replyToId).filter((x): x is number => !!x);
  const replies = replyIds.length
    ? await db
        .select({ id: messages.id, body: messages.body, userName: users.name })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.userId))
        .where(inArray(messages.id, replyIds))
    : [];
  const replyMap = new Map(replies.map((r) => [r.id, r]));

  return rows.map((r) => ({
    ...r.m,
    userName: r.userName ?? (r.m.kind === "system" ? "PONGS Bot" : "PONGS CRM"),
    replyTo: r.m.replyToId ? (replyMap.get(r.m.replyToId) ?? null) : null,
  }));
}
export type MessageDTO = Awaited<ReturnType<typeof loadMessages>>[number];

// Task & approval cards whose state changed since `since` (so open chats refresh card status).
export async function changedCards(channelId: number, since: Date) {
  const [t, a] = await Promise.all([
    db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.channelId, channelId), gt(tasks.updatedAt, since))),
    db
      .select({ id: approvals.id })
      .from(approvals)
      .where(and(eq(approvals.channelId, channelId), gt(approvals.updatedAt, since))),
  ]);
  return { taskIds: t.map((x) => x.id), approvalIds: a.map((x) => x.id) };
}
