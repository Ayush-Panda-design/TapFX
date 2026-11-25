import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { QrDesigner } from "@/components/qr/designer";
import { getAnalytics } from "@/lib/analytics";
import { env } from "@/lib/env";
import type { QrContentType } from "@/lib/qr/content";
import { shortUrlFor } from "@/lib/qr/resolve";
import { styleSchema } from "@/lib/qr/style";
import { requireUser } from "@/lib/session";
import { saveQr } from "../actions";
import { DangerZone } from "./danger-zone";

export const metadata: Metadata = { title: "Edit QR code" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function QrDetailPage({ params, searchParams }: PageProps<"/dashboard/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Owner-scoped: another user's id returns "not found", never their data.
  const qr = await db
    .select()
    .from(schema.qrCodes)
    .where(and(eq(schema.qrCodes.id, id), eq(schema.qrCodes.userId, user.id)))
    .get();
  if (!qr) notFound();

  const sp = await searchParams;
  const range = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const dynamic = qr.kind === "dynamic";
  const analytics = dynamic ? await getAnalytics(qr.id, range) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          ← All QR codes
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{qr.name}</h1>
        {dynamic && qr.shortCode && (
          <p className="mt-1 text-sm text-muted-foreground">
            Short link: <span className="font-mono">{shortUrlFor(qr.shortCode)}</span>
            {qr.status === "paused" && <span className="ml-2 rounded-md bg-danger-soft px-1.5 py-0.5 text-xs text-danger">paused</span>}
          </p>
        )}
      </div>

      <QrDesigner
        mode="edit"
        appUrl={env.APP_URL.replace(/\/$/, "")}
        saveAction={saveQr}
        initial={{
          id: qr.id,
          name: qr.name,
          kind: qr.kind,
          contentType: qr.contentType as QrContentType,
          content: qr.content as Record<string, unknown>,
          style: styleSchema.parse(qr.style),
          shortUrl: qr.shortCode ? shortUrlFor(qr.shortCode) : null,
        }}
      />

      {analytics && <AnalyticsPanel data={analytics} basePath={`/dashboard/${qr.id}`} />}

      <DangerZone id={qr.id} status={qr.status} dynamic={dynamic} />
    </div>
  );
}
