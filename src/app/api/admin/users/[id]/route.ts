import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { setMemberships } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireAdmin } from "@/lib/api";
import { userFields } from "@/lib/user-fields";

type Ctx = { params: Promise<{ id: string }> };
const { users } = schema;

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const admin = await requireAdmin();
  const id = Number((await params).id);
  const input = await parseBody(req, userFields.partial());
  if (id === admin.id && ((input.role && input.role !== "admin") || input.active === false)) {
    throw new HttpError(400, "You cannot demote or deactivate yourself");
  }
  if (input.email) {
    const [dupe] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), ne(users.id, id)));
    if (dupe) throw new HttpError(409, "Another user already uses this email");
  }
  const { password, channelIds, ...fields } = input;
  const update: Partial<typeof users.$inferInsert> = { ...fields };
  if (password) update.passwordHash = await bcrypt.hash(password, 10);
  if (Object.keys(update).length) {
    const [row] = await db.update(users).set(update).where(eq(users.id, id)).returning({ id: users.id });
    if (!row) throw new HttpError(404, "User not found");
  }
  if (channelIds) await setMemberships(id, channelIds);
  return json({ ok: true });
});
