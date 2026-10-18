"use client";

import { useState } from "react";
import { BellRing, CalendarClock, ChevronDown, ChevronRight, ExternalLink, SquareCheck, BadgeCheck } from "lucide-react";
import { api, formatMoney, formatTime, type Approval, type Me, type Task } from "@/lib/client";
import { Attachments } from "./MessageBubble";
import { StatusPill } from "./ui";

function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  if (m % 1440 === 0) return `${m / 1440} day${m === 1440 ? "" : "s"}`;
  return `${+(m / 60).toFixed(1)} h`;
}

export function TaskCard({ task, me, onChange }: { task: Task; me: Me; onChange: (t: Task) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAssignee = task.assigneeId === me.id;
  const canManage = task.createdById === me.id || me.role === "admin";
  const overdue = task.dueAt && task.status !== "done" && new Date(task.dueAt) < new Date();

  async function setStatus(status: Task["status"]) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ task: Task }>(`/api/tasks/${task.id}`, { method: "PATCH", json: { status } });
      onChange(r.task);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reminder =
    task.status === "open"
      ? `Reminds ${isAssignee ? "you" : task.assigneeName} every ${minutesLabel(task.ackReminderMinutes)} until acknowledged`
      : task.status !== "done"
        ? `Reminds every ${minutesLabel(task.progressReminderMinutes)} until completed`
        : null;

  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-surface p-3.5">
      <div className="mb-1.5 flex items-center gap-2 eyebrow">
        <SquareCheck className="h-3.5 w-3.5" strokeWidth={2} /> Action item
        <span className="ml-auto tracking-normal normal-case">
          <StatusPill status={task.status} />
        </span>
      </div>
      <div className="text-[14px] font-semibold">{task.title}</div>
      {task.description && <p className="mt-1 text-[13px] whitespace-pre-wrap text-ink-2">{task.description}</p>}
      <div className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-xs text-ink-3">
        <div>
          Owner <b className="font-medium text-ink">{isAssignee ? "You" : task.assigneeName}</b> · assigned by {task.createdByName}
        </div>
        {task.dueAt && (
          <div className={`flex items-center gap-1 ${overdue ? "font-medium text-danger" : ""}`}>
            <CalendarClock className="h-3.5 w-3.5" /> Due {formatTime(task.dueAt)}
            {overdue && " · overdue"}
          </div>
        )}
        {reminder && (
          <div className="flex items-center gap-1">
            <BellRing className="h-3.5 w-3.5" /> {reminder}
          </div>
        )}
        {task.completedAt && <div>Completed {formatTime(task.completedAt)}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {isAssignee && task.status === "open" && (
          <button className="btn-primary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => setStatus("acknowledged")}>
            Acknowledge
          </button>
        )}
        {isAssignee && (task.status === "open" || task.status === "acknowledged") && (
          <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => setStatus("in_progress")}>
            Start working
          </button>
        )}
        {(isAssignee || canManage) && task.status !== "done" && task.status !== "open" && (
          <button className="btn-primary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => setStatus("done")}>
            Mark done
          </button>
        )}
        {canManage && task.status === "done" && (
          <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => setStatus("open")}>
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}

export function ApprovalCard({
  approval,
  me,
  onChange,
}: {
  approval: Approval;
  me: Me;
  onChange: (a: Approval) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | "rejected" | "changes_requested">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canDecide =
    approval.status === "pending" &&
    (me.canApprove || me.role === "admin") &&
    (!approval.approverId || approval.approverId === me.id || me.role === "admin");

  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ approval: Approval }>(`/api/approvals/${approval.id}/decision`, {
        method: "POST",
        json: { decision, note: note || undefined },
      });
      onChange(r.approval);
      setMode(null);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = approval.costBreakdown.reduce((s, l) => s + Number(l.cost) * (l.qty ?? 1), 0);

  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-surface p-3.5">
      <div className="mb-1.5 flex items-center gap-2 eyebrow">
        <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} /> Costing approval {approval.source === "crm" && "· PONGS CRM"}
        <span className="ml-auto tracking-normal normal-case">
          <StatusPill status={approval.status} />
        </span>
      </div>
      <div className="text-[14px] font-semibold">{approval.title}</div>
      {approval.externalRef && <div className="text-xs text-slate-500">Quote #{approval.externalRef}</div>}
      {approval.customerName && <div className="text-sm text-slate-600">Customer: {approval.customerName}</div>}

      <div className="mt-2.5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-2 py-2 text-center">
        <div>
          <div className="text-[10px] font-medium tracking-wider uppercase text-ink-3">Quote</div>
          <div className="text-[13px] font-semibold sm:text-sm">{formatMoney(approval.amount, approval.currency)}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium tracking-wider uppercase text-ink-3">Cost</div>
          <div className="text-[13px] font-semibold sm:text-sm">{formatMoney(approval.cost, approval.currency)}</div>
        </div>
        <div>
          <div className="text-[10px] font-medium tracking-wider uppercase text-ink-3">Margin</div>
          <div
            className={`text-[13px] font-semibold tabular-nums sm:text-sm ${
              approval.marginPercent !== null && Number(approval.marginPercent) < 10 ? "text-danger" : "text-positive"
            }`}
          >
            {approval.marginPercent !== null ? `${Number(approval.marginPercent).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      {approval.costBreakdown.length > 0 && (
        <div className="mt-2">
          <button className="flex items-center gap-1 text-xs font-medium text-slate-600" onClick={() => setOpen(!open)}>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Cost breakdown ({approval.costBreakdown.length} items)
          </button>
          {open && (
            <table className="mt-1 w-full text-xs">
              <tbody>
                {approval.costBreakdown.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-1 pr-2">
                      {l.item}
                      {l.qty && l.qty !== 1 ? ` × ${l.qty}` : ""}
                      {l.note && <div className="text-slate-400">{l.note}</div>}
                    </td>
                    <td className="py-1 text-right whitespace-nowrap">
                      {formatMoney(String(Number(l.cost) * (l.qty ?? 1)), approval.currency)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1">Total</td>
                  <td className="py-1 text-right">{formatMoney(String(total), approval.currency)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {approval.notes && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">{approval.notes}</p>}
      {approval.attachments.length > 0 && (
        <div className="mt-2">
          <Attachments items={approval.attachments} />
        </div>
      )}
      <div className="mt-2 space-y-0.5 text-xs text-slate-500">
        {approval.requestedByName && <div>Requested by {approval.requestedByName}</div>}
        {approval.approverName && <div>Approver: {approval.approverName}</div>}
        {approval.decidedAt && (
          <div>
            {approval.status.replace("_", " ")} by <b>{approval.decidedByName}</b> · {formatTime(approval.decidedAt)}
          </div>
        )}
        {approval.decisionNote && <div className="italic">“{approval.decisionNote}”</div>}
        {approval.callbackStatus && <div>CRM sync: {approval.callbackStatus}</div>}
      </div>
      {approval.crmUrl && (
        <a href={approval.crmUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-positive hover:underline">
          Open in PONGS CRM <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {canDecide && !mode && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => decide("approved")}>
            Approve
          </button>
          <button className="btn-secondary px-2.5 py-1.5 text-xs" disabled={busy} onClick={() => setMode("changes_requested")}>
            Request changes
          </button>
          <button className="btn border border-danger/40 px-2.5 py-1.5 text-xs text-danger hover:bg-danger-soft" disabled={busy} onClick={() => setMode("rejected")}>
            Reject
          </button>
        </div>
      )}
      {canDecide && mode && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input"
            rows={2}
            autoFocus
            placeholder={mode === "rejected" ? "Reason for rejection" : "What should the estimation team change?"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className={`${mode === "rejected" ? "btn-danger" : "btn-primary"} px-2.5 py-1.5 text-xs`}
              disabled={busy || !note.trim()}
              onClick={() => decide(mode)}
            >
              {mode === "rejected" ? "Reject" : "Send back"}
            </button>
            <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
