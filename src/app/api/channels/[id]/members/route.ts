import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getChannelForUser } from "@/lib/access";
import { handler, json, requireUser } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const { users, channelMembers } = schema;

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const channel = await getChannelForUser(user, Number((await params).id));
  const members = await db
    .select({ id: users.id, name: users.name, role: users.role, department: users.department, canApprove: users.canApprove })
    .from(channelMembers)
    .innerJoin(users, eq(users.id, channelMembers.userId))
    .where(eq(channelMembers.channelId, channel.id))
    .orderBy(asc(users.name));
  return json({ members: members });
});
