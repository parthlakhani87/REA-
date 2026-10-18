import { handler, json, requireUser } from "@/lib/api";
import { mentionsFor } from "@/lib/discover";

// Messages that @mention the user (or @everyone / @channel) in channels they belong to.
export const GET = handler(async () => {
  const user = await requireUser();
  return json({ mentions: await mentionsFor(user) });
});
