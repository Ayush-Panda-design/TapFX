import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "./env";

const COOKIE = "sid";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 15 * 24 * 60 * 60 * 1000;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + TTL_MS;
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

/** Signs a user out everywhere (used after a password reset). */
export async function destroyAllSessions(userId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  jar.delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; verified: boolean };

/** Returns the signed-in user or null. Safe to call from any server component / action. */
export async function getUser(): Promise<SessionUser | null> {
  // Session validity depends on the current time, so this must never run during prerender/prefetch.
  await connection();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const row = await db
    .select({ expiresAt: schema.sessions.expiresAt, userId: schema.users.id, email: schema.users.email, name: schema.users.name, verifiedAt: schema.users.emailVerifiedAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, Date.now())))
    .get();
  if (!row) return null;

  // Sliding expiry: extend active sessions. (Cookie is only re-set inside actions/route handlers.)
  if (row.expiresAt - Date.now() < TTL_MS - REFRESH_AFTER_MS) {
    await db.update(schema.sessions).set({ expiresAt: Date.now() + TTL_MS }).where(eq(schema.sessions.id, id));
  }
  return { id: row.userId, email: row.email, name: row.name, verified: row.verifiedAt !== null };
}

/** Use at the top of protected pages and actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
