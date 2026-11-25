import { env } from "@/lib/env";
import { buildPayload, contentSchema } from "./content";
import { styleSchema, type QrStyle } from "./style";
import { renderSvg } from "./render";

export const shortUrlFor = (code: string) => `${env.APP_URL.replace(/\/$/, "")}/r/${code}`;

type Row = { kind: "static" | "dynamic"; content: unknown; style: unknown; shortCode: string | null };

/** The exact string a phone reads from this QR code. */
export function payloadFor(row: Row): string | null {
  if (row.kind === "dynamic") return row.shortCode ? shortUrlFor(row.shortCode) : null;
  const c = contentSchema.safeParse(row.content);
  return c.success ? buildPayload(c.data) : null;
}

/** Server-side SVG for dashboard thumbnails. Falls back to a safe default if stored style is invalid. */
export function svgFor(row: Row): string | null {
  const payload = payloadFor(row);
  if (!payload) return null;
  const style: Partial<QrStyle> = styleSchema.safeParse(row.style).data ?? {};
  return renderSvg(payload, style);
}
