import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConfigError } from "./config";
import { ensureSchema } from "@/db/ensure-schema";

const COOKIE = "pongs_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new ConfigError("AUTH_SECRET is not set. Add it (at least 16 characters) in Vercel → Settings → Environment Variables, then redeploy.");
  }
  return new TextEncoder().encode(s);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = typeof schema.users.$inferSelect;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let uid: number;
  try {
    const { payload } = await jwtVerify(token, secret());
    uid = Number(payload.uid);
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    return null;
  }
  await ensureSchema();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, uid));
  return user && user.active ? user : null;
}

export function publicUser(u: SessionUser) {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}
