import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { HttpError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/auth";

const body = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export const POST = handler(async (req: Request) => {
  const { email, password } = await parseBody(req, body);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }
  await createSession(user.id);
  return json({ ok: true, mustChangePassword: user.mustChangePassword });
});
