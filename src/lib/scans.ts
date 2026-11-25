import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { env } from "./env";
import { parseUserAgent } from "./ua";

export type ScanInput = {
  qrId: string;
  ip: string;
  userAgent: string | null;
  referrer: string | null;
  country: string | null;
};

/**
 * Privacy-friendly visitor id: salted hash of (day, ip, user-agent). It rotates daily and the raw IP is
 * never stored, so we can count unique scanners per day without keeping personal data.
 */
export function visitorHash(ip: string, ua: string | null, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${env.IP_HASH_SALT}|${day}|${ip}|${ua ?? ""}`).digest("hex").slice(0, 24);
}

function referrerHost(ref: string | null): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).hostname.slice(0, 100) || null;
  } catch {
    return null;
  }
}

/** Runs after the redirect response is sent (via `after()`), so it never slows down a scan. */
export async function recordScan(s: ScanInput): Promise<void> {
  try {
    const ua = parseUserAgent(s.userAgent);
    await db.insert(schema.scanEvents).values({
      qrId: s.qrId,
      ts: Date.now(),
      country: s.country && /^[A-Za-z]{2}$/.test(s.country) ? s.country.toUpperCase() : null,
      device: ua.device,
      os: ua.os,
      browser: ua.browser,
      referrer: referrerHost(s.referrer),
      visitor: visitorHash(s.ip, s.userAgent),
      isBot: ua.isBot,
    });
  } catch (err) {
    // Analytics must never break a redirect.
    console.error("scan record failed", err);
  }
}
