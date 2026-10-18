import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import type { Attachment } from "@/db/schema";
import type { SessionUser } from "./auth";

// Read-only lookups behind search, shared files and mentions. Every query is limited to channels
// the user belongs to (admins also see every non-DM group, matching getChannelForUser).

function visibleChannel(user: SessionUser, channelAlias: SQL = sql`c`) {
  return sql`(exists (select 1 from channel_members cm where cm.channel_id = ${channelAlias}.id and cm.user_id = ${user.id})
    or (${user.role === "admin"} and ${channelAlias}.type <> 'dm'))`;
}

function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export type MessageHit = {
  id: number;
  channelId: number;
  channelName: string;
  channelType: string;
  cityName: string | null;
  userName: string | null;
  body: string;
  createdAt: string;
};

const messageColumns = sql`m.id::int as id, m.channel_id as "channelId",
  case when c.type = 'dm' then coalesce((select u2.name from channel_members cm2 join users u2 on u2.id = cm2.user_id
    where cm2.channel_id = c.id and cm2.user_id <> m.user_id limit 1), 'Direct message') else c.name end as "channelName",
  c.type as "channelType", ci.name as "cityName", u.name as "userName", m.body,
  to_json(m.created_at) #>> '{}' as "createdAt"`;

export async function searchMessages(user: SessionUser, q: string, limit = 30) {
  return (await db.execute(sql`
    select ${messageColumns}
    from messages m join channels c on c.id = m.channel_id
    left join cities ci on ci.id = c.city_id left join users u on u.id = m.user_id
    where m.kind = 'text' and m.body ilike ${likePattern(q)} and ${visibleChannel(user)}
    order by m.id desc limit ${limit}
  `)) as unknown as MessageHit[];
}

export async function mentionsFor(user: SessionUser, limit = 100) {
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  return (await db.execute(sql`
    select ${messageColumns}
    from messages m join channels c on c.id = m.channel_id
    left join cities ci on ci.id = c.city_id left join users u on u.id = m.user_id
    where m.kind = 'text' and coalesce(m.user_id, 0) <> ${user.id}
      and (m.body ilike ${likePattern(`@${user.name}`)} or m.body ilike ${likePattern(`@${first}`)}
        or m.body ilike '%@everyone%' or m.body ilike '%@channel%')
      and exists (select 1 from channel_members cm where cm.channel_id = c.id and cm.user_id = ${user.id})
    order by m.id desc limit ${limit}
  `)) as unknown as MessageHit[];
}

export type FileHit = Attachment & {
  messageId: number;
  channelId: number;
  channelName: string;
  channelType: string;
  cityName: string | null;
  userName: string | null;
  createdAt: string;
};

export async function sharedFiles(user: SessionUser, opts: { q?: string; channelId?: number; limit?: number }) {
  const conds = [visibleChannel(user)];
  if (opts.q) conds.push(sql`a->>'name' ilike ${likePattern(opts.q)}`);
  if (opts.channelId) conds.push(sql`m.channel_id = ${opts.channelId}`);
  return (await db.execute(sql`
    select a->>'url' as url, a->>'type' as type, a->>'name' as name, coalesce((a->>'size')::bigint, 0)::float8 as size,
      m.id::int as "messageId", m.channel_id as "channelId",
      case when c.type = 'dm' then 'Direct message' else c.name end as "channelName",
      c.type as "channelType", ci.name as "cityName", u.name as "userName", to_json(m.created_at) #>> '{}' as "createdAt"
    from messages m cross join lateral jsonb_array_elements(m.attachments) a
    join channels c on c.id = m.channel_id left join cities ci on ci.id = c.city_id left join users u on u.id = m.user_id
    where jsonb_array_length(m.attachments) > 0 and ${sql.join(conds, sql` and `)}
    order by m.id desc limit ${opts.limit ?? 300}
  `)) as unknown as FileHit[];
}

export async function searchPeople(q: string, limit = 12) {
  return (await db.execute(sql`
    select u.id, u.name, u.role, u.department, u.can_approve as "canApprove", ci.name as "cityName"
    from users u left join cities ci on ci.id = u.city_id
    where u.active and (u.name ilike ${likePattern(q)} or coalesce(u.department, '') ilike ${likePattern(q)}
      or coalesce(ci.name, '') ilike ${likePattern(q)})
    order by u.name limit ${limit}
  `)) as unknown as { id: number; name: string; role: string; department: string | null; canApprove: boolean; cityName: string | null }[];
}
