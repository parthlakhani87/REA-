import { z } from "zod";
import { handler, json, parseBody, requireAdmin } from "@/lib/api";
import { notificationsPaused, setNotificationsPaused } from "@/lib/notification-switch";

// Company-wide pause / resume for all notifications.
export const GET = handler(async () => {
  await requireAdmin();
  return json({ paused: await notificationsPaused() });
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const { paused } = await parseBody(req, z.object({ paused: z.boolean() }));
  await setNotificationsPaused(paused);
  return json({ paused });
});
