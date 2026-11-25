import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/session";
import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

async function Gate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  if (await getUser()) redirect("/dashboard");
  const reset = (await searchParams).reset === "1";
  return <AuthForm mode="login" action={login} notice={reset ? "Password updated. Sign in with your new password." : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}
