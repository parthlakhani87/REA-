import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { handler, json, requireUser } from "@/lib/api";

const { users, cities } = schema;

// Company directory, used to start direct messages and assign tasks.
export const GET = handler(async () => {
  await requireUser();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      department: users.department,
      canApprove: users.canApprove,
      cityName: cities.name,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .leftJoin(cities, eq(cities.id, users.cityId))
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
  return json({ users: rows });
});
