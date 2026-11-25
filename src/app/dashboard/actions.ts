"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { newId, newShortCode } from "@/lib/ids";
import { LIMITS } from "@/lib/limits";
import { rateLimit } from "@/lib/ratelimit";
import { assertDestinationAllowed } from "@/lib/safe-url";
import { requireUser } from "@/lib/session";
import { contentSchema } from "@/lib/qr/content";
import { styleSchema } from "@/lib/qr/style";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give this QR code a name").max(80),
  kind: z.enum(["static", "dynamic"]),
  content: contentSchema,
  style: styleSchema,
});

export type SaveResult = { error?: string; id?: string };

export async function saveQr(input: unknown): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid QR code" };
  const { id, name, kind, content, style } = parsed.data;

  if (kind === "dynamic" && content.type !== "url") return { error: "Dynamic codes only support website links" };

  let destination: string | null = null;
  if (kind === "dynamic" && content.type === "url") {
    try {
      assertDestinationAllowed(content.url);
    } catch (e) {
      return { error: (e as Error).message };
    }
    destination = content.url;
  }

  // ---- Update (ownership enforced in the WHERE clause) ----
  if (id) {
    const existing = await db
      .select()
      .from(schema.qrCodes)
      .where(and(eq(schema.qrCodes.id, id), eq(schema.qrCodes.userId, user.id)))
      .get();
    if (!existing) return { error: "QR code not found" };
    // Kind and content type are fixed at creation: a printed code must keep meaning the same kind of thing.
    if (existing.kind !== kind || existing.contentType !== content.type) return { error: "The type of a saved QR code can't be changed" };
    await db
      .update(schema.qrCodes)
      .set({ name, content, style, destination, updatedAt: Date.now() })
      .where(and(eq(schema.qrCodes.id, id), eq(schema.qrCodes.userId, user.id)));
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/${id}`);
    return { id };
  }

  // ---- Create ----
  if (kind === "dynamic" && !user.verified) return { error: "Confirm your email to create dynamic QR codes. Check your inbox for the link." };
  if (!(await rateLimit(`create:${user.id}`, LIMITS.createsPerHour, 60 * 60 * 1000)).ok) {
    return { error: "You're creating codes too quickly. Please try again in a bit." };
  }
  const [{ total }] = await db.select({ total: count() }).from(schema.qrCodes).where(eq(schema.qrCodes.userId, user.id));
  if (total >= LIMITS.maxQrCodes) return { error: `You've reached the limit of ${LIMITS.maxQrCodes} QR codes.` };
  if (kind === "dynamic") {
    const [{ dyn }] = await db
      .select({ dyn: count() })
      .from(schema.qrCodes)
      .where(and(eq(schema.qrCodes.userId, user.id), eq(schema.qrCodes.kind, "dynamic")));
    if (dyn >= LIMITS.maxDynamicQrCodes) return { error: `You've reached the limit of ${LIMITS.maxDynamicQrCodes} dynamic QR codes.` };
  }

  const newQrId = newId();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.insert(schema.qrCodes).values({
        id: newQrId,
        userId: user.id,
        name,
        kind,
        contentType: content.type,
        content,
        style,
        shortCode: kind === "dynamic" ? newShortCode() : null,
        destination,
      });
      revalidatePath("/dashboard");
      return { id: newQrId };
    } catch (e) {
      // Only a short-code collision is retryable; anything else is a real error.
      if (kind !== "dynamic" || !/UNIQUE|constraint/i.test(String(e))) throw e;
    }
  }
  return { error: "Could not allocate a short link. Please try again." };
}

const idSchema = z.string().uuid();

export async function setQrStatus(id: string, status: "active" | "paused") {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return;
  await db
    .update(schema.qrCodes)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(schema.qrCodes.id, id), eq(schema.qrCodes.userId, user.id)));
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${id}`);
}

export async function deleteQr(id: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return;
  await db.delete(schema.qrCodes).where(and(eq(schema.qrCodes.id, id), eq(schema.qrCodes.userId, user.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
