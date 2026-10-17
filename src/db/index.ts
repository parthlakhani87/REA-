import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;
const globalForDb = globalThis as unknown as { db?: DB };

function getDb(): DB {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // prepare: false keeps us compatible with pooled (pgbouncer) connections on Neon/Supabase
    const client = postgres(url, { prepare: false, max: 5 });
    globalForDb.db = drizzle({ client, schema });
  }
  return globalForDb.db;
}

// Lazily connect so that `next build` works without a database.
export const db = new Proxy({} as DB, {
  get: (_, prop) => {
    const real = getDb();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
