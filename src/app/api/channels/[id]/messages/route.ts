import { z } from "zod";
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { channelMemberIds, getChannelForUser } from "@/lib/access";
import { handler, json, parseBody, requireUser } from "@/lib/api";
import { changedCards, channelLink, insertMessage, loadApprovals, loadMessages, loadTasks } from "@/lib/messages";
import { sendPush } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const channel = await getChannelForUser(user, Number((await params).id));
  const url = new URL(req.url);
  const after = num(url.searchParams.get("after"));
  const before = num(url.searchParams.get("before"));
  const since = url.searchParams.get("since");

  const around = num(url.searchParams.get("around"));

  // `around` opens the history at a specific message (e.g. a search result): 25 before it, itself, 24 after.
  const msgs = around
    ? [
        ...(await loadMessages(channel.id, { before: around + 1, limit: 25 })),
        ...(await loadMessages(channel.id, { after: around, limit: 24 })),
      ]
    : await loadMessages(channel.id, { after, before });
  const taskIds = new Set(msgs.map((m) => m.taskId).filter((x): x is number => !!x));
  const approvalIds = new Set(msgs.map((m) => m.approvalId).filter((x): x is number => !!x));
  if (since) {
    const changed = await changedCards(channel.id, new Date(since));
    changed.taskIds.forEach((id) => taskIds.add(id));
    changed.approvalIds.forEach((id) => approvalIds.add(id));
  }
  const [tasks, approvals] = await Promise.all([loadTasks([...taskIds]), loadApprovals([...approvalIds])]);
  return json({ messages: msgs, tasks, approvals, serverTime: new Date().toISOString() });
});

const attachment = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video", "file"]),
  name: z.string().max(300),
  size: z.number().nonnegative(),
});
const body = z
  .object({
    body: z.string().max(10000).default(""),
    attachments: z.array(attachment).max(20).default([]),
    replyToId: z.number().int().optional(),
  })
  .refine((b) => b.body.trim() || b.attachments.length, "Message is empty");

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const channel = await getChannelForUser(user, Number((await params).id));
  const input = await parseBody(req, body);
  const msg = await insertMessage({
    channelId: channel.id,
    userId: user.id,
    body: input.body.trim(),
    attachments: input.attachments,
    replyToId: input.replyToId,
  });
  // Posting implies you've read the channel up to here.
  await db
    .update(schema.channelMembers)
    .set({ lastReadMessageId: sql`greatest(${schema.channelMembers.lastReadMessageId}, ${msg.id})` })
    .where(and(eq(schema.channelMembers.channelId, channel.id), eq(schema.channelMembers.userId, user.id)));

  const recipients = (await channelMemberIds(channel.id)).filter((id) => id !== user.id);
  const preview = input.body.trim() || (input.attachments[0]?.type === "video" ? "🎥 Video" : "📷 Photo");
  await sendPush(recipients, {
    type: "message",
    title: channel.type === "dm" ? user.name : `${channel.name}`,
    body: channel.type === "dm" ? preview : `${user.name}: ${preview}`,
    link: channelLink(channel.id),
  });
  return json({ message: msg });
});
