import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = () => Date.now();

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** Set when the user proves control of the inbox (verification link or completed password reset). */
  emailVerifiedAt: integer("email_verified_at"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

/** One-time email tokens. Only the SHA-256 of the token is stored, so a leaked DB cannot be used to take over accounts. */
export const authTokens = sqliteTable(
  "auth_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["verify", "reset"] }).notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId, t.type)],
);

/** Session ids are SHA-256 hashes of the cookie token, so a leaked DB cannot be used to hijack sessions. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const qrCodes = sqliteTable(
  "qr_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "dynamic": encodes a short link that redirects (editable, tracked). "static": encodes the data directly. */
    kind: text("kind", { enum: ["static", "dynamic"] }).notNull(),
    contentType: text("content_type").notNull(),
    /** JSON of the validated content (url/wifi/vcard/...). */
    content: text("content", { mode: "json" }).notNull(),
    /** JSON of the validated style (shapes, colours, logo). */
    style: text("style", { mode: "json" }).notNull(),
    shortCode: text("short_code"),
    /** Dynamic only: current redirect destination. */
    destination: text("destination"),
    status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("qr_short_code_idx").on(t.shortCode), index("qr_user_idx").on(t.userId, t.createdAt)],
);

export const scanEvents = sqliteTable(
  "scan_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    qrId: text("qr_id").notNull().references(() => qrCodes.id, { onDelete: "cascade" }),
    ts: integer("ts").notNull(),
    country: text("country"),
    device: text("device").notNull(),
    os: text("os").notNull(),
    browser: text("browser").notNull(),
    referrer: text("referrer"),
    /** Salted, daily-rotating hash: enables unique counts without ever storing a raw IP. */
    visitor: text("visitor").notNull(),
    isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("scan_qr_ts_idx").on(t.qrId, t.ts)],
);

/** Fixed-window rate limiter (works on any host with no Redis). */
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull(),
});

export const abuseReports = sqliteTable("abuse_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shortCode: text("short_code").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: integer("created_at").notNull().$defaultFn(now),
});

export type User = typeof users.$inferSelect;
export type QrRow = typeof qrCodes.$inferSelect;
