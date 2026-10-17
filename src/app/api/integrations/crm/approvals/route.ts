import { timingSafeEqual } from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { DEPARTMENTS } from "@/db/schema";
import { HttpError, handler, json, parseBody } from "@/lib/api";
import { approvalInputSchema, createApproval, resubmitApproval } from "@/lib/approvals";

const { approvals, channels, cities, users } = schema;

function requireCrmKey(req: Request) {
  const expected = process.env.CRM_API_KEY;
  if (!expected) throw new HttpError(503, "CRM integration is not configured (CRM_API_KEY)");
  const given = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Invalid API key");
}

const body = approvalInputSchema.omit({ approverId: true }).extend({
  quoteId: z.string().trim().min(1).max(200),
  city: z.string().trim().optional(),
  department: z.enum(DEPARTMENTS).optional(),
  channelId: z.number().int().optional(),
  callbackUrl: z.string().url().optional(),
  approverEmail: z.string().email().optional(),
  requestedBy: z.object({ name: z.string().max(200).optional(), email: z.string().email().optional() }).optional(),
});

async function resolveChannel(input: z.infer<typeof body>) {
  if (input.channelId) {
    const [c] = await db.select().from(channels).where(eq(channels.id, input.channelId));
    if (c && c.type !== "dm") return c;
    throw new HttpError(400, "Unknown channelId");
  }
  if (!input.city) throw new HttpError(400, "Provide either `city` or `channelId`");
  const [city] = await db.select().from(cities).where(ilike(cities.name, input.city));
  if (!city) {
    const all = await db.select({ name: cities.name }).from(cities);
    throw new HttpError(400, `Unknown city "${input.city}". Known cities: ${all.map((c) => c.name).join(", ")}`);
  }
  const department = input.department ?? (process.env.CRM_DEFAULT_DEPARTMENT as (typeof DEPARTMENTS)[number]) ?? "sales";
  const [c] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.cityId, city.id), eq(channels.type, department)));
  if (!c) throw new HttpError(400, `No ${department} group for ${city.name}`);
  return c;
}

async function userIdByEmail(email?: string) {
  if (!email) return undefined;
  const [u] = await db.select({ id: users.id }).from(users).where(ilike(users.email, email));
  return u?.id;
}

function view(a: typeof approvals.$inferSelect) {
  return {
    approvalId: a.id,
    quoteId: a.externalRef,
    status: a.status,
    note: a.decisionNote,
    decidedAt: a.decidedAt,
    channelId: a.channelId,
  };
}

/**
 * PONGS CRM → submit a quotation costing for approval.
 * Re-posting the same quoteId while pending is a no-op; after a decision it re-opens the approval as a revision.
 */
export const POST = handler(async (req: Request) => {
  requireCrmKey(req);
  const input = await parseBody(req, body);
  const channel = await resolveChannel(input);
  const approverId = await userIdByEmail(input.approverEmail);
  const requestedById = await userIdByEmail(input.requestedBy?.email);

  const [existing] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.source, "crm"), eq(approvals.externalRef, input.quoteId)));
  if (existing?.status === "pending") return json({ ...view(existing), duplicate: true });
  if (existing) {
    const revised = await resubmitApproval(existing.id, { ...input, approverId }, { callbackUrl: input.callbackUrl });
    return json({ ...view(revised), revised: true });
  }

  const created = await createApproval(
    channel.id,
    { ...input, approverId },
    {
      source: "crm",
      externalRef: input.quoteId,
      callbackUrl: input.callbackUrl,
      requestedById,
      requestedByName: input.requestedBy?.name,
      requestedByEmail: input.requestedBy?.email,
    },
  );
  return json(view(created), 201);
});

// PONGS CRM → poll the status of a quotation approval: GET ?quoteId=Q-1001
export const GET = handler(async (req: Request) => {
  requireCrmKey(req);
  const quoteId = new URL(req.url).searchParams.get("quoteId");
  if (!quoteId) throw new HttpError(400, "quoteId is required");
  const [a] = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.source, "crm"), eq(approvals.externalRef, quoteId)));
  if (!a) throw new HttpError(404, "No approval for this quoteId");
  return json(view(a));
});
