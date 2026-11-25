import { env } from "./env";

export type Mail = { to: string; subject: string; text: string };

/**
 * Sends a plain-text email through Resend's HTTP API (free tier, no SDK needed).
 * - With RESEND_API_KEY + EMAIL_FROM set: sends for real.
 * - In development without a key: prints the message (including links) to the server console.
 * - In production without a key: logs a warning only (links are secrets and must not be logged).
 * Returns false when nothing was delivered; callers must not reveal that to the requester.
 */
export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (env.NODE_ENV !== "production") {
      console.log(`\n--- EMAIL (dev, not sent) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n-----------------------------\n`);
      return true;
    }
    console.warn("Email not sent: set RESEND_API_KEY and EMAIL_FROM.");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`Email provider rejected message (${res.status})`);
    return res.ok;
  } catch (e) {
    console.error("Email send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
