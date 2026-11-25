import { beforeAll, describe, expect, it, vi } from "vitest";

// env.ts validates process.env at import time, so provide values before importing modules that use it.
beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "file:./data/test.db");
  vi.stubEnv("APP_URL", "https://qr.example.com");
  vi.stubEnv("IP_HASH_SALT", "test-salt-test-salt-test-salt-1234");
  vi.stubEnv("NODE_ENV", "production");
});

describe("passwords (scrypt)", () => {
  it("hashes with a random salt and verifies correctly", async () => {
    const { hashPassword, verifyPassword } = await import("./password");
    const a = await hashPassword("correct horse battery staple");
    const b = await hashPassword("correct horse battery staple");
    expect(a).not.toBe(b); // unique salt per hash
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", a)).toBe(true);
    expect(await verifyPassword("wrong password", a)).toBe(false);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    const { verifyPassword } = await import("./password");
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$nope")).toBe(false);
  });
});

describe("short codes", () => {
  it("are 7 base62 chars and effectively unique", async () => {
    const { newShortCode, SHORT_CODE_RE } = await import("./ids");
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      const c = newShortCode();
      expect(c).toMatch(/^[0-9A-Za-z]{7}$/);
      expect(SHORT_CODE_RE.test(c)).toBe(true);
      seen.add(c);
    }
    expect(seen.size).toBe(5000);
  });

  it("validator rejects injection-style codes", async () => {
    const { SHORT_CODE_RE } = await import("./ids");
    for (const bad of ["a'b", "../x", "abc", "a".repeat(13), "ab cd1", "ab;cd12", ""]) {
      expect(SHORT_CODE_RE.test(bad)).toBe(false);
    }
  });
});

describe("destination safety (production)", () => {
  it("blocks loops and internal addresses", async () => {
    const { assertDestinationAllowed } = await import("./safe-url");
    expect(() => assertDestinationAllowed("https://qr.example.com/r/AbC1234")).toThrow(/another short link/);
    for (const bad of [
      "http://localhost:3000/x",
      "http://127.0.0.1/admin",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.0.9/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://printer.local/",
    ]) {
      expect(() => assertDestinationAllowed(bad), bad).toThrow();
    }
  });

  it("allows normal public sites", async () => {
    const { assertDestinationAllowed } = await import("./safe-url");
    expect(() => assertDestinationAllowed("https://example.com/menu")).not.toThrow();
    expect(() => assertDestinationAllowed("https://qr.example.com/pricing")).not.toThrow();
  });
});

describe("user-agent parsing", () => {
  it("classifies devices, OS and browsers", async () => {
    const { parseUserAgent } = await import("./ua");
    const iphone = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(iphone).toMatchObject({ device: "mobile", os: "iOS", browser: "Safari", isBot: false });
    const win = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0");
    expect(win).toMatchObject({ device: "desktop", os: "Windows", browser: "Edge" });
    const pad = parseUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(pad.device).toBe("tablet");
  });

  it("flags bots, previews and empty agents", async () => {
    const { parseUserAgent } = await import("./ua");
    for (const ua of ["facebookexternalhit/1.1", "Googlebot/2.1", "curl/8.0", "WhatsApp/2.23", "Slackbot-LinkExpanding 1.0", "", null]) {
      expect(parseUserAgent(ua).isBot, String(ua)).toBe(true);
    }
  });
});

describe("visitor hashing (privacy)", () => {
  it("is stable within a day, differs across days and never contains the IP", async () => {
    const { visitorHash } = await import("./scans");
    const d1 = new Date("2026-01-01T10:00:00Z");
    const d2 = new Date("2026-01-02T10:00:00Z");
    const a = visitorHash("203.0.113.7", "UA", d1);
    expect(a).toBe(visitorHash("203.0.113.7", "UA", new Date("2026-01-01T23:00:00Z")));
    expect(a).not.toBe(visitorHash("203.0.113.7", "UA", d2));
    expect(a).not.toBe(visitorHash("203.0.113.8", "UA", d1));
    expect(a).not.toContain("203");
    expect(a).toMatch(/^[0-9a-f]{24}$/);
  });
});
