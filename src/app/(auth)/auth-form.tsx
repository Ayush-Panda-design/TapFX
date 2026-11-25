"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import type { FormState } from "./actions";

export function AuthForm({
  mode,
  action,
  notice,
}: {
  notice?: string;
  mode: "login" | "signup";
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const signup = mode === "signup";

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {signup ? "Free forever for the essentials. No credit card." : "Sign in to manage your QR codes."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        {notice && !state && <Alert kind="success">{notice}</Alert>}
        {state?.error && <Alert>{state.error}</Alert>}
        {signup && (
          <Field label="Name">
            <Input name="name" autoComplete="name" required maxLength={80} />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required maxLength={254} />
        </Field>
        <Field label="Password" hint={signup ? "At least 10 characters." : undefined}>
          <Input
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 10 : 1}
            maxLength={128}
          />
        </Field>
        {!signup && (
          <div className="-mt-2 text-right text-sm">
            <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {signup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}
