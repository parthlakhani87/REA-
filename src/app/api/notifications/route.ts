import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { handler, json, parseBody, requireUser } from "@/lib/api";

const { notifications } = schema;

export const GET = handler(async () => {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.id))
    .limit(100);
  return json({ notifications: rows });
});

const body = z.object({ ids: z.array(z.number().int()).optional(), all: z.boolean().optional() });

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { ids, all } = await parseBody(req, body);
  if (!all && !ids?.length) return json({ ok: true });
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(
      and(eq(notifications.userId, user.id), isNull(notifications.readAt), all ? undefined : inArray(notifications.id, ids!)),
    );
  return json({ ok: true });
});
