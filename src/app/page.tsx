import { QrDesigner } from "@/components/qr/designer";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";

const FEATURES = [
  {
    title: "Change it after you print it",
    text: "Dynamic QR codes point to a short link you control. Fix a typo or swap the page without reprinting a single flyer.",
  },
  {
    title: "See who scans",
    text: "Scans over time, countries, devices and browsers. Bots and link-preview crawlers are filtered out so the numbers are real.",
  },
  {
    title: "Designed to scan, every time",
    text: "Every design is test-decoded as you edit it. If a style would be unreliable on a phone, you'll know before you print.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
          <div className="max-w-2xl">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{BRAND.tagline}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{BRAND.description}</p>
          </div>
        </section>

        <section id="generator" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <QrDesigner mode="public" appUrl={env.APP_URL.replace(/\/$/, "")} />
        </section>

        <section className="border-t border-border/70 bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6">
                <h2 className="text-lg font-semibold tracking-tight">{f.title}</h2>
                <p className="mt-2 text-muted-foreground">{f.text}</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
