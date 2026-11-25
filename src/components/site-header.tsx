import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { BRAND } from "@/lib/brand";
import { getUser } from "@/lib/session";
import { ThemeToggle } from "./theme-toggle";
import { Button, LinkButton } from "./ui";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h3v3h-3v-3Zm5 0h3v3h-3v-3Zm-5 5h3v3h-3v-3Zm5 0h3v3h-3v-3Z" />
        </svg>
      </span>
      <span className="text-lg">{BRAND.name}</span>
    </Link>
  );
}

/**
 * The header reads the session cookie (request-time data), so it renders inside <Suspense>.
 * The rest of every page can still be prerendered as a static shell.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Suspense fallback={<div className="h-10 w-48" aria-hidden />}>
            <HeaderNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function HeaderNav() {
  const user = await getUser();
  return (
    <nav className="flex items-center gap-2">
      {user ? (
        <>
          <LinkButton href="/dashboard" variant="ghost">
            Dashboard
          </LinkButton>
          <form action={logout}>
            <Button variant="secondary" type="submit">
              Sign out
            </Button>
          </form>
        </>
      ) : (
        <>
          <LinkButton href="/login" variant="ghost">
            Sign in
          </LinkButton>
          <LinkButton href="/signup">Get started free</LinkButton>
        </>
      )}
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {BRAND.name}. QR Code is a registered trademark of DENSO WAVE INCORPORATED.
        </p>
        <nav className="flex gap-4">
          <Link href="/report" className="hover:text-foreground">
            Report abuse
          </Link>
        </nav>
      </div>
    </footer>
  );
}
