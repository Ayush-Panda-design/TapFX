import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/session";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create account" };

async function Gate() {
  if (await getUser()) redirect("/dashboard");
  return <AuthForm mode="signup" action={signup} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  );
}
