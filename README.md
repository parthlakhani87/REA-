# REA: Setup & Installation

This branch (`main`) holds the setup and installation guide. The applications are kept on their own branches:

| Branch | What it contains |
| --- | --- |
| `main` | This setup & installation guide |
| [`internal-communication`](../../tree/internal-communication) | **PONGS Connect**, the internal communication app (city groups, media sharing, task reminders, PONGS CRM costing approvals) |

---

## Install PONGS Connect (internal communication)

### What you need
- A GitHub account with access to this repository
- A [Vercel](https://vercel.com) account. Hobby works; Pro is recommended for frequent reminders.
- Node.js 20+ on your computer, used once to generate keys

### 1. Create the Vercel project
1. Go to <https://vercel.com/new> and import `parthlakhani87/REA-`.
2. Under **Configure Project**, set **Production Branch** to `internal-communication`. You can also change this later under *Settings → Git*.
3. Click **Deploy**. The first build may fail until steps 2 and 3 are done, which is expected.

### 2. Add storage
In the Vercel project, open **Storage**:
- **Create Database → Neon (Postgres)**, then connect it to the project. This adds `DATABASE_URL`.
- **Create → Blob**, then connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` (for photos and videos).

### 3. Add environment variables
Go to **Settings → Environment Variables** and add these:

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | Random string. Run `openssl rand -base64 32` |
| `CRON_SECRET` | Any random string |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | From `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | From the same command |
| `VAPID_SUBJECT` | `mailto:it@yourcompany.com` |
| `CRM_API_KEY` | Random string. Give the same value to the PONGS CRM |
| `CRM_WEBHOOK_SECRET` | Random string, used to sign decisions sent back to the CRM |
| `CRM_WEBHOOK_URL` | *(optional)* CRM endpoint that receives approval decisions |
| `APPROVAL_REMINDER_MINUTES` | *(optional)* default `30` |
| `CRM_DEFAULT_DEPARTMENT` | *(optional)* `sales`, `project`, `accounts` or `dispatch`. Default is `sales` |

### 4. Redeploy
Go to **Deployments → ⋯ → Redeploy**. The database tables are created automatically during the build.

### 5. First-time setup
1. Open `https://<your-app>.vercel.app/setup`.
2. Create the first **admin** account and list your cities, for example `Mumbai, Pune, Ahmedabad`. Each city gets **Sales, Project, Accounts and Dispatch** groups.
3. Open **Admin → People** to add employees. For each person, set their role, city and department, and tick **Can approve costings** for anyone who approves quotations.

### 6. Turn on phone notifications
- **Android and desktop:** sign in, then tap **Turn on notifications** in the sidebar.
- **iPhone:** open the site in Safari and tap **Share → Add to Home Screen**. Open the app from the home screen, then turn on notifications.

### 7. Reminder frequency
On the Vercel **Hobby** plan, the built-in cron job only runs once a day. Reminders still go out whenever someone has the app open. To send them reliably even when nobody is using the app, pick one of these:
- **Vercel Pro:** change the schedule in `vercel.json` (on the `internal-communication` branch) to `*/5 * * * *`.
- **Any plan:** have a free scheduler such as cron-job.org call this every 5 minutes:
  `GET https://<your-app>.vercel.app/api/cron/reminders` with the header `Authorization: Bearer <CRON_SECRET>`.

### 8. Connect PONGS CRM
The CRM sends quotations for costing approval to `POST /api/integrations/crm/approvals`, with the header `x-api-key: <CRM_API_KEY>`. Decisions are sent back to the CRM's callback URL, signed with `CRM_WEBHOOK_SECRET`. The full request and response format is in the README on the [`internal-communication`](../../tree/internal-communication) branch and on the app's **Admin → PONGS CRM integration** page.

---

## Local development

```bash
git clone https://github.com/parthlakhani87/REA-.git
cd REA-
git checkout internal-communication
cp .env.example .env.local      # set at least DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate
npm run dev                     # then open http://localhost:3000/setup
```
