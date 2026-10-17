import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEPARTMENTS, type Department } from "@/db/schema";
import { HttpError } from "./api";
import type { SessionUser } from "./auth";

const { channels, channelMembers, cities, users } = schema;

export const DEPARTMENT_LABELS: Record<Department, string> = {
  sales: "Sales",
  project: "Project",
  accounts: "Accounts",
  dispatch: "Dispatch",
};

export async function getChannelForUser(user: SessionUser, channelId: number) {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) throw new HttpError(404, "Group not found");
  if (user.role === "admin" && channel.type !== "dm") return channel;
  const [member] = await db
    .select()
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, user.id)));
  if (!member) throw new HttpError(403, "You are not a member of this group");
  return channel;
}

export async function createCityWithChannels(name: string) {
  const [city] = await db.insert(cities).values({ name: name.trim() }).returning();
  await db.insert(channels).values(
    DEPARTMENTS.map((d) => ({ cityId: city.id, type: d, name: `${city.name} · ${DEPARTMENT_LABELS[d]}` })),
  );
  return city;
}

export async function ensureGeneralChannel() {
  const [existing] = await db
    .select()
    .from(channels)
    .where(and(isNull(channels.cityId), eq(channels.type, "general")));
  if (existing) return existing;
  const [created] = await db.insert(channels).values({ type: "general", name: "Company Announcements" }).returning();
  return created;
}

// Default memberships: everybody joins company-wide channels; managers get every group of their city;
// members get their own department group in their city (or the whole city if no department is set).
export async function syncDefaultMemberships(user: Pick<SessionUser, "id" | "role" | "cityId" | "department">) {
  const conds = [and(isNull(channels.cityId), eq(channels.type, "general"))];
  if (user.cityId) {
    if (user.role === "member" && user.department) {
      conds.push(and(eq(channels.cityId, user.cityId), eq(channels.type, user.department)));
    } else {
      conds.push(eq(channels.cityId, user.cityId));
    }
  }
  const rows = await db.select({ id: channels.id }).from(channels).where(or(...conds));
  if (rows.length === 0) return;
  await db
    .insert(channelMembers)
    .values(rows.map((r) => ({ channelId: r.id, userId: user.id })))
    .onConflictDoNothing();
}

export async function setMemberships(userId: number, channelIds: number[]) {
  const nonDm = await db
    .select({ id: channels.id })
    .from(channels)
    .where(sql`${channels.type} <> 'dm'`);
  if (nonDm.length === 0) return;
  const allowed = new Set(nonDm.map((c) => c.id));
  const wanted = channelIds.filter((id) => allowed.has(id));
  await db
    .delete(channelMembers)
    .where(and(eq(channelMembers.userId, userId), inArray(channelMembers.channelId, [...allowed])));
  if (wanted.length) {
    await db
      .insert(channelMembers)
      .values(wanted.map((id) => ({ channelId: id, userId })))
      .onConflictDoNothing();
  }
}

// People who can approve costing in a given channel.
export async function approversForChannel(channelId: number) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      and(
        eq(users.active, true),
        eq(users.canApprove, true),
        or(
          eq(users.role, "admin"),
          sql`exists (select 1 from ${channelMembers} cm where cm.channel_id = ${channelId} and cm.user_id = ${users.id})`,
        ),
      ),
    );
}

export async function channelMemberIds(channelId: number) {
  const rows = await db
    .select({ userId: channelMembers.userId })
    .from(channelMembers)
    .where(eq(channelMembers.channelId, channelId));
  return rows.map((r) => r.userId);
}

// SQL condition: approvals in channels the user can see.
export function visibleApprovals(userId: number, isAdmin: boolean) {
  if (isAdmin) return undefined;
  return sql`exists (select 1 from ${channelMembers} cm where cm.channel_id = ${schema.approvals.channelId} and cm.user_id = ${userId})`;
}
