import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { APPROVAL_STATUSES, type ApprovalStatus } from "@/db/schema";
import { getChannelForUser, visibleApprovals } from "@/lib/access";
import { handler, json, parseBody, requireUser } from "@/lib/api";
import { approvalInputSchema, createApproval } from "@/lib/approvals";
import { loadApprovals } from "@/lib/messages";
import { z } from "zod";

const { approvals } = schema;

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const status = new URL(req.url).searchParams.get("status");
  const rows = await db
    .select({ id: approvals.id })
    .from(approvals)
    .where(
      and(
        visibleApprovals(user.id, user.role === "admin"),
        status && (APPROVAL_STATUSES as readonly string[]).includes(status)
          ? eq(approvals.status, status as ApprovalStatus)
          : undefined,
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(200);
  const loaded = await loadApprovals(rows.map((r) => r.id));
  loaded.sort((a, b) => b.id - a.id);
  return json({ approvals: loaded });
});

// Approval raised from inside the app (e.g. an estimator posting a costing for sign-off).
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, approvalInputSchema.extend({ channelId: z.number().int() }));
  const channel = await getChannelForUser(user, input.channelId);
  const approval = await createApproval(channel.id, input, {
    source: "app",
    requestedById: user.id,
    requestedByName: user.name,
    requestedByEmail: user.email,
  });
  return json({ approval: (await loadApprovals([approval.id]))[0] });
});
