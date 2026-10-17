import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "./index";

let ready: Promise<void> | null = null;

// Applies any pending migrations once per server instance. Covers deployments where the
// database was connected after the build ran (so the build-time migration was skipped).
export function ensureSchema() {
  ready ??= migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}
