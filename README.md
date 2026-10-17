# PONGS Connect

Internal communication app for PONGS — something between WhatsApp and Slack.

- **City groups.** Every city has four sub-groups: **Sales, Project, Accounts, Dispatch**. There's also a company-wide **Announcements** group and 1:1 **direct messages**.
- **Photos, videos and files.** Uploads go straight from the browser to Vercel Blob, so large videos work. You can drag and drop or paste files.
- **Tasks with reminders.** You can assign a task to anyone in a group.
  - Until they **acknowledge** it, they're reminded on a fixed schedule (every 30 minutes by default). After 3 reminders the person who assigned it is alerted too.
  - Once it's acknowledged or started, they get **regular reminders to complete it** (every 4 hours by default) until it's marked done. Overdue tasks also alert the person who assigned it.
- **Costing approvals from PONGS CRM.** The estimation team's quotations arrive as approval cards in the right city group, showing quote, cost, margin and the cost breakdown. Approvers get a notification right away and reminders until they decide. They can **Approve**, **Request changes** or **Reject** in one tap, and the decision is sent back to the CRM. Approvals can also be raised from inside the app.
- **Notifications.** There's an in-app notification centre plus **push notifications** on phones and desktops. The app is installable as a PWA (*Add to Home Screen*).
- **Admin.** Admins add cities (groups are created automatically) and people (role, city, department, who can approve), and choose which groups each person belongs to.

Built with Next.js 16 (App Router), Postgres (Drizzle ORM), Vercel Blob, Web Push and Vercel Cron.

---

## Deploy to Vercel

1. **Import the repo.** On <https://vercel.com/new>, import this GitHub repository. The framework is detected as Next.js automatically.
2. **Add storage.** In the project, go to **Storage**:
   - **Create Database → Neon (Postgres)** and connect it to the project. This sets `DATABASE_URL`.
   - **Create → Blob** and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
3. **Set environment variables.** Go to **Settings → Environment Variables** (see `.env.example`):
   - `AUTH_SECRET`: run `openssl rand -base64 32`
   - `CRON_SECRET`: any random string
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: run `npx web-push generate-vapid-keys`
   - `CRM_API_KEY`, `CRM_WEBHOOK_SECRET`, and optionally `CRM_WEBHOOK_URL`
4. **Deploy.** The build runs the database migrations automatically (`scripts/migrate.mjs`).
5. **Set up the workspace.** Open `https://<your-app>.vercel.app/setup` to create the first admin account and your cities. Then add your people under **Admin**.

### About reminder frequency

`vercel.json` registers a Vercel Cron job for `/api/cron/reminders`. On the **Hobby** plan, Vercel only allows cron jobs to run **once a day**, so the app also runs the reminder check on normal app traffic: whenever anyone has the app open, at most once a minute.

For reliable reminders even when nobody has the app open, do one of these:

- **Vercel Pro:** change the schedule in `vercel.json` to `"*/5 * * * *"`.
- **Any plan:** use a free external scheduler (for example cron-job.org or GitHub Actions) to call this every 5 minutes:
  ```
  GET https://<your-app>.vercel.app/api/cron/reminders
  Authorization: Bearer <CRON_SECRET>
  ```

### Push notifications on phones

- **Android / desktop Chrome, Edge, Firefox:** tap **Turn on notifications** in the sidebar.
- **iPhone (iOS 16.4+):** open the site in Safari, tap **Share → Add to Home Screen**, open the app from the home screen, then turn on notifications.

---

## PONGS CRM integration

### 1. CRM → app: submit a quotation for costing approval

```http
POST /api/integrations/crm/approvals
x-api-key: <CRM_API_KEY>
content-type: application/json

{
  "quoteId": "Q-2026-1042",               // required, unique per quotation
  "title": "Cold storage panels — Phase 1", // required
  "city": "Mumbai",                        // city name (or pass "channelId")
  "department": "sales",                   // sales | project | accounts | dispatch (default CRM_DEFAULT_DEPARTMENT)
  "customerName": "Acme Foods",
  "amount": 1250000,                       // quoted price
  "cost": 1010000,                         // total cost (margin is computed if marginPercent is omitted)
  "marginPercent": 19.2,
  "currency": "INR",
  "costBreakdown": [                       // cost = unit cost, multiplied by qty if given
    { "item": "PUF panels 100mm", "qty": 400, "cost": 1900 },
    { "item": "Installation labour", "cost": 250000, "note": "8 days" }
  ],
  "notes": "Customer wants delivery in 3 weeks",
  "attachments": [{ "url": "https://…/drawing.pdf", "type": "file", "name": "drawing.pdf", "size": 120000 }],
  "crmUrl": "https://crm.pongs…/quotes/Q-2026-1042",   // shown as "Open in PONGS CRM"
  "callbackUrl": "https://crm.pongs…/webhooks/approvals",
  "approverEmail": "director@pongs…",                   // optional: send to one specific approver
  "requestedBy": { "name": "Estimation Team", "email": "estimator@pongs…" }
}
```

- **Response:** `201 { approvalId, quoteId, status: "pending", channelId }`.
- **Same `quoteId` while still pending:** nothing new is created. The response is `{ …, duplicate: true }`.
- **Same `quoteId` after a decision** (for example after *changes requested*): the approval re-opens as a **revision** with the new figures. The response is `{ …, revised: true }`.
- **Matching the requester:** if `requestedBy.email` matches a user in the app, that person also gets notified of the decision in the app.

### 2. App → CRM: decision webhook

When an approver decides, the app sends a `POST` to `callbackUrl` (or to `CRM_WEBHOOK_URL` if no `callbackUrl` was given):

```json
{
  "event": "approval.decided",
  "approvalId": 12,
  "quoteId": "Q-2026-1042",
  "status": "approved",            // approved | rejected | changes_requested
  "note": "OK, go ahead",
  "decidedBy": "Meera Shah",
  "decidedAt": "2026-10-17T10:15:00.000Z"
}
```

Header: `x-pongs-signature: sha256=<HMAC-SHA256 of the raw body using CRM_WEBHOOK_SECRET>`. The CRM should verify this header. The delivery result is shown on the approval card as *CRM sync*.

### 3. CRM → app: poll the status

```http
GET /api/integrations/crm/approvals?quoteId=Q-2026-1042
x-api-key: <CRM_API_KEY>
```

---

## Local development

```bash
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET at least
npm install
DATABASE_URL=… npm run db:migrate
npm run dev                  # http://localhost:3000 → /setup
```

- **Schema changes:** edit `src/db/schema.ts`, then run `npm run db:generate` to create a new migration in `drizzle/`.
- **Uploads:** these need `BLOB_READ_WRITE_TOKEN`. You can pull it with `vercel env pull`.

## Project layout

```
src/db/schema.ts            database tables
src/lib/reminders.ts        task & approval reminder engine
src/lib/approvals.ts        approval creation, decisions, CRM callback
src/app/api/…               JSON API (chat, tasks, approvals, admin, CRM, cron)
src/components/…            UI: Shell (sidebar), ChatView, Cards, Dialogs, AdminPanel
public/sw.js                service worker for push notifications
```

## Notes & limits

- **Live updates use polling.** Open chats refresh every 3 seconds and the sidebar every 5 seconds. Polling works on Vercel's serverless platform without extra services. To get instant delivery at a larger scale, add Pusher or Ably later.
- **Uploaded files are public but unguessable.** They're stored as public Vercel Blob URLs with random suffixes, so only people who have the link can open them.
