import { Suspense, type ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/session";
import { VerifyBanner } from "./verify-banner";

/** Real authorization check (the proxy only does a cheap cookie-presence redirect). */
async function AuthGuard({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      {!user.verified && <VerifyBanner email={user.email} />}
      {children}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<PageSkeleton />}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
