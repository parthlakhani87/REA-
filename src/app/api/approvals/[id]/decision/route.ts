import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getChannelForUser } from "@/lib/access";
import { HttpError, handler, json, parseBody, requireUser } from "@/lib/api";
import { decideApproval } from "@/lib/approvals";
import { loadApprovals } from "@/lib/messages";

type Ctx = { params: Promise<{ id: string }> };

const body = z
  .object({
    decision: z.enum(["approved", "rejected", "changes_requested"]),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.decision === "approved" || b.note, { message: "Please add a note explaining the decision" });

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const input = await parseBody(req, body);
  const [approval] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, Number((await params).id)));
  if (!approval) throw new HttpError(404, "Approval not found");
  await getChannelForUser(user, approval.channelId);
  if (!user.canApprove && user.role !== "admin") throw new HttpError(403, "You are not allowed to approve costings");
  if (approval.approverId && approval.approverId !== user.id && user.role !== "admin") {
    throw new HttpError(403, "This approval is assigned to someone else");
  }
  await decideApproval(approval.id, user, input.decision, input.note || undefined);
  return json({ approval: (await loadApprovals([approval.id]))[0] });
});
