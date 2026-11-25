import type { Metadata } from "next";
import { QrDesigner } from "@/components/qr/designer";
import { env } from "@/lib/env";
import { saveQr } from "../actions";

export const metadata: Metadata = { title: "New QR code" };

export default function NewQrPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">New QR code</h1>
      <QrDesigner mode="create" appUrl={env.APP_URL.replace(/\/$/, "")} saveAction={saveQr} />
    </div>
  );
}
