// Applies pending SQL migrations from ./drizzle. Runs automatically before `next build` on Vercel.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping migrations");
  process.exit(0);
}
const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });
  console.log("[migrate] database is up to date");
} finally {
  await client.end();
}
