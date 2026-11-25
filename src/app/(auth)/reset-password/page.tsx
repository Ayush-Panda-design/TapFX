import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert, Card, LinkButton } from "@/components/ui";
import { peekToken } from "@/lib/tokens";
import { resetPassword } from "../actions";
import { ResetForm } from "../token-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

async function Content({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  if (!(await peekToken(token, "reset"))) {
    return (
      <Card className="w-full max-w-md space-y-4 p-6 text-center sm:p-8">
        <Alert>This reset link is invalid or has expired.</Alert>
        <LinkButton href="/forgot-password">Request a new link</LinkButton>
      </Card>
    );
  }
  return <ResetForm action={resetPassword} token={token} />;
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
