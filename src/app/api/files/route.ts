import { handler, json, requireUser } from "@/lib/api";
import { sharedFiles } from "@/lib/discover";

// Attachments shared in the user's channels, newest first.
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const channelId = Number(url.searchParams.get("channelId")) || undefined;
  const q = url.searchParams.get("q")?.trim().slice(0, 200) || undefined;
  return json({ files: await sharedFiles(user, { q, channelId }) });
});
