import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

// Standalone (does not import the app's env module so it can run in CI/deploy steps).
async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  console.log(`Migrations applied to ${url.startsWith("file:") ? url : "remote database"}`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
