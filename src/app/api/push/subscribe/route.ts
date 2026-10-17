import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { handler, json, parseBody, requireUser } from "@/lib/api";

const { pushSubscriptions } = schema;

const body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const sub = await parseBody(req, body);
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  await requireUser();
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string() }));
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return json({ ok: true });
});
