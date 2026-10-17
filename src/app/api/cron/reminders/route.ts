import { HttpError, handler, json } from "@/lib/api";
import { runReminderSweep } from "@/lib/reminders";

export const maxDuration = 60;

// Called by Vercel Cron (see vercel.json) or any external scheduler with `Authorization: Bearer $CRON_SECRET`.
export const GET = handler(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new HttpError(401, "Unauthorized");
  return json({ ok: true, sent: await runReminderSweep() });
});
