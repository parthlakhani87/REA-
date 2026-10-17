import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, handler, json, parseBody, requireUser } from "@/lib/api";

const { users, channels, channelMembers } = schema;

// Opens (or creates) the 1:1 conversation between the current user and another user.
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const { userId } = await parseBody(req, z.object({ userId: z.number().int() }));
  if (userId === me.id) throw new HttpError(400, "You cannot message yourself");
  const [other] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.active, true)));
  if (!other) throw new HttpError(404, "User not found");

  const dmKey = [me.id, other.id].sort((a, b) => a - b).join(":");
  let [channel] = await db.select().from(channels).where(eq(channels.dmKey, dmKey));
  if (!channel) {
    [channel] = await db
      .insert(channels)
      .values({ type: "dm", name: "Direct message", dmKey })
      .onConflictDoNothing()
      .returning();
    channel ??= (await db.select().from(channels).where(eq(channels.dmKey, dmKey)))[0];
  }
  await db
    .insert(channelMembers)
    .values([
      { channelId: channel.id, userId: me.id },
      { channelId: channel.id, userId: other.id },
    ])
    .onConflictDoNothing();
  return json({ channelId: channel.id });
});
