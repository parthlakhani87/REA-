import bcrypt from "bcryptjs";
import { count } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createCityWithChannels, ensureGeneralChannel, syncDefaultMemberships } from "@/lib/access";
import { HttpError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/auth";

async function needsSetup() {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  return n === 0;
}

export const GET = handler(async () => json({ needsSetup: await needsSetup() }));

const body = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  cities: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
});

// One-time bootstrap: creates the first admin plus the city groups. Disabled once any user exists.
export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, body);
  if (!(await needsSetup())) throw new HttpError(403, "Setup has already been completed");
  await ensureGeneralChannel();
  for (const name of [...new Set(input.cities)]) await createCityWithChannels(name);
  const [user] = await db
    .insert(schema.users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: "admin",
      canApprove: true,
    })
    .returning();
  await syncDefaultMemberships(user);
  await createSession(user.id);
  return json({ ok: true });
});
