import type { QrContentType } from "@/lib/qr/content";

export type FieldSpec = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "select" | "checkbox" | "number" | "email" | "tel" | "url";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
};

export const FIELDS: Record<QrContentType, FieldSpec[]> = {
  url: [{ key: "url", label: "Website address", kind: "text", placeholder: "https://example.com/menu", maxLength: 2048 }],
  text: [{ key: "text", label: "Your text", kind: "textarea", placeholder: "Anything you like…", maxLength: 1000 }],
  wifi: [
    { key: "ssid", label: "Network name (SSID)", kind: "text", maxLength: 32 },
    {
      key: "security",
      label: "Security",
      kind: "select",
      options: [
        { value: "WPA", label: "WPA / WPA2 / WPA3" },
        { value: "WEP", label: "WEP" },
        { value: "nopass", label: "No password" },
      ],
    },
    { key: "password", label: "Password", kind: "text", maxLength: 63 },
    { key: "hidden", label: "Hidden network", kind: "checkbox" },
  ],
  vcard: [
    { key: "firstName", label: "First name", kind: "text", maxLength: 60 },
    { key: "lastName", label: "Last name", kind: "text", maxLength: 60 },
    { key: "org", label: "Company", kind: "text", maxLength: 100 },
    { key: "title", label: "Job title", kind: "text", maxLength: 100 },
    { key: "phone", label: "Phone", kind: "tel", maxLength: 30 },
    { key: "email", label: "Email", kind: "email", maxLength: 254 },
    { key: "website", label: "Website", kind: "text", maxLength: 200 },
    { key: "address", label: "Address", kind: "text", maxLength: 200 },
  ],
  email: [
    { key: "to", label: "Send to", kind: "email", placeholder: "hello@example.com", maxLength: 254 },
    { key: "subject", label: "Subject", kind: "text", maxLength: 200 },
    { key: "body", label: "Message", kind: "textarea", maxLength: 1000 },
  ],
  sms: [
    { key: "phone", label: "Phone number", kind: "tel", placeholder: "+91 98765 43210", maxLength: 20 },
    { key: "message", label: "Message", kind: "textarea", maxLength: 500 },
  ],
  phone: [{ key: "phone", label: "Phone number", kind: "tel", placeholder: "+91 98765 43210", maxLength: 20 }],
  geo: [
    { key: "lat", label: "Latitude", kind: "number", placeholder: "28.6139" },
    { key: "lng", label: "Longitude", kind: "number", placeholder: "77.2090" },
  ],
};

export type Values = Record<string, string | boolean>;

export const DEFAULT_VALUES: Record<QrContentType, Values> = {
  url: { url: "" },
  text: { text: "" },
  wifi: { ssid: "", security: "WPA", password: "", hidden: false },
  vcard: { firstName: "", lastName: "", org: "", title: "", phone: "", email: "", website: "", address: "" },
  email: { to: "", subject: "", body: "" },
  sms: { phone: "", message: "" },
  phone: { phone: "" },
  geo: { lat: "", lng: "" },
};

/** Turns form strings into the shape the zod schema expects (numbers for geo, booleans for checkboxes). */
export function toContentInput(type: QrContentType, values: Values): Record<string, unknown> {
  const out: Record<string, unknown> = { type };
  for (const [k, v] of Object.entries(values)) out[k] = v;
  if (type === "geo") {
    out.lat = values.lat === "" ? NaN : Number(values.lat);
    out.lng = values.lng === "" ? NaN : Number(values.lng);
  }
  return out;
}

export function toValues(type: QrContentType, content: Record<string, unknown>): Values {
  const base = { ...DEFAULT_VALUES[type] };
  for (const k of Object.keys(base)) {
    const v = content[k];
    if (v === undefined || v === null) continue;
    base[k] = typeof base[k] === "boolean" ? Boolean(v) : String(v);
  }
  return base;
}
