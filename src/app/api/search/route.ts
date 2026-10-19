import { handler, json, requireUser } from "@/lib/api";
import { searchMessages, searchPeople, sharedFiles } from "@/lib/discover";

// Global search across messages, people and files the user can see.
export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return json({ messages: [], people: [], files: [] });
  // Search inside one conversation (the in-chat search box).
  const channelId = Number(new URL(req.url).searchParams.get("channelId")) || undefined;
  if (channelId) return json({ messages: await searchMessages(user, q, 100, channelId), people: [], files: [] });
  const [messages, people, files] = await Promise.all([searchMessages(user, q), searchPeople(q), sharedFiles(user, { q, limit: 30 })]);
  return json({ messages, people, files });
});
