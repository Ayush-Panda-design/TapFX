import { sql } from "drizzle-orm";
import { db } from "@/db";

export type Breakdown = { label: string; count: number }[];
export type Analytics = {
  days: number;
  total: number;
  unique: number;
  botsFiltered: number;
  series: { day: string; count: number }[];
  countries: Breakdown;
  devices: Breakdown;
  os: Breakdown;
  browsers: Breakdown;
  referrers: Breakdown;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates scans for one QR code. The caller must already have verified that the signed-in
 * user owns `qrId` (the dashboard page does, via an owner-scoped query).
 * Days are bucketed in UTC. Bots and link-preview crawlers are excluded from every figure.
 */
export async function getAnalytics(qrId: string, days: 7 | 30 | 90): Promise<Analytics> {
  const now = Date.now();
  const since = now - days * DAY_MS;

  const [totals] = await db.all<{ total: number; uniq: number }>(sql`
    SELECT COUNT(*) AS total, COUNT(DISTINCT visitor) AS uniq
    FROM scan_events WHERE qr_id = ${qrId} AND ts >= ${since} AND is_bot = 0`);

  const [bots] = await db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM scan_events WHERE qr_id = ${qrId} AND ts >= ${since} AND is_bot = 1`);

  const perDay = await db.all<{ day: string; n: number }>(sql`
    SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS day, COUNT(*) AS n
    FROM scan_events WHERE qr_id = ${qrId} AND ts >= ${since} AND is_bot = 0 GROUP BY day`);
  const map = new Map(perDay.map((r) => [r.day, Number(r.n)]));
  const series: Analytics["series"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * DAY_MS).toISOString().slice(0, 10);
    series.push({ day, count: map.get(day) ?? 0 });
  }

  // Column names are fixed literals below (never user input), so sql.raw is safe here.
  const top = async (col: "country" | "device" | "os" | "browser" | "referrer", fallback: string): Promise<Breakdown> => {
    const rows = await db.all<{ label: string | null; n: number }>(sql`
      SELECT ${sql.raw(col)} AS label, COUNT(*) AS n FROM scan_events
      WHERE qr_id = ${qrId} AND ts >= ${since} AND is_bot = 0
      GROUP BY ${sql.raw(col)} ORDER BY n DESC LIMIT 8`);
    return rows.map((r) => ({ label: r.label ?? fallback, count: Number(r.n) }));
  };

  const [countries, devices, os, browsers, referrers] = await Promise.all([
    top("country", "Unknown"),
    top("device", "Unknown").then((rows) => rows.map((r) => ({ ...r, label: r.label.charAt(0).toUpperCase() + r.label.slice(1) }))),
    top("os", "Unknown"),
    top("browser", "Unknown"),
    top("referrer", "Direct / none"),
  ]);

  return {
    days,
    total: Number(totals?.total ?? 0),
    unique: Number(totals?.uniq ?? 0),
    botsFiltered: Number(bots?.n ?? 0),
    series,
    countries,
    devices,
    os,
    browsers,
    referrers,
  };
}

/** Lifetime human scan counts for a set of QR codes, one query for the whole dashboard list. */
export async function scanCountsForUser(userId: string): Promise<Map<string, number>> {
  const rows = await db.all<{ qr_id: string; n: number }>(sql`
    SELECT s.qr_id AS qr_id, COUNT(*) AS n
    FROM scan_events s JOIN qr_codes q ON q.id = s.qr_id
    WHERE q.user_id = ${userId} AND s.is_bot = 0 GROUP BY s.qr_id`);
  return new Map(rows.map((r) => [r.qr_id, Number(r.n)]));
}

/** Retention: raw events are deleted after `keepDays` (privacy + keeps the database small on free tiers). */
export async function pruneOldScans(keepDays = 365) {
  await db.run(sql`DELETE FROM scan_events WHERE ts < ${Date.now() - keepDays * DAY_MS}`);
}
