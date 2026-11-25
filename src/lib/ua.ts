/** Minimal, dependency-free user-agent classifier for scan analytics and bot filtering. */

export type UaInfo = { device: "mobile" | "tablet" | "desktop"; os: string; browser: string; isBot: boolean };

const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|fetch|curl|wget|python-requests|httpclient|headless|lighthouse|pingdom|uptime|monitor|scanner|go-http-client|axios|node-fetch/i;

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? "";
  const isBot = s.length === 0 || BOT_RE.test(s);

  const device: UaInfo["device"] = /ipad|tablet|(android(?!.*mobile))/i.test(s)
    ? "tablet"
    : /mobi|iphone|ipod|android/i.test(s)
      ? "mobile"
      : "desktop";

  const os = /windows/i.test(s)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(s)
      ? "iOS"
      : /android/i.test(s)
        ? "Android"
        : /mac os x|macintosh/i.test(s)
          ? "macOS"
          : /cros/i.test(s)
            ? "ChromeOS"
            : /linux/i.test(s)
              ? "Linux"
              : "Other";

  // Order matters: Edge/Opera/Samsung include "Chrome"; Chrome includes "Safari".
  const browser = /edg(e|a|ios)?\//i.test(s)
    ? "Edge"
    : /opr\/|opera/i.test(s)
      ? "Opera"
      : /samsungbrowser/i.test(s)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(s)
          ? "Firefox"
          : /chrome|crios/i.test(s)
            ? "Chrome"
            : /safari/i.test(s)
              ? "Safari"
              : "Other";

  return { device, os, browser, isBot };
}
