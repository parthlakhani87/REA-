import { asc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, json, requireAdmin } from "@/lib/api";

const { channels, cities } = schema;

export const GET = handler(async () => {
  await requireAdmin();
  const rows = await db
    .select({ id: channels.id, name: channels.name, type: channels.type, cityId: channels.cityId, cityName: cities.name })
    .from(channels)
    .leftJoin(cities, eq(cities.id, channels.cityId))
    .where(ne(channels.type, "dm"))
    .orderBy(asc(cities.name), asc(channels.id));
  return json({ channels: rows });
});
