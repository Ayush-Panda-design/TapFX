import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert, Card, LinkButton } from "@/components/ui";
import { peekToken } from "@/lib/tokens";
import { confirmEmail } from "../actions";
import { ConfirmForm } from "../token-forms";

export const metadata: Metadata = { title: "Confirm email", robots: { index: false } };

/**
 * Confirmation needs a button press (a POST) rather than happening on page load, so email security
 * scanners and link previews that open the URL can't use up the one-time token.
 */
async function Content({ searchParams }: { searchParams: PageProps<"/verify-email">["searchParams"] }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  if (!(await peekToken(token, "verify"))) {
    return (
      <Card className="w-full max-w-md space-y-4 p-6 text-center sm:p-8">
        <Alert>This link is invalid, expired or already used.</Alert>
        <LinkButton href="/dashboard">Go to dashboard</LinkButton>
      </Card>
    );
  }
  return <ConfirmForm action={confirmEmail} token={token} />;
}

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
