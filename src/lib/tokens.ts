import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { env } from "./env";
import { BRAND } from "./brand";

export type TokenType = "verify" | "reset";

const TTL: Record<TokenType, number> = { verify: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000 };
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** Creates a token, invalidating any earlier unused token of the same type for that user. Returns the raw token. */
export async function createToken(userId: string, type: TokenType): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.delete(schema.authTokens).where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.type, type)));
  await db.insert(schema.authTokens).values({ id: hash(token), userId, type, expiresAt: Date.now() + TTL[type] });
  return token;
}

/** Atomically spends a token (single use). Returns the user id, or null if invalid, expired or already used. */
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null;
  const now = Date.now();
  const rows = await db.all<{ user_id: string }>(sql`
    UPDATE auth_tokens SET used_at = ${now}
    WHERE id = ${hash(token)} AND type = ${type} AND used_at IS NULL AND expires_at > ${now}
    RETURNING user_id
  `);
  return rows[0]?.user_id ?? null;
}

/** Non-consuming validity check, used to show a friendly page before the user submits. */
export async function peekToken(token: string, type: TokenType): Promise<boolean> {
  await connection(); // expiry depends on the current time: never evaluate during prerender
  if (!TOKEN_RE.test(token)) return false;
  const row = await db
    .select({ usedAt: schema.authTokens.usedAt, expiresAt: schema.authTokens.expiresAt })
    .from(schema.authTokens)
    .where(and(eq(schema.authTokens.id, hash(token)), eq(schema.authTokens.type, type)))
    .get();
  return !!row && row.usedAt === null && row.expiresAt > Date.now();
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
  const token = await createToken(user.id, "verify");
  const link = `${env.APP_URL.replace(/\/$/, "")}/verify-email?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: `Confirm your email for ${BRAND.name}`,
    text: `Confirm your email address to finish setting up your ${BRAND.name} account:\n\n${link}\n\nThis link works once and expires in 24 hours. If you didn't create an account, ignore this email.`,
  });
}

export async function sendResetEmail(user: { id: string; email: string }) {
  const token = await createToken(user.id, "reset");
  const link = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: `Reset your ${BRAND.name} password`,
    text: `Use this link to choose a new password:\n\n${link}\n\nThis link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email: your password has not changed.`,
  });
}
