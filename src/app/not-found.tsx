import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Card, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="grid flex-1 place-items-center px-4 py-16">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-2 text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
          <div className="mt-6">
            <LinkButton href="/">Go home</LinkButton>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
