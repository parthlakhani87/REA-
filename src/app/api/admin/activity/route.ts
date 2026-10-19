import { sql } from "drizzle-orm";
import { db } from "@/db";
import { HttpError, handler, json, requireAdmin } from "@/lib/api";

type Row = {
  id: number;
  name: string;
  role: string;
  department: string | null;
  cityName: string | null;
  lastSeenAt: string | null;
  sessions: { start: string; end: string }[] | null;
};

// Online periods per employee within [from, to) — the client passes its local day boundaries.
export const GET = handler(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") ?? "");
  const to = new Date(url.searchParams.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 32 * 86400000) {
    throw new HttpError(400, "Provide a valid from/to range (max 31 days)");
  }
  const rows = (await db.execute(sql`
    select u.id, u.name, u.role, u.department, ci.name as "cityName", to_json(u.last_seen_at) #>> '{}' as "lastSeenAt",
      (select json_agg(json_build_object(
          'start', to_json(greatest(p.started_at, ${from.toISOString()}::timestamptz)) #>> '{}',
          'end', to_json(least(p.ended_at, ${to.toISOString()}::timestamptz)) #>> '{}') order by p.started_at)
        from presence_sessions p
        where p.user_id = u.id and p.ended_at > ${from.toISOString()}::timestamptz and p.started_at < ${to.toISOString()}::timestamptz
      ) as sessions
    from users u left join cities ci on ci.id = u.city_id
    where u.active
    order by u.name
  `)) as unknown as Row[];

  const people = rows.map((r) => {
    const sessions = r.sessions ?? [];
    const onlineMinutes = Math.round(
      sessions.reduce((s, p) => s + (new Date(p.end).getTime() - new Date(p.start).getTime()), 0) / 60000,
    );
    return { ...r, sessions, onlineMinutes };
  });
  return json({ people });
});
