import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure-schema";
import { databaseUrl } from "@/lib/config";

// Deployment self-check: which settings are present and whether the database works. Never returns secret values.
export async function GET() {
  const env = process.env;
  const config = {
    database: Boolean(databaseUrl()),
    authSecret: (env.AUTH_SECRET?.length ?? 0) >= 16,
    blobStorage: Boolean(env.BLOB_READ_WRITE_TOKEN),
    // Keys come from the environment, or are generated and stored automatically on first use.
    pushNotifications: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? "environment keys" : "automatic keys",
    cronSecret: Boolean(env.CRON_SECRET),
    crmApiKey: Boolean(env.CRM_API_KEY),
  };
  let databaseStatus = "not configured";
  if (config.database) {
    try {
      await ensureSchema();
      await db.execute(sql`select 1 from users limit 1`);
      databaseStatus = "ok";
    } catch (err) {
      console.error(err);
      databaseStatus = `error: ${(err as Error).message}`;
    }
  }
  const ok = config.database && config.authSecret && databaseStatus === "ok";
  return Response.json({ ok, config, databaseStatus }, { status: ok ? 200 : 503 });
}
