import { handler, json, requireUser } from "@/lib/api";
import { sendPush } from "@/lib/notify";

// Sends a test notification to every device the current user has turned notifications on for.
export const POST = handler(async () => {
  const user = await requireUser();
  const result = await sendPush([user.id], {
    type: "test",
    title: "PONGS Connect notifications are working",
    body: `Hi ${user.name.split(" ")[0]}, this is how reminders and approvals will reach this device.`,
    link: "/app?view=settings",
  });
  return json(result);
});
