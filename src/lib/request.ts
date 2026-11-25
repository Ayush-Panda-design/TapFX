import { headers } from "next/headers";

/**
 * Best-effort client IP. Only trustworthy behind a proxy/CDN that sets these headers
 * (Vercel, Cloudflare); locally it falls back to "local".
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || xff || "local";
}

/** CSRF defence in depth for non-Server-Action POST handlers: Origin must match Host. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
