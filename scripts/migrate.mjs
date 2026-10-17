// Applies pending SQL migrations from ./drizzle. Runs automatically before `next build` on Vercel.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const env = process.env;
const fallbackKey = Object.keys(env).find((k) => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && !/UNPOOLED|NON_POOLING/.test(k));
const url = env.DATABASE_URL || env.POSTGRES_URL || (fallbackKey && env[fallbackKey]);
if (!url) {
  console.log("[migrate] no database URL set, skipping migrations (they will run on first request)");
  process.exit(0);
}
const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });
  console.log("[migrate] database is up to date");
} finally {
  await client.end();
}
