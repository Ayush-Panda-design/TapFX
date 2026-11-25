import { z } from "zod";

/** Validated once at boot: the app refuses to start with missing or weak configuration. */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  APP_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(16, "IP_HASH_SALT must be at least 16 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Optional: Resend API key (free tier). Without it, emails are printed to the server console in development. */
  RESEND_API_KEY: z.string().optional(),
  /** Sender, e.g. "TapFX <no-reply@yourdomain.com>". Must be a domain verified with your email provider. */
  EMAIL_FROM: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example`);
}
if (parsed.data.NODE_ENV === "production" && parsed.data.IP_HASH_SALT.startsWith("change-me")) {
  throw new Error("IP_HASH_SALT must be changed from the example value in production");
}

export const env = parsed.data;
