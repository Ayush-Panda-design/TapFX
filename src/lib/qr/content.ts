import { z } from "zod";

/**
 * QR content types and the logic that turns each into the exact string a phone
 * camera understands (URL, WIFI:..., BEGIN:VCARD, mailto:, SMSTO:, geo:, tel:).
 */

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Accepts "example.com/x" or full URLs. Only http(s) is allowed (blocks javascript:, data:, file:). */
export function normalizeUrl(input: string): string {
  const raw = input.trim();
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !/^[^/]+:\d+(\/|$)/.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http and https links are allowed");
  if (!u.hostname.includes(".") && u.hostname !== "localhost") throw new Error("Enter a valid URL");
  if (u.username || u.password) throw new Error("URLs with embedded credentials are not allowed");
  return u.toString();
}

export const urlSchema = z
  .string()
  .trim()
  .min(1, "Enter a URL")
  .max(2048)
  .transform((v, ctx) => {
    try {
      return normalizeUrl(v);
    } catch (e) {
      ctx.addIssue({ code: "custom", message: (e as Error).message });
      return z.NEVER;
    }
  });

export const contentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: urlSchema }),
  z.object({ type: z.literal("text"), text: trimmed(1000) }),
  z.object({
    type: z.literal("wifi"),
    ssid: trimmed(32),
    password: optional(63),
    security: z.enum(["WPA", "WEP", "nopass"]).default("WPA"),
    hidden: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("email"),
    to: z.string().trim().email().max(254),
    subject: optional(200),
    body: optional(1000),
  }),
  z.object({ type: z.literal("phone"), phone: z.string().trim().regex(/^\+?[0-9 ()-]{5,20}$/, "Enter a valid phone number") }),
  z.object({
    type: z.literal("sms"),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{5,20}$/, "Enter a valid phone number"),
    message: optional(500),
  }),
  z.object({
    type: z.literal("vcard"),
    firstName: trimmed(60),
    lastName: optional(60),
    org: optional(100),
    title: optional(100),
    phone: optional(30),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    website: optional(200),
    address: optional(200),
  }),
  z.object({
    type: z.literal("geo"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
]);

export type QrContent = z.infer<typeof contentSchema>;
export type QrContentType = QrContent["type"];

export const CONTENT_TYPES: { type: QrContentType; label: string; description: string }[] = [
  { type: "url", label: "Website", description: "Link to any web page" },
  { type: "text", label: "Text", description: "Plain text message" },
  { type: "wifi", label: "WiFi", description: "Join a network by scanning" },
  { type: "vcard", label: "Contact", description: "Save a contact card" },
  { type: "email", label: "Email", description: "Compose an email" },
  { type: "sms", label: "SMS", description: "Send a text message" },
  { type: "phone", label: "Phone", description: "Start a phone call" },
  { type: "geo", label: "Location", description: "Open a map location" },
];

const wifiEscape = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
const vcardEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([;,])/g, "\\$1");
/** Strip CR/LF so user input can never inject extra vCard/line fields. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export function buildPayload(content: QrContent): string {
  switch (content.type) {
    case "url":
      return content.url;
    case "text":
      return content.text;
    case "wifi": {
      const pass = content.security === "nopass" ? "" : wifiEscape(content.password ?? "");
      return `WIFI:T:${content.security};S:${wifiEscape(content.ssid)};P:${pass};H:${content.hidden ? "true" : "false"};;`;
    }
    case "email": {
      const params: string[] = [];
      if (content.subject) params.push(`subject=${encodeURIComponent(content.subject)}`);
      if (content.body) params.push(`body=${encodeURIComponent(content.body)}`);
      return `mailto:${content.to}${params.length ? `?${params.join("&")}` : ""}`;
    }
    case "phone":
      return `tel:${content.phone.replace(/[^+\d]/g, "")}`;
    case "sms":
      return `SMSTO:${content.phone.replace(/[^+\d]/g, "")}:${oneLine(content.message ?? "")}`;
    case "geo":
      return `geo:${content.lat},${content.lng}`;
    case "vcard": {
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      const last = oneLine(content.lastName ?? "");
      const first = oneLine(content.firstName);
      lines.push(`N:${vcardEscape(last)};${vcardEscape(first)};;;`);
      lines.push(`FN:${vcardEscape([first, last].filter(Boolean).join(" "))}`);
      if (content.org) lines.push(`ORG:${vcardEscape(oneLine(content.org))}`);
      if (content.title) lines.push(`TITLE:${vcardEscape(oneLine(content.title))}`);
      if (content.phone) lines.push(`TEL:${vcardEscape(oneLine(content.phone))}`);
      if (content.email) lines.push(`EMAIL:${vcardEscape(oneLine(content.email))}`);
      if (content.website) lines.push(`URL:${vcardEscape(oneLine(content.website))}`);
      if (content.address) lines.push(`ADR:;;${vcardEscape(oneLine(content.address))};;;;`);
      lines.push("END:VCARD");
      return lines.join("\n");
    }
  }
}
