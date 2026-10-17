import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getChannelForUser } from "@/lib/access";
import { handler, json, parseBody, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const { channelMembers } = schema;

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const channel = await getChannelForUser(user, Number((await params).id));
  const { messageId } = await parseBody(req, z.object({ messageId: z.number().int().nonnegative() }));
  await db
    .update(channelMembers)
    .set({ lastReadMessageId: sql`greatest(${channelMembers.lastReadMessageId}, ${messageId})` })
    .where(and(eq(channelMembers.channelId, channel.id), eq(channelMembers.userId, user.id)));
  return json({ ok: true });
});
