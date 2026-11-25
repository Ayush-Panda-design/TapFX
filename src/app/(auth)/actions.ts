"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId } from "@/lib/ids";
import { dummyVerify, hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";
import { createSession, destroyAllSessions, destroySession, requireUser } from "@/lib/session";
import { consumeToken, sendResetEmail, sendVerificationEmail } from "@/lib/tokens";

export type FormState = { error?: string } | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const COMMON = new Set(["password123", "1234567890", "qwertyuiop", "iloveyou12", "password1234", "letmein1234", "0123456789"]);

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email,
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(128, "Use at most 128 characters")
    .refine((p) => !COMMON.has(p.toLowerCase()), "That password is too common"),
});

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)).ok) {
    return { error: "Too many sign-ups from this network. Please try again later." };
  }

  const { name, email: addr, password } = parsed.data;
  const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, addr)).get();
  if (exists) return { error: "An account with this email already exists. Try signing in." };

  const id = newId();
  try {
    await db.insert(schema.users).values({ id, email: addr, name, passwordHash: await hashPassword(password) });
  } catch {
    return { error: "An account with this email already exists. Try signing in." }; // unique-constraint race
  }
  await sendVerificationEmail({ id, email: addr });
  await createSession(id);
  redirect("/dashboard");
}

export type MessageState = { error?: string; message?: string } | undefined;

const passwordField = signupSchema.shape.password;

/** Always answers the same way, so it cannot be used to discover which emails have accounts. */
export async function requestPasswordReset(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email address" };

  const ip = await clientIp();
  const addr = parsed.data.email;
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`reset-ip:${ip}`, 10, 60 * 60 * 1000),
    rateLimit(`reset-email:${addr}`, 3, 60 * 60 * 1000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: "Too many requests. Please try again later." };

  const user = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(eq(schema.users.email, addr)).get();
  if (user) await sendResetEmail(user);
  return { message: "If an account exists for that email, we've sent a link to reset your password." };
}

export async function resetPassword(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const parsed = z.object({ token: z.string().max(100), password: passwordField }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = await clientIp();
  if (!(await rateLimit(`reset-submit:${ip}`, 10, 15 * 60 * 1000)).ok) return { error: "Too many attempts. Please try again later." };

  const userId = await consumeToken(parsed.data.token, "reset");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  // A completed reset also proves the user controls the inbox.
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: Date.now() })
    .where(eq(schema.users.id, userId));
  await destroyAllSessions(userId); // anyone holding an old session is signed out
  redirect("/login?reset=1");
}

export async function confirmEmail(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const token = String(formData.get("token") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`verify-ip:${ip}`, 20, 15 * 60 * 1000)).ok) return { error: "Too many attempts. Please try again later." };

  const userId = await consumeToken(token, "verify");
  if (!userId) return { error: "This link is invalid or has expired. Sign in and request a new one." };
  await db.update(schema.users).set({ emailVerifiedAt: Date.now() }).where(eq(schema.users.id, userId));
  return { message: "Your email is confirmed." };
}

export async function resendVerification(): Promise<MessageState> {
  const user = await requireUser();
  if (user.verified) return { message: "Your email is already confirmed." };
  if (!(await rateLimit(`resend-verify:${user.id}`, 3, 60 * 60 * 1000)).ok) return { error: "Too many requests. Please try again later." };
  const sent = await sendVerificationEmail(user);
  return sent ? { message: `We sent a confirmation link to ${user.email}.` } : { error: "We couldn't send the email. Please try again later." };
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password" };

  const ip = await clientIp();
  const { email: addr, password } = parsed.data;
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login-ip:${ip}`, 20, 15 * 60 * 1000),
    rateLimit(`login-email:${addr}`, 8, 15 * 60 * 1000),
  ]);
  if (!byIp.ok || !byEmail.ok) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const user = await db.select().from(schema.users).where(eq(schema.users.email, addr)).get();
  // Always burn a password hash so response time does not reveal whether the email exists.
  const valid = user ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
  if (!user || !valid) return { error: "Incorrect email or password" };

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
