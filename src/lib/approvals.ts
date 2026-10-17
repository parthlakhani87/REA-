import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { approversForChannel } from "./access";
import { HttpError } from "./api";
import { channelLink, insertMessage } from "./messages";
import { notifyUsers } from "./notify";

const { approvals } = schema;

const attachmentSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video", "file"]),
  name: z.string().max(300),
  size: z.number().nonnegative(),
});

export const approvalInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  customerName: z.string().trim().max(300).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  currency: z.string().trim().max(8).optional(),
  marginPercent: z.coerce.number().optional(),
  costBreakdown: z
    .array(
      z.object({
        item: z.string().max(300),
        cost: z.coerce.number(),
        qty: z.coerce.number().optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .max(200)
    .optional(),
  notes: z.string().max(5000).optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
  crmUrl: z.string().url().optional(),
  approverId: z.number().int().optional(),
});
export type ApprovalInput = z.infer<typeof approvalInputSchema>;

function computedMargin(input: ApprovalInput) {
  if (input.marginPercent !== undefined) return input.marginPercent;
  if (input.amount && input.cost !== undefined) return ((input.amount - input.cost) / input.amount) * 100;
  return undefined;
}

function approvalFields(input: ApprovalInput) {
  const margin = computedMargin(input);
  return {
    title: input.title,
    customerName: input.customerName ?? null,
    amount: input.amount?.toString() ?? null,
    cost: input.cost?.toString() ?? null,
    currency: input.currency || "INR",
    marginPercent: margin !== undefined ? margin.toFixed(2) : null,
    costBreakdown: input.costBreakdown ?? [],
    notes: input.notes ?? "",
    attachments: input.attachments ?? [],
    crmUrl: input.crmUrl ?? null,
    approverId: input.approverId ?? null,
  };
}

export async function createApproval(
  channelId: number,
  input: ApprovalInput,
  meta: {
    source: "crm" | "app";
    externalRef?: string;
    callbackUrl?: string;
    requestedById?: number;
    requestedByName?: string;
    requestedByEmail?: string;
  },
) {
  const [approval] = await db
    .insert(approvals)
    .values({
      channelId,
      source: meta.source,
      externalRef: meta.externalRef ?? null,
      callbackUrl: meta.callbackUrl ?? null,
      requestedById: meta.requestedById ?? null,
      requestedByName: meta.requestedByName ?? null,
      requestedByEmail: meta.requestedByEmail ?? null,
      ...approvalFields(input),
    })
    .returning();

  await announceApproval(approval, false);
  return approval;
}

// Re-opens an existing approval with revised figures (e.g. the CRM re-submits a quote after "changes requested").
export async function resubmitApproval(id: number, input: ApprovalInput, meta: { callbackUrl?: string }) {
  const [approval] = await db
    .update(approvals)
    .set({
      ...approvalFields(input),
      callbackUrl: meta.callbackUrl ?? null,
      status: "pending",
      decisionNote: null,
      decidedById: null,
      decidedAt: null,
      callbackStatus: null,
      lastRemindedAt: null,
      reminderCount: 0,
      updatedAt: sql`now()`,
    })
    .where(eq(approvals.id, id))
    .returning();
  await announceApproval(approval, true);
  return approval;
}

async function announceApproval(approval: typeof approvals.$inferSelect, revised: boolean) {
  await insertMessage({
    channelId: approval.channelId,
    userId: approval.requestedById,
    kind: "approval",
    body: `${revised ? "Revised costing" : "Costing approval requested"}: ${approval.title}`,
    approvalId: approval.id,
  });
  const targets = approval.approverId
    ? [approval.approverId]
    : (await approversForChannel(approval.channelId)).map((u) => u.id).filter((id) => id !== approval.requestedById);
  await notifyUsers(targets, {
    type: "approval_request",
    title: `${revised ? "Revised — approval" : "Approval"} needed: ${approval.title}`,
    body: [
      approval.customerName,
      approval.amount && `${approval.currency} ${Number(approval.amount).toLocaleString("en-IN")}`,
      approval.marginPercent && `margin ${approval.marginPercent}%`,
      approval.requestedByName && `by ${approval.requestedByName}`,
    ]
      .filter(Boolean)
      .join(" · "),
    link: channelLink(approval.channelId),
  });
}

export async function decideApproval(
  approvalId: number,
  decider: { id: number; name: string },
  decision: "approved" | "rejected" | "changes_requested",
  note?: string,
) {
  // Only a pending approval can be decided; the WHERE guard makes this race-safe.
  const [updated] = await db
    .update(approvals)
    .set({
      status: decision,
      decisionNote: note ?? null,
      decidedById: decider.id,
      decidedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(approvals.id, approvalId), eq(approvals.status, "pending")))
    .returning();
  if (!updated) throw new HttpError(409, "This approval has already been decided");

  const label = { approved: "Approved", rejected: "Rejected", changes_requested: "Changes requested" }[decision];
  await insertMessage({
    channelId: updated.channelId,
    userId: decider.id,
    kind: "system",
    body: `${label}: ${updated.title}${note ? ` — "${note}"` : ""}`,
    approvalId: updated.id,
  });
  if (updated.requestedById && updated.requestedById !== decider.id) {
    await notifyUsers([updated.requestedById], {
      type: "approval_decision",
      title: `${label}: ${updated.title}`,
      body: `${decider.name}${note ? `: ${note}` : ""}`,
      link: channelLink(updated.channelId),
    });
  }

  await sendCrmCallback(updated, decider.name);
  return updated;
}

// Notifies PONGS CRM of the decision. Body is signed with HMAC-SHA256 so the CRM can verify it.
async function sendCrmCallback(a: typeof approvals.$inferSelect, deciderName: string) {
  const url = a.callbackUrl || (a.source === "crm" ? process.env.CRM_WEBHOOK_URL : undefined);
  if (!url) return;
  const body = JSON.stringify({
    event: "approval.decided",
    approvalId: a.id,
    quoteId: a.externalRef,
    status: a.status,
    note: a.decisionNote,
    decidedBy: deciderName,
    decidedAt: a.decidedAt,
  });
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) headers["x-pongs-signature"] = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  let status: string;
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
    status = res.ok ? "delivered" : `failed (${res.status})`;
  } catch (err) {
    status = `failed (${(err as Error).message})`;
  }
  await db.update(approvals).set({ callbackStatus: status }).where(eq(approvals.id, a.id));
}
