import { env } from "./env";

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
];

/**
 * Anti-abuse rules for redirect destinations. QR shorteners are a common phishing vector,
 * so we refuse loops back to ourselves and (in production) links to internal addresses.
 */
export function assertDestinationAllowed(destination: string): void {
  const u = new URL(destination);
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  const own = new URL(env.APP_URL).hostname.toLowerCase();
  if (host === own && u.pathname.startsWith("/r/")) throw new Error("A QR code cannot point to another short link on this site");

  if (env.NODE_ENV === "production") {
    const internal =
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      PRIVATE_V4.some((re) => re.test(host));
    if (internal) throw new Error("Links to private or internal addresses are not allowed");
  }
}
