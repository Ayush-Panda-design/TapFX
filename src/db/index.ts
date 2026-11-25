import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse one client across hot reloads in dev so we don't leak connections.
const globalForDb = globalThis as unknown as { __libsql?: ReturnType<typeof createClient> };
const client =
  globalForDb.__libsql ?? createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN || undefined });
if (env.NODE_ENV !== "production") globalForDb.__libsql = client;

export const db = drizzle(client, { schema });
export { schema };
