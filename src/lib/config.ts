// Raised when the deployment is missing configuration; shown to the user as-is (never contains secret values).
export class ConfigError extends Error {}

// Vercel's Neon/Postgres integrations expose the connection string under different names
// (and with a custom prefix if one was chosen when connecting the store).
export function databaseUrl(): string | undefined {
  const env = process.env;
  const direct = env.DATABASE_URL || env.POSTGRES_URL;
  if (direct) return direct;
  const key = Object.keys(env).find((k) => /(_DATABASE_URL|_POSTGRES_URL)$/.test(k) && !/UNPOOLED|NON_POOLING/.test(k));
  return key ? env[key] : undefined;
}
