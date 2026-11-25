import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "QR code unavailable", robots: { index: false, follow: false } };

async function Message({ searchParams }: { searchParams: PageProps<"/qr-unavailable">["searchParams"] }) {
  const { reason } = await searchParams;
  const paused = reason === "paused";
  return (
    <Card className="max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{paused ? "This QR code is paused" : "This QR code doesn't exist"}</h1>
      <p className="mt-2 text-muted-foreground">
        {paused
          ? "The owner has temporarily turned this code off. Please check back later."
          : "The link may have been deleted or mistyped. Ask whoever shared it for an updated code."}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <LinkButton href="/">Make your own QR code</LinkButton>
        <LinkButton href="/report" variant="secondary">
          Report a problem
        </LinkButton>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Seen something harmful? <Link href="/report" className="underline">Report abuse</Link>.
      </p>
    </Card>
  );
}

export default function Unavailable({ searchParams }: PageProps<"/qr-unavailable">) {
  return (
    <>
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <Suspense fallback={null}>
          <Message searchParams={searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
