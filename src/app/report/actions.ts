"use server";

import { z } from "zod";
import { db, schema } from "@/db";
import { SHORT_CODE_RE } from "@/lib/ids";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/request";

export type ReportState = { error?: string; ok?: boolean } | undefined;

const REASONS = ["phishing", "malware", "scam", "adult", "other"] as const;

const schemaIn = z.object({
  link: z.string().trim().min(1, "Paste the QR short link or code").max(300),
  reason: z.enum(REASONS),
  details: z.string().trim().max(1000).optional(),
});

/** Accepts either a full short link (https://host/r/AbC1234) or the bare code. */
function extractCode(link: string): string | null {
  const m = link.match(/\/r\/([0-9A-Za-z]{4,12})(?:[/?#]|$)/);
  const code = m?.[1] ?? link;
  return SHORT_CODE_RE.test(code) ? code : null;
}

export async function reportAbuse(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const parsed = schemaIn.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const code = extractCode(parsed.data.link);
  if (!code) return { error: "That doesn't look like one of our short links (example: …/r/AbC1234)." };

  const ip = await clientIp();
  if (!(await rateLimit(`report:${ip}`, 5, 60 * 60 * 1000)).ok) return { error: "Too many reports. Please try again later." };

  await db.insert(schema.abuseReports).values({ shortCode: code, reason: parsed.data.reason, details: parsed.data.details || null });
  return { ok: true };
}
