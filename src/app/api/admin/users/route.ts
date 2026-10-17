import bcrypt from "bcryptjs";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { setMemberships, syncDefaultMemberships } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireAdmin } from "@/lib/api";
import { userFields } from "@/lib/user-fields";

const { users, channelMembers, channels } = schema;

export const GET = handler(async () => {
  await requireAdmin();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      cityId: users.cityId,
      department: users.department,
      canApprove: users.canApprove,
      active: users.active,
      channelIds: sql<number[]>`coalesce(array_agg(${channelMembers.channelId}) filter (where ${channels.type} <> 'dm'), '{}')`,
    })
    .from(users)
    .leftJoin(channelMembers, eq(channelMembers.userId, users.id))
    .leftJoin(channels, eq(channels.id, channelMembers.channelId))
    .groupBy(users.id)
    .orderBy(asc(users.name));
  return json({ users: rows });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const input = await parseBody(req, userFields);
  if (!input.password) throw new HttpError(400, "A starting password is required");
  const [dupe] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (dupe) throw new HttpError(409, "A user with this email already exists");
  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      role: input.role,
      cityId: input.cityId ?? null,
      department: input.department ?? null,
      canApprove: input.canApprove ?? false,
      active: input.active ?? true,
      passwordHash: await bcrypt.hash(input.password, 10),
    })
    .returning();
  if (input.channelIds) await setMemberships(user.id, input.channelIds);
  else await syncDefaultMemberships(user);
  return json({ id: user.id });
});
