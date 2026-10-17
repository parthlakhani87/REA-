import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { createCityWithChannels } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireAdmin } from "@/lib/api";

export const GET = handler(async () => {
  await requireAdmin();
  return json({ cities: await db.select().from(schema.cities).orderBy(asc(schema.cities.name)) });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(1).max(100) }));
  const [dupe] = await db.select().from(schema.cities).where(eq(schema.cities.name, name));
  if (dupe) throw new HttpError(409, "City already exists");
  return json({ city: await createCityWithChannels(name) });
});
