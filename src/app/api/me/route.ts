import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, handler, json, parseBody, requireUser } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { getVapidKeys } from "@/lib/notify";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({ user: publicUser(user), vapidPublicKey: (await getVapidKeys()).publicKey });
});

const patch = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export const PATCH = handler(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, patch);
  const update: Partial<typeof schema.users.$inferInsert> = {};
  if (input.name) update.name = input.name;
  if (input.phone !== undefined) update.phone = input.phone || null;
  if (input.newPassword) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
    update.passwordHash = await bcrypt.hash(input.newPassword, 10);
  }
  if (Object.keys(update).length) await db.update(schema.users).set(update).where(eq(schema.users.id, user.id));
  return json({ ok: true });
});
