import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Atomic fixed-window rate limiter stored in the database (no Redis needed).
 * Returns { ok: false } once `limit` hits within `windowMs` have been made for `key`.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number }> {
  const now = Date.now();
  const cutoff = now - windowMs;
  const rows = await db.all<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${now}, 1)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN window_start <= ${cutoff} THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN window_start <= ${cutoff} THEN ${now} ELSE window_start END
    RETURNING count
  `);
  const count = Number(rows[0]?.count ?? 1);
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

/** Opportunistic cleanup so the table never grows unbounded. */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000) {
  await db.run(sql`DELETE FROM rate_limits WHERE window_start < ${Date.now() - olderThanMs}`);
}
