import { eq } from "drizzle-orm";
import { after, NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { env } from "@/lib/env";
import { SHORT_CODE_RE } from "@/lib/ids";
import { recordScan } from "@/lib/scans";

// Route handlers that read the request are evaluated per request, and we send no-store so a cached
// redirect can never defeat editing or analytics.
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

function unavailable(reason: "notfound" | "paused") {
  const url = new URL(`/qr-unavailable?reason=${reason}`, env.APP_URL);
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}

export async function GET(req: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!SHORT_CODE_RE.test(code)) return unavailable("notfound");

  const qr = await db
    .select({ id: schema.qrCodes.id, destination: schema.qrCodes.destination, status: schema.qrCodes.status })
    .from(schema.qrCodes)
    .where(eq(schema.qrCodes.shortCode, code))
    .get();

  if (!qr || !qr.destination) return unavailable("notfound");
  if (qr.status === "paused") return unavailable("paused");

  // Count the scan after the response is on its way; never block the redirect on analytics.
  const h = req.headers;
  after(() =>
    recordScan({
      qrId: qr.id,
      ip: h.get("x-real-ip") || h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
      userAgent: h.get("user-agent"),
      referrer: h.get("referer"),
      country: h.get("x-vercel-ip-country") || h.get("cf-ipcountry"),
    }),
  );

  // 302 (not 301): browsers must not cache it, so edits take effect immediately.
  return NextResponse.redirect(qr.destination, { status: 302, headers: NO_STORE });
}

// HEAD requests (link previews, uptime checks) get the same routing but are never counted as scans.
export async function HEAD(req: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!SHORT_CODE_RE.test(code)) return new NextResponse(null, { status: 404, headers: NO_STORE });
  const qr = await db.select({ d: schema.qrCodes.destination }).from(schema.qrCodes).where(eq(schema.qrCodes.shortCode, code)).get();
  return new NextResponse(null, { status: qr?.d ? 302 : 404, headers: NO_STORE });
}
