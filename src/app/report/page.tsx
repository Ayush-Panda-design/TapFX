import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report abuse" };

export default function ReportPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Report a harmful QR code</h1>
          <p className="mb-6 mt-1.5 text-sm text-muted-foreground">
            QR codes can be misused for phishing and scams. If a code created here led you somewhere harmful, tell us and we&apos;ll investigate.
          </p>
          <ReportForm />
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
